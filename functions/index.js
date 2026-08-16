import { createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import OpenAI from 'openai';

initializeApp();

const openaiApiKey = defineSecret('OPENAI_API_KEY');

const REGION = 'us-central1';
const STORAGE_BUCKET = 'reading-club-284ae.firebasestorage.app';
const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const SUMMARY_MODEL = 'gpt-5-nano';
const FALLBACK_SUMMARY_MODEL = 'gpt-4.1-nano-2025-04-14';
const MAX_TRANSCRIPT_CHARS = 55000;

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeId(value) {
  return /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

function safeBookPayload(book = {}) {
  return {
    title: asString(book.title) || '제목 없음',
    authors: asString(book.authors) || '작가 정보 없음',
    publisher: asString(book.publisher),
    publishedDate: asString(book.publishedDate),
    participantCount: Number(book.participantCount || 0) || 0,
  };
}

function inferExtension(storagePath = '', contentType = '') {
  const ext = path.extname(storagePath).toLowerCase().replace('.', '');
  if (ext) return ext;

  const mimeExtension = {
    'audio/flac': 'flac',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
  }[contentType];

  return mimeExtension || 'webm';
}

function transcriptText(transcription) {
  if (typeof transcription === 'string') return transcription.trim();
  if (typeof transcription?.text === 'string') return transcription.text.trim();
  return '';
}

function responseText(response) {
  const direct = asString(response?.output_text);
  if (direct) return direct;

  const chunks = [];
  const collect = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (text) chunks.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value !== 'object') return;

    const text = asString(value.text) || asString(value.output_text);
    if (text) chunks.push(text);

    if (Array.isArray(value.content)) collect(value.content);
    if (Array.isArray(value.message?.content)) collect(value.message.content);
    if (Array.isArray(value.choices)) collect(value.choices);
  };

  collect(response?.output);
  collect(response?.choices);
  return chunks.join('\n').trim();
}

function responseDiagnostic(response) {
  return {
    status: response?.status || null,
    incompleteDetails: response?.incomplete_details || null,
    usage: response?.usage || null,
    output: Array.isArray(response?.output)
      ? response.output.map((item) => ({
        type: item?.type || null,
        status: item?.status || null,
        role: item?.role || null,
        contentTypes: Array.isArray(item?.content)
          ? item.content.map((content) => content?.type || null)
          : [],
      }))
      : [],
  };
}

function clampTranscript(transcript) {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  return transcript.slice(0, MAX_TRANSCRIPT_CHARS);
}

function buildSummaryPrompt(book, transcript) {
  const participantLine = book.participantCount > 0
    ? `${book.participantCount}명`
    : '알 수 없음';

  return [
    '너는 한국어 독서 전문 잡지의 에디터다.',
    '아래 독서모임 전사문을 바탕으로 책에 대한 대화의 분위기, 핵심 쟁점, 인상적인 해석을 짧은 잡지 서평처럼 요약해라.',
    '',
    '조건:',
    '- 한국어로 작성한다.',
    '- 실제 전사문에 있는 내용만 사용하고, 없는 사실은 만들지 않는다.',
    '- 회의록처럼 항목화하지 말고 문학 잡지의 리뷰 코너처럼 자연스러운 한 단락으로 쓴다.',
    '- 4~6문장으로 쓴다.',
    '- 참석자 수가 주어지면 필요할 때만 자연스럽게 반영한다.',
    '- 개인 이름이 명확하지 않으면 이름을 만들지 않는다.',
    '- 제목이나 설명 없이 요약문만 출력한다.',
    '',
    `책 제목: ${book.title}`,
    `저자: ${book.authors}`,
    `출판사: ${book.publisher || '알 수 없음'}`,
    `출간일: ${book.publishedDate || '알 수 없음'}`,
    `참석 인원수: ${participantLine}`,
    '',
    '전사문:',
    transcript,
  ].join('\n');
}

