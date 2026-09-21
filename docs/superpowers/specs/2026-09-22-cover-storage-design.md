# 책 표지 이미지 Firebase Storage 저장 설계

날짜: 2026-09-22
관련 이전 작업: `docs/superpowers/specs/2026-09-21-share-duration-date-design.md`의 공유 카드 기능에서, Google Books 썸네일 URL이 CORS 헤더를 보내지 않아 캔버스에 표지를 그릴 수 없다는 문제가 확인됨(최종 리뷰에서 검증됨). 이번 작업으로 그 근본 원인을 해결한다.

## 배경 및 문제

브라우저에서 `<img crossOrigin="anonymous">`로 외부 이미지를 캔버스에 그리려면 그 이미지 서버가 `Access-Control-Allow-Origin` 헤더를 보내야 한다. Google Books 썸네일(`books.google.com`, `*.googleusercontent.com`)은 이 헤더를 보내지 않는다. 브라우저의 `fetch()` 역시 동일한 CORS 제약을 받으므로, **클라이언트에서 직접 이미지를 받아와 Storage에 재업로드하는 것은 불가능하다** — CORS는 브라우저에만 적용되는 제약이라, 서버(Cloud Function)가 대신 이미지를 받아오면 이 제약을 피할 수 있다.

## 설계

### A. 신규 Cloud Function `uploadBookCover`

`functions/index.js`에 `analyzeRecording`과 같은 패턴(`onCall`, `HttpsError`, `firebase-admin/storage`)으로 추가한다.

**입력:** `{ clubId, bookId, imageUrl }`

**검증:**
- `clubId`/`bookId`는 기존 `isSafeId()` 패턴으로 검증.
- `imageUrl`은 반드시 `https://`이고 호스트가 `books.google.<tld>` 또는 `*.googleusercontent.com` 패턴이어야 한다. **임의의 URL을 서버가 fetch하게 허용하면 SSRF(서버 측 요청 위조) 위험**이 있으므로 호스트 화이트리스트는 필수 보안 요구사항이다.
- fetch 응답의 `content-type`이 `image/*`가 아니면 거부.
- 응답 바이트가 0이거나 5MB를 넘으면 거부.

**처리:**
1. 서버에서 `fetch(imageUrl)`로 이미지 바이트를 받는다 (서버-서버 요청이라 CORS 제약 없음).
2. `covers/{clubId}/{bookId}.{ext}` 경로로 Firebase Storage에 저장 (`file.save(buffer, { metadata: { contentType, cacheControl } })`).
3. Firebase Storage REST 다운로드 URL을 직접 조립해 반환한다: `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodeURIComponent(path)}?alt=media` — `storage.rules`가 해당 경로를 공개 읽기로 허용하므로 별도 다운로드 토큰이나 `makePublic()`(uniform bucket-level access와 충돌 가능)이 필요 없다.

**출력:** `{ storagePath, url, contentType }`

### B. `storage.rules` 추가

기존 `recordings/{clubId}/{bookId}/{fileName}` 규칙과 같은 패턴으로 추가:

```
match /covers/{clubId}/{fileName} {
  allow read: if true;
  allow write: if false;
}
```

쓰기는 막는다 — Admin SDK(Cloud Function)는 규칙을 우회하므로 이 제한과 무관하게 정상 동작하고, 클라이언트가 직접 임의 파일을 이 경로에 쓰는 것만 막힌다.

### C. 클라이언트 연동

`js/firebase.js`에 `uploadBookCover(clubId, bookId, imageUrl)` 콜러블 wrapper를 추가한다(기존 `analyzeRecording` 콜러블과 같은 패턴).

호출 시점: 책을 검색해서 모임에 새로 추가할 때, 그리고 표지를 수정할 때(`js/app.js`의 `addSearchResultToMonth`) — **둘 다 이미 `book.id`가 확정된 이후에** 백그라운드로(await하지 않고, 화면 흐름을 막지 않고) 호출한다:

1. `uploadBookCover(clubId, bookId, book.thumbnail)` 호출.
2. 성공하면 `updateBook(clubId, bookId, { thumbnail: result.url })`로 `thumbnail` 필드를 Storage URL로 교체하고 로컬 상태도 갱신.
3. 실패하면 `console.warn`만 남기고 그대로 둔다 — 기존 Google Books URL이 `thumbnail`에 남아있으므로 일반 `<img>` 표지 표시는 계속 정상 동작한다(공유 카드만 표지 없이 나온다, 지금과 동일).

**기존에 이미 등록된 책은 소급 적용하지 않는다** — 새로 추가되는 책부터 적용.

## 범위 밖 (Out of scope)

- 기존 책 데이터 일괄 마이그레이션 (원하면 별도 스크립트로 추후 진행 가능).
- 이미지 리사이즈/최적화 (원본 그대로 저장).
- `js/shareCard.js` 자체 변경 없음 — 이미 `book.thumbnail`을 읽어서 쓰고 있으므로, `thumbnail`이 Storage URL로 바뀌면 자동으로 CORS 문제 없이 로드된다(같은 Firebase 프로젝트의 Storage는 `crossOrigin='anonymous'`로 문제없이 로드되도록 기본 설정되어 있음 — Firebase Storage의 다운로드 엔드포인트는 모든 오리진에 대해 CORS를 허용함).

## 테스트/검증 방법

- Cloud Function 로직은 `node --check functions/index.js`로 문법 확인. 실제 fetch/Storage 업로드 동작은 로컬 에뮬레이터가 없으므로 배포 후 실제 검색→책 추가 흐름으로 확인.
- 클라이언트 wrapper는 브라우저 필요 — 실제 프로덕션에 테스트 데이터를 쓰지 않도록, mock `uploadBookCoverCallable`로 성공/실패 케이스만 검증.
- 배포(`firebase deploy --only functions,storage:rules`)는 실제 프로덕션에 영향을 주는 작업이므로, 구현 완료 후 사용자에게 배포 여부를 별도로 확인받는다.
