# 공유 이미지 / 토론시간 / 모임 날짜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세 화면에 "공유"(카드 이미지 생성) 링크와 "토론시간"/"날짜" 필드를 추가하고, 녹음/업로드 흐름에서 이 데이터를 수집·저장한다.

**Architecture:** 정적 사이트(빌드 없음). Firestore는 스키마리스이므로 새 필드(`meetingDate`, `discussionDurationSeconds`)는 마이그레이션 없이 바로 쓴다. `functions/index.js`(분석 클라우드 함수)는 건드리지 않고, 분석 완료 후 클라이언트에서 별도 `updateBook()` 호출로 새 필드만 저장한다. 순수 포맷팅 로직(초→문자열, 날짜→문자열)은 별도 모듈로 분리해 유닛 테스트한다.

**Tech Stack:** Vanilla JS (ES modules), Canvas API(공유 카드), Firebase Firestore, `node --test`.

## Global Constraints

- `functions/index.js`, `firestore.rules`는 수정하지 않는다.
- 기존에 `meetingDate`/`discussionDurationSeconds`가 없는 책(과거 데이터)은 상세 화면에서 해당 줄을 아예 숨긴다 — 빈 값을 노출하지 않는다.
- `meetingDate`는 시간대 문제를 피하기 위해 항상 로컬 캘린더 날짜 문자열 `"YYYY-MM-DD"` 형식으로 저장한다 (UTC ISO 타임스탬프 사용 금지 — `toISOString()` 쓰지 않음).
- 실제 프로덕션 Firebase에 테스트 데이터를 쓰지 않는다 — 브라우저 검증은 모의 `book`/`handlers` 객체로 렌더 함수를 직접 호출하는 방식을 쓴다 (이전 리디자인 작업에서 쓴 방식과 동일).
- 커밋은 태스크 단위로 작게 나눈다.

---

## 파일 구조 개요

| 파일 | 역할 |
|---|---|
| `js/meetingFormat.js` | **신규.** 순수 함수: 로컬 날짜 인코딩(`toLocalDateString`), 초→"N시간 M분 S초"(`formatDurationSeconds`), "YYYY-MM-DD"→"N년 N월 N일 요일"(`formatMeetingDate`) |
| `test/meetingFormat.test.js` | **신규.** 위 함수들의 유닛 테스트 |
| `js/shareCard.js` | **신규.** 캔버스로 공유 카드 PNG 생성 + 다운로드/`navigator.share` 처리 |
| `js/app.js` | 녹음 시작/종료 시각 기록, `runAnalysis` 시그니처 확장, 업로드 흐름에 오디오 길이 읽기+날짜 모달 연결, 공유 카드 트리거 핸들러 추가 |
| `js/bookSlider.js` | 상세 화면에 토론시간/날짜 표시, 상단바에 "공유" 링크 추가, 업로드용 날짜 입력 모달 렌더 함수 추가 |
| `css/style.css` | 새 메타 정보 줄, 날짜 입력 모달 스타일 |

---

## Task 1: 순수 포맷팅 함수 (`js/meetingFormat.js`)

TDD로 작성. DOM/Firebase 의존성 없는 순수 함수라 `node --test`로 바로 검증 가능.

**Files:**
- Create: `js/meetingFormat.js`
- Test: `test/meetingFormat.test.js`

**Interfaces:**
- Produces:
  - `export function toLocalDateString(date: Date): string` — 로컬 타임존 기준 `"YYYY-MM-DD"` 문자열 반환.
  - `export function formatDurationSeconds(totalSeconds: number): string` — `"N시간 M분 S초"` / `"M분 S초"` / `"S초"` 형태. 1시간 이상이면 항상 시/분/초 다 표시, 1시간 미만 1분 이상이면 분/초만, 1분 미만이면 초만. 음수/NaN/undefined는 `0`으로 취급.
  - `export function formatMeetingDate(dateString: string): string` — `"YYYY-MM-DD"` 입력을 `"N년 N월 N일 요일"`로 변환 (예: `"2026-03-27"` → `"2026년 3월 27일 금요일"`). 파싱 실패 시 빈 문자열 반환.
