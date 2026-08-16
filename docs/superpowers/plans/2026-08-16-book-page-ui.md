# 책 모양 UI 및 로고 고정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스플래시/메인(목록) 화면을 제외한 8개 화면을 흰색 "펼쳐진 책" 모양으로 표시하고, 화면 전환 시 페이지 넘김 애니메이션을 적용하며, 로고(assets/logo.png)를 스플래시에서 메인 화면 상단으로 이어지도록 고정한다.

**Architecture:** 순수 CSS 레이어 변경 — 기존 `index.html`의 각 화면 내용을 `.book > .book-page` 래퍼로 감싸고, `js/screens.js`의 `showScreen()`에 로고 상태 전환 및 페이지 넘김 애니메이션 재생 로직을 추가한다. Firebase/검색/녹음/분석 로직은 전혀 건드리지 않는다.

**Tech Stack:** 순수 HTML/CSS/JS (기존과 동일), 외부 라이브러리 없음.

## Global Constraints

- 빌드 도구/프레임워크 없음 — 순수 HTML/CSS/JS
- 이번 작업은 UI/CSS/애니메이션 레이어만 변경 — Firebase 데이터 흐름, 이벤트 핸들러의 비즈니스 로직(검색/녹음/분석/저장)은 수정하지 않음. 모든 기존 엘리먼트 id는 그대로 유지되어야 함 (js/app.js의 `document.getElementById(...)` 호출이 전부 그대로 동작해야 하므로)
- 책 모양 적용 대상 8개 화면: `screen-search`, `screen-detail`, `screen-meeting`, `screen-upload`, `screen-analyzing`, `screen-summary`, `screen-participant-count`, `screen-reviews-form`
- `screen-meeting`의 데시벨 색상 변화는 `.book-page` 영역 배경색으로 적용 (전체화면 배경색 아님)
- 로고 이미지 경로: `assets/logo.png`
- 로고 상태: 스플래시(중앙, 큼) → 메인 화면(상단 고정, 작음) → 그 외 화면(숨김)
- 페이지 넘김은 순수 CSS `perspective`+`rotateY`+opacity 애니메이션으로 구현, 라이브러리 사용 금지
- 기존 9개 `node:test` 단위 테스트(`js/decibel.js`, `js/ratings.js`, `js/mockAnalysis.js`)는 이번 작업과 무관하므로 회귀 없이 계속 통과해야 함

---

### Task 1: index.html 구조 변경 (로고 분리 + 책 래퍼 적용)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `<img id="app-logo">` 엘리먼트 (모든 `.screen` 바깥에 위치, 초기 클래스 `logo-splash`), 8개 화면 각각에 `.book > .book-page` 래퍼 (기존 콘텐츠는 `.book-page` 안으로 이동, 엘리먼트 id는 전부 그대로 유지)

- [ ] **Step 1: index.html 전체를 아래 내용으로 교체**

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
  <img id="app-logo" src="assets/logo.png" alt="책책책 책좀 읽읍시다" class="logo-splash" />

  <section id="screen-splash" class="screen active"></section>

  <section id="screen-main" class="screen">
    <div id="book-slider" class="book-slider"></div>
  </section>

  <section id="screen-search" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <button id="search-close-btn" class="btn-close">✕</button>
        <input id="search-input" type="text" placeholder="책 제목을 검색하세요" />
        <button id="search-btn">검색</button>
        <ul id="search-results"></ul>
      </div>
    </div>
  </section>

  <section id="screen-detail" class="screen book-screen">
    <div class="book">
      <div class="book-page">
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
      </div>
    </div>
  </section>

  <section id="screen-meeting" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <div id="meeting-bg" class="meeting-bg">
          <p id="meeting-warning" class="meeting-warning hidden">조금만 조용히 해주세요 🤫</p>
          <button id="meeting-finish-btn">완료</button>
        </div>
      </div>
    </div>
  </section>

  <section id="screen-upload" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <button id="upload-back-btn" class="btn-close">✕</button>
        <input id="upload-file-input" type="file" accept="audio/*" />
        <button id="upload-confirm-btn" disabled>분석 시작</button>
      </div>
    </div>
  </section>

  <section id="screen-analyzing" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <p>분석중...</p>
      </div>
    </div>
  </section>

  <section id="screen-summary" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <h3>모임 요약</h3>
        <p id="summary-text"></p>
        <button id="summary-continue-btn">다음</button>
      </div>
    </div>
  </section>

  <section id="screen-participant-count" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <label for="participant-count-input">참석 인원수</label>
        <input id="participant-count-input" type="number" min="1" step="1" />
        <button id="participant-count-confirm">확인</button>
      </div>
    </div>
  </section>

  <section id="screen-reviews-form" class="screen book-screen">
    <div class="book">
      <div class="book-page">
        <div id="reviews-form-container"></div>
        <button id="reviews-save-btn">저장</button>
      </div>
    </div>
  </section>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 필수 엘리먼트 id가 모두 보존되었는지 확인**

