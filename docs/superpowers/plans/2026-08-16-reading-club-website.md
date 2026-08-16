# 독서모임 웹사이트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "책책책 책좀 읽읍시다" 독서모임 웹사이트를 빌드 도구 없는 순수 HTML/CSS/JS SPA로 구현한다. 책 목록을 가로 슬라이더로 관리하고, 실시간 모임(데시벨 모니터링+중재+녹음) 또는 녹음본 업로드를 통해 모임을 요약(mock)하고, 참석자별 별점/리뷰를 기록한다.

**Architecture:** `index.html` 하나에 모든 화면을 `<section class="screen">`으로 두고 JS로 active 클래스를 토글하는 SPA. 순수 로직(데시벨 계산, 평균 별점, mock 요약)은 별도 모듈로 분리해 Node 내장 테스트 러너로 단위 테스트한다. 데이터는 Firebase(Firestore+Storage)에 저장하며, Google Books API로 실시간 검색한다.

**Tech Stack:** Vanilla JS (ES Modules), Firebase JS SDK v10 (CDN, `https://www.gstatic.com/firebasejs/10.12.2/`), Google Books API v1 (키 불필요), Node.js 내장 테스트 러너(`node:test`), Playwright(webapp-testing 스킬, 수동 스모크 테스트용).

## Global Constraints

- 빌드 도구/프레임워크 없음 — 순수 HTML/CSS/JS, ES Modules로 브라우저에서 직접 로드
- Firebase SDK는 CDN import로 사용 (npm 설치 없음)
- Google Books API는 API 키 없이 사용 (`https://www.googleapis.com/books/v1/volumes?q=...`)
- 로그인/인증 없음 — Firestore/Storage는 오픈 액세스 규칙
- 녹음본 → 텍스트 요약은 mock (실제 STT/AI 연동 없음), 코드에 `// TODO: 실제 AI 분석 API로 교체` 주석 유지
- 데시벨 측정은 실제 Web Audio API 사용
- Firestore 컬렉션/필드명은 스펙과 동일하게 유지: `books/{bookId}` — `title, authors, thumbnail, googleBooksId, addedAt, status, summary, participantCount, avgRating, reviews, recordingUrl`
- Storage 경로: `recordings/{bookId}/{timestamp}.webm`

---

### Task 1: 프로젝트 스캐폴딩 + Node 테스트 러너 설정

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `test/.gitkeep` (디렉토리 존재 확인용, 이후 태스크에서 실제 테스트 파일로 대체됨)

**Interfaces:**
- Produces: `npm test` 명령으로 `node --test test/` 실행 가능한 상태

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "reading-club",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: .gitignore 작성**

```
node_modules/
.DS_Store
```

- [ ] **Step 3: test 디렉토리 생성 확인**

```bash
mkdir -p test
touch test/.gitkeep
```

- [ ] **Step 4: 테스트 러너 동작 확인 (테스트가 아직 없어도 정상 종료해야 함)**

Run: `npm test`
Expected: `# tests 0` 형태로 출력되며 exit code 0 (에러 없이 종료)

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore test/.gitkeep
git commit -m "chore: scaffold project and node test runner"
```

---

### Task 2: 순수 로직 모듈 (데시벨 판정 / 평균 별점 / mock 요약) + 단위 테스트

**Files:**
- Create: `js/decibel.js`
- Create: `js/ratings.js`
- Create: `js/mockAnalysis.js`
- Test: `test/decibel.test.js`
- Test: `test/ratings.test.js`
- Test: `test/mockAnalysis.test.js`

**Interfaces:**
- Produces:
  - `rmsToDb(rms: number): number` — RMS(0~1)를 dBFS로 변환, `rms <= 0`이면 `-Infinity`
  - `THRESHOLD_LOUD_DB: number` (= -18), `THRESHOLD_QUIET_DB: number` (= -35)
  - `classifyLevel(db: number): 'quiet' | 'moderate' | 'loud'`
  - `calcAverage(reviews: {rating:number, review:string}[]): number` — 소수 첫째 자리 반올림, 빈 배열이면 0
  - `generateMockSummary(bookTitle: string): string` — 결정론적 템플릿 문자열

- [ ] **Step 1: 데시벨 판정 실패하는 테스트 작성**

```javascript
// test/decibel.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmsToDb, classifyLevel, THRESHOLD_LOUD_DB, THRESHOLD_QUIET_DB } from '../js/decibel.js';

test('rmsToDb: rms 0 이하는 -Infinity', () => {
  assert.equal(rmsToDb(0), -Infinity);
  assert.equal(rmsToDb(-1), -Infinity);
});

test('rmsToDb: rms 1은 0dB', () => {
  assert.equal(rmsToDb(1), 0);
});

test('rmsToDb: rms 0.5는 약 -6.02dB', () => {
  assert.ok(Math.abs(rmsToDb(0.5) - (-6.0206)) < 0.001);
});

