# 책 표지 Firebase Storage 저장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Books 표지 이미지를 서버(Cloud Function)가 대신 받아와 Firebase Storage에 재호스팅해서, 공유 카드 캔버스가 CORS 문제 없이 표지를 그릴 수 있게 한다.

**Architecture:** 새 `onCall` Cloud Function `uploadBookCover`가 서버 측에서 이미지를 fetch(브라우저 CORS 제약 없음)해 Storage에 저장하고 다운로드 URL을 반환한다. 클라이언트는 책을 추가/표지 수정할 때 이 함수를 백그라운드로 호출해 `thumbnail` 필드를 Storage URL로 교체한다. 실패해도 기존 Google Books URL이 남아있어 아무것도 깨지지 않는다.

**Tech Stack:** Firebase Functions v2 (`onCall`), `firebase-admin/storage`, Firebase Storage Rules, Vanilla JS 클라이언트.

## Global Constraints

- `imageUrl`은 반드시 `https://`이고 호스트가 `books.google.<tld>` 또는 `*.googleusercontent.com`이어야 한다 — 임의 URL을 서버가 fetch하는 걸 허용하면 SSRF 위험이 생긴다. 이 화이트리스트 검증은 타협 불가.
- 기존에 이미 등록된 책은 소급 적용하지 않는다 — 새로 추가/표지 수정되는 책부터.
- 표지 업로드 실패가 책 추가/수정 흐름 자체를 막거나 지연시켜서는 안 된다 (백그라운드, non-blocking).
- `storage.rules`의 `covers/` 경로는 쓰기를 클라이언트에 허용하지 않는다 (Admin SDK만 씀).
- 커밋은 태스크 단위로 작게 나눈다.
- 실제 `firebase deploy`는 구현이 끝나고 로컬 검증까지 마친 뒤, 별도로 사용자 확인을 받고 실행한다 (마지막 태스크에서 수행).

---

## 파일 구조 개요

| 파일 | 역할 |
|---|---|
| `functions/index.js` | 신규 `uploadBookCover` onCall 함수 추가 |
| `storage.rules` | `covers/{clubId}/{fileName}` 경로 규칙 추가 |
| `js/firebase.js` | `uploadBookCover(clubId, bookId, imageUrl)` 클라이언트 wrapper 추가 |
| `js/app.js` | `addSearchResultToMonth`의 두 분기(신규 추가/표지 수정) 끝에 백그라운드 업로드 호출 추가 |

---

## Task 1: Cloud Function `uploadBookCover`

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Produces: `export const uploadBookCover = onCall({ region: REGION, ... }, async (request) => {...})` — 입력 `{ clubId, bookId, imageUrl }`, 출력 `{ storagePath, url, contentType }`. `HttpsError`로 검증 실패/업로드 실패를 던진다.

- [ ] **Step 1: 호스트 화이트리스트 검증 헬퍼 추가**

`functions/index.js`의 `isSafeId` 함수 근처에 추가:

```js
const ALLOWED_COVER_HOST_PATTERN = /^books\.google(\.[a-z.]+)?$|(^|\.)googleusercontent\.com$/i;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

function isAllowedCoverUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_COVER_HOST_PATTERN.test(url.hostname);
  } catch (err) {
    return false;
  }
}
```

- [ ] **Step 2: `uploadBookCover` 함수 작성**

`functions/index.js`의 `export const analyzeRecording = onCall(...)` 블록 뒤(파일 끝)에 추가:

