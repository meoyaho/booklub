# 공유 이미지 / 토론시간 / 모임 날짜 추가 설계

날짜: 2026-09-21
관련 이전 작업: `docs/superpowers/specs/2026-09-20-retro-redesign-design.md` (레퍼런스 대비 "공유", "토론시간", "날짜" 필드를 데이터 모델이 없어 범위 밖으로 뺐던 항목을 여기서 구현)

## 배경 및 목표

레트로 리디자인 후 레퍼런스 스크린샷과 실제 배포본을 다시 대조하면서, 상세 화면에 있어야 할 "공유" 링크와 "토론시간"/"날짜" 필드가 빠져 있는 것을 확인했다. 원래 설계에서는 대응하는 데이터가 없어 스킵했는데, 이번에 데이터 수집 방식까지 포함해 구현한다.

## 범위 밖 (Out of scope)

- `functions/index.js`(`analyzeRecording` 클라우드 함수)는 건드리지 않는다. 새 필드(`meetingDate`, `discussionDurationSeconds`)는 클라이언트에서 분석 완료 후 별도로 `updateBook()`을 호출해 저장한다 — 함수 재배포가 필요 없어 더 안전하다.
- `firestore.rules`는 이미 필드 제한 없이 전체 허용(`allow read, write: if true`)이라 변경하지 않는다.
- 총점/요약 라벨, 빈 달 물음표 아이콘 등 이전에 발견한 다른 UI 차이점은 사용자가 "나중에"로 보류했으므로 이번 작업에 포함하지 않는다.
- 기존에 이미 분석 완료된 책(레코드에 `meetingDate`/`discussionDurationSeconds`가 없는 경우)에 소급 적용하지 않는다 — 해당 필드가 없으면 상세 화면에서 그냥 숨긴다.
- 공유 카드에 넣을 리뷰 텍스트가 너무 길 경우의 완벽한 줄바꿈/페이지네이션은 다루지 않는다 — 한 줄로 자르고 필요시 말줄임표 처리하는 정도로 충분하다.

## A. 데이터 필드

책 문서(Firestore `books/{bookId}` 또는 `clubs/{clubId}/books/{bookId}`)에 다음 두 필드를 추가한다. 둘 다 선택적(optional) 필드이며 없으면 UI에서 숨긴다.

- `meetingDate`: string, ISO 8601 날짜 (예: `"2026-03-27"` 또는 `"2026-03-27T14:00:00.000Z"`)
- `discussionDurationSeconds`: number, 정수 초

## B. 토론시간 / 날짜 — 수집

### B-1. 실시간 녹음 흐름

- `js/app.js`의 `startMeeting()`에서 녹음 시작 시각을 `meetingStartedAt = Date.now()`로 기록한다 (신규 모듈 변수).
- `finishMeeting()`에서 녹음 종료 시:
  - `discussionDurationSeconds = Math.round((Date.now() - meetingStartedAt) / 1000)`
  - `meetingDate = new Date(meetingStartedAt).toISOString()`
  - 이 두 값을 `runAnalysis(blob, { meetingDate, discussionDurationSeconds })` 형태로 전달한다 (기존 `runAnalysis(blob)` 시그니처에 두 번째 인자 `meta = {}` 추가).
- 사용자 입력 없음 — 전부 자동.

### B-2. 녹음본 업로드 흐름

- `discussionDurationSeconds`는 업로드된 오디오 파일 자체의 재생 길이로 계산한다. `<audio>` 엘리먼트의 `loadedmetadata` 이벤트에서 `audio.duration`을 읽어 반올림한다 (실시간 시작/종료 개념이 없는 업로드이므로 파일 길이가 유일하게 신뢰 가능한 값).
- `meetingDate`는 사용자가 직접 입력한다 — 파일 선택 직후, 실제 분석 시작 전에 작은 모달(레트로 스타일, `<input type="date">` 하나 + "확인"/"취소" 버튼)을 띄워 입력받는다. 기본값은 오늘 날짜. 취소하면 업로드/분석 자체를 진행하지 않는다.
- 흐름: 파일 선택 → 파일 길이 읽기(`readAudioDurationSeconds`) → 날짜 입력 모달 → 확인 시 `runAnalysis(file, { meetingDate, discussionDurationSeconds })` 호출.

### B-3. 저장

- `runAnalysis`의 성공 경로(현재는 클라우드 함수 `analyzeRecording`이 서버 측에서 요약/리뷰/평점을 직접 Firestore에 써서, 클라이언트는 로컬 상태만 갱신하는 구조)에, `meta.meetingDate`/`meta.discussionDurationSeconds` 값이 있으면 **별도의 클라이언트 `updateBook()` 호출**로 이 두 필드만 추가 저장한다. 로컬 `allBooks` 상태에도 즉시 반영해 화면에 바로 보이게 한다.
- 실패 경로(수동 작성으로 넘어가는 `manualUpdate` 분기)는 이미 `updateBook()`을 호출하고 있으므로, 그 객체에 `meetingDate`/`discussionDurationSeconds`를 그냥 같이 포함시킨다 (녹음/업로드 자체는 성공했으므로 이 값들은 분석 성공 여부와 무관하게 저장돼야 함).

