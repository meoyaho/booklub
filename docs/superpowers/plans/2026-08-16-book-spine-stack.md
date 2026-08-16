# 책등 스택형 목록 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 화면의 가로 표지 슬라이더를, 책등이 아래(오래된 책)부터 위(최신 책)로 아슬아슬하게 쌓인 세로 스택으로 교체한다. `+` 버튼은 항상 맨 위에 위치한다.

**Architecture:** 책마다 결정적(deterministic) 스타일(너비/두께/회전/오프셋/색상)을 계산하는 순수 함수를 새 모듈로 분리해 유닛테스트하고, 렌더링 모듈(`js/bookSlider.js`)이 이를 사용해 DOM을 만든다. 데이터 흐름(Firebase, 클릭 핸들러 시그니처)은 전혀 변경하지 않는다.

**Tech Stack:** 순수 HTML/CSS/JS (기존과 동일), 외부 라이브러리 없음, `node:test`로 순수 로직 유닛테스트.

## Global Constraints

- 빌드 도구/프레임워크 없음 — 순수 HTML/CSS/JS
- `renderBookSlider(books, onBookClick, onAddClick)`의 시그니처와 클릭 콜백 동작(각 항목 클릭 시 `onBookClick(book.id)`, `+` 클릭 시 `onAddClick()`)은 변경하지 않음 — `js/app.js`가 이 시그니처로 호출 중이며 이번 작업에서 `js/app.js`는 건드리지 않음
- 시각 순서: 맨 위 = `+` 버튼, 그 아래 = 최신 책, 맨 아래 = 가장 오래된 책. `subscribeBooks`가 주는 `books` 배열은 `addedAt` 오름차순(오래된 것이 먼저)이므로 렌더링 시 역순으로 순회해야 함
- 책등 크기: `width = clamp(140 + title.length * 9, 160, 480)`px, `height = clamp(44 + title.length * 1.5, 48, 100)`px
- 책등 색상/회전/오프셋은 책 id 기반 해시로 결정론적으로 계산 — 진짜 `Math.random()`을 쓰면 안 됨 (새로고침/리렌더링 시 같은 책은 항상 같은 모습이어야 함)
- 회전 범위: -6~6도, 좌우 오프셋 범위: -12~12px
- 책 상세 화면(`#detail-cover`)의 표지 이미지는 이번 변경과 무관 — 계속 이미지로 유지

---

### Task 1: js/bookSpineStyle.js — 결정론적 책등 스타일 계산 순수 함수 + 유닛테스트

**Files:**
- Create: `js/bookSpineStyle.js`
- Test: `test/bookSpineStyle.test.js`

**Interfaces:**
- Produces: `getSpineStyle(bookId: string, title: string): { width: number, height: number, rotationDeg: number, offsetX: number, color: string }` — 순수 함수, DOM 의존 없음. Task 2의 `js/bookSlider.js`가 이 함수를 import해서 사용함

- [ ] **Step 1: 실패하는 테스트 작성**