- Task 2, 3, 4가 이 세 함수를 그대로 import해서 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/meetingFormat.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalDateString, formatDurationSeconds, formatMeetingDate } from '../js/meetingFormat.js';

test('toLocalDateString: 로컬 날짜를 YYYY-MM-DD로', () => {
  assert.equal(toLocalDateString(new Date(2026, 2, 27)), '2026-03-27');
  assert.equal(toLocalDateString(new Date(2026, 0, 5)), '2026-01-05');
});

test('formatDurationSeconds: 1시간 이상은 시/분/초 모두 표시', () => {
  assert.equal(formatDurationSeconds(9315), '2시간 35분 15초');
});

test('formatDurationSeconds: 1시간 미만 1분 이상은 분/초만', () => {
  assert.equal(formatDurationSeconds(95), '1분 35초');
});

test('formatDurationSeconds: 1분 미만은 초만', () => {
  assert.equal(formatDurationSeconds(45), '45초');
});

test('formatDurationSeconds: 0/음수/NaN은 0초', () => {
  assert.equal(formatDurationSeconds(0), '0초');
  assert.equal(formatDurationSeconds(-5), '0초');
  assert.equal(formatDurationSeconds(NaN), '0초');
  assert.equal(formatDurationSeconds(undefined), '0초');
});

test('formatMeetingDate: 정상 날짜 문자열 변환', () => {
  assert.equal(formatMeetingDate('2026-03-27'), '2026년 3월 27일 금요일');
  assert.equal(formatMeetingDate('2026-01-01'), '2026년 1월 1일 목요일');
});

