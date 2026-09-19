# 레트로 윈도우 스킨 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `reading-club` 사이트를 `웹사이트작업/` 레퍼런스 스크린샷과 동일한 레트로 윈도우 스킨으로 재작업하고, 검색을 우측 패널 인라인 뷰로, 별점 입력을 총점 클릭 팝업으로, 녹음 시작 전 2단계 화면과 데시벨 기반 길잡이 캐릭터 반응을 추가한다.

**Architecture:** 정적 사이트(빌드 없음, ES 모듈을 브라우저에서 직접 로드). `js/app.js`가 상태(`mainView` 등)를 들고 있고, `js/bookSlider.js`의 `renderBookSlider()`가 매 상태 변화마다 `#book-slider`(좌측 사이드바)와 `#month-detail`(우측 패널) DOM을 통째로 다시 그리는 구조. 이번 작업도 이 패턴을 유지하며 CSS 토큰 교체 + `bookSlider.js` 렌더 함수 확장 + 작은 순수 로직 모듈(`guideState.js`) 추가로 구현한다.

**Tech Stack:** Vanilla JS (ES modules), CSS (변수 기반), Firebase (Firestore/Storage, 변경 없음), `node --test` 기반 유닛 테스트.

## Global Constraints

- 백엔드/Firebase 데이터 모델은 변경하지 않는다 (spec 참고: `docs/superpowers/specs/2026-09-20-retro-redesign-design.md`).
- `js/decibel.js`, `js/decibelMonitor.js`의 데시벨 측정/분류 로직 자체는 수정하지 않는다. 그 결과값을 소비하는 UI 레이어만 추가한다.
- `assets/logo.png`, `assets/back.jpg`는 교체하지 않는다 (기존 로고 유지, 사용자 확정 사항).
- 커스텀 스크롤바 화살표 버튼의 완전한 픽셀 재현은 하지 않는다 (네이티브 스크롤 + 시각적 톤만 근접).
- 이번 리스킨은 **데스크톱 레이아웃(레퍼런스 스크린샷과 동일 해상도대)을 기준**으로 하고, 기존 `@media (max-width: 760px)` 모바일 레이아웃은 구조/동작을 그대로 유지한 채 색상 토큰만 새 팔레트를 상속받는다 (모바일 전용 픽셀 리스킨은 이번 범위 밖).
- 커밋은 태스크 단위로 작게 나눠서 한다.

---

## 파일 구조 개요

| 파일 | 역할 |
|---|---|
| `index.html` | 죽은 레거시 화면 제거, 제목바 마크업 추가 |
| `css/style.css` | 컬러 토큰/전역 크롬/버튼/스크롤바/팝업/캐릭터 스타일 전면 개편 |
| `js/app.js` | `mainView` 상태에 `meeting-intro` 추가, 길잡이 상태 연동, 리뷰 팝업 핸들러 연결, 죽은 이벤트 리스너 제거 |
| `js/bookSlider.js` | 검색 패널 인라인화, 총점 팝업 렌더, 시작 전 화면 렌더, 길잡이 캐릭터 렌더 |
| `js/guideState.js` | **신규.** 데시벨 레벨 + 경과시간 → 길잡이 상태를 계산하는 순수 함수 |
| `js/bookDetail.js` | **삭제.** 죽은 레거시 렌더러 |
| `test/guideState.test.js` | **신규.** `guideState.js` 유닛 테스트 |
| `assets/buttons/`, `assets/characters/` | **신규.** 레퍼런스 png 에셋 복사본 |

---

## Task 1: 죽은 레거시 화면/코드 제거

현재 `index.html`의 `#screen-search`, `#screen-detail`, `#screen-upload` 섹션과 `js/bookDetail.js`, 그리고 `js/app.js`의 관련 이벤트 리스너는 실제로는 절대 화면에 노출되지 않는 죽은 코드다. `js/screens.js`의 `showScreen()`은 `'screen-splash'`, `'screen-main'` 두 값만 받는데, 실제 검색/상세/녹음 UI는 전부 `js/bookSlider.js`가 `#book-slider`/`#month-detail`(둘 다 `#screen-main` 내부) 안에 직접 그리는 방식으로 이미 대체되어 있다. 리스킨 작업 전에 이 죽은 코드를 지워서 혼동을 없앤다.

**Files:**
- Modify: `index.html`
- Modify: `js/app.js:1-17` (import), `js/app.js:665` (`renderBookDetail` 호출), `js/app.js:670-734` (죽은 리스너들)
- Delete: `js/bookDetail.js`
- Modify: `css/style.css` (죽은 셀렉터 제거)

**Interfaces:**
- Consumes: 없음 (순수 삭제 작업)
- Produces: 이후 태스크가 다룰 `index.html`의 최종 구조 — `<body>` 안에 남는 것은 `#app-logo`, `#upload-file-input`, `#screen-splash`, `#screen-main` 뿐.

- [ ] **Step 1: `index.html`에서 죽은 섹션 제거**

`index.html`에서 아래 블록들을 삭제한다 (모두 `showScreen()`으로 절대 활성화되지 않는 섹션):

```html
  <section id="screen-search" class="screen book-screen">
    ...
  </section>

  <section id="screen-detail" class="screen book-screen">
    ...
  </section>

  <section id="screen-upload" class="screen book-screen">
    ...
  </section>
```

`#upload-file-input`(네이티브 업로드 인풋)은 `js/app.js`의 `openUploadScreen()`/change 리스너가 실제로 사용하므로 **그대로 남긴다**.

- [ ] **Step 2: `js/app.js`에서 죽은 코드 제거**

`import { renderBookDetail } from './bookDetail.js';` 줄을 삭제한다.

`subscribeCurrentClub()` 안의 아래 두 줄을 삭제한다:

```js
    if (currentBookId) {
      const updated = books.find((b) => b.id === currentBookId);
      if (updated) renderBookDetail(updated);
    }
```

아래 죽은 이벤트 리스너 블록들을 전부 삭제한다 (파일 하단, `document.getElementById('search-close-btn')...`부터 `document.getElementById('upload-back-btn')...`까지, `upload-file-input`의 `change` 리스너는 **유지**):

```js
document.getElementById('search-close-btn').addEventListener('click', () => {
  mainView = 'detail';
  showScreen('screen-main');
});

document.getElementById('search-btn').addEventListener('click', async () => {
  ...
});

document.getElementById('detail-back-btn').addEventListener('click', () => {
  currentBookId = null;
  showScreen('screen-main');
});

document.getElementById('start-meeting-btn').addEventListener('click', () => {
  if (!currentBookId) return;
  openMeetingRules();
});

document.getElementById('upload-recording-btn').addEventListener('click', () => openUploadScreen());
document.getElementById('upload-back-btn').addEventListener('click', () => showScreen('screen-main'));
```

- [ ] **Step 3: `js/bookDetail.js` 삭제**

```bash
rm js/bookDetail.js
```

- [ ] **Step 4: `css/style.css`에서 죽은 셀렉터 제거**

아래 셀렉터/규칙 블록을 삭제한다 (모두 삭제된 마크업에만 쓰이던 것):
`.book-screen`, `.book`, `.book::before`, `.book-page`, `.book-page input, .book-page textarea, .book-page select`, `.book-page textarea`, `#search-results`, `#search-results li`, `.btn-close`, `.detail-cover`.

`.detail-action-primary, .detail-action-secondary, #search-btn, #start-meeting-btn, #upload-recording-btn, #upload-confirm-btn { ... }` 규칙에서 `#search-btn, #start-meeting-btn, #upload-recording-btn, #upload-confirm-btn`를 셀렉터 목록에서 제거하고 `.detail-action-primary, .detail-action-secondary`만 남긴다 (바로 아래 두 규칙도 동일하게 정리).

- [ ] **Step 5: 회귀 테스트 및 수동 확인**

```bash
npm test
```
Expected: 기존 3개 테스트 파일 모두 PASS (이 태스크는 로직을 건드리지 않으므로 실패하면 안 됨).

로컬 서버로 수동 확인:
```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000`을 열고 클럽 생성 → 검색 → 책 추가 → 상세 화면 → "독서모임 시작" → "완료"까지 기존과 동일하게 동작하는지 확인 (콘솔 에러 없어야 함).

- [ ] **Step 6: Commit**

