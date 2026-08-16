# 책 모양 UI 및 로고 고정 설계 문서

작성일: 2026-08-16 (기존 구현에 대한 추가 기능)

## 1. 개요

기존에 구현된 독서모임 웹사이트에 두 가지 UI 개선을 적용한다:

1. 스플래시/메인(목록) 화면을 제외한 모든 화면을 "펼쳐진 흰 책" 모양으로 표시하고, 화면 전환 시 페이지가 넘어가는 느낌의 애니메이션을 적용한다.
2. 스플래시 로고(`assets/logo.png`)가 스플래시에서는 중앙에, 이후 메인(목록) 화면으로 넘어가면 상단에 고정되어 계속 보이도록 한다. 그 외 화면에서는 로고를 숨긴다.

## 2. 로고 처리

- `assets/logo.png`를 `<img id="app-logo">`로 모든 `.screen` 바깥, `<body>` 최상단에 배치되는 고정(`position: fixed`) 엘리먼트로 둔다.
- 상태 클래스 3가지:
  - `.logo-splash` (초기): 화면 중앙, 큰 크기
  - `.logo-docked`: 화면 상단 중앙, 작은 크기
  - `.logo-hidden`: `display: none`
- `js/app.js`의 스플래시 애니메이션 완료 시점에 `.logo-splash` → `.logo-docked`로 전환(위치 이동은 CSS transition으로 자연스럽게).
- `js/screens.js`의 `showScreen(screenId)`가 호출될 때마다: `screenId === 'screen-main'`이면 `.logo-docked` 유지(표시), 그 외 화면이면 `.logo-hidden` 추가. 단, `screen-splash`는 최초 1회만 거치므로 별도 분기 불필요(앱 시작 시 이미 `.logo-splash` 상태).

## 3. "펼쳐진 책" 화면 프레임

### 적용 대상 (8개 화면, 스플래시/메인 제외)

`screen-search`, `screen-detail`, `screen-meeting`, `screen-upload`, `screen-analyzing`, `screen-summary`, `screen-participant-count`, `screen-reviews-form`

### 구조

각 화면 내부에 공통 래퍼를 추가한다:

```html
<section id="screen-XXX" class="screen book-screen">
  <div class="book">
    <div class="book-page">
      <!-- 기존 화면 콘텐츠가 여기로 이동 -->
    </div>
  </div>
</section>
```

- `.book`: 중앙 정렬된 고정 최대 너비(예: 720px) x 비율 유지 높이, 흰색 배경, 둥근 모서리, 바깥 그림자(참고 이미지처럼 종이 질감의 은은한 그림자)
- `.book`은 가운데에 세로 그라디언트 선(제본선)을 의사요소(`::before`)로 표현해 "펼쳐진 책"처럼 보이게 한다
- `.book-page`: 실제 콘텐츠가 배치되는 내부 영역 (패딩 포함), 좌우 페이지 구분 없이 하나의 콘텐츠 영역으로 사용 (내용이 표/폼처럼 다양해서 좌우 분할은 하지 않음)
- `screen-meeting`의 데시벨 색상 변화(`#meeting-bg`)는 `.book-page` 배경색으로 적용한다 (기존의 전체화면 배경색 대신). 중재 경고 문구와 완료 버튼은 `.book-page` 안에 위치.

### 배경

`body`는 은은한 중립색(예: 옅은 회색 `#e8e8e8`)으로 두어 흰 책이 도드라지도록 한다. 메인/스플래시 화면은 기존 배경을 유지해도 무방.

## 4. 페이지 넘김 전환 애니메이션

- `.book-screen`이 `showScreen()`으로 활성화될 때마다(즉 `.active` 클래스가 붙는 순간) `.book`에 `page-turn-in` 애니메이션 클래스를 재적용한다.
- 애니메이션: `perspective`를 부모(`.screen`)에 주고, `.book`에 `transform-origin: right center`로 `rotateY(-90deg)` + `opacity: 0` 상태에서 `rotateY(0deg)` + `opacity: 1`로 약 0.4~0.5초간 전환 — 오른쪽에서 페이지가 넘어오는 느낌.
- 매번 같은 화면에 재진입해도 애니메이션이 다시 재생되도록, `showScreen()`에서 클래스를 제거했다가 강제 리플로우 후 다시 추가하는 방식을 사용한다.
- 순수 CSS/JS로 구현하며 외부 라이브러리를 사용하지 않는다.

## 5. 영향받지 않는 부분

- 스플래시 화면과 메인(목록) 화면의 레이아웃/기능은 로고 위치를 제외하면 변경 없음
- Firebase 연동, 검색, 녹음, 분석, 별점/리뷰 로직 등 기존 동작은 그대로 유지 — 이번 작업은 순수 UI/CSS/애니메이션 레이어 변경

## 6. 테스트/검증 방법

- `webapp-testing` 스킬(Playwright)로 각 책 화면 진입 시 `.book` 요소가 렌더링되고 애니메이션 클래스가 붙는지 확인
- 로고가 메인 화면에서만 보이고 다른 화면에서 숨겨지는지 수동 확인
- 기존 9개 유닛 테스트가 회귀 없이 통과하는지 확인 (`npm test`)