Run:
```bash
for id in app-logo screen-splash screen-main book-slider screen-search search-close-btn search-input search-btn search-results screen-detail detail-back-btn detail-cover detail-title detail-authors detail-pending-actions start-meeting-btn upload-recording-btn detail-analyzed-content detail-summary detail-avg-rating detail-reviews screen-meeting meeting-bg meeting-warning meeting-finish-btn screen-upload upload-back-btn upload-file-input upload-confirm-btn screen-analyzing screen-summary summary-text summary-continue-btn screen-participant-count participant-count-input participant-count-confirm screen-reviews-form reviews-form-container reviews-save-btn; do
  grep -q "id=\"$id\"" index.html || echo "MISSING: $id"
done
```
Expected: 아무 출력 없음 (모든 id 존재)

- [ ] **Step 3: 8개 화면에 book-screen/book/book-page 래퍼가 적용되었는지 확인**

Run: `grep -c 'class="screen book-screen"' index.html`
Expected: `8`

Run: `grep -c '<div class="book">' index.html`
Expected: `8`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: restructure screens into book-page layout, extract standalone logo"
```

---

### Task 2: css/style.css — 로고 상태, 책 프레임, 페이지 넘김 애니메이션

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Consumes: Task 1의 `#app-logo`, `.book-screen`, `.book`, `.book-page` 구조
- Produces: `.logo-splash`/`.logo-docked`/`.logo-hidden` 클래스로 로고 위치 제어, `.book.page-turn` 클래스로 재생되는 `page-turn-in` 키프레임 애니메이션

- [ ] **Step 1: css/style.css 전체를 아래 내용으로 교체**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, "Apple SD Gothic Neo", sans-serif;
  height: 100vh;
  overflow: hidden;
  background: #e8e8e8;
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

#app-logo {
  position: fixed;
  left: 50%;
  z-index: 100;
  transition: top 0.8s ease, width 0.8s ease;
  transform: translate(-50%, -50%);
}

#app-logo.logo-splash {
  top: 50%;
  width: 280px;
}

#app-logo.logo-docked {
  top: 56px;
  width: 96px;
}

#app-logo.logo-hidden {
  display: none;
}

#screen-splash {
  align-items: center;
  justify-content: center;
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

.book-screen {
  align-items: center;
  justify-content: center;
  perspective: 1600px;
}

.book {
  width: 90%;
  max-width: 720px;
  height: 80vh;
  max-height: 560px;
  background: #ffffff;
  border-radius: 6px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  position: relative;
  transform-origin: right center;
}

.book::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 24px;
  height: 100%;
  transform: translateX(-50%);
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.08),
    rgba(0, 0, 0, 0) 50%,
    rgba(0, 0, 0, 0.08)
  );
  pointer-events: none;
}

.book-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@keyframes page-turn-in {
  from {
    transform: rotateY(-90deg);
    opacity: 0;
  }
  to {
    transform: rotateY(0deg);
    opacity: 1;
  }
}

.book.page-turn {
  animation: page-turn-in 0.45s ease-out;
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

#screen-meeting .book-page {
  padding: 0;
}