```javascript
// test/bookSpineStyle.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpineStyle } from '../js/bookSpineStyle.js';

test('getSpineStyle: 같은 입력에 항상 같은 결과 (결정론적)', () => {
  const a = getSpineStyle('book-1', '데미안');
  const b = getSpineStyle('book-1', '데미안');
  assert.deepEqual(a, b);
});

test('getSpineStyle: 제목이 길수록 width/height가 커짐', () => {
  const short = getSpineStyle('book-2', '토지');
  const long = getSpineStyle('book-3', '어린 왕자와 함께하는 아주 길고 긴 제목의 모험 이야기');
  assert.ok(long.width > short.width);
  assert.ok(long.height > short.height);
});

test('getSpineStyle: width/height는 지정된 범위 내에 있음', () => {
  const empty = getSpineStyle('book-4', '');
  const veryLong = getSpineStyle('book-5', 'a'.repeat(200));
  assert.ok(empty.width >= 160 && empty.width <= 480);
  assert.ok(empty.height >= 48 && empty.height <= 100);
  assert.ok(veryLong.width >= 160 && veryLong.width <= 480);
  assert.ok(veryLong.height >= 48 && veryLong.height <= 100);
});

test('getSpineStyle: rotationDeg와 offsetX는 지정된 범위 내에 있음', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  ids.forEach((id) => {
    const style = getSpineStyle(id, '제목');
    assert.ok(style.rotationDeg >= -6 && style.rotationDeg <= 6);
    assert.ok(style.offsetX >= -12 && style.offsetX <= 12);
  });
});

test('getSpineStyle: color는 문자열이며 비어있지 않음', () => {
  const style = getSpineStyle('book-6', '제목');
  assert.equal(typeof style.color, 'string');
  assert.ok(style.color.length > 0);
});

test('getSpineStyle: 서로 다른 id는 대체로 다른 색/회전/오프셋을 가짐 (완전히 동일하지 않음을 확인)', () => {
  const a = getSpineStyle('book-a', '제목');
  const b = getSpineStyle('book-b', '제목');
  const same = a.color === b.color && a.rotationDeg === b.rotationDeg && a.offsetX === b.offsetX;
  assert.equal(same, false);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/bookSpineStyle.test.js`
Expected: FAIL — `Cannot find module '../js/bookSpineStyle.js'`

- [ ] **Step 3: js/bookSpineStyle.js 구현**

```javascript
// js/bookSpineStyle.js
const PALETTE = [
  '#8e2f2f', '#2f5d8e', '#2f7d4f', '#6b3f8e', '#8e6a2f',
  '#2f7d7d', '#8e2f6a', '#4f4f8e', '#7d5a2f', '#3f6b3f',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getSpineStyle(bookId, title) {
  const id = String(bookId);
  const colorIndex = hashString(id) % PALETTE.length;
  const rotationDeg = (hashString(`${id}:rotation`) % 13) - 6;
  const offsetX = (hashString(`${id}:offset`) % 25) - 12;

  const length = (title || '').length;
  const width = clamp(140 + length * 9, 160, 480);
  const height = clamp(44 + length * 1.5, 48, 100);

  return {
    width,
    height,
    rotationDeg,
    offsetX,
    color: PALETTE[colorIndex],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/bookSpineStyle.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: PASS (15 tests total — 기존 9개 + 신규 6개)

- [ ] **Step 6: Commit**

```bash
git add js/bookSpineStyle.js test/bookSpineStyle.test.js
git commit -m "feat: add deterministic book-spine style calculation with unit tests"
```

---

### Task 2: js/bookSlider.js — 책등 스택 렌더링으로 교체

**Files:**
- Modify: `js/bookSlider.js`

**Interfaces:**
- Consumes: `getSpineStyle(bookId, title)` (Task 1, `js/bookSpineStyle.js`)
- Produces: `renderBookSlider(books, onBookClick, onAddClick)` — 시그니처는 기존과 동일하게 유지. `#book-slider` 안에 `+` 버튼(맨 위, class `add-book-btn`)과 `books`를 역순(최신 우선)으로 순회한 `.book-spine` div들을 렌더링. 각 스파인 클릭 시 `onBookClick(book.id)` 호출

- [ ] **Step 1: js/bookSlider.js 전체를 아래 내용으로 교체**

```javascript
// js/bookSlider.js
import { getSpineStyle } from './bookSpineStyle.js';

export function renderBookSlider(books, onBookClick, onAddClick) {
  const container = document.getElementById('book-slider');
  container.innerHTML = '';

  const addBtn = document.createElement('button');
  addBtn.className = 'add-book-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', onAddClick);
  container.appendChild(addBtn);

  const newestFirst = books.slice().reverse();
  newestFirst.forEach((book) => {
    const spine = document.createElement('div');
    spine.className = 'book-spine';
    spine.textContent = book.title;

    const style = getSpineStyle(book.id, book.title);
    spine.style.width = `${style.width}px`;
    spine.style.height = `${style.height}px`;
    spine.style.backgroundColor = style.color;
    spine.style.transform = `translateX(${style.offsetX}px) rotate(${style.rotationDeg}deg)`;

    spine.addEventListener('click', () => onBookClick(book.id));
    container.appendChild(spine);
  });
}
```

