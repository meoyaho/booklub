# 책등 스택형 목록 UI 설계 문서

작성일: 2026-08-16 (기존 메인 화면 책 슬라이더 교체)

## 1. 개요

기존 메인 화면의 가로 스크롤 표지 슬라이더를, 책을 옆에서 본 "책등"이 세로로 아슬아슬하게 쌓인 모습으로 교체한다.

## 2. 쌓임 순서 및 레이아웃

- `#book-slider`를 세로 스크롤 컨테이너(`overflow-y: auto`, `flex-direction: column`)로 변경
- DOM(그리고 시각적) 순서는 위에서부터: `+` 버튼 → 최신 책 → ... → 가장 오래된 책(맨 아래)
- `subscribeBooks`가 반환하는 `books` 배열은 `addedAt` 오름차순(오래된 것이 먼저)이므로, 렌더링 시 `+` 버튼을 맨 위에 두고 그 아래로 배열을 역순(최신 우선)으로 렌더링한다
- 컨테이너의 기본 스크롤 위치(`scrollTop: 0`)가 곧 "맨 위"이므로 별도의 스크롤 위치 조정 없이 진입 시 `+` 버튼과 최신 책이 보인다

## 3. 책등 스타일

- 기존의 `<img class="book-cover">` (표지 이미지)를 제거하고, 색이 채워진 가로 막대 `<div class="book-spine">`로 대체한다. 안에 책 제목이 가로로 표시된다
- 너비와 높이(두께) 모두 제목 글자 수에 비례해서 커진다:
  - `width = clamp(140 + title.length * 9, 160, 480)` px
  - `height = clamp(44 + title.length * 1.5, 48, 100)` px
- 배경색은 책마다 고정된(새로고침해도 변하지 않는) 색 — 책 id 문자열을 해시하여 미리 정한 팔레트(10종 내외의 book-spine스러운 진한/채도 있는 색) 중 하나를 결정적으로 선택한다. 텍스트는 흰색 + 옅은 그림자로 가독성을 확보한다

## 4. "아슬아슬한" 쌓임 효과

- 각 책등에는 결정적 랜덤 회전(-6~6도)과 좌우 오프셋(-12~12px)을 적용해 삐뚤빼뚤 쌓인 느낌을 낸다
- 회전/오프셋/색상 모두 책 id를 시드로 한 해시 기반 의사난수로 계산되어, 같은 책은 리렌더링/새로고침해도 항상 같은 모습을 유지한다 (매번 다른 진짜 `Math.random()`은 사용하지 않음)

## 5. 구현 구조

- **신규 순수 로직 모듈** `js/bookSpineStyle.js`: `getSpineStyle(bookId, title)` 함수. 책 id/제목을 받아 `{ width, height, rotationDeg, offsetX, color }`를 결정적으로 계산해 반환하는 순수 함수 — DOM에 의존하지 않으므로 `node:test`로 유닛테스트 가능
- `js/bookSlider.js`의 `renderBookSlider(books, onBookClick, onAddClick)`를 다시 작성: 배열을 역순으로 순회하며 각 책마다 `.book-spine` div를 생성하고 `getSpineStyle`의 결과를 인라인 스타일로 적용, 클릭 시 기존과 동일하게 `onBookClick(book.id)` 호출. `+` 버튼은 맨 위(첫 DOM 자식)에 위치, 기존과 동일하게 `onAddClick()` 호출
- `css/style.css`: `.book-slider`를 세로 스크롤 flex-column으로, `.book-cover` 규칙 제거, `.book-spine`(신규) 및 `.add-book-btn`(세로 레이아웃에 맞게 재조정) 스타일 추가

## 6. 영향받지 않는 부분

- Firebase 데이터 흐름(`subscribeBooks`, `addBook`), 검색, 책 상세, 모임/녹음/분석, 별점/리뷰 로직은 전혀 변경하지 않음
- 책 상세 화면(`#detail-cover`)의 표지 이미지는 이번 변경과 무관 — 계속 이미지로 표시됨 (메인 목록만 책등 스타일로 바뀜)

## 7. 테스트/검증 방법

- `js/bookSpineStyle.js`의 `getSpineStyle`에 대한 `node:test` 유닛테스트: 같은 입력에 항상 같은 출력(결정론), 제목 길이에 따라 width/height가 커짐, 반환값이 각 필드의 유효 범위 내에 있음
- `webapp-testing` 스킬(Playwright)로 메인 화면 진입 시 `+` 버튼이 최상단에 보이는지, 책마다 회전/오프셋/색상이 적용되는지, 클릭 시 상세 화면으로 이동하는지 수동 확인
- 기존 9개 유닛 테스트 회귀 없이 통과 확인