```js
export const uploadBookCover = onCall(
  {
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    const data = request.data || {};
    const clubId = asString(data.clubId);
    const bookId = asString(data.bookId);
    const imageUrl = asString(data.imageUrl);

    if (!clubId || !bookId || !imageUrl) {
      throw new HttpsError('invalid-argument', '독서모임 ID, 책 ID, 이미지 URL이 필요합니다.');
    }
    if (!isSafeId(clubId) || !isSafeId(bookId)) {
      throw new HttpsError('invalid-argument', '올바르지 않은 독서모임 또는 책 ID입니다.');
    }
    if (!isAllowedCoverUrl(imageUrl)) {
      throw new HttpsError('invalid-argument', '지원하지 않는 이미지 출처입니다.');
    }

    let response;
    try {
      response = await fetch(imageUrl);
    } catch (err) {
      throw new HttpsError('unavailable', '표지 이미지를 가져오지 못했습니다.');
    }
    if (!response.ok) {
      throw new HttpsError('unavailable', '표지 이미지를 가져오지 못했습니다.');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', '이미지 형식이 아닙니다.');
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new HttpsError('failed-precondition', '표지 이미지가 비어 있습니다.');
    }
    if (arrayBuffer.byteLength > MAX_COVER_BYTES) {
      throw new HttpsError('invalid-argument', '표지 이미지가 너무 큽니다.');
    }

    const extension = (contentType.split('/')[1] || 'jpg').split('+')[0];
    const storagePath = `covers/${clubId}/${bookId}.${extension}`;
    const bucket = getStorage().bucket(STORAGE_BUCKET);
    const file = bucket.file(storagePath);

    await file.save(Buffer.from(arrayBuffer), {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`;

    return { storagePath, url, contentType };
  },
);
```

- [ ] **Step 3: 문법 확인**

```bash
node --check functions/index.js
```
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add functions/index.js
git commit -m "$(cat <<'EOF'
표지 이미지를 서버에서 받아 Storage에 저장하는 함수 추가

Google Books 썸네일이 CORS 헤더를 보내지 않아 브라우저에서
캔버스로 못 그리는 문제를, 서버가 대신 이미지를 받아 Storage에
재호스팅하는 방식으로 해결. 임의 URL을 서버가 fetch하지 않도록
Google Books 계열 호스트만 화이트리스트로 허용.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `storage.rules` 추가

**Files:**
- Modify: `storage.rules`

- [ ] **Step 1: 규칙 추가**

`storage.rules`의 기존 `match /recordings/{bookId}/{fileName} { ... }` 블록 뒤에 추가:

```
    match /covers/{clubId}/{fileName} {
      allow read: if true;
      allow write: if false;
    }
```

- [ ] **Step 2: 파일 유효성 확인**

```bash
cat storage.rules
```
중괄호 짝이 맞는지, 기존 블록을 건드리지 않았는지 육안 확인.

- [ ] **Step 3: Commit**

```bash
git add storage.rules
git commit -m "$(cat <<'EOF'
표지 이미지 경로(covers/)에 Storage 규칙 추가

읽기는 공개 허용(기존 recordings/ 패턴과 동일), 쓰기는 막아서
Admin SDK(Cloud Function)만 쓸 수 있게 한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 클라이언트 wrapper + 호출 연결

**Files:**
- Modify: `js/firebase.js` (콜러블 wrapper 추가)
- Modify: `js/app.js` (`addSearchResultToMonth`의 두 분기에 백그라운드 호출 추가)

**Interfaces:**
- Consumes: Task 1의 `uploadBookCover` Cloud Function.
- Produces: `js/firebase.js`: `export async function uploadBookCover(clubId, bookId, imageUrl)` — `{ storagePath, url, contentType }`를 반환하거나 실패 시 throw.

- [ ] **Step 1: `js/firebase.js`에 wrapper 추가**

기존 `const analyzeRecordingCallable = httpsCallable(functions, 'analyzeRecording');` 바로 아래에 추가:

```js
const uploadBookCoverCallable = httpsCallable(functions, 'uploadBookCover');
```

파일에서 `export async function analyzeRecording(...)` 함수(콜러블을 감싸는 export 함수)를 찾아, 그 근처에 같은 패턴으로 추가:

```js
export async function uploadBookCover(clubId, bookId, imageUrl) {
  const result = await uploadBookCoverCallable({ clubId, bookId, imageUrl });
  return result.data;
}
```

(정확한 `analyzeRecording` export 함수의 현재 형태를 먼저 읽어서, 에러 처리 등 기존 컨벤션이 있으면 동일하게 맞춘다. 없으면 위 형태 그대로 사용.)

- [ ] **Step 2: `js/app.js`에 백그라운드 동기화 헬퍼 추가**

import 문에서 `firebase.js`로부터 가져오는 목록에 `uploadBookCover`를 추가.

`addSearchResultToMonth` 함수 위에 헬퍼 추가:

```js
function syncBookCoverToStorage(bookId, imageUrl) {
  if (!imageUrl || !currentClubId || !bookId) return;

  uploadBookCover(currentClubId, bookId, imageUrl)
    .then((result) => {
      if (!result?.url) return;
      return updateBook(currentClubId, bookId, { thumbnail: result.url }).then(() => {
        allBooks = allBooks.map((entry) => (
          entry.id === bookId ? { ...entry, thumbnail: result.url } : entry
        ));
        renderMain();
      });
    })
    .catch((err) => {
      console.warn('표지 이미지를 Storage에 저장하지 못했습니다', err);
    });
}
```

- [ ] **Step 3: `addSearchResultToMonth`의 두 분기에서 호출**

`editingBookId` 분기에서, 기존:

