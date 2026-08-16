# 독서모임 웹사이트 설계 문서

작성일: 2026-08-16

## 1. 개요

독서모임에서 사용할 웹사이트. 책 목록을 가로 슬라이더로 관리하고, 모임을 실시간으로 진행(데시벨 모니터링 + 중재)하거나 녹음본을 업로드해 분석하며, 참석자별 별점/리뷰를 기록한다.

이번 단계 범위: 프론트엔드 UI/흐름을 완성하되, 실제로 동작 가능한 부분은 실제 연동한다.
- Google Books 검색: 실제 연동 (키 불필요)
- 데시벨 측정/녹음: 실제 브라우저 API 사용 (Web Audio, MediaRecorder)
- 녹음 → 텍스트 요약 분석: mock (템플릿 텍스트, 추후 실제 AI 연동 예정)
- 데이터 저장: Firebase (Firestore + Storage), 로그인 없는 오픈 액세스

## 2. 기술 스택 및 파일 구조

- 순수 HTML/CSS/JS (빌드 도구 없음), Firebase는 CDN 모듈(import)로 사용
- 단일 페이지 애플리케이션: `index.html` 하나에서 JS로 화면(섹션) 전환

```
reading-club/
  index.html
  css/style.css
  js/
    app.js         # 화면 상태 전환, 전체 흐름 제어
    firebase.js     # Firebase 초기화 및 Firestore/Storage CRUD
    search.js       # Google Books API 검색
    decibel.js      # 마이크 입력 → 데시벨 계산/색상/중재
    recorder.js     # MediaRecorder 녹음 제어
    mockAnalysis.js # 녹음본 → 요약 mock 로직
```

## 3. 화면 흐름

```
[스플래시] "책책책 책좀 읽읍시다" 중앙 표시
    ↓ (자동, 로고 위로 이동하는 애니메이션)
[메인] 가로 슬라이드 책 표지 목록 (왼쪽=오래된 책, 오른쪽=최신 책, 맨 오른쪽 [+])
    │
    ├─ [+] 클릭 → [검색 모달] 제목 검색 (Google Books API)
    │     → 책 선택 → Firestore에 저장(status: "pending") → [책 상세-미분석]으로 이동
    │
    └─ 책 표지 클릭 → status로 분기
         ├─ status="pending" → [책 상세-미분석]
         │      표지/제목/저자 + [독서모임 시작] [녹음본 업로드]
         │
         │      [독서모임 시작] → [실시간 모임 화면]
         │        (데시벨에 따른 배경색 변화 + 임계값 초과 시 중재 오버레이, 실제 녹음 진행)
         │        → [완료] 클릭 → 녹음 종료 → Storage 업로드
         │        → [분석중...] 로딩 → [요약 결과(mock)] 표시
         │        → [인원수 입력] → 인원수만큼 [별점+리뷰 입력 폼] 동적 생성
         │        → [저장] → Firestore 업데이트(status: "analyzed") → [책 상세-분석완료]로 이동
         │
         │      [녹음본 업로드] → [파일 선택] → Storage 업로드
         │        → [분석중...] 로딩 → [요약 결과(mock)] 표시
         │        → [인원수 입력] → 인원수만큼 [별점+리뷰 입력 폼] 동적 생성
         │        → [저장] → Firestore 업데이트(status: "analyzed") → [책 상세-분석완료]로 이동
         │
         └─ status="analyzed" → [책 상세-분석완료]
                표지/제목/저자 + 요약 + 평균 별점 + 리뷰 목록
```

## 4. 데이터 모델

### Firestore: `books/{bookId}`

| 필드 | 타입 | 설명 |
|---|---|---|
| title | string | 책 제목 |
| authors | string | 저자 |
| thumbnail | string | 표지 이미지 URL |
| googleBooksId | string | Google Books 식별자 |
| addedAt | timestamp | 추가 시각 (슬라이더 정렬 기준) |
| status | string | "pending" \| "analyzed" |
| summary | string | 분석 완료 후 요약 (mock) |
| participantCount | number | 참석 인원수 |
| avgRating | number | 평균 별점 (reviews로부터 자동 계산) |
| reviews | array | `[{ rating: number, review: string }]` |
| recordingUrl | string | Storage 내 녹음 파일 경로 |

### Storage

```
recordings/{bookId}/{timestamp}.webm
```

### 보안 규칙

로그인 없이 누구나 읽기/쓰기 가능하도록 설정 (독서모임 공용 공간이므로). 프로덕션 전환 시 재검토 필요.

## 5. 핵심 기능 상세

### 5.1 데시벨 모니터링 및 중재
- `navigator.mediaDevices.getUserMedia({ audio: true })`로 마이크 스트림 획득
- Web Audio `AnalyserNode`로 실시간 RMS 계산 → dB 근사치 변환
- 화면 전체 배경색을 조용함(초록) → 보통(노랑) → 시끄러움(빨강)으로 부드럽게 전환
- 임계값을 일정 시간(예: 3초) 이상 초과하면 "조금만 조용히 해주세요 🤫" 오버레이 표시

### 5.2 녹음
- `MediaRecorder`로 모임 시작~완료 구간 실제 녹음
- 완료 시 Blob을 Firebase Storage에 업로드, URL을 Firestore에 기록

### 5.3 분석 (mock)
- 실제 STT/요약 대신, 2~3초 로딩 스피너 후 미리 정의한 템플릿에 책 제목을 채워 넣은 요약 텍스트를 표시
- 코드에 `// TODO: 실제 AI 분석 API로 교체` 주석으로 추후 교체 지점 표시

### 5.4 인원수 → 별점/리뷰 입력
- 분석 완료 화면에서 인원수를 입력받음
- 입력된 인원수만큼 별점(1~5, 별 아이콘) + 리뷰 텍스트 입력 폼을 동적으로 생성
- 저장 시 각 리뷰를 배열로 Firestore에 저장하고, 평균 별점을 자동 계산해 함께 저장

## 6. 에러 처리

| 상황 | 처리 |
|---|---|
| 마이크 권한 거부 | 안내 메시지 표시 후 "녹음본 업로드" 경로로 유도 |
| Google Books API 실패/결과 없음 | "검색 결과가 없습니다" 메시지 표시 |
| Firestore/Storage 저장 실패 | 오류 메시지 + 재시도 버튼 표시 |
| 녹음 파일 업로드 실패 | 오류 메시지 + 재시도 버튼 표시 |

## 7. Firebase 설정

Firebase 프로젝트가 아직 없으므로, 구현 단계에서 다음을 안내한다:
1. https://console.firebase.google.com 에서 새 프로젝트 생성
2. Firestore Database 및 Storage 활성화 (테스트 모드 규칙로 시작)
3. 웹 앱 등록 후 발급되는 `firebaseConfig` 값을 `js/firebase.js`에 입력

## 8. 테스트/검증 방법

- `webapp-testing` 스킬(Playwright)로 로컬에서 화면 흐름(스플래시→메인→검색→모임 시작→요약→별점 입력) 스모크 테스트
- 마이크/녹음 관련 기능은 브라우저 권한이 필요하므로 수동 확인 병행