.meeting-bg {
  flex: 1;
  width: 100%;
  height: 100%;
  border-radius: 6px;
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

- [ ] **Step 2: 이전 버전에 있던 `.splash-logo`/`.modal`/`.modal-box` 관련 스타일이 남아있지 않은지 확인**

Run: `grep -E '\.splash-logo|\.modal-box|^\.modal ' css/style.css`
Expected: 아무 출력 없음 (Task 1에서 해당 클래스를 쓰는 HTML을 이미 제거했으므로 CSS에도 남아있으면 안 됨)

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add book-page frame, page-turn animation, and logo docking styles"
```

---

### Task 3: 로고 상태 전환 및 페이지 넘김 애니메이션 재생 로직

**Files:**
- Modify: `js/screens.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: Task 1의 `#app-logo`, `.book-screen`, `.book` (CSS 클래스 `logo-splash`/`logo-docked`/`logo-hidden`/`page-turn`은 Task 2에서 정의됨)
- Produces: `showScreen(screenId)`가 화면 전환마다 (1) 로고를 메인 화면에서는 보이고 그 외 화면(스플래시 제외)에서는 숨기며, (2) `.book-screen`으로 진입할 때마다 `.book`에 `page-turn` 클래스를 재적용해 애니메이션을 매번 재생시킴

- [ ] **Step 1: js/screens.js를 아래 내용으로 교체**

```javascript
// js/screens.js
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === screenId);
  });

  const logo = document.getElementById('app-logo');
  if (screenId === 'screen-main') {
    logo.classList.remove('logo-hidden');
  } else if (screenId !== 'screen-splash') {
    logo.classList.add('logo-hidden');
  }

  const activeScreen = document.getElementById(screenId);
  if (activeScreen && activeScreen.classList.contains('book-screen')) {
    const book = activeScreen.querySelector('.book');
    if (book) {
      book.classList.remove('page-turn');
      void book.offsetWidth; // 강제 리플로우: 같은 화면에 재진입해도 애니메이션이 다시 재생되도록 함
      book.classList.add('page-turn');
    }
  }
}
```

- [ ] **Step 2: js/app.js의 `startSplashAnimation` 함수를 아래 내용으로 교체**

기존:
```javascript
function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}
```

교체 후:
```javascript
function startSplashAnimation() {
  const logo = document.getElementById('app-logo');
  setTimeout(() => {
    logo.classList.remove('logo-splash');
    logo.classList.add('logo-docked');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}
```

파일의 다른 부분(다른 함수, 이벤트 리스너)은 전혀 수정하지 않는다.

- [ ] **Step 3: 문법 오류 확인**

Run: `node --check js/screens.js && node --check js/app.js`
Expected: 출력 없이 exit code 0

- [ ] **Step 4: 기존 단위 테스트 회귀 확인**

Run: `npm test`
Expected: 9/9 PASS (이번 작업은 DOM/CSS 레이어만 건드리므로 순수 로직 테스트는 영향받지 않아야 함)

- [ ] **Step 5: Commit**

```bash
git add js/screens.js js/app.js
git commit -m "feat: wire logo docking and page-turn animation replay into showScreen"
```

---

### Task 4: 전체 화면 수동 스모크 테스트

**Files:**
- 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 1~3의 모든 변경사항

- [ ] **Step 1: 로컬 서버로 브라우저에서 전체 흐름 확인**

Run: `python3 -m http.server 8000` (프로젝트 루트에서)

브라우저에서 `http://localhost:8000` 접속 후 다음을 확인한다:

1. 진입 시 로고(assets/logo.png)가 화면 중앙에 크게 표시됨
2. 약 1.2초 후 로고가 위로 이동하며 작아지고, 메인(책 슬라이더) 화면으로 전환됨. 전환 후에도 로고가 화면 상단에 계속 보임
3. `+` 버튼 클릭 → 검색 화면이 흰색 "펼쳐진 책" 모양으로 오른쪽에서 페이지가 넘어오듯 나타남. 이때 상단 로고는 사라짐
4. 검색 결과에서 책 선택 → 책 상세 화면도 동일한 책 모양 + 페이지 넘김으로 전환됨
5. "독서모임 시작" 클릭 → 마이크 권한 허용 → 모임 화면도 책 모양으로 나타나되, 데시벨에 따라 책 페이지 내부(`.book-page`) 배경색이 바뀌는지 확인 (화면 전체가 아니라 책 영역만)
6. "완료" → 분석중 → 요약 → 인원수 입력 → 리뷰 폼까지 각 화면 전환마다 책 모양 + 페이지 넘김 애니메이션이 재생되는지 확인
7. 저장 후 메인 화면으로 돌아오면 다시 상단에 로고가 보이는지 확인

Expected: 위 7단계가 모두 설계대로 동작, 콘솔에 에러 없음

- [ ] **Step 2: 회귀 확인**

Run: `npm test`
Expected: 9/9 PASS