```js
    await updateBook(currentClubId, bookId, replacement);
    allBooks = allBooks.map((entry) => (
      entry.id === bookId ? { ...entry, ...replacement } : entry
    ));
    currentBookId = bookId;
```

를 아래로 교체 (`updateBook` 호출 직후에 추가):

```js
    await updateBook(currentClubId, bookId, replacement);
    allBooks = allBooks.map((entry) => (
      entry.id === bookId ? { ...entry, ...replacement } : entry
    ));
    syncBookCoverToStorage(bookId, replacement.thumbnail);
    currentBookId = bookId;
```

신규 추가 분기에서, 기존:

```js
  const bookId = await addBook(currentClubId, {
    ...book,
    ...periodData,
  });

  currentBookId = bookId;
```

를 아래로 교체:

```js
  const bookId = await addBook(currentClubId, {
    ...book,
    ...periodData,
  });

  syncBookCoverToStorage(bookId, book.thumbnail);
  currentBookId = bookId;
```

- [ ] **Step 4: 문법/테스트 확인**

```bash
node --check js/app.js
node --check js/firebase.js
npm test
```
Expected: 문법 에러 없음, 기존 테스트 26/26 PASS (이 태스크는 로직 테스트 대상 모듈을 건드리지 않음).

- [ ] **Step 5: Commit**

```bash
git add js/firebase.js js/app.js
git commit -m "$(cat <<'EOF'
책 추가/표지 수정 시 표지를 Storage에 백그라운드로 저장

책을 검색해서 추가하거나 표지를 바꿀 때, 새 uploadBookCover
함수를 화면 흐름을 막지 않고 호출해 성공하면 thumbnail을 Storage
URL로 교체한다. 실패해도 기존 Google Books URL이 남아있어
표지 표시 자체는 계속 정상 동작한다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 배포 및 실제 검증

**이 태스크는 실제 프로덕션 Firebase 프로젝트에 배포하는 작업이다 — 실행 전 반드시 사용자에게 배포 여부를 확인받는다.**

**Files:** 없음 (배포/검증 전용)

- [ ] **Step 1: 사용자 확인**

컨트롤러(나)가 사용자에게 "Cloud Function과 Storage 규칙을 배포해도 될까요?"를 명시적으로 물어보고 승인을 받은 뒤에만 다음 스텝을 진행한다. 이 태스크는 implementer가 독단적으로 배포까지 실행하지 않는다 — 배포 자체는 컨트롤러(또는 사용자 승인 이후의 별도 실행)가 수행한다.

- [ ] **Step 2: 배포**

```bash
firebase deploy --only functions:uploadBookCover,storage:rules
```

배포 로그에서 `uploadBookCover` 함수와 storage rules가 성공적으로 배포됐는지 확인.

- [ ] **Step 3: 실제 검증 (사용자가 직접, 또는 컨트롤러가 실제 초대 링크로)**

1. 책 검색 → 모임에 추가.
2. 몇 초 후 Firestore에서 해당 책의 `thumbnail` 필드가 `https://firebasestorage.googleapis.com/...`로 바뀌었는지 확인.
3. 그 책의 상세 화면에서 총점 옆 "공유" 클릭 → 생성된 카드 이미지에 실제 표지가 (검은 placeholder가 아니라) 제대로 들어가는지 확인.
4. 브라우저 콘솔에 CORS 관련 에러가 없는지 확인.

- [ ] **Step 4: 문제 발견 시**

배포된 함수/규칙에 문제가 있으면 해당 태스크로 돌아가 수정 후 재배포. 이 태스크 자체는 검증 결과와 무관하게 별도 커밋하지 않는다 (배포는 코드 변경이 아님).

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지:** A(Cloud Function)→Task 1 / B(storage.rules)→Task 2 / C(클라이언트 연동)→Task 3 / 배포→Task 4.
- **보안:** SSRF 방지용 호스트 화이트리스트가 Task 1 Step 1에 명시적으로 포함됨. Task 2에서 `covers/` 쓰기가 클라이언트에 막혀있음을 확인.
- **플레이스홀더 스캔:** 없음.
- **타입/시그니처 일관성:** `uploadBookCover(clubId, bookId, imageUrl)`이 Task 1(Cloud Function 정의)과 Task 3(클라이언트 wrapper 및 호출)에서 동일한 인자 순서/이름으로 일치. 반환값 `{ storagePath, url, contentType }`이 Task 1 정의와 Task 3의 `result.url` 사용에서 일치.
- **비파괴성:** Task 3의 실패 처리가 `console.warn`만 하고 예외를 삼켜서, 표지 업로드 실패가 책 추가/수정 흐름 자체를 절대 막지 않음을 확인.
