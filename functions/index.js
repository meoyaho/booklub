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
const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const SUMMARY_MODEL = 'gpt-5-nano';
const MAX_TRANSCRIPT_CHARS = 55000;

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
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
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    throw new HttpsError('not-found', '녹음본 파일을 찾을 수 없습니다.');
  }

  const extension = inferExtension(storagePath, contentType);
  const tempDir = path.join(tmpdir(), `reading-club-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const filename = `recording.${extension}`;
  const tempPath = path.join(tempDir, filename);
  await file.download({ destination: tempPath });

  return { tempDir, tempPath };
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
    const bookId = asString(data.bookId);
    const storagePath = asString(data.storagePath);
    const recordingUrl = asString(data.recordingUrl);
    const contentType = asString(data.contentType);
    const book = safeBookPayload(data.book);

    if (!bookId || !storagePath) {
      throw new HttpsError('invalid-argument', '책 ID와 녹음본 경로가 필요합니다.');
    }

    if (!storagePath.startsWith(`recordings/${bookId}/`)) {
      throw new HttpsError('permission-denied', '이 책의 녹음본 경로만 분석할 수 있습니다.');
    }

    let tempDir = '';

    try {
      const downloaded = await downloadRecording(storagePath, contentType);
      tempDir = downloaded.tempDir;

      const openai = new OpenAI({ apiKey: openaiApiKey.value() });
      const transcription = await openai.audio.transcriptions.create({
        file: createReadStream(downloaded.tempPath),
        model: TRANSCRIPTION_MODEL,
        language: 'ko',
        response_format: 'json',
      });

      const transcript = transcriptText(transcription);
      if (!transcript) {
        throw new HttpsError('internal', '전사문을 생성하지 못했습니다.');
      }

      const prompt = buildSummaryPrompt(book, clampTranscript(transcript));
      const response = await openai.responses.create({
        model: SUMMARY_MODEL,
        input: prompt,
        max_output_tokens: 420,
      });

      const summary = asString(response.output_text);
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
        analysisMeta: {
          transcriptionModel: TRANSCRIPTION_MODEL,
          summaryModel: SUMMARY_MODEL,
          transcriptCharCount: transcript.length,
          transcriptWasTrimmed: transcript.length > MAX_TRANSCRIPT_CHARS,
        },
        analyzedAt: FieldValue.serverTimestamp(),
      };

      await getFirestore().doc(`books/${bookId}`).update(update);

      return {
        recordingUrl,
        recordingPath: storagePath,
        summary,
        status: 'reviewing',
        reviews: [],
        avgRating: 0,
        participantCount: book.participantCount || 0,
        analysisMeta: update.analysisMeta,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', err?.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  },
);