test('formatMeetingDate: 잘못된 입력은 빈 문자열', () => {
  assert.equal(formatMeetingDate(''), '');
  assert.equal(formatMeetingDate('not-a-date'), '');
  assert.equal(formatMeetingDate(undefined), '');
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
node --test test/meetingFormat.test.js
```
Expected: FAIL (`js/meetingFormat.js` 모듈 없음).

- [ ] **Step 3: 구현**

`js/meetingFormat.js`:

```js
// js/meetingFormat.js
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function toLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDurationSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분 ${secs}초`;
  if (minutes > 0) return `${minutes}분 ${secs}초`;
  return `${secs}초`;
}

export function formatMeetingDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return '';
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return '';
  return `${Number(y)}년 ${Number(m)}월 ${Number(d)}일 ${WEEKDAYS[date.getDay()]}요일`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test test/meetingFormat.test.js
```
Expected: 전체 PASS.

```bash
npm test
```
Expected: 기존 테스트 포함 전체 PASS.

- [ ] **Step 5: Commit**

```bash
git add js/meetingFormat.js test/meetingFormat.test.js
git commit -m "$(cat <<'EOF'
토론시간/모임 날짜 포맷팅 순수 함수 추가

초 단위 길이를 "N시간 M분 S초"로, "YYYY-MM-DD" 날짜를
"N년 N월 N일 요일"로 변환하는 순수 함수 추가. 시간대 문제를
피하기 위해 날짜는 항상 로컬 캘린더 날짜 문자열로 다룬다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 실시간 녹음 흐름 — 시작/종료 시각 기록 및 저장

**Files:**
- Modify: `js/app.js` (`startMeeting`, `finishMeeting`, `runAnalysis`, 상단 상태 변수 블록, import)

**Interfaces:**
- Consumes: `js/meetingFormat.js`의 `toLocalDateString`.
- Produces: `runAnalysis(blob, meta = {})` — 두 번째 인자로 `{ meetingDate?: string, discussionDurationSeconds?: number }`를 받도록 시그니처 확장 (기존 호출부 `runAnalysis(blob)`도 `meta`가 `{}`로 기본값 처리되어 그대로 동작). Task 3의 업로드 흐름이 같은 시그니처를 사용한다.

- [ ] **Step 1: import 및 상태 변수 추가**

`js/app.js` 상단 import에 추가:

```js
import { toLocalDateString } from './meetingFormat.js';
```

`let uploadedFile = null;` 바로 아래에 추가:

```js
let meetingStartedAt = null;
```

- [ ] **Step 2: `startMeeting`에 시작 시각 기록**

`startMeeting` 함수에서 `mainView = 'meeting-active';` 바로 위에 추가:

```js
  meetingStartedAt = Date.now();
```

- [ ] **Step 3: `finishMeeting`에서 종료 시각 계산 후 `runAnalysis`에 전달**

`finishMeeting` 함수 안, 기존:

```js
    mainView = 'detail';
    setLogoMode('docked');
    renderMain();
    await runAnalysis(blob);
```

를 아래로 교체:

```js
    mainView = 'detail';
    setLogoMode('docked');
    renderMain();

    const meta = {};
    if (meetingStartedAt) {
      meta.meetingDate = toLocalDateString(new Date(meetingStartedAt));
      meta.discussionDurationSeconds = Math.round((Date.now() - meetingStartedAt) / 1000);
    }
    meetingStartedAt = null;

    await runAnalysis(blob, meta);
```

- [ ] **Step 4: `runAnalysis` 시그니처 확장 및 저장 로직 추가**

`async function runAnalysis(blob) {`를 `async function runAnalysis(blob, meta = {}) {`로 변경.

성공 경로에서, 기존:

```js
    allBooks = allBooks.map((entry) => (
      entry.id === currentBookId
        ? { ...entry, ...analysisUpdate }
        : entry
    ));
    mainView = 'detail';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
```

를 아래로 교체 (분석 결과 반영 후 이어서 `meetingDate`/`discussionDurationSeconds`를 별도로 저장):

```js
    allBooks = allBooks.map((entry) => (
      entry.id === currentBookId
        ? { ...entry, ...analysisUpdate }
        : entry
    ));
    mainView = 'detail';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');

    if (meta.meetingDate || meta.discussionDurationSeconds != null) {
      const extra = {};
      if (meta.meetingDate) extra.meetingDate = meta.meetingDate;
      if (meta.discussionDurationSeconds != null) extra.discussionDurationSeconds = meta.discussionDurationSeconds;
      try {
        await updateBook(currentClubId, currentBookId, extra);
        allBooks = allBooks.map((entry) => (
          entry.id === currentBookId ? { ...entry, ...extra } : entry
        ));
        renderMain();
      } catch (err) {
        console.warn('모임 날짜/토론시간 저장 실패', err);
      }
    }
  } catch (err) {
```

실패(분석 실패, 수동 작성으로 전환) 경로에서, 기존 `manualUpdate` 객체 정의:

```js
      const manualUpdate = {
        recordingUrl: recording.url,
        recordingPath: recording.path,
        summary: book?.summary || '',
        status: 'reviewing',
        reviews: book?.reviews || [],
        avgRating: Number(book?.avgRating || 0),
        participantCount: Number(book?.participantCount || 0),
        analysisError: message,
        analysisMeta: {
          ...(book?.analysisMeta || {}),
          analysisFailed: true,
          analysisError: message,
        },
      };
```

를 아래로 교체 (녹음/업로드 자체는 성공했으므로 분석 실패와 무관하게 날짜/시간은 저장):

```js
      const manualUpdate = {
        recordingUrl: recording.url,
        recordingPath: recording.path,
        summary: book?.summary || '',
        status: 'reviewing',
        reviews: book?.reviews || [],
        avgRating: Number(book?.avgRating || 0),
        participantCount: Number(book?.participantCount || 0),
        analysisError: message,
        analysisMeta: {
          ...(book?.analysisMeta || {}),
          analysisFailed: true,
          analysisError: message,
        },
        ...(meta.meetingDate ? { meetingDate: meta.meetingDate } : {}),
        ...(meta.discussionDurationSeconds != null ? { discussionDurationSeconds: meta.discussionDurationSeconds } : {}),
      };
```

- [ ] **Step 5: 회귀 확인**

```bash
npm test
```
Expected: 전체 PASS (이 태스크는 브라우저/Firebase 의존 로직이라 새 유닛 테스트는 없음 — 기존 테스트만 안 깨지면 됨).

`node --check js/app.js`로 문법 오류가 없는지 확인.

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "$(cat <<'EOF'
실시간 녹음 흐름에 모임 날짜/토론시간 자동 기록 추가

녹음 시작 시각을 기록해두었다가 종료 시 경과시간과 날짜를 계산,
분석 완료 후(또는 분석 실패 시에도) 별도 updateBook 호출로
meetingDate/discussionDurationSeconds를 저장한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 녹음본 업로드 흐름 — 오디오 길이 읽기 + 날짜 입력 모달

**Files:**
- Modify: `js/app.js` (업로드 파일 change 리스너, 신규 `readAudioDurationSeconds` 헬퍼, import)
- Modify: `js/bookSlider.js` (신규 `renderUploadDateModal`/`removeUploadDateModal`, export 추가)
- Modify: `css/style.css` (날짜 입력 모달 스타일)

**Interfaces:**
- Consumes: Task 2에서 확장된 `runAnalysis(blob, meta)`.
- Produces: `js/bookSlider.js`에서 `export function renderUploadDateModal({ onConfirm, onCancel })` — `onConfirm(dateString: string)`, `onCancel()` 콜백을 받는다. `dateString`은 `<input type="date">`의 값(`"YYYY-MM-DD"`)을 그대로 전달.

- [ ] **Step 1: `js/bookSlider.js`에 날짜 입력 모달 추가**

파일 끝(`export function renderBookSlider` 앞)에 추가:

```js
function removeUploadDateModal() {
  document.getElementById('upload-date-modal')?.remove();
}

export function renderUploadDateModal({ onConfirm, onCancel } = {}) {
  removeUploadDateModal();

  const overlay = document.createElement('div');
  overlay.id = 'upload-date-modal';
  overlay.className = 'rating-modal-overlay';

  const modal = document.createElement('section');
  modal.className = 'rating-modal upload-date-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '모임 날짜 입력');

  const label = document.createElement('p');
  label.className = 'upload-date-label';
  label.textContent = '이 녹음본의 모임 날짜를 입력해주세요';

  const form = document.createElement('form');
  form.className = 'upload-date-form';

  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'upload-date-input';
  input.required = true;
  const today = new Date();
  input.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const actions = document.createElement('div');
  actions.className = 'upload-date-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'detail-action-secondary';
  cancelButton.textContent = '취소';
  cancelButton.addEventListener('click', () => {
    removeUploadDateModal();
    onCancel?.();
  });

  const confirmButton = document.createElement('button');
  confirmButton.type = 'submit';
  confirmButton.className = 'detail-action-primary';
  confirmButton.textContent = '확인';

  actions.append(cancelButton, confirmButton);
  form.append(input, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value;
    removeUploadDateModal();
    onConfirm?.(value);
  });

  modal.append(label, form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  input.focus();
}
```

- [ ] **Step 2: `js/app.js`에 오디오 길이 읽기 헬퍼 추가**

import 문에서:

```js
import { renderBookSlider } from './bookSlider.js';
```

를:

```js
import { renderBookSlider, renderUploadDateModal } from './bookSlider.js';
```

로 변경.

`openUploadScreen` 함수 아래에 추가:

```js
function readAudioDurationSeconds(file) {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      const seconds = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      URL.revokeObjectURL(url);
      resolve(seconds);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
  });
}
```

- [ ] **Step 3: 업로드 파일 change 리스너 수정**

파일 하단, 기존:

```js
document.getElementById('upload-file-input').addEventListener('change', async (e) => {
  uploadedFile = e.target.files[0] || null;
  if (!uploadedFile) return;
  const fileToUpload = uploadedFile;
  try {
    await runAnalysis(fileToUpload);
    uploadedFile = null;
  } catch (err) {
    // runAnalysis already alerted the user and returned them to the main screen.
    uploadedFile = null;
  } finally {
    e.target.value = '';
  }
});
```

를 아래로 교체:

```js
document.getElementById('upload-file-input').addEventListener('change', async (e) => {
  uploadedFile = e.target.files[0] || null;
  if (!uploadedFile) return;
  const fileToUpload = uploadedFile;
  e.target.value = '';

  const discussionDurationSeconds = await readAudioDurationSeconds(fileToUpload);

  renderUploadDateModal({
    onConfirm: async (meetingDate) => {
      uploadedFile = null;
      try {
        await runAnalysis(fileToUpload, { meetingDate, discussionDurationSeconds });
      } catch (err) {
        // runAnalysis already alerted the user and returned them to the main screen.
      }
    },
    onCancel() {
      uploadedFile = null;
    },
  });
});
```

- [ ] **Step 4: CSS 추가**

`css/style.css`에 추가 (`.rating-modal-form` 근처):

```css
.upload-date-label {
  margin-bottom: 16px;
  font-weight: 800;
}

.upload-date-form {
  display: grid;
  gap: 14px;
}

.upload-date-input {
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0 10px;
  font-family: inherit;
}

.upload-date-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
```

- [ ] **Step 5: 수동 확인**

```bash
npm test
```
Expected: PASS.

모의 harness(이전 태스크들과 동일한 방식)로 `renderUploadDateModal({ onConfirm: console.log, onCancel: () => console.log('cancel') })`을 직접 호출해 모달이 뜨는지, 날짜 입력 후 확인/취소가 콜백을 올바르게 호출하는지 헤드리스 브라우저로 확인한다.

- [ ] **Step 6: Commit**

```bash
git add js/app.js js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
녹음본 업로드 흐름에 날짜 입력 모달 및 오디오 길이 자동 계산 추가

업로드된 파일의 재생 길이를 읽어 토론시간으로 쓰고, 실시간
시작/종료가 없는 업로드 특성상 모임 날짜는 작은 모달로 직접
입력받는다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 상세 화면에 토론시간/날짜 표시

**Files:**
- Modify: `js/bookSlider.js` (`renderDetailWithBook`, import)
- Modify: `css/style.css` (`.detail-meta-row` 등)

**Interfaces:**
- Consumes: Task 1의 `formatDurationSeconds`, `formatMeetingDate`.

- [ ] **Step 1: import 추가**

`js/bookSlider.js` 상단에 추가:

```js
import { formatDurationSeconds, formatMeetingDate } from './meetingFormat.js';
```

- [ ] **Step 2: 메타 정보 줄 생성 헬퍼 추가**

`createStars` 함수 근처(파일 상단 헬퍼 구역)에 추가:

```js
function createMetaRow(label, value) {
  const row = document.createElement('p');
  row.className = 'detail-meta-row';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'detail-meta-label';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'detail-meta-value';
  valueSpan.textContent = value;

  row.append(labelSpan, valueSpan);
  return row;
}
```

- [ ] **Step 3: `renderDetailWithBook`에 표시 로직 추가**

`renderDetailWithBook` 함수에서 기존:

```js
  ratingRow.addEventListener('click', () => renderRatingModal(book, handlers));

  info.append(title, authors, ratingRow);
```

를 아래로 교체:

```js
  ratingRow.addEventListener('click', () => renderRatingModal(book, handlers));

  info.append(title, authors, ratingRow);

  if (book.discussionDurationSeconds != null) {
    info.appendChild(createMetaRow('토론시간', formatDurationSeconds(book.discussionDurationSeconds)));
  }
  if (book.meetingDate) {
    info.appendChild(createMetaRow('날짜', formatMeetingDate(book.meetingDate)));
  }
```

- [ ] **Step 4: CSS 추가**

`css/style.css`에 추가 (`.detail-rating-row` 근처):

```css
.detail-meta-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.85rem;
}

.detail-meta-label {
  min-width: 64px;
  color: var(--muted);
  font-weight: 800;
}

.detail-meta-value {
  color: var(--ink);
}
```

- [ ] **Step 5: 수동 확인**

`discussionDurationSeconds`/`meetingDate`가 있는 모의 `book` 객체와 없는 모의 `book` 객체 두 가지로 `renderDetailWithBook`(또는 `renderBookSlider`)을 호출해, 값이 있을 때만 줄이 보이고 없을 때는 완전히 숨겨지는지 헤드리스 브라우저로 확인.

```bash
npm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
상세 화면에 토론시간/날짜 필드 표시 추가

값이 있는 책만 해당 줄을 보여주고, 기존 데이터처럼 값이 없으면
숨긴다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 공유 카드 생성 (`js/shareCard.js`) + 상단바 "공유" 링크

**Files:**
- Create: `js/shareCard.js`
- Modify: `js/bookSlider.js` (`createDetailTopbar`)
- Modify: `js/app.js` (핸들러 연결)

**Interfaces:**
- Produces:
  - `js/shareCard.js`: `export async function shareOrDownloadCard(book): Promise<void>` — 카드를 생성해 `navigator.share`(파일 공유 지원 시) 또는 다운로드로 전달. 실패 시 에러를 던진다(호출부가 처리).
  - `js/bookSlider.js`: `createDetailTopbar`가 `handlers.onShareCard(book)`를 호출하는 "공유" 링크를 맨 앞에 추가.
  - `js/app.js`: `handlers.onShareCard`로 연결되는 `shareBookCard(book)` 함수 추가, 실패 시 alert로 안내.

- [ ] **Step 1: `js/shareCard.js` 작성**

```js
// js/shareCard.js
const CARD_WIDTH = 900;
const CARD_HEADER_HEIGHT = 90;
const CARD_PADDING = 40;
const COVER_WIDTH = 160;
const COVER_HEIGHT = 240;
const REVIEW_ROW_HEIGHT = 34;

function sanitizeFilename(name) {
  return String(name || '카드').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

function loadCoverImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function truncateToWidth(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function cardHeight(book) {
  const reviewCount = (book.reviews || []).length;
  return CARD_HEADER_HEIGHT + CARD_PADDING * 2 + COVER_HEIGHT + 30 + 40 + reviewCount * REVIEW_ROW_HEIGHT + 40;
}

function drawCard(ctx, book, coverImg, width, height) {
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#ece9d8';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#3f5d95';
  ctx.fillRect(0, 0, width, CARD_HEADER_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px GalmuriMono11, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('책 쫌 읽읍시다', CARD_PADDING, CARD_HEADER_HEIGHT / 2);

  const y = CARD_HEADER_HEIGHT + CARD_PADDING;

  if (coverImg) {
    ctx.drawImage(coverImg, CARD_PADDING, y, COVER_WIDTH, COVER_HEIGHT);
  } else {
    ctx.fillStyle = '#111111';
    ctx.fillRect(CARD_PADDING, y, COVER_WIDTH, COVER_HEIGHT);
  }

  const textX = CARD_PADDING + COVER_WIDTH + 30;
  const textMaxWidth = width - textX - CARD_PADDING;

  ctx.fillStyle = '#111111';
  ctx.font = '900 26px GalmuriMono11, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(truncateToWidth(ctx, book.title || '제목 없음', textMaxWidth), textX, y);

  ctx.font = '400 18px GalmuriMono11, sans-serif';
  ctx.fillStyle = '#707070';
  ctx.fillText(truncateToWidth(ctx, book.authors || '', textMaxWidth), textX, y + 40);

  const avgRating = Number(book.avgRating || 0);
  const filled = Math.round(avgRating);
  ctx.font = '400 20px GalmuriMono11, sans-serif';
  ctx.fillStyle = '#ff4a14';
  ctx.fillText(`${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}  ${avgRating.toFixed(1)}`, textX, y + 75);

  let rowY = y + COVER_HEIGHT + 30;
  ctx.strokeStyle = '#8c8c84';
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, rowY);
  ctx.lineTo(width - CARD_PADDING, rowY);
  ctx.stroke();
  rowY += 30;

  (book.reviews || []).forEach((review) => {
    ctx.fillStyle = '#111111';
    ctx.font = '900 18px GalmuriMono11, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateToWidth(ctx, review.name || '익명', 90), CARD_PADDING, rowY);

    const rating = Number(review.rating) || 0;
    ctx.fillStyle = '#ff4a14';
    ctx.font = '400 16px GalmuriMono11, sans-serif';
    ctx.fillText(`${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`, CARD_PADDING + 100, rowY);

    ctx.fillStyle = '#707070';
    ctx.font = '400 16px GalmuriMono11, sans-serif';
    const reviewText = truncateToWidth(ctx, review.review || '', width - CARD_PADDING - 220);
    ctx.fillText(reviewText, CARD_PADDING + 220, rowY);

    rowY += REVIEW_ROW_HEIGHT;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('카드 이미지를 생성하지 못했습니다.'))), 'image/png');
  });
}

export async function generateShareCardBlob(book) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = cardHeight(book);
  const ctx = canvas.getContext('2d');

  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      // 폰트 로딩 실패는 무시하고 기본 폰트로 진행
    }
  }

  const coverImg = await loadCoverImage(book.thumbnail);
  drawCard(ctx, book, coverImg, canvas.width, canvas.height);

  try {
    return await canvasToBlob(canvas);
  } catch (err) {
    // 캔버스 오염(CORS) 등으로 실패 시 표지 이미지 없이 재시도
    drawCard(ctx, book, null, canvas.width, canvas.height);
    return canvasToBlob(canvas);
  }
}