## C. 상세 화면에 필드 표시

`js/bookSlider.js`의 `renderDetailWithBook`(또는 관련 렌더 함수)에 "총점" 줄 아래 "토론시간"/"날짜" 줄을 추가한다. 레퍼런스("리뷰 작성완료 창.jpg") 포맷을 따른다:

- 토론시간: `discussionDurationSeconds`를 "N시간 M분 S초" 형태로 변환 (예: 2시간 35분 15초). 1시간 미만이면 "M분 S초"만, 1분 미만이면 "S초"만 표시.
- 날짜: `meetingDate`를 "YYYY년 M월 D일 요일" 형태로 변환 (예: 2026년 3월 27일 토요일).
- 값이 없는(undefined/빈 문자열) 필드는 해당 줄 자체를 렌더링하지 않는다.

## D. 공유 기능

### D-1. 트리거

`js/bookSlider.js`의 `createDetailTopbar`에 현재 "수정 | 삭제"만 있는 자리에 "공유" 링크를 맨 앞에 추가한다 ("공유 | 수정 | 삭제" — 레퍼런스와 동일 순서). 클릭 시 `handlers.onShareCard(book)` 호출.

### D-2. 카드 이미지 생성

새 로직(위치는 구현 시 적절한 파일에 — `js/app.js` 또는 신규 `js/shareCard.js`)이 `<canvas>`에 카드를 그린다:

- 배경: 사이트의 레트로 톤(크림 `#ECE9D8` 배경, 파란 타이틀 스트립)
- 책 표지 이미지 (있으면) — `crossOrigin = 'anonymous'`로 로드 시도
- 책 제목, 저자
- 평균 별점 (별 아이콘 + 숫자)
- 멤버별 별점 리스트 (이름 + 별점)
- 멤버별 한줄평 텍스트 (한 줄로 표시, 너무 길면 말줄임표)
- 하단에 "책 쫌 읽읍시다" 워터마크

캔버스 텍스트를 그리기 전에 `document.fonts.ready`를 기다려 `GalmuriMono11` 폰트가 로드된 상태에서 그리도록 한다 (안 그러면 기본 폰트로 그려짐).

**CORS 안전장치**: 책 표지 이미지가 CORS를 허용하지 않는 외부 URL이면 캔버스가 "오염(tainted)"되어 `toBlob()`/`toDataURL()`이 실패할 수 있다. 표지 이미지 로드/그리기를 시도한 뒤 `toBlob()`이 실패하면(catch), 표지 이미지 없이 나머지 내용만 다시 그려서 재시도한다 — 표지가 없어도 카드 자체는 항상 생성되게 한다.

### D-3. 결과물 전달

`canvas.toBlob()`으로 PNG blob을 얻은 뒤:

- `navigator.canShare?.({ files: [file] })`가 true면 (주로 모바일) `navigator.share({ files: [file], title: ... })`로 네이티브 공유시트를 띄운다.
- 지원하지 않으면(주로 데스크톱) `<a download>` 합성 클릭으로 PNG 파일을 다운로드한다. 파일명: `책좀읽읍시다_{책제목}_카드.png` (파일시스템에 안전하지 않은 문자는 치환).

## 영향받는 기존 파일

- `js/app.js`: `runAnalysis` 시그니처 확장, `startMeeting`/`finishMeeting`에 시각 기록 추가, 업로드 파일 선택 핸들러에 오디오 길이 읽기 + 날짜 입력 모달 호출 추가, 공유 카드 생성/전달 로직 추가
- `js/bookSlider.js`: `createDetailTopbar`에 공유 링크 추가, `renderDetailWithBook`에 토론시간/날짜 표시 추가, 업로드 날짜 입력 모달 렌더 함수 추가
- `css/style.css`: 공유 링크 스타일(기존 "수정"/"삭제" 링크와 동일 톤), 날짜 입력 모달 스타일(기존 rating-modal과 유사한 톤)
- 신규 가능: `js/shareCard.js` (캔버스 카드 생성 로직을 분리한다면)

## 테스트/검증 방법

- 순수 로직(초→"N시간 M분 S초" 변환, ISO 날짜→"YYYY년 M월 D일 요일" 변환)은 순수 함수로 분리해 `node --test`로 유닛 테스트 가능 — TDD로 작성.
- 오디오 길이 읽기, 날짜 입력 모달, 공유 카드 생성/다운로드는 브라우저 환경이 필요해 자동 유닛 테스트 대상이 아님 — 헤드리스 브라우저로 수동/모의 데이터 검증.
- 실제 Firebase 프로덕션에 테스트 데이터를 쓰지 않도록, 이전 작업들과 동일하게 모의 `book`/`handlers` 객체로 렌더 함수를 직접 호출하는 방식으로 검증한다.