```bash
git add index.html js/app.js js/bookDetail.js css/style.css
git commit -m "$(cat <<'EOF'
사용되지 않는 레거시 검색/상세/업로드 화면 마크업 제거

showScreen()이 절대 활성화하지 않는 죽은 섹션(#screen-search,
#screen-detail, #screen-upload)과 그에 딸린 JS/CSS를 정리해
이후 리디자인 작업의 혼동을 없앤다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 에셋 파일 복사

`웹사이트작업/버튼 에셋들/`, `웹사이트작업/캐릭터/`의 png들을 사이트 에셋 경로로 복사한다. 원본 폴더는 그대로 둔다.

**Files:**
- Create: `assets/buttons/*.png`
- Create: `assets/characters/*.png`

**Interfaces:**
- Consumes: 없음
- Produces: 이후 태스크가 참조할 정확한 파일 경로 목록 (아래 Step 1에서 확정).

- [ ] **Step 1: 대상 폴더 생성 및 파일 목록 확인**

```bash
mkdir -p assets/buttons assets/characters
ls "웹사이트작업/버튼 에셋들/버튼_선택전" "웹사이트작업/버튼 에셋들/버튼_선택후" "웹사이트작업/버튼 에셋들/에셋들"
ls "웹사이트작업/캐릭터"
```

- [ ] **Step 2: 복사**

```bash
cp "웹사이트작업/버튼 에셋들/버튼_선택전/"* assets/buttons/ 2>/dev/null
cp "웹사이트작업/버튼 에셋들/버튼_선택후/"* assets/buttons/ 2>/dev/null
cp "웹사이트작업/버튼 에셋들/에셋들/"* assets/buttons/ 2>/dev/null
cp "웹사이트작업/캐릭터/"*.png assets/characters/
```

파일명에 한글/공백이 섞여 있으므로, 복사 후 `ls assets/buttons assets/characters`로 실제 파일명을 확인하고 이 태스크 결과에 **정확한 최종 파일명 목록**을 기록해 다음 태스크(버튼/캐릭터 CSS·JS 연동)에서 그대로 참조할 수 있게 한다. 파일명에 공백이 있으면 CSS `url()`/JS 문자열에서 문제가 없도록 각 파일을 언더스코어(`_`)로 리네임한다 (예: `책1_금지.png`는 이미 언더스코어라 그대로, "버튼 선택전 1.png" 같은 공백 포함 이름이 있으면 `버튼_선택전_1.png`로 변경).

```bash
cd assets/buttons && for f in *' '*; do mv "$f" "$(echo "$f" | tr ' ' '_')"; done 2>/dev/null; cd -
cd assets/characters && for f in *' '*; do mv "$f" "$(echo "$f" | tr ' ' '_')"; done 2>/dev/null; cd -
```

- [ ] **Step 3: 결과 기록**

```bash
ls assets/buttons assets/characters
```

이 출력 결과(정확한 파일명)를 다음 커밋 메시지와 이후 태스크 구현 시 참고 목록으로 남긴다.

- [ ] **Step 4: Commit**

```bash
git add assets/buttons assets/characters
git commit -m "$(cat <<'EOF'
레트로 버튼/캐릭터 에셋 추가

웹사이트작업/ 레퍼런스 폴더의 버튼(선택전/후)과 책 캐릭터 7종
png를 assets/buttons, assets/characters로 복사.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 길잡이 캐릭터 상태머신 (`js/guideState.js`)

`decibelMonitor.js`가 매 애니메이션 프레임마다 `quiet`/`moderate`/`loud` 레벨을 콜백으로 전달한다(`js/app.js:412`의 `handleDecibelLevel`). 이 레벨과 "현재 레벨이 시작된 시각"을 받아서, 길잡이 캐릭터가 어떤 상태(조용함 8초 지속→도움, 보통 상태 30초마다→응원, 큰소리 5초 지속→경고, 큰소리 15초 지속→싸움 차단)인지 계산하는 **순수 함수**를 만든다. DOM이나 타이머를 직접 다루지 않아 유닛 테스트가 가능하다.

**Files:**
- Create: `js/guideState.js`
- Test: `test/guideState.test.js`

**Interfaces:**
- Produces:
  - `export const GUIDE_STATES = { NONE: 'none', IDLE_HELP: 'idle-help', ENCOURAGE: 'encourage', WARN_LOUD: 'warn-loud', BLOCK_FIGHT: 'block-fight' }`
  - `export const QUIET_HELP_MS = 8000`
  - `export const LOUD_WARN_MS = 5000`
  - `export const LOUD_BLOCK_MS = 15000`
  - `export const ENCOURAGE_INTERVAL_MS = 30000`
  - `export function computeGuideState({ level, levelSinceMs, now, lastEncourageAt }): string` — `level`은 `'quiet' | 'moderate' | 'loud'`, `levelSinceMs`/`now`/`lastEncourageAt`는 epoch ms(숫자). `lastEncourageAt`은 `null` 가능. 반환값은 `GUIDE_STATES`의 값 중 하나.
  - Task 11(`js/app.js`)이 이 함수와 상수들을 그대로 import해서 사용한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`test/guideState.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGuideState,
  GUIDE_STATES,
  QUIET_HELP_MS,
  LOUD_WARN_MS,
  LOUD_BLOCK_MS,
  ENCOURAGE_INTERVAL_MS,
} from '../js/guideState.js';

test('quiet: 임계값 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - (QUIET_HELP_MS - 1),
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('quiet: 8초 이상 지속되면 IDLE_HELP', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - QUIET_HELP_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.IDLE_HELP);
});

test('loud: 5초 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - (LOUD_WARN_MS - 1),
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('loud: 5초 이상 15초 미만이면 WARN_LOUD', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - LOUD_WARN_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.WARN_LOUD);
});

test('loud: 15초 이상이면 BLOCK_FIGHT', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - LOUD_BLOCK_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.BLOCK_FIGHT);
});

test('moderate: lastEncourageAt이 null이면 바로 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});

test('moderate: 마지막 격려 후 interval 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: now - (ENCOURAGE_INTERVAL_MS - 1),
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('moderate: 마지막 격려 후 interval 이상이면 다시 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: now - ENCOURAGE_INTERVAL_MS,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
node --test test/guideState.test.js
```
Expected: FAIL (`js/guideState.js` 모듈이 없어서 import 에러).

- [ ] **Step 3: 최소 구현 작성**

`js/guideState.js`:

```js
// js/guideState.js
export const GUIDE_STATES = {
  NONE: 'none',
  IDLE_HELP: 'idle-help',
  ENCOURAGE: 'encourage',
  WARN_LOUD: 'warn-loud',
  BLOCK_FIGHT: 'block-fight',
};

export const QUIET_HELP_MS = 8000;
export const LOUD_WARN_MS = 5000;
export const LOUD_BLOCK_MS = 15000;
export const ENCOURAGE_INTERVAL_MS = 30000;

export function computeGuideState({ level, levelSinceMs, now, lastEncourageAt }) {
  const elapsed = now - levelSinceMs;

  if (level === 'quiet') {
    return elapsed >= QUIET_HELP_MS ? GUIDE_STATES.IDLE_HELP : GUIDE_STATES.NONE;
  }

  if (level === 'loud') {
    if (elapsed >= LOUD_BLOCK_MS) return GUIDE_STATES.BLOCK_FIGHT;
    if (elapsed >= LOUD_WARN_MS) return GUIDE_STATES.WARN_LOUD;
    return GUIDE_STATES.NONE;
  }

  const sinceEncourage = lastEncourageAt === null ? Infinity : now - lastEncourageAt;
  return sinceEncourage >= ENCOURAGE_INTERVAL_MS ? GUIDE_STATES.ENCOURAGE : GUIDE_STATES.NONE;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test test/guideState.test.js
```
Expected: 8개 테스트 모두 PASS.

```bash
npm test
```
Expected: 전체(4개 파일) PASS.

- [ ] **Step 5: Commit**

```bash
git add js/guideState.js test/guideState.test.js
git commit -m "$(cat <<'EOF'
데시벨 기반 길잡이 캐릭터 상태머신 추가

quiet/moderate/loud 레벨과 경과 시간을 받아 idle-help/encourage/
warn-loud/block-fight 상태를 계산하는 순수 함수 computeGuideState 추가.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 레트로 비주얼 토큰 & 전역 크롬

`css/style.css`의 컬러 토큰을 레퍼런스 팔레트로 교체하고, 제목바("책 쫌 읽읍시다" + `?` 버튼) 마크업을 추가한다. `.main-layout`(사이드바+패널 2단 구조)은 그대로 재사용한다.

**Files:**
- Modify: `index.html` (제목바 마크업 추가)
- Modify: `css/style.css:1-38` (`:root`, `body`), `css/style.css:172-224` (`.main-layout`, `.main-left`), `css/style.css:445-455` (`.month-detail`)

**Interfaces:**
- Produces: `--titlebar-height` CSS 변수(이후 태스크의 sticky 헤더 계산에 사용 가능), `.app-titlebar` 마크업/클래스 (이후 필요 시 참조).

- [ ] **Step 1: `index.html`에 제목바 추가**

`<section id="screen-main" class="screen">` 여는 태그 바로 다음, `<div class="main-layout">` 앞에 추가:

```html
    <header class="app-titlebar">
      <span class="app-titlebar-title">책 쫌 읽읍시다</span>
      <button type="button" class="app-titlebar-help" aria-label="도움말">?</button>
    </header>
```

(`.main-layout`을 감싸는 `<div class="main-layout">`가 실제로는 `js/app.js`가 아니라 `index.html`에 없고 `js/bookSlider.js`가 `#book-slider`/`#month-detail`을 직접 채우는 구조이므로, `#screen-main` 안의 기존 구조를 확인 후 제목바를 `#screen-main` 최상단 자식으로 넣는다. `index.html`을 열어 `<section id="screen-main" class="screen"> <div class="main-layout"> ... `의 정확한 현재 구조를 그대로 보존하면서 그 앞에 `<header class="app-titlebar">`만 형제로 추가한다.)

- [ ] **Step 2: 컬러 토큰 교체**

`css/style.css`의 `:root` 블록을 다음으로 교체:

```css
:root {
  --ink: #1a1a1a;
  --muted: #6b6b60;
  --line: #999999;
  --paper: #ffffff;
  --panel: #ffffff;
  --orange: #ff4a14;
  --green: #2f8f6b;

  --retro-cream: #ede8dc;
  --retro-titlebar-start: #4a6fc0;
  --retro-titlebar-end: #8fb3f0;
  --retro-border: #8c8c84;
  --retro-warn-orange-start: #ffd9a0;
  --retro-warn-orange-end: #ff9a3d;
  --retro-warn-pink-start: #ffe3ee;
  --retro-warn-pink-end: #ff9ac0;
  --titlebar-height: 44px;

  --detail-copy-size: clamp(1.1rem, 2.05vw, 2.3rem);
  --detail-copy-line: 1.22;
  --magazine-copy-size: clamp(0.95rem, 1.45vw, 1.55rem);
  --magazine-copy-line: 1.55;
  --review-row-size: clamp(0.78rem, 1vw, 1rem);
  --splash-logo-width: min(70vw, 640px);
  --splash-logo-half-height: min(23.333vw, 213px);
  --splash-gate-height: 48px;
  --splash-gap: 18px;
  --splash-center-shift: calc((var(--splash-gap) + var(--splash-gate-height)) / 2);
  --main-outer-gutter: clamp(24px, 4vw, 64px);
  --main-column-gap: clamp(24px, 4vw, 64px);
}
```

`body` 규칙에서 `background: #ffffff;`를 `background: var(--retro-cream);`로 변경한다.

- [ ] **Step 3: 제목바 스타일 추가**

`css/style.css`의 `.main-layout` 규칙 앞에 추가:

```css
.app-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--titlebar-height);
  padding: 0 16px;
  border-bottom: 2px solid var(--retro-border);
  background: linear-gradient(180deg, var(--retro-titlebar-start), var(--retro-titlebar-end));
  color: #ffffff;
  font-weight: 900;
  font-size: 1.05rem;
}

.app-titlebar-help {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid #ffffff;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-weight: 900;
  cursor: pointer;
}

body:has(#screen-main.active) .app-titlebar {
  display: flex;
}

#screen-main:not(.active) .app-titlebar {
  display: none;
}
```

- [ ] **Step 4: 사이드바/패널 배경을 크림/흰색 각진 패널로 변경**

`.main-layout` 규칙에서 `background: #ffffff;`를 `background: var(--retro-cream);`로, `height: 100vh;`를 `height: calc(100vh - var(--titlebar-height));`로 변경한다.

`.main-left` 규칙에서 `background: #ffffff;`를 `background: var(--retro-cream);`로 변경한다.

`.month-detail` 규칙에 `border: 2px solid var(--retro-border);`와 `border-radius: 2px;`, `padding: 0 12px;`를 추가하고 `background: #ffffff;`는 유지한다.

- [ ] **Step 5: 수동 확인**

```bash
python3 -m http.server 8000
```
브라우저로 열어 제목바(파란 그라데이션 + "책 쫌 읽읍시다" + `?` 버튼)가 상단에 보이고, 그 아래 사이드바가 크림색, 우측 패널이 흰 배경에 회색 테두리로 보이는지 확인한다. 콘솔 에러가 없어야 한다.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css
git commit -m "$(cat <<'EOF'
레트로 윈도우 스킨 컬러 토큰 및 제목바 추가

파란 그라데이션 제목바 + 크림색 사이드바 + 각진 회색 테두리 패널로
전역 크롬을 레퍼런스 스타일에 맞춰 교체.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 버튼 에셋 적용

Task 2에서 복사한 버튼 png(선택전/선택후)를 `.detail-action-primary`, `.detail-action-secondary`, `.meeting-confirm-btn`, `.meeting-finish-btn` 등 주요 버튼에 배경 이미지로 적용한다.

**Files:**
- Modify: `css/style.css:716-746` (`.detail-action-primary`, `.detail-action-secondary`), `css/style.css:790-829` (`.meeting-confirm-btn`, `.meeting-finish-btn`)

**Interfaces:**
- Consumes: Task 2에서 확정된 `assets/buttons/` 안의 실제 파일명.

- [ ] **Step 1: 공용 버튼 클래스로 재작성**

Task 2의 Step 3에서 기록한 실제 파일명을 `<선택전-파일명>`, `<선택후-파일명>` 자리에 채워 넣는다. `css/style.css`의 기존 `.detail-action-primary, .detail-action-secondary { ... }` 및 관련 규칙(`button:disabled` 앞까지)을 아래로 교체:

```css
.detail-action-primary,
.detail-action-secondary {
  min-height: 46px;
  padding: 0 22px;
  border: none;
  border-radius: 0;
  background: url('../assets/buttons/<선택전-파일명>') center / 100% 100% no-repeat;
  color: var(--ink);
  font-weight: 800;
  cursor: pointer;
}

.detail-action-primary:hover:not(:disabled),
.detail-action-primary:active:not(:disabled),
.detail-action-secondary:hover:not(:disabled),
.detail-action-secondary:active:not(:disabled) {
  background-image: url('../assets/buttons/<선택후-파일명>');
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
```

(만약 선택전/선택후 에셋이 버튼마다 여러 종류라면, primary/secondary 각각에 가장 범용적인 사각 버튼 한 쌍을 골라 적용하고 나머지는 이후 태스크에서 필요한 곳에만 추가로 지정한다.)

- [ ] **Step 2: 수동 확인**

로컬 서버에서 상세 화면의 "독서모임 시작"/"녹음본 업로드" 버튼에 마우스를 올렸을 때 이미지가 선택후 상태로 바뀌는지 확인한다.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "$(cat <<'EOF'
주요 액션 버튼에 레트로 버튼 에셋 적용

detail-action-primary/secondary에 선택전/선택후 png를 배경으로
적용해 호버 시 버튼이 눌린 것처럼 보이게 함.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 검색을 오버레이 팝업에서 우측 패널 인라인 뷰로 전환

현재 `js/bookSlider.js`의 `renderSearchModal()`은 `document.body`에 `position: fixed` 오버레이(`#month-search-modal`)를 붙이는 방식이다. 이를 `#month-detail` 안에 직접 렌더되는 인라인 뷰로 바꾼다(레퍼런스 "책 검색창" — 사이드바는 그대로 보이고 우측 패널만 검색 화면으로 바뀜).

**Files:**
- Modify: `js/bookSlider.js:538-651` (`removeSearchModal`, `renderSearchModal`, `renderMonthDetail`, `renderBookSlider` 하단)
- Modify: `css/style.css:1012-1147` (`.month-search-*`)

**Interfaces:**
- Consumes: 기존 `handlers.onSearch`, `handlers.onSearchResult`, `handlers.onSearchClose`, `handlers.searchState`(변경 없음).
- Produces: `renderSearchModal(detail, selectedPeriod, searchState, handlers)` — 첫 인자가 `detail`(`#month-detail` 엘리먼트)로 바뀜. 함수명은 유지하되 시그니처가 바뀌므로 호출부(`renderBookSlider` 안)도 함께 수정.

- [ ] **Step 1: `renderSearchModal`을 인라인 렌더 함수로 변경**

`js/bookSlider.js`에서 `removeSearchModal` 함수를 삭제한다(더 이상 body에 별도로 붙이지 않으므로 불필요).

`renderSearchModal`을 아래로 교체 (오버레이/닫기 버튼 제거, `overlay`/`document.body.appendChild` 대신 `detail`에 직접 렌더):

```js
function renderSearchPanel(detail, selectedPeriod, searchState, handlers) {
  const monthTitle = `${selectedPeriod.year}년 ${selectedPeriod.month}월`;

  const panel = document.createElement('div');
  panel.className = 'month-detail-scroll month-search-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', `${monthTitle} 책 검색`);

  const header = document.createElement('div');
  header.className = 'month-search-header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'detail-eyebrow';
  eyebrow.textContent = monthTitle;
  header.appendChild(eyebrow);

  const form = document.createElement('form');
  form.className = 'month-search-form';

  const input = document.createElement('input');
  input.className = 'month-search-input';
  input.type = 'text';
  input.placeholder = '책 제목을 검색하세요';
  input.value = searchState.query || '';

  const button = document.createElement('button');
  button.className = 'detail-action-primary';
  button.type = 'submit';
  button.textContent = '검색';
  button.disabled = searchState.status === 'loading';

  form.append(input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSearch(input.value);
  });

  panel.append(header, form);

  if (searchState.results.length > 0) {
    const list = document.createElement('ul');
    list.className = 'month-search-results';

    searchState.results.forEach((book) => {
      const item = document.createElement('li');
      const resultButton = document.createElement('button');
      resultButton.className = 'search-result-btn';
      resultButton.type = 'button';
      resultButton.addEventListener('click', () => handlers.onSearchResult(book));

      if (book.thumbnail) {
        resultButton.appendChild(createCover(book, 'search-result-cover'));
      } else {
        resultButton.classList.add('has-no-cover');
      }

      const resultText = document.createElement('span');
      resultText.className = 'search-result-text';

      const resultTitle = document.createElement('strong');
      resultTitle.textContent = book.title || '제목 없음';

      const resultAuthors = document.createElement('span');
      resultAuthors.textContent = book.authors || '';

      resultText.appendChild(resultTitle);
      if (book.authors) {
        resultText.appendChild(resultAuthors);
      }
      resultButton.appendChild(resultText);
      item.appendChild(resultButton);
      list.appendChild(item);
    });

    panel.appendChild(list);
  } else if (searchState.status === 'empty') {
    const empty = document.createElement('p');
    empty.className = 'month-search-status';
    empty.textContent = '검색 결과가 없습니다.';
    panel.appendChild(empty);
  } else if (searchState.status === 'error') {
    const error = document.createElement('p');
    error.className = 'month-search-status';
    error.textContent = '검색 중 오류가 발생했습니다. 다시 시도해주세요.';
    panel.appendChild(error);
  }

  detail.appendChild(panel);
  input.focus();
}
```

- [ ] **Step 2: 호출부 갱신**

`renderMonthDetail` 함수는 변경하지 않는다(검색은 `book`이 없을 때 뷰이므로 별도 분기).

`renderBookSlider` 함수 맨 아래, 기존:

```js
  renderMonthDetail(detail, selectedBook, selectedPeriod, handlers);
  if (handlers.view === 'search' || handlers.view === 'edit-search') {
    renderSearchModal(selectedPeriod, handlers.searchState, handlers);
  } else {
    removeSearchModal();
  }
```

를 아래로 교체:

```js
  if (handlers.view === 'search' || handlers.view === 'edit-search') {
    detail.innerHTML = '';
    renderSearchPanel(detail, selectedPeriod, handlers.searchState, handlers);
  } else {
    renderMonthDetail(detail, selectedBook, selectedPeriod, handlers);
  }
```

`renderMonthDetail` 함수 안의 `} else if (handlers.view !== 'search') { removeSearchModal(); }` 분기(더 이상 필요 없음)를 삭제해 다음으로 단순화한다:

```js
function renderMonthDetail(detail, book, selectedPeriod, handlers) {
  detail.innerHTML = '';
  if (book) {
    if (handlers.view === 'book-edit' || handlers.view === 'edit-search') {
      renderBookEdit(detail, book, selectedPeriod, handlers);
    } else if (handlers.view === 'review-entry' || book.status === 'reviewing') {
      renderReviewEntry(detail, book, selectedPeriod, handlers);
    } else {
      renderDetailWithBook(detail, book, selectedPeriod, handlers);
    }
  }
}
```

(`renderReviewEntry` 분기는 Task 8에서 제거될 예정이지만 이 태스크에서는 손대지 않는다.)

다른 곳에 남아있는 `removeSearchModal()` 호출(`renderBookSlider` 상단의 `if (handlers.view === 'meeting-rules') { removeSearchModal(); ... }`, `meeting-active` 분기)도 전부 삭제한다(더 이상 body 오버레이가 없으므로 정리할 대상이 없음).

닫기 버튼이 없어졌으므로 `handlers.onSearchClose`는 이제 아무 UI에서도 호출되지 않는다 — `js/app.js`의 `onSearchClose` 핸들러 정의와 참조는 **일단 그대로 둔다** (다른 곳에서 재사용 가능성을 열어두되, 이번 태스크의 스코프는 검색 렌더링 위치 변경에 한정).

- [ ] **Step 3: CSS 조정**

`css/style.css`에서 `.month-search-overlay`, `.month-search-modal`, `.month-search-close` 규칙을 삭제한다.

`.month-search-header`, `.month-search-form`, `.month-search-input`, `.search-status`, `.month-search-results`, `.search-result-*` 규칙은 유지하되, `.month-search-panel`을 새로 추가한다 (`.month-detail-scroll`을 이미 상속하므로 패딩/스크롤은 자동 적용됨):

```css
.month-search-panel {
  display: flex;
  flex-direction: column;
}

.month-search-status {
  margin-top: 26px;
  color: var(--muted);
}
```

모바일 미디어쿼리 안의 `.month-search-form`, `.month-search-modal`, `.month-search-close`, `.month-search-results`, `.search-result-btn`, `.search-result-cover`, `.search-result-text strong/span` 규칙에서 `.month-search-modal`, `.month-search-close`만 삭제하고 나머지는 유지한다.

- [ ] **Step 4: 수동 확인**

로컬 서버에서 "+" 버튼(빈 달)을 눌러 검색 화면 진입 시, 좌측 사이드바(로고+연도+월 그리드)는 그대로 보이고 우측 패널만 검색창/결과로 바뀌는지 확인한다. 검색 → 결과 클릭 → 상세 화면 전환까지 정상 동작 확인.

- [ ] **Step 5: Commit**

```bash
git add js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
검색을 전체화면 팝업에서 우측 패널 인라인 뷰로 전환

document.body에 fixed 오버레이로 띄우던 검색 모달을 제거하고
#month-detail 안에서 렌더링해 사이드바가 항상 보이도록 변경.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 총점 클릭 → 별점 팝업

상세 화면(`renderDetailWithBook`)의 별점 줄을 클릭 가능하게 만들고, 클릭 시 기존 리뷰 목록(스크롤 가능) + 새 리뷰 입력 폼(이름 + 별 클릭 선택 + 보내기)이 담긴 모달 팝업을 띄운다. 제출 시 `updateBook`으로 저장하고 평균 별점을 갱신한다.

**Files:**
- Modify: `js/bookSlider.js:204-307` (`renderDetailWithBook`의 `ratingRow` 부분), 파일 하단에 팝업 렌더 함수 추가
- Modify: `js/app.js` (팝업에서 리뷰 저장 시 호출할 핸들러 추가, `renderMain`의 `handlers`에 연결)
- Modify: `css/style.css` (팝업 스타일 추가)

**Interfaces:**
- Consumes: `js/ratings.js`의 `calcAverage(reviews)`(기존 그대로), `js/firebase.js`의 `updateBook(clubId, bookId, data)`(기존 그대로).
- Produces:
  - `js/bookSlider.js`: `handlers.onRatingClick(book)` — 총점 클릭 시 호출.
  - `js/bookSlider.js`: 신규 export 불필요(내부 함수 `renderRatingModal(book, handlers)`로 body에 오버레이 렌더 — 이건 진짜 팝업이라 fixed 오버레이가 맞음, 검색과 달리 사이드바를 가려도 되는 사용자 흐름).
  - `js/app.js`: `handlers.onRatingSave(bookId, reviews)` — 팝업의 "보내기" 제출 시 호출, 기존 리뷰 배열에 새 리뷰를 추가해 저장.

- [ ] **Step 1: 총점 줄을 클릭 가능하게 변경**

`js/bookSlider.js`의 `renderDetailWithBook` 함수에서 아래 부분:

```js
  const ratingRow = document.createElement('div');
  ratingRow.className = 'detail-rating-row';
  ratingRow.appendChild(createStars(book.avgRating));

  const ratingText = document.createElement('span');
  ratingText.textContent = Number(book.avgRating || 0).toFixed(1);
  ratingRow.appendChild(ratingText);
```

를 아래로 교체:

```js
  const ratingRow = document.createElement('button');
  ratingRow.type = 'button';
  ratingRow.className = 'detail-rating-row detail-rating-trigger';
  ratingRow.setAttribute('aria-label', '총점 및 리뷰 보기');
  ratingRow.appendChild(createStars(book.avgRating));

  const ratingText = document.createElement('span');
  ratingText.textContent = Number(book.avgRating || 0).toFixed(1);
  ratingRow.appendChild(ratingText);

  ratingRow.addEventListener('click', () => handlers.onRatingClick?.(book));
```

- [ ] **Step 2: 별점 팝업 렌더 함수 추가**

`js/bookSlider.js` 파일 끝(마지막 `export function renderBookSlider` 앞)에 추가:

```js
function removeRatingModal() {
  document.getElementById('rating-modal')?.remove();
}

function createStarPicker(initialValue, onChange) {
  const picker = document.createElement('div');
  picker.className = 'rating-picker';
  picker.setAttribute('role', 'radiogroup');
  picker.setAttribute('aria-label', '별점 선택');

  let value = initialValue;
  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rating-picker-star';
    btn.textContent = n <= value ? '★' : '☆';
    btn.setAttribute('aria-label', `${n}점`);
    btn.addEventListener('click', () => {
      value = n;
      buttons.forEach((b, i) => {
        b.textContent = i + 1 <= value ? '★' : '☆';
      });
      onChange(value);
    });
    return btn;
  });

  picker.append(...buttons);
  picker.getValue = () => value;
  return picker;
}

function renderRatingModal(book, handlers) {
  removeRatingModal();

  const overlay = document.createElement('div');
  overlay.id = 'rating-modal';
  overlay.className = 'rating-modal-overlay';

  const modal = document.createElement('section');
  modal.className = 'rating-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${book.title || '이 책'} 감상평`);

  const closeButton = document.createElement('button');
  closeButton.className = 'rating-modal-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '닫기');
  closeButton.addEventListener('click', removeRatingModal);

  const list = document.createElement('ul');
  list.className = 'rating-modal-list';
  const reviews = book.reviews || [];
  if (reviews.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'rating-modal-empty';
    empty.textContent = '아직 감상평이 없어요. 가장 먼저 남겨보세요!';
    list.appendChild(empty);
  } else {
    reviews.forEach((review) => {
      const item = document.createElement('li');
      item.className = 'rating-modal-item';

      const head = document.createElement('p');
      head.className = 'rating-modal-item-head';
      head.textContent = `[${review.name || '익명'}]의 감상평 : ${'★'.repeat(Number(review.rating) || 0)}${'☆'.repeat(5 - (Number(review.rating) || 0))}`;

      const body = document.createElement('p');
      body.className = 'rating-modal-item-body';
      body.textContent = review.review || '';

      item.append(head, body);
      list.appendChild(item);
    });
  }

  const form = document.createElement('form');
  form.className = 'rating-modal-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'rating-modal-name';
  nameInput.placeholder = '이름';
  nameInput.setAttribute('aria-label', '이름');
  nameInput.required = true;

  const reviewInput = document.createElement('input');
  reviewInput.type = 'text';
  reviewInput.className = 'rating-modal-review';
  reviewInput.placeholder = '한줄 감상평';
  reviewInput.setAttribute('aria-label', '감상평');

  const picker = createStarPicker(5, () => {});

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'detail-action-primary';
  submitButton.textContent = '보내기';

  form.append(nameInput, picker, reviewInput, submitButton);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;

    const newReview = { name, rating: picker.getValue(), review: reviewInput.value.trim() };
    handlers.onRatingSave(book.id, [...(book.reviews || []), newReview]);
    removeRatingModal();
  });

  modal.append(closeButton, list, form);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) removeRatingModal();
  });
  document.body.appendChild(overlay);
  nameInput.focus();
}
```

`renderBookSlider` 함수의 최상단(다른 핸들러들과 함께)에 아래를 추가해 팝업 오픈 훅을 연결:

```js
  if (handlers.onRatingClick) {
    handlers.onRatingClick = handlers.onRatingClick; // no-op, kept for clarity
  }
```

위 줄은 불필요하므로 넣지 않는다. 대신 `renderDetailWithBook` 안에서 `handlers.onRatingClick?.(book)`을 직접 호출하도록 이미 Step 1에서 반영했으니, `renderRatingModal`을 실제로 트리거하는 지점은 **`js/app.js`가 `handlers.onRatingClick`으로 `renderRatingModal(book, handlers)`를 호출**하는 방식이 아니라, `js/bookSlider.js` 안에서 바로 팝업을 그리는 게 더 단순하다. 따라서 Step 1의 `ratingRow.addEventListener('click', ...)`를 아래로 최종 수정한다:

```js
  ratingRow.addEventListener('click', () => renderRatingModal(book, handlers));
```

(`handlers.onRatingClick`은 사용하지 않으므로 Step 1에서 넣었던 `handlers.onRatingClick?.(book)` 호출 대신 위 코드로 대체한다. 즉 최종적으로 `renderDetailWithBook`에는 `onRatingClick` 관련 코드가 없고, `renderRatingModal(book, handlers)`만 직접 호출한다.)

- [ ] **Step 3: `js/app.js`에 저장 핸들러 추가**

`saveEditedBookContent` 함수 아래에 추가:

```js
async function saveRatingReview(bookId, reviews) {
  try {
    const avgRating = calcAverage(reviews);
    await updateBook(currentClubId, bookId, {
      reviews,
      avgRating,
      participantCount: reviews.length,
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, reviews, avgRating, participantCount: reviews.length }
        : book
    ));
    renderMain();
  } catch (err) {
    alert('리뷰 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}
```

`renderMain()` 안의 `handlers` 객체에 추가:

```js
    onRatingSave: saveRatingReview,
```

- [ ] **Step 4: CSS 추가**

`css/style.css`에 추가 (파일 끝, 모바일 미디어쿼리 앞):

```css
.detail-rating-trigger {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.detail-rating-trigger:hover .star-rating-fill {
  filter: brightness(1.15);
}

.rating-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.35);
}

.rating-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  max-height: 80vh;
  padding: 32px 28px 24px;
  border: 2px solid var(--retro-border);
  border-radius: 2px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.rating-modal-close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
}

.rating-modal-list {
  display: grid;
  gap: 16px;
  max-height: 45vh;
  margin-bottom: 18px;
  padding-right: 6px;
  overflow-y: auto;
  list-style: none;
}

.rating-modal-item-head {
  font-weight: 900;
}

.rating-modal-item-body {
  margin-top: 4px;
  color: var(--muted);
}

.rating-modal-empty {
  color: var(--muted);
}

.rating-modal-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.rating-modal-name,
.rating-modal-review {
  grid-column: 1 / -1;
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 0 10px;
}

.rating-picker {
  grid-column: 1 / -1;
  display: flex;
  gap: 2px;
}

.rating-picker-star {
  border: none;
  background: transparent;
  color: var(--orange);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.rating-modal-form .detail-action-primary {
  grid-column: 1 / -1;
  justify-self: end;
}
```

- [ ] **Step 5: 수동 확인**

상세 화면에서 별점/총점 클릭 → 팝업이 뜨고 기존 리뷰가 보이는지, 이름/별점/한줄평 입력 후 "보내기" → 팝업이 닫히고 상세 화면 총점이 즉시 갱신되는지 확인.

- [ ] **Step 6: Commit**

```bash
git add js/bookSlider.js js/app.js css/style.css
git commit -m "$(cat <<'EOF'
총점 클릭 시 리뷰 조회/입력 팝업 추가

상세 화면의 총점을 클릭 가능한 버튼으로 바꾸고, 기존 리뷰 목록과
이름·별점·한줄평 입력 폼을 담은 팝업을 새로 구현. 제출 시 평균
별점을 즉시 재계산해 저장.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 녹음 완료 후 강제 리뷰 입력 단계 제거

현재 `runAnalysis()`는 분석 성공/실패와 무관하게 항상 `mainView = 'review-entry'`로 이동시켜 리뷰를 강제로 입력받는다. 이제 리뷰는 Task 7의 팝업에서 언제든 입력 가능하므로, 분석 완료 후에는 바로 상세 화면(`'detail'`)으로 이동한다.

**Files:**
- Modify: `js/app.js:495-590` (`runAnalysis`)
- Modify: `js/bookSlider.js:453-536` (`renderReviewEntry`), `js/bookSlider.js:638-651` (`renderMonthDetail`)

**Interfaces:**
- Consumes: 없음 (기존 상태 필드 재사용)
- Produces: 없음 (제거 작업)

- [ ] **Step 1: `js/app.js`의 `runAnalysis`에서 `mainView` 대상 변경**

`runAnalysis` 함수 안, 성공 경로의:

```js
    mainView = 'review-entry';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');
```

를:

```js
    mainView = 'detail';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');
```

로 변경한다.

실패(분석 에러) 경로의:

```js
      alert(`AI 분석에 실패해서 직접 작성 화면으로 이동합니다.\n${message}`);
      mainView = 'review-entry';
      mobilePage = 'detail';
      renderMain();
      showScreen('screen-main');
      return;
```

는 요약이 비어있는 채로 사용자가 직접 채워야 하는 케이스이므로 **`review-entry`가 아니라 기존 `book-edit`(수정 화면, 요약/리뷰를 표 형태로 편집 가능)으로 보낸다**:

```js
      alert(`AI 분석에 실패해서 직접 작성 화면으로 이동합니다.\n${message}`);
      mainView = 'book-edit';
      mobilePage = 'detail';
      renderMain();
      showScreen('screen-main');
      return;
```

- [ ] **Step 2: `book.status === 'reviewing'`으로 자동 진입하던 분기 제거**

`js/bookSlider.js`의 `renderMonthDetail` 함수에서:

```js
    } else if (handlers.view === 'review-entry' || book.status === 'reviewing') {
      renderReviewEntry(detail, book, selectedPeriod, handlers);
```

를:

```js
    } else if (handlers.view === 'review-entry') {
      renderReviewEntry(detail, book, selectedPeriod, handlers);
```

로 변경한다(더 이상 `mainView`가 `'review-entry'`로 설정되지 않으므로 이 분기는 실질적으로 죽은 코드가 되지만, `renderReviewEntry`/`onReviewSave` 자체는 남겨둔다 — 기존에 이미 `status: 'reviewing'`으로 저장된 과거 데이터가 있을 경우를 대비해 함수는 유지하고, 필요하면 이후 태스크에서 완전히 제거할 수 있다).

`book.status === 'analyzed'`가 아니면서 `status === 'reviewing'`인 기존 데이터는 이제 `renderDetailWithBook`의 else 분기(요약 없음 → "독서모임 시작"/"녹음본 업로드" 버튼)로 떨어진다. 이를 방지하려면 `renderDetailWithBook`에서 `book.status === 'analyzed'` 조건을 `book.status === 'analyzed' || book.status === 'reviewing'`으로 넓혀서, `summary`/`reviews`가 있으면(비어 있어도) 요약·리뷰 섹션을 보여주도록 한다:

`js/bookSlider.js`의 `renderDetailWithBook`에서:

```js
  if (book.status === 'analyzed') {
```

를:

```js
  if (book.status === 'analyzed' || book.status === 'reviewing') {
```

로 변경한다.

- [ ] **Step 3: 수동 확인**

로컬 서버에서 녹음 → 완료 → 분석 성공 시 곧바로 상세 화면(요약 + 리뷰 목록 + 총점)으로 이동하는지 확인한다. Firebase 함수 호출이 필요한 실제 분석은 로컬에서 재현이 어려우므로, `js/app.js`의 `runAnalysis` 성공 분기 로직을 코드 리딩으로 재확인하고, 최소한 `npm test`가 깨지지 않는지 확인한다.

```bash
npm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/app.js js/bookSlider.js
git commit -m "$(cat <<'EOF'
녹음 분석 완료 후 강제 리뷰 입력 단계 제거

분석 성공 시 review-entry 대신 바로 상세 화면으로 이동. 리뷰는
이제 총점 팝업(Task 7)에서 언제든 추가 가능하므로 순차 입력을
강제하지 않는다.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: "독서모임 시작 전" 사전 안내 화면 추가

상세 화면에서 "독서모임 시작" 클릭 시, 곧바로 수칙 화면(`meeting-rules`)으로 가는 대신 새 중간 화면(`meeting-intro`)을 먼저 보여준다. 캐릭터가 "무슨 말을 해야할까요? / 그냥 시작할게" 두 선택지를 제공하고, 어느 쪽을 눌러도 다음 단계(수칙 화면)로 넘어간다. "무슨 말을 해야할까요?"는 대화 예시를 추가로 보여준 뒤 같은 버튼으로 다음 단계로 넘어가게 한다.

**Files:**
- Modify: `js/app.js` (`openMeetingRules` 앞에 `openMeetingIntro` 추가, `mainView` 상태 추가)
- Modify: `js/bookSlider.js` (`renderMeetingIntro` 추가, `renderBookSlider` 분기 추가)
- Modify: `css/style.css` (캐릭터 말풍선 공용 스타일 — Task 11과 공유)

**Interfaces:**
- Consumes: Task 2에서 복사한 `assets/characters/` 파일들.
- Produces: `mainView === 'meeting-intro'`. `handlers.onIntroContinue()` — 두 선택지 버튼 모두 이 핸들러를 호출(어떤 버튼을 눌렀는지는 `renderMeetingIntro` 내부 상태로만 구분).

- [ ] **Step 1: `js/app.js`에 `meeting-intro` 상태 추가**

`openMeetingRules` 함수 바로 위에 추가:

```js
function openMeetingIntro() {
  mainView = 'meeting-intro';
  renderMain();
  showScreen('screen-main');
}
```

`renderMain()` 안 `handlers` 객체에서:

```js
    onStartMeeting(bookId) {
      currentBookId = bookId;
      openMeetingRules();
    },
```

를:

```js
    onStartMeeting(bookId) {
      currentBookId = bookId;
      openMeetingIntro();
    },
    onIntroContinue: openMeetingRules,
```

로 변경한다.

- [ ] **Step 2: `js/bookSlider.js`에 `renderMeetingIntro` 추가**

`renderMeetingRules` 함수 바로 위에 추가:

```js
function createGuideBubble({ characterFile, lines, onSelect }) {
  const wrap = document.createElement('div');
  wrap.className = 'guide-bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'guide-bubble';

  lines.forEach((line) => {
    const p = document.createElement('p');
    p.className = 'guide-bubble-line';
    p.textContent = line;
    bubble.appendChild(p);
  });

  if (onSelect) {
    const options = document.createElement('div');
    options.className = 'guide-bubble-options';
    onSelect.forEach(({ label, onClick }) => {
      const optBtn = document.createElement('button');
      optBtn.type = 'button';
      optBtn.className = 'guide-bubble-option';
      optBtn.textContent = label;
      optBtn.addEventListener('click', onClick);
      options.appendChild(optBtn);
    });
    bubble.appendChild(options);
  }

  const character = document.createElement('img');
  character.className = 'guide-character';
  character.src = `assets/characters/${characterFile}`;
  character.alt = '길잡이 캐릭터';

  wrap.append(bubble, character);
  return wrap;
}

function renderMeetingIntro(detail, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-intro-page';

  const heading = document.createElement('p');
  heading.className = 'meeting-intro-heading';
  heading.textContent = '독서모임을 시작해볼까요?';
  page.appendChild(heading);

  let bubbleWrap = createGuideBubble({
    characterFile: '책6_인사.png',
    lines: ['안녕하세요? 독서모임 길잡이입니다. 이 응용프로그램을 사용하는 여러분을 돕는게 제 일이죠.'],
    onSelect: [
      {
        label: '무슨말을 해야할까요?',
        onClick: () => {
          const detailScroll = bubbleWrap.parentElement;
          const nextBubble = createGuideBubble({
            characterFile: '책3_검색.png',
            lines: [
              '어떻게 시작해야할지 모르겠다면 이런 이야기를 나눠보세요.',
              '1. 어떻게 읽었는지 서로 이야기해보기',
              '2. 가장 인상에 깊었던 페이지를 서로 이야기해보기',
              '3. 내가 별로라고 생각했던 점',
              '4. 내가 좋다고 생각했던 점',
            ],
            onSelect: [{ label: '고마워', onClick: () => handlers.onIntroContinue() }],
          });
          bubbleWrap.replaceWith(nextBubble);
          bubbleWrap = nextBubble;
        },
      },
      { label: '그냥 시작할게', onClick: () => handlers.onIntroContinue() },
    ],
  });

  page.appendChild(bubbleWrap);
  detail.appendChild(page);
}
```

- [ ] **Step 3: `renderBookSlider`에 분기 추가**

`js/bookSlider.js`의 `renderBookSlider` 함수에서 `if (handlers.view === 'meeting-rules') { ... }` 블록 바로 위에 추가:

```js
  if (handlers.view === 'meeting-intro') {
    renderMeetingLeft(container, handlers);
    renderMeetingIntro(detail, handlers);
    return;
  }
```

`container.classList.toggle('is-meeting-left', ...)` 줄의 조건에 `'meeting-intro'`도 포함시킨다:

```js
  container.classList.toggle('is-meeting-left', handlers.view === 'meeting-intro' || handlers.view === 'meeting-rules' || handlers.view === 'meeting-active');
```

`js/app.js`의 `syncMainLayoutState()`에서:

```js
  const isMeetingScreen = mainView === 'meeting-rules' || mainView === 'meeting-active';
```

를:

```js
  const isMeetingScreen = mainView === 'meeting-intro' || mainView === 'meeting-rules' || mainView === 'meeting-active';
```

로 변경한다(모바일 레이아웃에서도 시작 전 화면이 전체 화면으로 보이도록).

- [ ] **Step 4: CSS 추가**

`css/style.css`에 추가:

```css
.meeting-intro-heading {
  margin-bottom: 24px;
  font-size: clamp(1.3rem, 2vw, 2rem);
  font-weight: 900;
}

.guide-bubble-wrap {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.guide-bubble {
  flex: 1;
  min-width: 0;
  padding: 18px 20px;
  border: 2px solid var(--retro-border);
  border-radius: 4px;
  background: #eef3ff;
}

.guide-bubble-line {
  margin-bottom: 8px;
  line-height: 1.4;
}

.guide-bubble-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  margin-top: 10px;
}

.guide-bubble-option {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-weight: 800;
  cursor: pointer;
}

.guide-bubble-option::before {
  content: '';
  width: 12px;
  height: 12px;
  border: 2px solid var(--retro-titlebar-start);
  border-radius: 50%;
}

.guide-character {
  flex: 0 0 auto;
  width: clamp(90px, 12vw, 140px);
  height: auto;
}
```

- [ ] **Step 5: 수동 확인**

상세 화면에서 "독서모임 시작" 클릭 → 인사 캐릭터 + "무슨말을 해야할까요? / 그냥 시작할게" 옵션이 뜨는지, "무슨말을 해야할까요?" 클릭 시 대화 예시가 담긴 새 말풍선으로 바뀌고 "고마워" 클릭 시 수칙 화면으로 넘어가는지, "그냥 시작할게" 클릭 시에도 수칙 화면으로 넘어가는지 확인.

- [ ] **Step 6: Commit**

```bash
git add js/app.js js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
독서모임 시작 전 길잡이 캐릭터 안내 화면 추가

"독서모임 시작" 클릭 시 수칙 화면 전에 캐릭터가 대화 시작을
돕는 중간 화면(meeting-intro)을 새로 추가.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: 수칙 화면 레트로 비주얼/카피 반영

기존 `meeting-rules` 화면(`createMeetingCopy`)의 초록 그라데이션 배경, "진짜 시작하기!" 버튼 문구를 레퍼런스에 맞춘다.

**Files:**
- Modify: `js/bookSlider.js:653-727` (`renderMeetingRules`, `createMeetingCopy`)
- Modify: `css/style.css:748-830` (`.meeting-page`, `.meeting-copy`, 관련)

**Interfaces:**
- Consumes: 없음 (기존 `MEETING_RULES`, `onMeetingConsent` 재사용)

- [ ] **Step 1: 버튼 문구 변경**

`js/bookSlider.js`의 `createMeetingCopy` 함수에서:

```js
  const confirmButton = document.createElement('button');
  confirmButton.className = 'detail-action-primary meeting-confirm-btn';
  confirmButton.type = 'button';
  confirmButton.textContent = '확인';
```

를:

```js
  const confirmButton = document.createElement('button');
  confirmButton.className = 'detail-action-primary meeting-confirm-btn';
  confirmButton.type = 'button';
  confirmButton.textContent = '진짜 시작하기!';
```

로 변경한다. 마찬가지로 아래 `prompt.textContent = '동의하시겠습니까?';`는 그대로 둔다(레퍼런스에는 별도 동의 문구가 없지만, 기존 UX(동의 필요)를 유지하는 것이 안전하며 스펙에서도 변경을 요구하지 않았다).

- [ ] **Step 2: 배경을 초록 그라데이션으로**

`css/style.css`에서 `renderMeetingRules`가 생성하는 `.meeting-rules-page`에 그라데이션을 입힌다. 기존 `.meeting-page` 규칙 뒤에 추가:

```css
.meeting-rules-page {
  background: linear-gradient(160deg, #eafff2, #8fe0b0);
  border-radius: 2px;
}
```

- [ ] **Step 3: 수동 확인**

수칙 화면 진입 시 연초록~진초록 그라데이션 배경에 "진짜 시작하기!" 버튼이 보이는지 확인.

- [ ] **Step 4: Commit**

```bash
git add js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
수칙 화면 레트로 비주얼(초록 그라데이션) 및 버튼 카피 반영

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: 녹음 중 길잡이 캐릭터 연동

`js/app.js`의 `handleDecibelLevel`에 Task 3의 `computeGuideState`를 연결해 `guideState`를 계산하고, `js/bookSlider.js`의 `renderMeetingActive`가 이 상태에 맞는 캐릭터/말풍선/배경색을 렌더하도록 확장한다.

**Files:**
- Modify: `js/app.js` (`handleDecibelLevel`, `openMeetingRules`/`startMeeting`의 상태 초기화, `renderMain`의 `handlers`)
- Modify: `js/bookSlider.js:751-775` (`renderMeetingActive`)
- Modify: `css/style.css:192-216` (`meeting-level-*` 배경색)

**Interfaces:**
- Consumes: `js/guideState.js`의 `computeGuideState`, `GUIDE_STATES`.
- Produces: `handlers.guideState`(문자열, `GUIDE_STATES`의 값)가 `renderMain()`을 통해 `renderBookSlider`/`renderMeetingActive`로 전달됨.

- [ ] **Step 1: `js/app.js`에 상태 변수와 계산 로직 추가**

파일 상단, `let loudSinceMs = null;` 바로 아래에 추가:

```js
let levelSinceMs = Date.now();
let lastEncourageAt = null;
let guideState = GUIDE_STATES.NONE;
```

파일 상단 import에 추가:

```js
import { computeGuideState, GUIDE_STATES } from './guideState.js';
```

`handleDecibelLevel` 함수를 아래로 교체:

```js
function handleDecibelLevel(level) {
  if (level !== meetingLevel) {
    meetingLevel = level;
    levelSinceMs = Date.now();
  }
  updateMeetingLevelClass(level);
  setMeetingWarningBannerVisible(level === 'loud');

  if (level === 'loud') {
    if (loudSinceMs === null) loudSinceMs = Date.now();
    if (Date.now() - loudSinceMs > 3000) setMeetingWarningVisible(true);
  } else {
    loudSinceMs = null;
    setMeetingWarningVisible(false);
  }

  const now = Date.now();
  const nextGuideState = computeGuideState({
    level,
    levelSinceMs,
    now,
    lastEncourageAt,
  });
  if (nextGuideState !== guideState) {
    guideState = nextGuideState;
    if (guideState === GUIDE_STATES.ENCOURAGE) lastEncourageAt = now;
    renderMain();
  }
}
```

(`renderMain()`을 상태 변화 시에만 호출해 매 프레임 리렌더로 인한 성능 저하를 피한다.)

`startMeeting` 함수에서 `loudSinceMs = null;` 옆에 추가:

```js
  levelSinceMs = Date.now();
  lastEncourageAt = null;
  guideState = GUIDE_STATES.NONE;
```

`openMeetingRules` 함수에도 동일하게 추가:

```js
  levelSinceMs = Date.now();
  lastEncourageAt = null;
  guideState = GUIDE_STATES.NONE;
```

`renderMain()` 안 `handlers` 객체에 추가:

```js
    guideState,
```

- [ ] **Step 2: `js/bookSlider.js`의 `renderMeetingActive` 확장**

`renderMeetingActive` 함수를 아래로 교체:

```js
const GUIDE_CHARACTER_CONTENT = {
  'idle-help': {
    characterFile: '책5_도움.png',
    lines: ['혹시 제가 필요할까요? 저는 여러분을 최대한 도와드릴수 있습니다!', '무슨말을 해야할까요? / 어떻게 시작해야돼? / 어쩌구... / 그냥 시작할게'],
    boxClass: '',
  },
  encourage: {
    characterFile: '책7_엄지척.png',
    lines: ['우와!! 지금 너무 좋은데요!! 서로 말도 잘하고 계세용!'],
    boxClass: '',
  },
  'warn-loud': {
    characterFile: '책2_궁금.png',
    lines: ['지금 너무 격해졌어요, 잠깐 쉬었다 해보세요!!'],
    boxClass: 'guide-box-warn',
  },
  'block-fight': {
    characterFile: '책1_금지.png',
    lines: ['건전한 독서모임을 위한 수칙을 다시 떠올려볼까요?'],
    boxClass: 'guide-box-block',
  },
};

function renderMeetingActive(detail, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-active-page';

  const copy = createMeetingCopy({ className: 'mobile-meeting-copy' });

  const warning = document.createElement('p');
  warning.className = 'meeting-warning-banner';
  warning.textContent = '건강한 독서모임을 응원합니다';
  warning.setAttribute('aria-live', 'polite');
  if (handlers.meetingLevel !== 'loud') {
    warning.classList.add('hidden');
  }

  page.append(copy, warning);

  const guideContent = GUIDE_CHARACTER_CONTENT[handlers.guideState];
  if (guideContent) {
    const box = document.createElement('div');
    box.className = `guide-recording-box ${guideContent.boxClass}`.trim();
    box.appendChild(createGuideBubble({ characterFile: guideContent.characterFile, lines: guideContent.lines }));
    page.appendChild(box);
  }

  if (handlers.guideState === 'block-fight') {
    const resetPage = document.createElement('div');
    resetPage.className = 'meeting-rules-page block-fight-overlay';
    resetPage.appendChild(createMeetingRulesList());

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'detail-action-primary';
    resetButton.textContent = '다시 시작하기!';
    resetButton.addEventListener('click', () => handlers.onGuideReset?.());

    resetPage.appendChild(resetButton);
    page.appendChild(resetPage);
  } else {
    const finishButton = document.createElement('button');
    finishButton.className = 'detail-action-primary meeting-finish-btn';
    finishButton.type = 'button';
    finishButton.textContent = '완료';
    finishButton.addEventListener('click', handlers.onMeetingFinish);
    page.appendChild(finishButton);
  }

  detail.appendChild(page);
}
```

(`createGuideBubble`은 Task 9에서 이미 추가했으므로 재사용한다. `onSelect` 인자 없이 호출하면 옵션 버튼 없이 대사만 표시된다.)

- [ ] **Step 3: `js/app.js`에 `onGuideReset` 핸들러 추가**

`finishMeeting` 함수 아래에 추가:

```js
async function resetMeetingAfterFight() {
  try {
    decibelMonitor?.stop();
    meetingStream?.getTracks().forEach((track) => track.stop());
    await currentRecorder?.stop();
  } catch (err) {
    // 녹음 중단 실패는 무시하고 계속 리셋 진행
  }
  decibelMonitor = null;
  meetingStream = null;
  currentRecorder = null;
  loudSinceMs = null;
  meetingLevel = 'quiet';
  meetingWarningVisible = false;
  guideState = GUIDE_STATES.NONE;
  openMeetingRules();
}
```

`renderMain()` 안 `handlers` 객체에 추가:

```js
    onGuideReset: resetMeetingAfterFight,
```

- [ ] **Step 4: CSS 추가**

`css/style.css`에 추가:

```css
.guide-recording-box {
  width: 100%;
  max-width: 560px;
  padding: 16px;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}

.guide-box-warn {
  background: linear-gradient(160deg, var(--retro-warn-orange-start), var(--retro-warn-orange-end));
}

.guide-box-block {
  background: linear-gradient(160deg, var(--retro-warn-pink-start), var(--retro-warn-pink-end));
}

.block-fight-overlay {
  width: 100%;
  max-width: 560px;
  margin-top: 12px;
  padding: 20px;
  border-radius: 4px;
  background: linear-gradient(160deg, var(--retro-warn-pink-start), var(--retro-warn-pink-end));
}
```

- [ ] **Step 5: 수동 확인 (마이크 필요)**

로컬 서버에서 녹음을 시작하고:
- 8초 이상 조용히 있으면 "혹시 제가 필요할까요?" 도움 말풍선이 뜨는지
- 보통 톤으로 말하면 이따금 "우와!! 지금 너무 좋은데요!!" 격려가 뜨는지
- 5초 이상 크게 말하면 주황 박스로 "지금 너무 격해졌어요" 경고가 뜨는지
- 15초 이상 계속 크게 말하면 핑크 박스 + 수칙 재노출 + "다시 시작하기!" 버튼이 뜨는지, 버튼 클릭 시 수칙 화면으로 돌아가는지

확인한다. (마이크 접근이 안 되는 환경이면 `js/app.js`의 `computeGuideState` 호출 로직과 `js/guideState.js` 유닛 테스트로 대신 검증하고, 이 스텝은 가능한 환경에서 별도로 확인한다.)

```bash
npm test
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/app.js js/bookSlider.js css/style.css
git commit -m "$(cat <<'EOF'
녹음 중 데시벨 기반 길잡이 캐릭터 반응 연동

computeGuideState로 조용함/격려/경고/싸움 상태를 계산해 녹음 화면에
캐릭터 말풍선과 배경색 변화를 반영. 싸움 상태에서는 녹음을 중단하고
수칙 화면으로 되돌리는 "다시 시작하기" 버튼 제공.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 최종 수동 QA

전체 흐름을 로컬 서버에서 처음부터 끝까지 훑어보며 리스킨 이후 회귀가 없는지 확인한다.

**Files:** 없음 (검증 전용 태스크)

- [ ] **Step 1: 자동 테스트 전체 실행**

```bash
npm test
```
Expected: 전체 PASS.

- [ ] **Step 2: 전체 플로우 수동 확인**

```bash
python3 -m http.server 8000
```

브라우저에서 아래 흐름을 순서대로 확인:
1. 클럽 생성/초대 링크 → 메인 화면 진입 (제목바 + 크림 사이드바 확인)
2. 빈 달 클릭 → 검색이 우측 패널에 인라인으로 뜨는지 → 책 선택 → 상세 화면
3. 상세 화면에서 총점 클릭 → 팝업에서 리뷰 추가 → 팝업 닫힘 후 총점 갱신 확인
4. "독서모임 시작" → 시작 전 안내(길잡이 캐릭터) → "그냥 시작할게" → 수칙 화면(초록 배경) → "진짜 시작하기!" → 녹음 화면
5. 녹음 화면에서 "완료" → 분석 로딩 → (실제 Firebase 함수가 없으면 에러 alert가 뜨는 것이 정상이며, 이 경우 알림 문구가 깨지지 않는지만 확인) → 정상 분석 환경이라면 바로 상세 화면으로 이동하는지 확인
6. 브라우저 폭을 760px 이하로 줄여 모바일 레이아웃이 깨지지 않는지 확인 (레트로 픽셀 디테일까지는 아니어도 레이아웃/클릭 동작은 정상이어야 함)

- [ ] **Step 3: 콘솔 에러 확인**

브라우저 개발자 도구 콘솔에 에러가 없는지 각 단계마다 확인한다.

- [ ] **Step 4: 발견된 문제 기록 및 수정**

문제가 발견되면 해당 태스크로 돌아가 수정하고 별도 커밋을 남긴다 (이 태스크 자체는 커밋하지 않음, 검증 전용).

---

## Self-Review 체크리스트 (작성자 참고용, 실행 불필요)

- **스펙 커버리지:** A(비주얼)→Task 4,5 / B(검색·상세필드)→Task 6, 상세필드(공유·토론시간·날짜)는 기존 데이터에 없는 필드라 이번 플랜에서는 다루지 않음(아래 "범위 조정" 참고) / C(별점 팝업)→Task 7,8 / D(시작 전 2단계)→Task 9,10 / E(길잡이 캐릭터)→Task 3,11 / F(에셋)→Task 2.
- **범위 조정:** 설계 스펙 B 섹션의 "공유·수정·삭제" 링크, "토론시간", "날짜" 필드는 기존 데이터 모델(`book` 객체)에 대응 필드가 없다(`recordingUrl`은 있지만 길이 계산 로직 없음, 모임 날짜 필드 없음). Global Constraints에서 "백엔드/데이터 모델 변경 없음"을 확정했으므로, 이 플랜에서는 **이미 존재하는 "수정·삭제" 링크(`createDetailTopbar`)를 유지**하고 "공유·토론시간·날짜"는 데이터가 없어 스킵한다. 필요하면 별도 스펙/플랜으로 분리해 데이터 모델부터 설계해야 한다.
- **타입/시그니처 일관성:** `computeGuideState({ level, levelSinceMs, now, lastEncourageAt })` 시그니처가 Task 3(정의)과 Task 11(사용)에서 동일. `handlers.guideState`, `handlers.onGuideReset`, `handlers.onRatingSave`, `handlers.onIntroContinue` 네이밍이 정의(app.js)와 사용(bookSlider.js) 양쪽에서 일치.
- **플레이스홀더 스캔:** 없음 — 모든 스텝에 실제 코드 포함.