test('classifyLevel: 임계값 경계 분류', () => {
  assert.equal(classifyLevel(THRESHOLD_QUIET_DB - 1), 'quiet');
  assert.equal(classifyLevel((THRESHOLD_QUIET_DB + THRESHOLD_LOUD_DB) / 2), 'moderate');
  assert.equal(classifyLevel(THRESHOLD_LOUD_DB), 'loud');
  assert.equal(classifyLevel(0), 'loud');
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/decibel.test.js`
Expected: FAIL — `Cannot find module '../js/decibel.js'`

- [ ] **Step 3: js/decibel.js 구현**

```javascript
// js/decibel.js
export const THRESHOLD_QUIET_DB = -35;
export const THRESHOLD_LOUD_DB = -18;

export function rmsToDb(rms) {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export function classifyLevel(db) {
  if (db < THRESHOLD_QUIET_DB) return 'quiet';
  if (db < THRESHOLD_LOUD_DB) return 'moderate';
  return 'loud';
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/decibel.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 평균 별점 실패하는 테스트 작성**

```javascript
// test/ratings.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcAverage } from '../js/ratings.js';

test('calcAverage: 빈 배열은 0', () => {
  assert.equal(calcAverage([]), 0);
  assert.equal(calcAverage(undefined), 0);
});

test('calcAverage: 단일 리뷰는 그 값 그대로', () => {
  assert.equal(calcAverage([{ rating: 4, review: 'good' }]), 4);
});

test('calcAverage: 여러 리뷰 평균, 소수 첫째 자리 반올림', () => {
  const reviews = [
    { rating: 5, review: 'a' },
    { rating: 4, review: 'b' },
    { rating: 3, review: 'c' },
  ];
  assert.equal(calcAverage(reviews), 4);

  const reviews2 = [
    { rating: 5, review: 'a' },
    { rating: 4, review: 'b' },
  ];
  assert.equal(calcAverage(reviews2), 4.5);
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `node --test test/ratings.test.js`
Expected: FAIL — `Cannot find module '../js/ratings.js'`

- [ ] **Step 7: js/ratings.js 구현**

```javascript
// js/ratings.js
export function calcAverage(reviews) {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `node --test test/ratings.test.js`
Expected: PASS (3 tests)

- [ ] **Step 9: mock 요약 실패하는 테스트 작성**

```javascript
// test/mockAnalysis.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMockSummary } from '../js/mockAnalysis.js';

test('generateMockSummary: 책 제목을 포함한 문자열 반환', () => {
  const summary = generateMockSummary('데미안');
  assert.ok(summary.includes('데미안'));
  assert.ok(summary.length > 20);
});

test('generateMockSummary: 동일 입력에 대해 결정론적으로 동일한 결과', () => {
  assert.equal(generateMockSummary('토지'), generateMockSummary('토지'));
});
```

- [ ] **Step 10: 테스트 실패 확인**

Run: `node --test test/mockAnalysis.test.js`
Expected: FAIL — `Cannot find module '../js/mockAnalysis.js'`

- [ ] **Step 11: js/mockAnalysis.js 구현**

```javascript
// js/mockAnalysis.js
// TODO: 실제 AI 분석 API로 교체
export function generateMockSummary(bookTitle) {
  return `이번 모임에서는 <${bookTitle}>을(를) 주제로 활발한 토론이 이어졌습니다. ` +
    `참석자들은 주요 등장인물의 선택과 이야기의 전환점에 대해 다양한 의견을 나누었고, ` +
    `책이 던지는 질문에 대해 서로 다른 해석을 공유하며 마무리되었습니다.`;
}
```

- [ ] **Step 12: 전체 테스트 통과 확인**

Run: `npm test`
Expected: PASS (9 tests total)

- [ ] **Step 13: Commit**

```bash
git add js/decibel.js js/ratings.js js/mockAnalysis.js test/decibel.test.js test/ratings.test.js test/mockAnalysis.test.js
git commit -m "feat: add pure logic modules for decibel, ratings, mock summary"
```

---

### Task 3: Firebase 데이터 계층 (firebase.js)

**Files:**
- Create: `js/firebaseConfig.js`
- Create: `js/firebase.js`

**Interfaces:**
- Consumes: 없음 (독립 모듈)
- Produces:
  - `subscribeBooks(callback: (books: Book[]) => void): () => void` — `addedAt` 오름차순 실시간 구독, unsubscribe 함수 반환. `Book = { id, title, authors, thumbnail, googleBooksId, addedAt, status, summary, participantCount, avgRating, reviews, recordingUrl }`
  - `addBook(data: { title, authors, thumbnail, googleBooksId }): Promise<string>` — 새 문서 생성, `status: 'pending'`, `addedAt: serverTimestamp()`, `reviews: []` 로 초기화 후 문서 id 반환
  - `updateBook(bookId: string, data: object): Promise<void>`
  - `uploadRecording(bookId: string, blob: Blob): Promise<string>` — 업로드 후 다운로드 URL 반환

이 모듈은 실제 Firebase 프로젝트 연결 없이는 단위 테스트로 검증할 수 없다 (Firestore 에뮬레이터는 이번 범위에서 제외). 대신 Task 12에서 실제 Firebase 프로젝트 연결 후 전체 흐름을 수동으로 검증한다.

- [ ] **Step 1: firebaseConfig.js 작성 (플레이스홀더, Task 12에서 실제 값으로 교체)**

```javascript
// js/firebaseConfig.js
// Task 12에서 https://console.firebase.google.com 에서 생성한 프로젝트의
// 웹 앱 설정값으로 아래 객체를 교체할 것.
export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  projectId: 'REPLACE_ME',
  storageBucket: 'REPLACE_ME.appspot.com',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};
```

- [ ] **Step 2: firebase.js 구현**

```javascript
// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

const booksCol = collection(db, 'books');

export function subscribeBooks(callback) {
  const q = query(booksCol, orderBy('addedAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const books = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(books);
  });
}

export async function addBook(data) {
  const docRef = await addDoc(booksCol, {
    ...data,
    status: 'pending',
    addedAt: serverTimestamp(),
    reviews: [],
  });
  return docRef.id;
}

export async function updateBook(bookId, data) {
  await updateDoc(doc(db, 'books', bookId), data);
}

export async function uploadRecording(bookId, blob) {
  const path = `recordings/${bookId}/${Date.now()}.webm`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
```

- [ ] **Step 3: 문법 오류 없는지 확인 (import는 브라우저 CDN 경로라 Node에서 직접 실행 불가하므로 구문 체크만 수행)**

Run: `node --check js/firebase.js && node --check js/firebaseConfig.js`
Expected: 출력 없이 exit code 0

- [ ] **Step 4: Commit**

```bash
git add js/firebaseConfig.js js/firebase.js
git commit -m "feat: add firebase data layer for books and recordings"
```

---

### Task 4: HTML 스켈레톤 + 기본 CSS + 스플래시 화면

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/screens.js`

**Interfaces:**
- Produces:
  - `showScreen(screenId: string): void` — `.screen.active`를 전환하는 화면 관리 함수 (이후 모든 태스크가 사용)
  - HTML에 다음 id를 가진 `<section class="screen">` 존재: `screen-splash`, `screen-main`, `screen-search`, `screen-detail`, `screen-meeting`, `screen-upload`, `screen-analyzing`, `screen-summary`, `screen-participant-count`, `screen-reviews-form`

- [ ] **Step 1: index.html 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>책책책 책좀 읽읍시다</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <section id="screen-splash" class="screen active">
    <h1 class="splash-logo">책책책<br />책좀 읽읍시다</h1>
  </section>

  <section id="screen-main" class="screen">
    <div id="book-slider" class="book-slider"></div>
  </section>

  <section id="screen-search" class="screen modal">
    <div class="modal-box">
      <button id="search-close-btn" class="btn-close">✕</button>
      <input id="search-input" type="text" placeholder="책 제목을 검색하세요" />
      <button id="search-btn">검색</button>
      <ul id="search-results"></ul>
    </div>
  </section>

  <section id="screen-detail" class="screen">
    <button id="detail-back-btn" class="btn-close">✕</button>
    <img id="detail-cover" class="detail-cover" alt="" />
    <h2 id="detail-title"></h2>
    <p id="detail-authors"></p>

    <div id="detail-pending-actions" class="detail-actions">
      <button id="start-meeting-btn">독서모임 시작</button>
      <button id="upload-recording-btn">녹음본 업로드</button>
    </div>

    <div id="detail-analyzed-content" class="detail-analyzed">
      <p id="detail-summary"></p>
      <p id="detail-avg-rating"></p>
      <ul id="detail-reviews"></ul>
    </div>
  </section>

  <section id="screen-meeting" class="screen">
    <div id="meeting-bg" class="meeting-bg">
      <p id="meeting-warning" class="meeting-warning hidden">조금만 조용히 해주세요 🤫</p>
      <button id="meeting-finish-btn">완료</button>
    </div>
  </section>

  <section id="screen-upload" class="screen">
    <button id="upload-back-btn" class="btn-close">✕</button>
    <input id="upload-file-input" type="file" accept="audio/*" />
    <button id="upload-confirm-btn" disabled>분석 시작</button>
  </section>

  <section id="screen-analyzing" class="screen">
    <p>분석중...</p>
  </section>

  <section id="screen-summary" class="screen">
    <h3>모임 요약</h3>
    <p id="summary-text"></p>
    <button id="summary-continue-btn">다음</button>
  </section>

  <section id="screen-participant-count" class="screen">
    <label for="participant-count-input">참석 인원수</label>
    <input id="participant-count-input" type="number" min="1" step="1" />
    <button id="participant-count-confirm">확인</button>
  </section>

  <section id="screen-reviews-form" class="screen">
    <div id="reviews-form-container"></div>
    <button id="reviews-save-btn">저장</button>
  </section>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: css/style.css 작성**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, "Apple SD Gothic Neo", sans-serif;
  height: 100vh;
  overflow: hidden;
}

.screen {
  display: none;
  width: 100%;
  height: 100vh;
}

.screen.active {
  display: flex;
  flex-direction: column;
}

.hidden { display: none !important; }

#screen-splash {
  align-items: center;
  justify-content: center;
}

.splash-logo {
  font-size: 2.5rem;
  text-align: center;
  transition: transform 0.8s ease, opacity 0.8s ease;
}

.splash-logo.rise {
  transform: translateY(-40vh);
}

.book-slider {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  align-items: center;
  height: 100%;
  padding: 24px;
}

.book-cover {
  flex: 0 0 auto;
  width: 120px;
  height: 180px;
  object-fit: cover;
  cursor: pointer;
  border-radius: 4px;
}

.add-book-btn {
  flex: 0 0 auto;
  width: 120px;
  height: 180px;
  font-size: 2rem;
  border: 2px dashed #999;
  background: none;
  cursor: pointer;
}

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
}

.modal-box {
  background: white;
  padding: 24px;
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 8px;
  position: relative;
}

.btn-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.detail-cover {
  width: 160px;
  height: 240px;
  object-fit: cover;
  align-self: center;
}

.meeting-bg {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 24px;
  transition: background-color 0.4s ease;
  background-color: #4caf50;
}

.meeting-warning {
  font-size: 1.5rem;
  color: white;
  font-weight: bold;
}
```

- [ ] **Step 3: js/screens.js 구현**

```javascript
// js/screens.js
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === screenId);
  });
}
```

- [ ] **Step 4: 스플래시 → 메인 전환 로직이 포함된 최소 app.js 작성 (이후 태스크에서 계속 확장)**

```javascript
// js/app.js
import { showScreen } from './screens.js';

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

startSplashAnimation();
```

- [ ] **Step 5: 브라우저에서 수동 확인**

Run: `python3 -m http.server 8000` (프로젝트 루트에서 실행)
Expected: `http://localhost:8000` 접속 시 "책책책 책좀 읽읍시다" 로고가 중앙에 뜬 뒤, 약 1.2초 후 위로 올라가며 메인 화면(빈 슬라이더)으로 전환됨

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/screens.js js/app.js
git commit -m "feat: add HTML skeleton, base CSS, and splash screen animation"
```

---

### Task 5: 메인 화면 - 책 슬라이더 렌더링

**Files:**
- Modify: `js/app.js`
- Create: `js/bookSlider.js`

**Interfaces:**
- Consumes: `subscribeBooks` (Task 3, `js/firebase.js`), `showScreen` (Task 4, `js/screens.js`)
- Produces: `renderBookSlider(books: Book[], onBookClick: (bookId:string)=>void, onAddClick: ()=>void): void` — `#book-slider` 안에 표지 이미지들과 `+` 버튼을 렌더링

- [ ] **Step 1: js/bookSlider.js 구현**

```javascript
// js/bookSlider.js
export function renderBookSlider(books, onBookClick, onAddClick) {
  const container = document.getElementById('book-slider');
  container.innerHTML = '';

  books.forEach((book) => {
    const img = document.createElement('img');
    img.src = book.thumbnail || '';
    img.alt = book.title;
    img.className = 'book-cover';
    img.addEventListener('click', () => onBookClick(book.id));
    container.appendChild(img);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-book-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', onAddClick);
  container.appendChild(addBtn);
}
```

- [ ] **Step 2: app.js에 연결**

```javascript
// js/app.js (기존 내용에 추가)
import { showScreen } from './screens.js';
import { subscribeBooks } from './firebase.js';
import { renderBookSlider } from './bookSlider.js';

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleBookClick(bookId) {
  // Task 7에서 상세 화면 렌더링 로직 연결
  console.log('book clicked', bookId);
}

function handleAddClick() {
  showScreen('screen-search');
}

subscribeBooks((books) => {
  renderBookSlider(books, handleBookClick, handleAddClick);
});

startSplashAnimation();
```

- [ ] **Step 3: 수동 확인 (Firebase 미설정 상태에서는 콘솔에 연결 오류가 뜰 수 있음 — 정상, Task 12에서 실제 값 연결 후 재확인)**

Run: `python3 -m http.server 8000` 후 브라우저에서 `screen-slider` DOM 구조가 `+` 버튼을 포함해 렌더링되는지 개발자 도구로 확인
Expected: `#book-slider` 안에 최소 `+` 버튼(`.add-book-btn`)이 존재

- [ ] **Step 4: Commit**

```bash
git add js/bookSlider.js js/app.js
git commit -m "feat: render book slider from firestore data"
```

---

### Task 6: 검색 모달 - Google Books API 연동 + 책 추가

**Files:**
- Create: `js/search.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `addBook` (Task 3, `js/firebase.js`)
- Produces: `searchBooks(query: string): Promise<{googleBooksId:string, title:string, authors:string, thumbnail:string}[]>`

- [ ] **Step 1: js/search.js 구현**

```javascript
// js/search.js
export async function searchBooks(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('검색 요청 실패');
  const data = await res.json();
  if (!data.items) return [];

  return data.items.map((item) => {
    const info = item.volumeInfo || {};
    return {
      googleBooksId: item.id,
      title: info.title || '제목 없음',
      authors: (info.authors || []).join(', '),
      thumbnail: info.imageLinks ? info.imageLinks.thumbnail : '',
    };
  });
}
```

- [ ] **Step 2: app.js에 검색 모달 이벤트 연결**

```javascript
// js/app.js (추가)
import { searchBooks } from './search.js';
import { addBook } from './firebase.js';

document.getElementById('search-close-btn').addEventListener('click', () => {
  showScreen('screen-main');
});

document.getElementById('search-btn').addEventListener('click', async () => {
  const query = document.getElementById('search-input').value.trim();
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  if (!query) return;

  let results;
  try {
    results = await searchBooks(query);
  } catch (err) {
    resultsEl.innerHTML = '<li>검색 중 오류가 발생했습니다. 다시 시도해주세요.</li>';
    return;
  }

  if (results.length === 0) {
    resultsEl.innerHTML = '<li>검색 결과가 없습니다.</li>';
    return;
  }

  results.forEach((book) => {
    const li = document.createElement('li');
    li.textContent = `${book.title} - ${book.authors}`;
    li.addEventListener('click', async () => {
      const bookId = await addBook(book);
      document.getElementById('search-input').value = '';
      resultsEl.innerHTML = '';
      handleBookClick(bookId);
    });
    resultsEl.appendChild(li);
  });
});
```

- [ ] **Step 3: 수동 확인**

Run: `python3 -m http.server 8000` 후 브라우저에서 `+` 버튼 클릭 → 검색창에 "데미안" 입력 → 검색 클릭
Expected: Google Books API 결과가 리스트로 표시됨 (Firestore 저장은 Task 12에서 실제 프로젝트 연결 후 최종 확인)

- [ ] **Step 4: Commit**

```bash
git add js/search.js js/app.js
git commit -m "feat: integrate google books search and add-book flow"
```

---

### Task 7: 책 상세 화면 (미분석 / 분석완료)

**Files:**
- Create: `js/bookDetail.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `calcAverage` (Task 2, `js/ratings.js`)
- Produces: `renderBookDetail(book: Book): void` — `status`에 따라 `#detail-pending-actions` 또는 `#detail-analyzed-content` 표시 전환

- [ ] **Step 1: js/bookDetail.js 구현**

```javascript
// js/bookDetail.js
export function renderBookDetail(book) {
  document.getElementById('detail-cover').src = book.thumbnail || '';
  document.getElementById('detail-title').textContent = book.title;
  document.getElementById('detail-authors').textContent = book.authors;

  const pendingActions = document.getElementById('detail-pending-actions');
  const analyzedContent = document.getElementById('detail-analyzed-content');

  if (book.status === 'analyzed') {
    pendingActions.classList.add('hidden');
    analyzedContent.classList.remove('hidden');

    document.getElementById('detail-summary').textContent = book.summary || '';
    document.getElementById('detail-avg-rating').textContent =
      `평균 별점: ${book.avgRating != null ? book.avgRating : 0} / 5`;

    const reviewsEl = document.getElementById('detail-reviews');
    reviewsEl.innerHTML = '';
    (book.reviews || []).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `★${r.rating} - ${r.review}`;
      reviewsEl.appendChild(li);
    });
  } else {
    pendingActions.classList.remove('hidden');
    analyzedContent.classList.add('hidden');
  }
}
```

- [ ] **Step 2: app.js에서 currentBook 상태 관리 및 연결**

```javascript
// js/app.js (기존 handleBookClick을 아래로 교체, currentBook 관련 상태 추가)
import { renderBookDetail } from './bookDetail.js';

let currentBookId = null;
let allBooks = [];

subscribeBooks((books) => {
  allBooks = books;
  renderBookSlider(books, handleBookClick, handleAddClick);

  if (currentBookId) {
    const updated = books.find((b) => b.id === currentBookId);
    if (updated) renderBookDetail(updated);
  }
});

function handleBookClick(bookId) {
  currentBookId = bookId;
  const book = allBooks.find((b) => b.id === bookId);
  if (book) renderBookDetail(book);
  showScreen('screen-detail');
}

document.getElementById('detail-back-btn').addEventListener('click', () => {
  currentBookId = null;
  showScreen('screen-main');
});
```

- [ ] **Step 3: 수동 확인**

브라우저에서 책 표지를 클릭했을 때(또는 검색 후 추가 직후) `#screen-detail`로 전환되고, `status: 'pending'`이면 두 버튼(독서모임 시작/녹음본 업로드)이, `status: 'analyzed'`이면 요약+평균별점+리뷰 목록이 보이는지 확인
Expected: 두 상태 모두 올바른 섹션만 노출됨

- [ ] **Step 4: Commit**

```bash
git add js/bookDetail.js js/app.js
git commit -m "feat: render book detail screen for pending and analyzed states"
```

---

### Task 8: 실시간 모임 화면 - 데시벨 모니터링 + 중재 오버레이

**Files:**
- Create: `js/decibelMonitor.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `rmsToDb`, `classifyLevel` (Task 2, `js/decibel.js`)
- Produces:
  - `class DecibelMonitor { constructor(stream: MediaStream, onLevel: (level:'quiet'|'moderate'|'loud')=>void); stop(): void }` — `requestAnimationFrame` 루프로 실시간 레벨 판정, 콜백 호출

- [ ] **Step 1: js/decibelMonitor.js 구현**

```javascript
// js/decibelMonitor.js
import { rmsToDb, classifyLevel } from './decibel.js';

export class DecibelMonitor {
  constructor(stream, onLevel) {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    const source = this.audioCtx.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.data = new Float32Array(this.analyser.fftSize);
    this.onLevel = onLevel;
    this.running = true;
    this._tick();
  }

  _tick() {
    if (!this.running) return;
    this.analyser.getFloatTimeDomainData(this.data);

    let sumSquares = 0;
    for (let i = 0; i < this.data.length; i++) {
      sumSquares += this.data[i] * this.data[i];
    }
    const rms = Math.sqrt(sumSquares / this.data.length);
    const db = rmsToDb(rms);
    this.onLevel(classifyLevel(db));

    requestAnimationFrame(() => this._tick());
  }

  stop() {
    this.running = false;
    this.audioCtx.close();
  }
}
```

- [ ] **Step 2: app.js에 모임 화면 진입/색상 전환/중재 오버레이 로직 추가**

```javascript
// js/app.js (추가)
import { DecibelMonitor } from './decibelMonitor.js';

const LEVEL_COLORS = { quiet: '#4caf50', moderate: '#ffc107', loud: '#f44336' };

let meetingStream = null;
let decibelMonitor = null;
let loudSinceMs = null;

function handleDecibelLevel(level) {
  document.getElementById('meeting-bg').style.backgroundColor = LEVEL_COLORS[level];
  const warningEl = document.getElementById('meeting-warning');

  if (level === 'loud') {
    if (loudSinceMs === null) loudSinceMs = Date.now();
    if (Date.now() - loudSinceMs > 3000) {
      warningEl.classList.remove('hidden');
    }
  } else {
    loudSinceMs = null;
    warningEl.classList.add('hidden');
  }
}

async function startMeeting() {
  try {
    meetingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('마이크 권한이 필요합니다. 대신 "녹음본 업로드"를 이용해주세요.');
    return;
  }

  decibelMonitor = new DecibelMonitor(meetingStream, handleDecibelLevel);
  showScreen('screen-meeting');
}

document.getElementById('start-meeting-btn').addEventListener('click', startMeeting);
```

- [ ] **Step 3: 수동 확인 (마이크 권한 허용 필요)**

브라우저에서 "독서모임 시작" 클릭 → 마이크 권한 허용 → 조용히 있을 때 배경이 초록색, 큰 소리를 낼 때 3초 이상 지속되면 빨간 배경 + 중재 문구가 뜨는지 확인
Expected: 소리 크기에 따라 배경색이 실시간으로 바뀌고, 임계값 초과 3초 후 경고 문구 노출

- [ ] **Step 4: Commit**

```bash
git add js/decibelMonitor.js js/app.js
git commit -m "feat: add real-time decibel monitoring and mediation overlay"
```

---

### Task 9: 녹음 + 업로드 + 분석(mock) 흐름

**Files:**
- Create: `js/recorder.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `uploadRecording`, `updateBook` (Task 3), `generateMockSummary` (Task 2)
- Produces: `class Recorder { constructor(stream: MediaStream); stop(): Promise<Blob> }` — `MediaRecorder`를 래핑, `stop()` 호출 시 수집된 Blob(`audio/webm`) resolve

- [ ] **Step 1: js/recorder.js 구현**

```javascript
// js/recorder.js
export class Recorder {
  constructor(stream) {
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      this.mediaRecorder.stop();
    });
  }
}
```

- [ ] **Step 2: app.js — 모임 시작 시 녹음 시작, 완료 시 업로드 → 분석 → 요약 화면까지 연결**

```javascript
// js/app.js (기존 startMeeting 수정 + 추가)
import { Recorder } from './recorder.js';
import { uploadRecording, updateBook } from './firebase.js';
import { generateMockSummary } from './mockAnalysis.js';

let currentRecorder = null;

async function startMeeting() {
  try {
    meetingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('마이크 권한이 필요합니다. 대신 "녹음본 업로드"를 이용해주세요.');
    return;
  }

  decibelMonitor = new DecibelMonitor(meetingStream, handleDecibelLevel);
  currentRecorder = new Recorder(meetingStream);
  showScreen('screen-meeting');
}

async function runAnalysis(blob) {
  showScreen('screen-analyzing');

  const recordingUrl = await uploadRecording(currentBookId, blob);
  const book = allBooks.find((b) => b.id === currentBookId);
  const summary = generateMockSummary(book ? book.title : '');

  await updateBook(currentBookId, { recordingUrl, summary });

  document.getElementById('summary-text').textContent = summary;
  showScreen('screen-summary');
}

document.getElementById('meeting-finish-btn').addEventListener('click', async () => {
  decibelMonitor.stop();
  meetingStream.getTracks().forEach((t) => t.stop());
  const blob = await currentRecorder.stop();
  await runAnalysis(blob);
});

document.getElementById('upload-recording-btn').addEventListener('click', () => {
  showScreen('screen-upload');
});

document.getElementById('upload-back-btn').addEventListener('click', () => {
  showScreen('screen-detail');
});

let uploadedFile = null;
document.getElementById('upload-file-input').addEventListener('change', (e) => {
  uploadedFile = e.target.files[0] || null;
  document.getElementById('upload-confirm-btn').disabled = !uploadedFile;
});

document.getElementById('upload-confirm-btn').addEventListener('click', async () => {
  if (!uploadedFile) return;
  await runAnalysis(uploadedFile);
});
```

- [ ] **Step 3: 수동 확인**

1. "독서모임 시작" → 몇 초 대화 → "완료" 클릭 → "분석중..." 화면 후 요약 문구가 뜨는지 확인 (Firebase 연결 전이면 업로드 단계에서 오류 로그가 날 수 있음 — Task 12에서 재확인)
2. "녹음본 업로드" → 오디오 파일 선택 → "분석 시작" 클릭 → 동일하게 요약 문구가 뜨는지 확인

Expected: 두 경로 모두 `#screen-summary`에 mock 요약 텍스트가 표시됨

- [ ] **Step 4: Commit**

```bash
git add js/recorder.js js/app.js
git commit -m "feat: add recording, upload, and mock analysis flow"
```

---

### Task 10: 인원수 입력 → 별점/리뷰 동적 폼 → 저장

**Files:**
- Create: `js/reviewsForm.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `calcAverage` (Task 2), `updateBook` (Task 3)
- Produces: `renderReviewsForm(count: number): void` — `#reviews-form-container`에 `count`개의 별점(1~5 select)+리뷰(textarea) 입력 쌍을 렌더링, `collectReviews(): {rating:number, review:string}[]` — 폼에서 입력값 수집

- [ ] **Step 1: js/reviewsForm.js 구현**

```javascript
// js/reviewsForm.js
export function renderReviewsForm(count) {
  const container = document.getElementById('reviews-form-container');
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'review-entry';

    const label = document.createElement('p');
    label.textContent = `참석자 ${i + 1}`;

    const ratingSelect = document.createElement('select');
    ratingSelect.className = 'review-rating';
    [1, 2, 3, 4, 5].forEach((n) => {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `★${n}`;
      ratingSelect.appendChild(opt);
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'review-text';
    textarea.placeholder = '리뷰를 입력하세요';

    wrapper.appendChild(label);
    wrapper.appendChild(ratingSelect);
    wrapper.appendChild(textarea);
    container.appendChild(wrapper);
  }
}

export function collectReviews() {
  const entries = document.querySelectorAll('#reviews-form-container .review-entry');
  return Array.from(entries).map((entry) => ({
    rating: Number(entry.querySelector('.review-rating').value),
    review: entry.querySelector('.review-text').value.trim(),
  }));
}
```

- [ ] **Step 2: app.js에 인원수 입력 → 리뷰 폼 → 저장 흐름 연결**

```javascript
// js/app.js (추가)
import { renderReviewsForm, collectReviews } from './reviewsForm.js';
import { calcAverage } from './ratings.js';

document.getElementById('summary-continue-btn').addEventListener('click', () => {
  showScreen('screen-participant-count');
});

document.getElementById('participant-count-confirm').addEventListener('click', () => {
  const count = Number(document.getElementById('participant-count-input').value);
  if (!count || count < 1) {
    alert('1명 이상의 인원수를 입력해주세요.');
    return;
  }
  renderReviewsForm(count);
  showScreen('screen-reviews-form');
});

document.getElementById('reviews-save-btn').addEventListener('click', async () => {
  const reviews = collectReviews();
  const avgRating = calcAverage(reviews);
  const participantCount = reviews.length;

  await updateBook(currentBookId, {
    status: 'analyzed',
    reviews,
    avgRating,
    participantCount,
  });

  currentBookId = null;
  showScreen('screen-main');
});
```

- [ ] **Step 3: 수동 확인**

요약 화면에서 "다음" 클릭 → 인원수(예: 3) 입력 후 "확인" → 별점/리뷰 입력칸 3쌍이 뜨는지 확인 → 각각 입력 후 "저장" → 메인 화면으로 돌아가고 해당 책 상세에 들어가면 분석완료 화면(요약+평균별점+리뷰)이 보이는지 확인
Expected: 저장된 리뷰 개수와 평균 별점이 입력값과 일치

- [ ] **Step 4: Commit**

```bash
git add js/reviewsForm.js js/app.js
git commit -m "feat: add participant count and rating/review form flow"
```

---

### Task 11: 전체 흐름 통합 점검 (app.js 정리)

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: Task 1~10에서 정의된 모든 모듈
- Produces: 없음 (통합/정리 태스크)

이 태스크는 Task 4~10에 걸쳐 누적된 `js/app.js`의 import/이벤트 리스너 순서를 점검하고 중복 선언(`meetingStream`, `decibelMonitor` 등)이 없는지 확인해 하나의 일관된 파일로 정리한다.

- [ ] **Step 1: js/app.js 전체를 아래 최종본으로 교체**

```javascript
// js/app.js
import { showScreen } from './screens.js';
import { subscribeBooks, addBook, updateBook, uploadRecording } from './firebase.js';
import { renderBookSlider } from './bookSlider.js';
import { renderBookDetail } from './bookDetail.js';
import { searchBooks } from './search.js';
import { DecibelMonitor } from './decibelMonitor.js';
import { Recorder } from './recorder.js';
import { generateMockSummary } from './mockAnalysis.js';
import { renderReviewsForm, collectReviews } from './reviewsForm.js';
import { calcAverage } from './ratings.js';

const LEVEL_COLORS = { quiet: '#4caf50', moderate: '#ffc107', loud: '#f44336' };

let currentBookId = null;
let allBooks = [];
let meetingStream = null;
let decibelMonitor = null;
let currentRecorder = null;
let loudSinceMs = null;
let uploadedFile = null;

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleBookClick(bookId) {
  currentBookId = bookId;
  const book = allBooks.find((b) => b.id === bookId);
  if (book) renderBookDetail(book);
  showScreen('screen-detail');
}

function handleAddClick() {
  showScreen('screen-search');
}

function handleDecibelLevel(level) {
  document.getElementById('meeting-bg').style.backgroundColor = LEVEL_COLORS[level];
  const warningEl = document.getElementById('meeting-warning');

  if (level === 'loud') {
    if (loudSinceMs === null) loudSinceMs = Date.now();
    if (Date.now() - loudSinceMs > 3000) warningEl.classList.remove('hidden');
  } else {
    loudSinceMs = null;
    warningEl.classList.add('hidden');
  }
}

async function startMeeting() {
  try {
    meetingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('마이크 권한이 필요합니다. 대신 "녹음본 업로드"를 이용해주세요.');
    return;
  }
  decibelMonitor = new DecibelMonitor(meetingStream, handleDecibelLevel);
  currentRecorder = new Recorder(meetingStream);
  showScreen('screen-meeting');
}

async function runAnalysis(blob) {
  showScreen('screen-analyzing');
  const recordingUrl = await uploadRecording(currentBookId, blob);
  const book = allBooks.find((b) => b.id === currentBookId);
  const summary = generateMockSummary(book ? book.title : '');
  await updateBook(currentBookId, { recordingUrl, summary });
  document.getElementById('summary-text').textContent = summary;
  showScreen('screen-summary');
}

subscribeBooks((books) => {
  allBooks = books;
  renderBookSlider(books, handleBookClick, handleAddClick);
  if (currentBookId) {
    const updated = books.find((b) => b.id === currentBookId);
    if (updated) renderBookDetail(updated);
  }
});

document.getElementById('search-close-btn').addEventListener('click', () => showScreen('screen-main'));

document.getElementById('search-btn').addEventListener('click', async () => {
  const query = document.getElementById('search-input').value.trim();
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  if (!query) return;

  let results;
  try {
    results = await searchBooks(query);
  } catch (err) {
    resultsEl.innerHTML = '<li>검색 중 오류가 발생했습니다. 다시 시도해주세요.</li>';
    return;
  }

  if (results.length === 0) {
    resultsEl.innerHTML = '<li>검색 결과가 없습니다.</li>';
    return;
  }

  results.forEach((book) => {
    const li = document.createElement('li');
    li.textContent = `${book.title} - ${book.authors}`;
    li.addEventListener('click', async () => {
      const bookId = await addBook(book);
      document.getElementById('search-input').value = '';
      resultsEl.innerHTML = '';
      handleBookClick(bookId);
    });
    resultsEl.appendChild(li);
  });
});

document.getElementById('detail-back-btn').addEventListener('click', () => {
  currentBookId = null;
  showScreen('screen-main');
});

document.getElementById('start-meeting-btn').addEventListener('click', startMeeting);

document.getElementById('meeting-finish-btn').addEventListener('click', async () => {
  decibelMonitor.stop();
  meetingStream.getTracks().forEach((t) => t.stop());
  const blob = await currentRecorder.stop();
  await runAnalysis(blob);
});

document.getElementById('upload-recording-btn').addEventListener('click', () => showScreen('screen-upload'));
document.getElementById('upload-back-btn').addEventListener('click', () => showScreen('screen-detail'));

document.getElementById('upload-file-input').addEventListener('change', (e) => {
  uploadedFile = e.target.files[0] || null;
  document.getElementById('upload-confirm-btn').disabled = !uploadedFile;
});

document.getElementById('upload-confirm-btn').addEventListener('click', async () => {
  if (!uploadedFile) return;
  await runAnalysis(uploadedFile);
});

document.getElementById('summary-continue-btn').addEventListener('click', () => showScreen('screen-participant-count'));

document.getElementById('participant-count-confirm').addEventListener('click', () => {
  const count = Number(document.getElementById('participant-count-input').value);
  if (!count || count < 1) {
    alert('1명 이상의 인원수를 입력해주세요.');
    return;
  }
  renderReviewsForm(count);
  showScreen('screen-reviews-form');
});

document.getElementById('reviews-save-btn').addEventListener('click', async () => {
  const reviews = collectReviews();
  const avgRating = calcAverage(reviews);
  const participantCount = reviews.length;

  await updateBook(currentBookId, {
    status: 'analyzed',
    reviews,
    avgRating,
    participantCount,
  });

  currentBookId = null;
  showScreen('screen-main');
});

startSplashAnimation();
```

- [ ] **Step 2: 문법 오류 확인**

Run: `node --check js/app.js`
Expected: 출력 없이 exit code 0

- [ ] **Step 3: 단위 테스트 전체 재실행 (회귀 없는지 확인)**

Run: `npm test`
Expected: 기존 9개 테스트 모두 PASS

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "refactor: consolidate app.js into single coherent state machine"
```

---

### Task 12: Firebase 프로젝트 연결 + 전체 흐름 수동 스모크 테스트

**Files:**
- Modify: `js/firebaseConfig.js`

**Interfaces:**
- Consumes: 모든 이전 태스크

- [ ] **Step 1: Firebase 프로젝트 생성**

https://console.firebase.google.com 에서 새 프로젝트 생성 → Firestore Database 활성화(테스트 모드) → Storage 활성화(테스트 모드) → 프로젝트 설정에서 웹 앱 추가 후 `firebaseConfig` 값 확인

- [ ] **Step 2: js/firebaseConfig.js의 REPLACE_ME 값을 실제 설정값으로 교체**

```javascript
// js/firebaseConfig.js (예시 형태, 실제 발급된 값으로 채울 것)
export const firebaseConfig = {
  apiKey: '실제_API_KEY',
  authDomain: '실제_PROJECT_ID.firebaseapp.com',
  projectId: '실제_PROJECT_ID',
  storageBucket: '실제_PROJECT_ID.appspot.com',
  messagingSenderId: '실제_SENDER_ID',
  appId: '실제_APP_ID',
};
```

- [ ] **Step 3: Firestore/Storage 보안 규칙을 오픈 액세스로 설정 (테스트 모드 기본값이 30일 제한이므로 명시적으로 갱신)**

Firestore 규칙:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /books/{bookId} {
      allow read, write: if true;
    }
  }
}
```

Storage 규칙:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /recordings/{bookId}/{fileName} {
      allow read, write: if true;
    }
  }
}
```

- [ ] **Step 4: webapp-testing 스킬로 전체 흐름 스모크 테스트**

Run: `python3 -m http.server 8000` 후 Playwright(webapp-testing 스킬)로 다음을 순서대로 확인
1. 스플래시 로고 표시 → 자동으로 메인 화면 전환
2. `+` 클릭 → 검색창에 실제 책 제목 입력 → 검색 결과 표시 → 하나 선택
3. 책 상세(미분석) 화면에 표지/제목/저자와 두 버튼 노출
4. "독서모임 시작" → 마이크 권한 허용 → 데시벨에 따라 배경색 변화 확인 → "완료" 클릭
5. "분석중..." 후 mock 요약 표시 → "다음" → 인원수 2 입력 → 리뷰 폼 2쌍 표시 → 각각 입력 후 "저장"
6. 메인 화면으로 복귀, 방금 추가한 책이 슬라이더 맨 오른쪽(가장 최신)에 위치
7. 해당 책 클릭 → 분석완료 화면에 요약/평균별점/리뷰 목록 표시

Expected: 위 7단계가 오류 없이 모두 통과, Firebase 콘솔의 Firestore/Storage에 실제 데이터가 생성됨

- [ ] **Step 5: Commit**

```bash
git add js/firebaseConfig.js
git commit -m "chore: connect real firebase project config"
```