async function downloadRecording(storagePath, contentType) {
  const bucket = getStorage().bucket(STORAGE_BUCKET);
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError('not-found', '녹음본 파일을 찾을 수 없습니다.');
  }

  const [metadata] = await file.getMetadata();
  const size = Number(metadata?.size || 0);
  if (!size) {
    throw new HttpsError('failed-precondition', '녹음본 파일이 비어 있습니다. 다시 녹음하거나 다른 음성 파일을 올려주세요.');
  }

  const extension = inferExtension(storagePath, contentType);
  const tempDir = path.join(tmpdir(), `reading-club-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const filename = `recording.${extension}`;
  const tempPath = path.join(tempDir, filename);
  await file.download({ destination: tempPath });

  return { tempDir, tempPath, size };
}

function logAnalyzeError(err, context) {
  console.error('analyzeRecording failed', JSON.stringify({
    ...context,
    name: err?.name,
    code: err?.code,
    status: err?.status,
    type: err?.type,
    message: err?.message,
    stack: err?.stack,
  }));
}

function toClientError(err) {
  if (err instanceof HttpsError) return err;

  const message = asString(err?.message);
  const status = Number(err?.status || 0);

  if (status === 401) {
    return new HttpsError('failed-precondition', 'OpenAI API 키가 없거나 올바르지 않습니다. Firebase Functions secret의 OPENAI_API_KEY를 확인해주세요.');
  }

  if (status === 403) {
    return new HttpsError('permission-denied', 'OpenAI API 사용 권한이 없습니다. API 키의 프로젝트 권한과 결제 설정을 확인해주세요.');
  }

  if (status === 404 && /model/i.test(message)) {
    return new HttpsError('failed-precondition', 'OpenAI 모델을 사용할 수 없습니다. 모델 이름 또는 프로젝트 접근 권한을 확인해주세요.');
  }

  if (status === 429) {
    return new HttpsError('resource-exhausted', 'OpenAI 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
  }

  return new HttpsError('internal', message || 'AI 분석 중 오류가 발생했습니다.');
}

async function createMagazineSummary(openai, prompt, context) {
  const primary = await openai.responses.create({
    model: SUMMARY_MODEL,
    input: prompt,
    reasoning: { effort: 'minimal' },
    max_output_tokens: 900,
  });
  const primarySummary = responseText(primary);
  if (primarySummary) {
    return {
      summary: primarySummary,
      model: SUMMARY_MODEL,
      usedFallback: false,
    };
  }

  console.error('summary response had no text', JSON.stringify({
    ...context,
    model: SUMMARY_MODEL,
    diagnostic: responseDiagnostic(primary),
  }));

  const fallback = await openai.responses.create({
    model: FALLBACK_SUMMARY_MODEL,
    input: prompt,
    max_output_tokens: 700,
  });
  const fallbackSummary = responseText(fallback);
  if (fallbackSummary) {
    return {
      summary: fallbackSummary,
      model: FALLBACK_SUMMARY_MODEL,
      usedFallback: true,
    };
  }

  console.error('fallback summary response had no text', JSON.stringify({
    ...context,
    model: FALLBACK_SUMMARY_MODEL,
    diagnostic: responseDiagnostic(fallback),
  }));

  return {
    summary: '',
    model: FALLBACK_SUMMARY_MODEL,
    usedFallback: true,
  };
}

export const analyzeRecording = onCall(
  {
    region: REGION,
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [openaiApiKey],
  },
  async (request) => {
    const data = request.data || {};
    const clubId = asString(data.clubId);
    const bookId = asString(data.bookId);
    const storagePath = asString(data.storagePath);
    const recordingUrl = asString(data.recordingUrl);
    const contentType = asString(data.contentType);
    const book = safeBookPayload(data.book);

    if (!clubId || !bookId || !storagePath) {
      throw new HttpsError('invalid-argument', '독서모임 ID, 책 ID와 녹음본 경로가 필요합니다.');
    }

    if (!isSafeId(clubId) || !isSafeId(bookId)) {
      throw new HttpsError('invalid-argument', '올바르지 않은 독서모임 또는 책 ID입니다.');
    }

    if (!storagePath.startsWith(`recordings/${clubId}/${bookId}/`)) {
      throw new HttpsError('permission-denied', '이 책의 녹음본 경로만 분석할 수 있습니다.');
    }

    let tempDir = '';
    let stage = 'download-recording';

    try {
      const downloaded = await downloadRecording(storagePath, contentType);
      tempDir = downloaded.tempDir;

      stage = 'transcribe-recording';
      const openai = new OpenAI({ apiKey: openaiApiKey.value() });
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(downloaded.tempPath),
        model: TRANSCRIPTION_MODEL,
        language: 'ko',
        response_format: 'json',
      });

      const transcript = transcriptText(transcription);
      if (!transcript) {
        throw new HttpsError('failed-precondition', '녹음에서 분석할 음성을 찾지 못했습니다. 파일이 비어 있거나 말소리가 너무 작을 수 있습니다.');
      }

      stage = 'summarize-transcript';
      const prompt = buildSummaryPrompt(book, clampTranscript(transcript));
      const summaryResult = await createMagazineSummary(openai, prompt, {
        bookId,
        storagePath,
        contentType,
        stage,
      });
      const summary = asString(summaryResult.summary);
      if (!summary) {
        throw new HttpsError('internal', '요약문을 생성하지 못했습니다.');
      }

      const update = {
        recordingUrl,
        recordingPath: storagePath,
        summary,
        status: 'reviewing',
        reviews: [],
        avgRating: 0,
        participantCount: book.participantCount || 0,
        analysisError: '',
        analysisMeta: {
          transcriptionModel: TRANSCRIPTION_MODEL,
          summaryModel: summaryResult.model,
          summaryUsedFallback: summaryResult.usedFallback,
          transcriptCharCount: transcript.length,
          transcriptWasTrimmed: transcript.length > MAX_TRANSCRIPT_CHARS,
        },
        analyzedAt: FieldValue.serverTimestamp(),
      };

      await getFirestore().doc(`clubs/${clubId}/books/${bookId}`).update(update);

      return {
        recordingUrl,
        recordingPath: storagePath,
        summary,
        status: 'reviewing',
        reviews: [],
        avgRating: 0,
        participantCount: book.participantCount || 0,
        analysisError: '',
        analysisMeta: update.analysisMeta,
      };
    } catch (err) {
      logAnalyzeError(err, {
        bookId,
        clubId,
        storagePath,
        contentType,
        stage,
        bucket: STORAGE_BUCKET,
      });
      throw toClientError(err);
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  },
);