export async function shareOrDownloadCard(book) {
  const blob = await generateShareCardBlob(book);
  const filename = `책좀읽읍시다_${sanitizeFilename(book.title)}_카드.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: book.title || '독서모임 카드' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // 공유 실패 시 아래 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: `createDetailTopbar`에 "공유" 링크 추가**

`js/bookSlider.js`의 `createDetailTopbar` 함수에서, 기존:

```js
  const actions = document.createElement('div');
  actions.className = 'detail-top-actions';

  const editButton = document.createElement('button');
```

를 아래로 교체:

```js
  const actions = document.createElement('div');
  actions.className = 'detail-top-actions';

  const shareButton = document.createElement('button');
  shareButton.className = 'detail-top-action';
  shareButton.type = 'button';
  shareButton.textContent = '공유';
  shareButton.addEventListener('click', () => handlers.onShareCard?.(book));

  const shareDivider = document.createElement('span');
  shareDivider.className = 'detail-top-separator';
  shareDivider.textContent = '|';

  const editButton = document.createElement('button');
```

그리고 함수 아래쪽, 기존:

```js
  actions.append(editButton, divider, deleteButton);
```

를:

```js
  actions.append(shareButton, shareDivider, editButton, divider, deleteButton);
```

로 변경.

- [ ] **Step 3: `js/app.js`에 핸들러 연결**

import 문에 추가:

```js
import { shareOrDownloadCard } from './shareCard.js';
```

`saveRatingReview` 함수 아래(또는 적절한 위치)에 추가:

```js
async function shareBookCard(book) {
  try {
    await shareOrDownloadCard(book);
  } catch (err) {
    alert('공유 카드를 만들지 못했습니다. 다시 시도해주세요.');
  }
}
```

`renderMain()`의 `handlers` 객체에서, 기존:

```js
    onRatingSave: saveRatingReview,
```

바로 아래에 추가:

```js
    onShareCard: shareBookCard,
```

- [ ] **Step 4: 수동 확인**

```bash
npm test
```
Expected: PASS (이 태스크의 `js/shareCard.js`는 `document`/`canvas`/`Image` 브라우저 API에 의존해 `node --test`로 직접 테스트하지 않음 — 기존 테스트가 깨지지 않는지만 확인).

모의 `book`(리뷰 여러 개, 표지 URL 있는 것/없는 것 둘 다) + 모의 `handlers.onShareCard`로 상세 화면을 렌더링해 "공유" 링크가 보이는지, 클릭 시 `shareOrDownloadCard`가 호출되는지 헤드리스 브라우저로 확인. 가능하면 실제로 `generateShareCardBlob(book)`을 호출해 PNG blob이 생성되는지(표지 있는 경우/없는 경우 둘 다) 직접 검증한다 — 실제 구글 북스 이미지 URL로 CORS 실패 시나리오도 한 번 확인해볼 것(실패해도 표지 없이 카드가 만들어져야 함).

- [ ] **Step 5: Commit**

```bash
git add js/shareCard.js js/bookSlider.js js/app.js
git commit -m "$(cat <<'EOF'
책 상세 정보를 이미지 카드로 공유하는 기능 추가

캔버스로 표지·제목·평균 별점·멤버별 별점/한줄평을 담은 카드를
그려 PNG로 만든 뒤, 파일 공유를 지원하는 환경에서는
navigator.share로, 아니면 다운로드로 전달한다. 표지 이미지의
CORS 문제로 캔버스가 오염되면 표지 없이 재시도해 항상 카드가
생성되게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 최종 수동 QA

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 자동 테스트 전체 실행**

```bash
npm test
```
Expected: 전체 PASS (Task 1의 신규 테스트 포함).

- [ ] **Step 2: 모의 데이터로 전체 흐름 확인**

로컬 서버 + 모의 `book`/`handlers` harness(이전 리디자인 작업들과 동일한 방식, 프로덕션 Firebase에 쓰지 않음)로 아래를 확인:
1. `discussionDurationSeconds`/`meetingDate`가 있는 책 상세 화면 → "토론시간"/"날짜" 줄이 올바른 형식으로 보이는지.
2. 두 필드가 없는 책 상세 화면 → 해당 줄이 아예 안 보이는지.
3. "공유" 링크 클릭 → `generateShareCardBlob`이 만든 PNG를 실제로 파일로 저장해 열어보고, 표지/제목/저자/평균 별점/멤버별 별점·한줄평이 다 들어가 있는지, 표지 URL이 없는 책도 카드가 깨지지 않고 생성되는지.
4. `renderUploadDateModal`을 직접 호출해 날짜 입력 → 확인/취소 버튼이 각각 올바른 콜백을 호출하는지.
5. (마이크가 있는 환경이라면) 실제 녹음 시작→완료까지 진행해 `meetingStartedAt` 기반으로 `meetingDate`/`discussionDurationSeconds`가 계산되는 흐름을 코드 리딩으로 재확인.

- [ ] **Step 3: 콘솔 에러 확인**

모든 확인 단계에서 브라우저 콘솔에 에러가 없는지 확인.

- [ ] **Step 4: 문제 발견 시**

해당 태스크로 돌아가 수정 후 별도 커밋. 이 태스크 자체는 커밋하지 않음.

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지:** A(데이터 필드)→Task 1,2,3 / B(수집: 실시간·업로드)→Task 2,3 / C(상세 화면 표시)→Task 4 / D(공유)→Task 5.
- **플레이스홀더 스캔:** 없음 — 모든 스텝에 실제 코드 포함.
- **타입/시그니처 일관성:** `runAnalysis(blob, meta = {})`가 Task 2(정의)와 Task 3(사용)에서 동일한 `{ meetingDate, discussionDurationSeconds }` 형태를 씀. `renderUploadDateModal({ onConfirm, onCancel })` 시그니처가 Task 3 정의·사용 양쪽에서 일치. `formatDurationSeconds`/`formatMeetingDate`/`toLocalDateString`이 Task 1(정의)과 Task 2/3/4(사용) 양쪽에서 동일한 이름·인자로 일치.
- **시간대 이슈:** `meetingDate`를 UTC ISO 문자열이 아니라 로컬 캘린더 날짜 문자열로 일관되게 다루도록 Global Constraints에 명시 — `toISOString()` 사용 금지 확인.