- [ ] **Step 2: 문법 오류 확인**

Run: `node --check js/bookSlider.js`
Expected: 출력 없이 exit code 0

- [ ] **Step 3: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: PASS (15/15 — 이 태스크는 DOM 렌더링만 다루므로 순수 로직 테스트에는 영향 없음)

- [ ] **Step 4: Commit**

```bash
git add js/bookSlider.js
git commit -m "feat: render book list as a stacked spine list instead of a cover slider"
```

---

### Task 3: css/style.css — 세로 스택 레이아웃 및 책등 스타일

**Files:**
- Modify: `css/style.css`

**Interfaces:**
- Consumes: Task 2의 `.book-spine`/`.add-book-btn` DOM 구조

- [ ] **Step 1: `.book-slider`, `.book-cover`, `.add-book-btn` 규칙을 아래 내용으로 교체**

기존:
```css
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
```

교체 후 (`.book-cover` 규칙은 완전히 삭제, `.book-spine`을 신규 추가):
```css
.book-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  overflow-y: auto;
  height: 100%;
  padding: 24px 24px 80px;
}

.book-spine {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  color: #ffffff;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-book-btn {
  flex: 0 0 auto;
  width: 100px;
  height: 48px;
  font-size: 1.5rem;
  border: 2px dashed #999;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 8px;
}
```

파일의 다른 규칙(스플래시, 로고, 책 모양 화면, 모달, 모임 관련)은 전혀 수정하지 않는다.

- [ ] **Step 2: `.book-cover` 규칙이 완전히 제거되었는지 확인**

Run: `grep -n '\.book-cover' css/style.css index.html js/*.js`
Expected: 아무 출력 없음 (CSS 규칙과 이를 참조하는 코드 모두 존재하지 않아야 함 — Task 2에서 이미 `.book-cover`를 생성하는 코드는 제거됨)

- [ ] **Step 3: 전체 테스트 회귀 확인**

Run: `npm test`
Expected: PASS (15/15 — CSS 변경은 순수 로직 테스트에 영향 없음)

- [ ] **Step 4: Commit**

```bash
git add css/style.css
git commit -m "feat: style book list as a vertically stacked spine layout"
```

---

### Task 4: 수동 스모크 테스트

**Files:**
- 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 1~3의 모든 변경사항

- [ ] **Step 1: 로컬 서버로 브라우저에서 확인**

Run: `python3 -m http.server 8000` (프로젝트 루트에서)

브라우저에서 `http://localhost:8000` 접속 후 스플래시를 지나 메인 화면에서 다음을 확인한다:

1. 화면 맨 위에 `+` 버튼이 보임
2. 책이 있다면 `+` 버튼 바로 아래부터 최신 책이, 아래로 갈수록 오래된 책이 보임 (스크롤해서 확인)
3. 각 책등이 제목 텍스트를 포함한 색깔 있는 막대로 보이고, 제목이 길수록 막대가 더 크고 두꺼움
4. 책마다 약간씩 다른 회전/좌우 위치를 가져 "아슬아슬하게 쌓인" 느낌이 남
5. 새로고침해도 각 책의 색상/회전/위치가 그대로 유지됨 (결정론적 스타일 확인)
6. 책등 클릭 시 책 상세 화면으로 정상 이동함
7. `+` 버튼 클릭 시 검색 화면으로 정상 이동함

Expected: 위 7단계가 모두 설계대로 동작, 콘솔에 JS 에러 없음

- [ ] **Step 2: 회귀 확인**

Run: `npm test`
Expected: 15/15 PASS
