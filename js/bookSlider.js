// js/bookSlider.js
import { formatDurationSeconds, formatMeetingDate, formatLogTimestamp } from './meetingFormat.js';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MEETING_RULES = [
  '싸우지 않습니다.',
  '우기지 않습니다.',
  '무시하지 않습니다.',
  '말 끊지 않습니다.',
  '딴짓하지 않습니다.',
];
export const MEETING_TOPIC_PROMPTS = [
  '어떻게 읽었는지 서로 이야기해보기',
  '가장 인상에 깊었던 페이지를 서로 이야기해보기',
  '내가 별로라고 생각했던 점',
  '내가 좋다고 생각했던점',
];
const MEETING_TOPIC_DETAILS = [
  '책을 언제, 어디서, 어떤 방식으로 읽었는지 편하게 이야기해보세요. 한번에 다 읽었는지, 나눠서 읽었는지도 좋은 이야깃거리가 돼요.',
  '가장 기억에 남는 장면이나 문장을 찾아 함께 읽어보고, 왜 그 부분이 인상 깊었는지 이유를 나눠보세요.',
  '이해가 잘 안 됐거나 아쉬웠던 부분, 동의하기 어려웠던 내용이 있다면 솔직하게 이야기해보세요.',
  '마음에 들었던 부분이나 공감했던 내용, 새롭게 배운 점을 구체적으로 이야기해보세요.',
];
export const MEETING_TOPIC_QUESTIONS = [
  '책을 어떻게 읽으셨나요?',
  '가장 인상에 깊었던 페이지가 있었나요?',
  '별로라고 생각했던 점이 있었나요?',
  '좋았다고 생각했던 점이 있었나요?',
];

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function isValidPeriod(year, month) {
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;
}

function getBookPeriod(book) {
  const readYear = Number(book.readYear);
  const readMonth = Number(book.readMonth);
  if (isValidPeriod(readYear, readMonth)) return { year: readYear, month: readMonth };

  if (typeof book.yearMonth === 'string') {
    const match = book.yearMonth.match(/^(\d{4})-(\d{1,2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (isValidPeriod(year, month)) return { year, month };
    }
  }

  const date = toDate(book.readAt) || toDate(book.finishedAt) || toDate(book.addedAt);
  if (!date) return null;
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function getBookTime(book) {
  const date = toDate(book.readAt) || toDate(book.finishedAt) || toDate(book.addedAt);
  return date ? date.getTime() : 0;
}

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function buildMonthBookMap(books) {
  const monthBooks = new Map();

  books.forEach((book) => {
    const period = getBookPeriod(book);
    if (!period) return;

    const key = periodKey(period.year, period.month);
    const existing = monthBooks.get(key);
    if (!existing || getBookTime(existing) <= getBookTime(book)) {
      monthBooks.set(key, book);
    }
  });

  return monthBooks;
}

function isFuturePeriod(year, month, today = new Date()) {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  return year > currentYear || (year === currentYear && month > currentMonth);
}

function createStars(rating = 0) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  const stars = document.createElement('div');
  stars.className = 'star-rating';
  stars.setAttribute('aria-label', `평균 별점 ${safeRating}점`);

  const empty = document.createElement('span');
  empty.className = 'star-rating-empty';
  empty.textContent = '★★★★★';

  const fill = document.createElement('span');
  fill.className = 'star-rating-fill';
  fill.textContent = '★★★★★';
  fill.style.width = `${(safeRating / 5) * 100}%`;

  stars.append(empty, fill);
  return stars;
}

function createMetaRow(label, value) {
  const row = document.createElement('p');
  row.className = 'detail-meta-row';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'detail-meta-label';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'detail-meta-value';
  valueSpan.textContent = value;

  row.append(labelSpan, valueSpan);
  return row;
}

function createCover(book, className) {
  const title = book.title || '제목 없음';
  const createFallback = () => {
    const fallback = document.createElement('div');
    fallback.className = `${className} cover-fallback`;
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', `${title} 표지`);
    fallback.title = title;

    const text = document.createElement('span');
    text.className = 'cover-fallback-title';
    const letters = Array.from(title);
    const limit = className === 'month-cover' ? 24 : 40;
    const half = Math.floor((limit - 3) / 2);
    text.textContent = letters.length > limit
      ? `${letters.slice(0, half).join('')}...${letters.slice(-(limit - 3 - half)).join('')}`
      : title;
    fallback.appendChild(text);
    return fallback;
  };

  if (!book.thumbnail) return createFallback();

  const image = document.createElement('img');
  image.className = className;
  image.src = book.thumbnail;
  image.alt = `${title} 표지`;
  image.addEventListener('error', () => image.replaceWith(createFallback()), { once: true });
  return image;
}

function createMonthCell(year, month, book, selectedPeriod, handlers) {
  const isFuture = isFuturePeriod(year, month);
  const cell = document.createElement('button');
  cell.className = 'month-cell';
  cell.type = 'button';
  cell.disabled = isFuture;
  cell.setAttribute('aria-label', `${year}년 ${month}월`);

  if (selectedPeriod.year === year && selectedPeriod.month === month) {
    cell.classList.add('is-selected');
  }
  if (!book) cell.classList.add('is-empty');
  if (isFuture) cell.classList.add('is-future');

  cell.setAttribute('aria-pressed', String(selectedPeriod.year === year && selectedPeriod.month === month));
  const label = document.createElement('span');
  label.className = 'month-label';
  label.textContent = `${month}월`;

  if (book) {
    const coverWrap = document.createElement('span');
    coverWrap.className = 'month-cover-wrap';
    coverWrap.appendChild(createCover(book, 'month-cover'));
    cell.appendChild(coverWrap);

  } else {
    const empty = document.createElement('span');
    empty.className = 'month-empty';
    empty.textContent = '?';
    empty.setAttribute('aria-hidden', 'true');
    cell.appendChild(empty);
  }

  cell.appendChild(label);

  cell.addEventListener('click', () => {
    if (isFuture) return;
    if (!book) {
      handlers.onAddClick?.({ year, month });
      return;
    }
    handlers.onMonthSelect({ year, month });
  });

  return cell;
}

function createDetailTopbar(selectedPeriod, book, handlers, { showShare = false, editLabel = '수정', onEdit, onCancel } = {}) {
  const topbar = document.createElement('div');
  topbar.className = 'detail-topbar';

  const left = document.createElement('div');
  left.className = 'detail-top-left';

  const backButton = document.createElement('button');
  backButton.className = 'mobile-detail-back';
  backButton.type = 'button';
  backButton.setAttribute('aria-label', '달력으로 돌아가기');
  backButton.addEventListener('click', () => handlers.onMobileBack?.());

  const eyebrow = document.createElement('p');
  eyebrow.className = 'detail-eyebrow';
  eyebrow.textContent = `${selectedPeriod.year}년 ${selectedPeriod.month}월`;
  left.append(backButton, eyebrow);

  const actions = document.createElement('div');
  actions.className = 'detail-top-actions';

  let shareButton = null;
  let shareDivider = null;
  if (showShare) {
    shareButton = document.createElement('button');
    shareButton.className = 'detail-top-action';
    shareButton.type = 'button';
    shareButton.textContent = '공유';
    shareButton.addEventListener('click', (event) => handlers.onShareCard?.(book, event.currentTarget));

    shareDivider = document.createElement('span');
    shareDivider.className = 'detail-top-separator';
    shareDivider.textContent = '|';
  }

  const editButton = document.createElement('button');
  editButton.className = 'detail-top-action';
  editButton.type = 'button';
  editButton.textContent = editLabel;
  editButton.addEventListener('click', () => (onEdit ? onEdit() : handlers.onEditBook?.(book.id)));

  const divider = document.createElement('span');
  divider.className = 'detail-top-separator';
  divider.textContent = '|';

  let cancelButton = null;
  let cancelDivider = null;
  if (onCancel) {
    cancelButton = document.createElement('button');
    cancelButton.className = 'detail-top-action';
    cancelButton.type = 'button';
    cancelButton.textContent = '취소';
    cancelButton.addEventListener('click', () => onCancel());

    cancelDivider = document.createElement('span');
    cancelDivider.className = 'detail-top-separator';
    cancelDivider.textContent = '|';
  }

  const deleteButton = document.createElement('button');
  deleteButton.className = 'detail-top-action';
  deleteButton.type = 'button';
  deleteButton.textContent = '삭제';
  deleteButton.addEventListener('click', () => handlers.onDeleteBook?.(book.id));

  if (showShare) {
    actions.append(shareButton, shareDivider);
  }
  actions.append(editButton, divider);
  if (onCancel) {
    actions.append(cancelButton, cancelDivider);
  }
  actions.append(deleteButton);
  topbar.append(left, actions);
  return topbar;
}

function renderDetailWithBook(detail, book, selectedPeriod, handlers) {
  const page = document.createElement('div');
  const completed = book.status === 'analyzed' || book.status === 'reviewing';
  const loading = handlers.view === 'analysis-loading';
  page.className = `month-detail-scroll book-ready-page${completed && !loading ? ' book-completed-page' : ''}`;

  const hero = document.createElement('div');
  hero.className = 'book-ready-hero';
  const cover = createCover(book, 'month-detail-cover');
  cover.classList.add('book-ready-cover');

  const topbar = createDetailTopbar(selectedPeriod, book, handlers, { showShare: completed && !loading });
  topbar.querySelector('.detail-eyebrow').textContent = `${selectedPeriod.year}. ${String(selectedPeriod.month).padStart(2, '0')}월`;

  const title = document.createElement('h1');
  title.className = 'book-ready-title';
  title.textContent = book.title || '제목 없음';

  const authors = createMetaRow('저자', book.authors || '작가 정보 없음');
  authors.classList.add('book-ready-authors');

  const rating = document.createElement('div');
  rating.className = 'book-ready-rating';
  const ratingLabel = document.createElement('span');
  ratingLabel.textContent = '총점';
  const ratingButton = document.createElement('button');
  ratingButton.type = 'button';
  ratingButton.className = 'detail-rating-trigger book-ready-rating-button';
  ratingButton.setAttribute('aria-label', '총점 및 리뷰 보기');
  const ratingValue = document.createElement('span');
  ratingValue.className = 'book-ready-rating-value';
  ratingValue.textContent = String(Number(book.avgRating) || 0);
  ratingButton.append(createStars(book.avgRating), ratingValue);
  ratingButton.addEventListener('click', () => renderRatingModal(book, handlers));
  rating.append(ratingLabel, ratingButton);

  const info = document.createElement('div');
  info.className = 'book-overview-info';
  info.append(topbar, title, authors, rating);
  hero.append(cover, info);
  page.appendChild(hero);

  if (loading) {
    const status = document.createElement('p');
    status.className = 'book-ready-empty-summary';
    status.setAttribute('role', 'status');
    status.textContent = '분석중';
    page.appendChild(status);
  } else if (completed) {
    const duration = createMetaRow('토론시간', book.discussionDurationSeconds == null
      ? '기록 없음' : formatDurationSeconds(book.discussionDurationSeconds));
    duration.classList.add('book-completed-meta');
    const date = createMetaRow('날짜', formatMeetingDate(book.meetingDate) || '기록 없음');
    date.classList.add('book-completed-meta');
    info.append(duration, date);

    const summary = document.createElement('section');
    summary.className = 'book-completed-summary';
    const summaryHeading = document.createElement('h2');
    summaryHeading.textContent = '요약';
    const summaryText = document.createElement('p');
    summaryText.className = 'book-summary-copy';
    summaryText.textContent = book.summary || '요약이 아직 없습니다.';
    summary.append(summaryHeading, summaryText);
    page.appendChild(summary);
  } else {
    const actions = document.createElement('div');
    actions.className = 'book-ready-actions';
    const startButton = document.createElement('button');
    startButton.className = 'detail-action-primary btn-start-meeting';
    startButton.type = 'button';
    startButton.textContent = '독서모임 시작';
    startButton.addEventListener('click', () => handlers.onStartMeeting(book.id));
    const uploadButton = document.createElement('button');
    uploadButton.className = 'detail-action-secondary btn-upload-recording';
    uploadButton.type = 'button';
    uploadButton.textContent = '녹음본 업로드';
    uploadButton.addEventListener('click', () => handlers.onUploadRecording(book.id));
    actions.append(startButton, uploadButton);

    const emptySummary = document.createElement('p');
    emptySummary.className = 'book-ready-empty-summary';
    emptySummary.append('아직 요약이 없어요!', document.createElement('br'), '독서모임을 통해서 기록해보세요');

    info.appendChild(actions);
    page.appendChild(emptySummary);
  }
  detail.appendChild(page);
}

function createReviewFormRow(review = {}) {
  const row = document.createElement('div');
  row.className = 'magazine-review-row';

  const nameInput = document.createElement('input');
  nameInput.className = 'reviewer-name-input';
  nameInput.type = 'text';
  nameInput.placeholder = '이름';
  nameInput.value = review.name || '';
  nameInput.setAttribute('aria-label', '이름');

  const ratingSelect = document.createElement('select');
  ratingSelect.className = 'review-rating-input';
  ratingSelect.setAttribute('aria-label', '별점');
  [5, 4, 3, 2, 1].forEach((rating) => {
    const option = document.createElement('option');
    option.value = String(rating);
    option.textContent = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`;
    ratingSelect.appendChild(option);
  });
  ratingSelect.value = String(review.rating || 5);

  const reviewInput = document.createElement('input');
  reviewInput.className = 'review-text-input';
  reviewInput.type = 'text';
  reviewInput.placeholder = '리뷰';
  reviewInput.value = review.review || '';
  reviewInput.setAttribute('aria-label', '리뷰');

  row.append(nameInput, ratingSelect, reviewInput);
  return row;
}

function collectMagazineReviews(form) {
  const rows = form.querySelectorAll('.magazine-review-row');
  return Array.from(rows)
    .map((row) => ({
      name: row.querySelector('.reviewer-name-input').value.trim(),
      rating: Number(row.querySelector('.review-rating-input').value),
      review: row.querySelector('.review-text-input').value.trim(),
    }))
    .filter((review) => review.name || review.review);
}

function renderBookEdit(detail, book, selectedPeriod, handlers) {
  const scroll = document.createElement('div');
  scroll.className = 'month-detail-scroll book-ready-page book-edit-page';

  const hero = document.createElement('div');
  hero.className = 'book-ready-hero';

  const coverStage = document.createElement('div');
  coverStage.className = 'book-ready-cover-stage';
  const cover = createCover(book, 'month-detail-cover');
  cover.classList.add('book-ready-cover');
  coverStage.appendChild(cover);

  const summaryInput = document.createElement('textarea');
  summaryInput.className = 'magazine-summary-input';
  summaryInput.value = book.summary || '';
  summaryInput.placeholder = '요약';
  summaryInput.setAttribute('aria-label', '요약');

  const totalDurationSeconds = Math.max(0, Math.round(Number(book.discussionDurationSeconds) || 0));
  const makeDurationInput = (value, label) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = String(value);
    input.className = 'duration-edit-input';
    input.setAttribute('aria-label', label);
    return input;
  };
  const hoursInput = makeDurationInput(Math.floor(totalDurationSeconds / 3600), '시간');
  const minutesInput = makeDurationInput(Math.floor((totalDurationSeconds % 3600) / 60), '분');
  const secondsInput = makeDurationInput(totalDurationSeconds % 60, '초');

  const durationRow = document.createElement('div');
  durationRow.className = 'detail-meta-row book-completed-meta duration-edit-row';
  const durationLabel = document.createElement('span');
  durationLabel.className = 'detail-meta-label';
  durationLabel.textContent = '토론시간';
  const durationValue = document.createElement('span');
  durationValue.className = 'detail-meta-value duration-edit-fields';
  durationValue.append(hoursInput, '시간 ', minutesInput, '분 ', secondsInput, '초');
  durationRow.append(durationLabel, durationValue);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'detail-meta-value date-edit-input';
  dateInput.value = book.meetingDate || '';
  dateInput.setAttribute('aria-label', '모임 날짜');

  const dateRow = document.createElement('div');
  dateRow.className = 'detail-meta-row book-completed-meta';
  const dateLabel = document.createElement('span');
  dateLabel.className = 'detail-meta-label';
  dateLabel.textContent = '날짜';
  dateRow.append(dateLabel, dateInput);

  const topbar = createDetailTopbar(selectedPeriod, book, handlers, {
    editLabel: '저장',
    onEdit: () => {
      const discussionDurationSeconds = (Number(hoursInput.value) || 0) * 3600
        + (Number(minutesInput.value) || 0) * 60
        + (Number(secondsInput.value) || 0);
      handlers.onEditContentSave(book.id, summaryInput.value, book.reviews || [], {
        meetingDate: dateInput.value,
        discussionDurationSeconds,
      });
    },
    onCancel: () => handlers.onCancelEdit?.(book.id),
  });
  topbar.querySelector('.detail-eyebrow').textContent = `${selectedPeriod.year}. ${String(selectedPeriod.month).padStart(2, '0')}월`;

  const title = document.createElement('h1');
  title.className = 'book-ready-title';
  title.textContent = book.title || '제목 없음';

  const authors = createMetaRow('저자', book.authors || '작가 정보 없음');
  authors.classList.add('book-ready-authors');

  const rating = document.createElement('div');
  rating.className = 'book-ready-rating';
  const ratingLabel = document.createElement('span');
  ratingLabel.textContent = '총점';
  const ratingButton = document.createElement('button');
  ratingButton.type = 'button';
  ratingButton.className = 'detail-rating-trigger book-ready-rating-button';
  ratingButton.setAttribute('aria-label', '총점 및 리뷰 보기');
  const ratingValue = document.createElement('span');
  ratingValue.className = 'book-ready-rating-value';
  ratingValue.textContent = String(Number(book.avgRating) || 0);
  ratingButton.append(createStars(book.avgRating), ratingValue);
  ratingButton.addEventListener('click', () => renderRatingModal(book, handlers, { editable: true }));
  rating.append(ratingLabel, ratingButton);

  const actionBar = document.createElement('div');
  actionBar.className = 'book-ready-actions book-edit-actions';

  const editBookButton = document.createElement('button');
  editBookButton.className = 'detail-action-primary btn-edit-book';
  editBookButton.type = 'button';
  editBookButton.textContent = '책 바꾸기';
  editBookButton.addEventListener('click', () => handlers.onEditCover?.(book.id));

  const startButton = document.createElement('button');
  startButton.className = 'detail-action-primary btn-start-meeting';
  startButton.type = 'button';
  startButton.textContent = '독서모임 시작';
  startButton.addEventListener('click', () => handlers.onStartMeeting(book.id));

  const uploadButton = document.createElement('button');
  uploadButton.className = 'detail-action-secondary btn-upload-recording';
  uploadButton.type = 'button';
  uploadButton.textContent = '녹음본 업로드';
  uploadButton.addEventListener('click', () => handlers.onUploadRecording(book.id));

  actionBar.append(editBookButton, startButton, uploadButton);

  const info = document.createElement('div');
  info.className = 'book-overview-info';
  info.append(topbar, title, authors, rating, durationRow, dateRow, actionBar);
  hero.append(coverStage, info);

  const form = document.createElement('div');
  form.className = 'book-edit-form book-completed-summary';

  const summaryHeading = document.createElement('h2');
  summaryHeading.textContent = '요약';

  form.append(summaryHeading, summaryInput);

  scroll.append(hero, form);
  detail.appendChild(scroll);
}

function renderReviewEntry(detail, book, selectedPeriod, handlers) {
  const scroll = document.createElement('div');
  scroll.className = 'month-detail-scroll review-entry-page';

  const hero = document.createElement('div');
  hero.className = 'detail-hero';

  const coverStage = document.createElement('div');
  coverStage.className = 'detail-cover-stage';
  coverStage.appendChild(createCover(book, 'month-detail-cover'));

  const info = document.createElement('div');
  info.className = 'detail-info';

  const title = document.createElement('h1');
  title.className = 'month-detail-title';
  title.textContent = book.title || '제목 없음';

  const authors = document.createElement('p');
  authors.className = 'month-detail-authors';
  authors.textContent = book.authors || '작가 정보 없음';

  info.append(title, authors);
  hero.append(coverStage, info);

  const magazine = document.createElement('section');
  magazine.className = 'magazine-review-panel';

  const summaryTitle = document.createElement('p');
  summaryTitle.className = 'magazine-summary-label';
  summaryTitle.textContent = '요약';

  const needsManualSummary = Boolean(book.analysisError) || !book.summary;
  const summary = needsManualSummary
    ? document.createElement('textarea')
    : document.createElement('p');
  summary.className = needsManualSummary
    ? 'magazine-summary-input magazine-summary-manual'
    : 'magazine-summary-copy';
  if (needsManualSummary) {
    summary.value = book.summary || '';
    summary.placeholder = '요약';
    summary.setAttribute('aria-label', '요약');
  } else {
    summary.textContent = book.summary;
  }

  const form = document.createElement('form');
  form.className = 'magazine-review-form';

  const existingReviews = book.reviews?.length ? book.reviews : Array.from({ length: 5 }, () => ({}));
  existingReviews.forEach((review) => form.appendChild(createReviewFormRow(review)));

  const actions = document.createElement('div');
  actions.className = 'magazine-review-actions';

  const addRowButton = document.createElement('button');
  addRowButton.className = 'detail-action-secondary';
  addRowButton.type = 'button';
  addRowButton.textContent = '행 추가';
  addRowButton.addEventListener('click', () => {
    form.insertBefore(createReviewFormRow(), actions);
  });

  const saveButton = document.createElement('button');
  saveButton.className = 'detail-action-primary';
  saveButton.type = 'submit';
  saveButton.textContent = '저장';

  actions.append(addRowButton, saveButton);
  form.appendChild(actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onReviewSave(
      book.id,
      collectMagazineReviews(form),
      needsManualSummary ? summary.value : book.summary,
    );
  });

  magazine.append(summaryTitle, summary, form);
  scroll.append(createDetailTopbar(selectedPeriod, book, handlers), hero, magazine);
  detail.appendChild(scroll);
}

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
  eyebrow.textContent = `${selectedPeriod.year}. ${String(selectedPeriod.month).padStart(2, '0')}월`;
  const topbar = document.createElement('div');
  topbar.className = 'detail-top-left';
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'mobile-detail-back';
  backButton.setAttribute('aria-label', '달력으로 돌아가기');
  backButton.addEventListener('click', () => handlers.onMobileBack?.());
  topbar.append(backButton, eyebrow);
  header.appendChild(topbar);

  const form = document.createElement('form');
  form.className = 'month-search-form';

  const input = document.createElement('input');
  input.className = 'month-search-input';
  input.type = 'search';
  input.setAttribute('aria-label', '책 제목 검색');
  input.placeholder = '책 제목을 검색하세요';
  input.value = searchState.query || '';

  const button = document.createElement('button');
  button.className = 'detail-action-primary btn-search';
  button.type = 'submit';
  button.textContent = '검색';
  button.disabled = searchState.status === 'loading';

  form.append(input, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onSearch(input.value);
  });

  header.appendChild(form);
  panel.appendChild(header);

  if (searchState.results.length > 0) {
    const list = document.createElement('ul');
    list.className = 'month-search-results';

    searchState.results.forEach((book) => {
      const item = document.createElement('li');
      item.className = 'search-result-item';
      item.appendChild(createCover(book, 'search-result-cover'));

      const resultText = document.createElement('div');
      resultText.className = 'search-result-text';

      const resultTitle = document.createElement('h2');
      resultTitle.className = 'search-result-title';
      resultTitle.textContent = book.title || '제목 없음';

      const authorRow = document.createElement('p');
      authorRow.className = 'search-result-authors';
      const authorLabel = document.createElement('span');
      authorLabel.textContent = '저자';
      const authorValue = document.createElement('span');
      authorValue.textContent = book.authors || '정보 없음';
      authorRow.append(authorLabel, authorValue);

      const selectButton = document.createElement('button');
      selectButton.className = 'search-result-select';
      selectButton.type = 'button';
      selectButton.textContent = '선택';
      selectButton.setAttribute('aria-label', `${book.title || '제목 없음'} 선택`);
      selectButton.addEventListener('click', () => handlers.onSearchResult(book));

      resultText.append(resultTitle, authorRow, selectButton);
      item.appendChild(resultText);
      list.appendChild(item);
    });

    panel.appendChild(list);
  } else if (searchState.status === 'loading') {
    const loading = document.createElement('p');
    loading.className = 'month-search-status';
    loading.setAttribute('role', 'status');
    loading.textContent = '검색 중입니다...';
    panel.appendChild(loading);
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

function renderMonthDetail(detail, book, selectedPeriod, handlers) {
  detail.innerHTML = '';
  if (book) {
    if (handlers.view === 'book-edit' || handlers.view === 'edit-search') {
      renderBookEdit(detail, book, selectedPeriod, handlers);
    } else if (handlers.view === 'review-entry') {
      renderReviewEntry(detail, book, selectedPeriod, handlers);
    } else {
      renderDetailWithBook(detail, book, selectedPeriod, handlers);
    }
  }
}

function createGuideBubble({ characterFile, lines, onSelect, onCharacterClick }) {
  const wrap = document.createElement('div');
  wrap.className = 'guide-bubble-wrap';

  if (lines) {
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
      onSelect.forEach(({ label, onClick, selected }) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = `guide-bubble-option${selected ? ' is-selected' : ''}`;
        optBtn.textContent = label;
        optBtn.addEventListener('click', onClick);
        options.appendChild(optBtn);
      });
      bubble.appendChild(options);
    }

    wrap.appendChild(bubble);
  }

  const character = document.createElement('img');
  character.className = 'guide-character';
  character.src = `assets/characters/${characterFile}`;
  character.alt = '길잡이 캐릭터';

  if (onCharacterClick) {
    character.classList.add('guide-character-clickable');
    character.setAttribute('role', 'button');
    character.setAttribute('tabindex', '0');
    character.addEventListener('click', onCharacterClick);
    character.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onCharacterClick();
      }
    });
  }

  wrap.appendChild(character);
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

function renderMeetingRules(detail, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-rules-page';

  page.appendChild(createMeetingCopy({
    includeConsent: true,
    onConfirm: handlers.onMeetingConsent,
    className: 'meeting-rules-copy',
    notice: handlers.meetingPermissionMessage,
  }));

  detail.appendChild(page);
}

function createMeetingCopy({
  includeConsent = false,
  onConfirm,
  className = '',
  notice = '',
} = {}) {
  const copy = document.createElement('div');
  copy.className = `meeting-copy ${className}`.trim();

  const title = document.createElement('h1');
  title.className = 'meeting-title';
  title.append('건전한', document.createElement('br'), '독서모임을 위한 수칙');

  const rules = createMeetingRulesList();
  copy.append(title, rules);

  if (includeConsent) {
    const confirmButton = document.createElement('button');
    confirmButton.className = 'detail-action-primary meeting-confirm-btn';
    confirmButton.type = 'button';
    confirmButton.textContent = '진짜 시작하기!';
    confirmButton.addEventListener('click', onConfirm);
    copy.appendChild(confirmButton);
  }

  if (notice) {
    const noticeCopy = document.createElement('p');
    noticeCopy.className = 'meeting-permission-copy';
    noticeCopy.textContent = notice;
    noticeCopy.setAttribute('role', 'status');
    copy.appendChild(noticeCopy);
  }

  return copy;
}

function createMeetingRulesList() {
  const rules = document.createElement('ul');
  rules.className = 'meeting-rules-list';
  MEETING_RULES.forEach((rule) => {
    const item = document.createElement('li');
    item.textContent = rule;
    rules.appendChild(item);
  });
  return rules;
}

function createInlineLogo() {
  const logo = document.createElement('img');
  logo.className = 'inline-app-logo';
  logo.src = 'assets/logo.png';
  logo.alt = '책좀읽읍시다';
  return logo;
}

function renderMeetingLeft(container, book, selectedPeriod, view = '') {
  const usesMeetingBookLayout = view === 'meeting-rules' || view === 'meeting-active';
  const panel = document.createElement('div');
  panel.className = `meeting-left-panel${usesMeetingBookLayout ? ' is-active' : ''}`;
  panel.appendChild(createInlineLogo());

  if (usesMeetingBookLayout) {
    const title = document.createElement('p');
    title.className = 'meeting-selected-title meeting-active-book-title';
    title.textContent = book?.title || '선택한 책';
    panel.appendChild(title);
    if (book) panel.appendChild(createCover(book, 'meeting-selected-cover meeting-active-book-cover'));
    container.appendChild(panel);
    return;
  }

  const month = document.createElement('p');
  month.className = 'meeting-selected-month';
  month.textContent = `${selectedPeriod.month}월`;

  const card = document.createElement('div');
  card.className = 'meeting-selected-book';
  if (book) {
    card.appendChild(createCover(book, 'meeting-selected-cover'));
  }

  const title = document.createElement('p');
  title.className = 'meeting-selected-title';
  title.textContent = book?.title || '선택한 책';
  card.appendChild(title);

  panel.append(month, card);

  container.appendChild(panel);
}

export const GUIDE_CHARACTER_CONTENT = {
  welcome: {
    characterFile: '책6_인사.png',
    lines: [
      '안녕하세요?',
      '독서모임 길잡이 입니다. 이 응용프로그램을 사용하는',
      '여러분을 돕는게 제 일이죠.',
    ],
  },
  topics: {
    characterFile: '책3_검색.png',
    lines: ['이런 것들을 얘기해볼 수 있어요'],
  },
  'topic-chosen': {
    characterFile: '책2_궁금.png',
  },
  'idle-help': {
    characterFile: '책3_검색.png',
    lines: ['혹시 제가 필요할까요? 저는 여러분을 최대한 도와드릴수', '있습니다!'],
    bodyLines: ['아무도 말을 하고 있지않습니다..'],
    options: [
      { label: '무슨말을 해야할까요?', action: 'help' },
      { label: '어떻게 시작해야돼?', action: 'help' },
      { label: '어쩌구...', action: 'dismiss' },
      { label: '그냥 시작할게', action: 'dismiss' },
    ],
  },
  encourage: {
    characterFile: '책7_엄지척.png',
    lines: ['우와!! 지금 너무 좋은데요!!', '서로 말도 잘하고 계세용!'],
    bodyLines: [],
  },
  'warn-loud': {
    characterFile: '책2_궁금.png',
    lines: ['지금 너무 격해졌어요', '잠깐 쉬었다 해보세요!!'],
    bodyLines: ['목소리가 커지고 있습니다!'],
  },
  'block-fight': {
    characterFile: '책1_금지.png',
    lines: ['잠깐! 수칙을 다같이 외쳐보아요!'],
    bodyLines: [MEETING_RULES.join(' ')],
  },
};

function renderMeetingActive(detail, selectedPeriod, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-active-page';

  const header = document.createElement('header');
  header.className = 'meeting-active-header';

  const date = document.createElement('p');
  date.className = 'meeting-active-date';
  date.textContent = `${selectedPeriod.year}. ${String(selectedPeriod.month).padStart(2, '0')}월`;

  const heading = document.createElement('h1');
  heading.className = 'meeting-active-heading';
  heading.textContent = '독서모임을 하고있습니다';

  const finishButton = document.createElement('button');
  finishButton.className = 'meeting-finish-btn';
  finishButton.type = 'button';
  finishButton.textContent = '완료!';
  finishButton.addEventListener('click', handlers.onMeetingFinish);
  header.append(date, heading, finishButton);

  const body = document.createElement('section');
  body.className = 'meeting-recording-body';

  const isBlocked = handlers.guideState === 'block-fight';
  const showsWelcome = !isBlocked && handlers.meetingGuideView === 'welcome';
  const showsTopicsGuide = !isBlocked && handlers.meetingGuideView === 'topics';
  const showsTopicChosen = !isBlocked && handlers.meetingGuideView === 'topic-chosen';
  const dynamicGuide = !showsWelcome && !showsTopicsGuide
    ? GUIDE_CHARACTER_CONTENT[handlers.guideState] || null
    : null;
  const hasTopicChosenDetail = !isBlocked && handlers.activeTopicIndex != null;
  const hasOverrideText = !!dynamicGuide?.bodyLines?.length || hasTopicChosenDetail;

  if (isBlocked) {
    page.classList.add('guide-state-block-fight');
    const lockPanel = document.createElement('div');
    lockPanel.className = 'block-fight-overlay';

    const lockTitle = document.createElement('h2');
    lockTitle.className = 'block-fight-title';
    lockTitle.textContent = '건전한 독서모임을 위한 수칙';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'detail-action-primary block-fight-reset';
    resetButton.textContent = '다시 시작하기!';
    resetButton.addEventListener('click', () => handlers.onGuideReset?.());

    lockPanel.append(lockTitle, createMeetingRulesList(), resetButton);
    body.appendChild(lockPanel);
    finishButton.disabled = true;
  } else if (!hasOverrideText) {
    const status = document.createElement('p');
    status.className = 'meeting-recording-status';
    status.textContent = '녹음중입니다...';
    body.appendChild(status);

    const guideHint = document.createElement('p');
    guideHint.className = 'meeting-guide-hint';
    guideHint.textContent = '언제든지 도움이 필요하면 아래 길잡이 를 눌러주세요';
    body.appendChild(guideHint);
  }

  if (dynamicGuide && !isBlocked) {
    page.classList.add(`guide-state-${handlers.guideState}`);
    dynamicGuide.bodyLines.forEach((line) => {
      const message = document.createElement('p');
      message.className = 'meeting-state-message';
      message.textContent = line;
      body.appendChild(message);
    });
  }

  if (hasTopicChosenDetail) {
    const topicTitle = MEETING_TOPIC_PROMPTS[handlers.activeTopicIndex];
    const topicDetail = MEETING_TOPIC_DETAILS[handlers.activeTopicIndex];
    if (topicTitle) {
      const topicDetailSection = document.createElement('div');
      topicDetailSection.className = 'meeting-topic-detail';

      const topicDetailTitle = document.createElement('h2');
      topicDetailTitle.className = 'meeting-topic-detail-title';
      topicDetailTitle.textContent = topicTitle;

      const topicDetailCopy = document.createElement('p');
      topicDetailCopy.className = 'meeting-topic-detail-copy';
      topicDetailCopy.textContent = topicDetail || '';

      topicDetailSection.append(topicDetailTitle, topicDetailCopy);
      body.appendChild(topicDetailSection);
    }
  }

  if (handlers.meetingLog?.length) {
    const logPanel = document.createElement('div');
    logPanel.className = 'meeting-log-panel';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'meeting-log-toggle';
    toggleButton.textContent = handlers.meetingLogExpanded ? '기록 접기' : '기록 펼치기';
    toggleButton.setAttribute('aria-expanded', String(!!handlers.meetingLogExpanded));
    toggleButton.addEventListener('click', () => handlers.onMeetingLogToggle?.());
    logPanel.appendChild(toggleButton);

    const entriesToShow = handlers.meetingLogExpanded
      ? handlers.meetingLog
      : handlers.meetingLog.slice(-1);

    const log = document.createElement('ol');
    log.className = 'meeting-log';
    entriesToShow.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'meeting-log-entry';

      const time = document.createElement('span');
      time.className = 'meeting-log-time';
      time.textContent = formatLogTimestamp(entry.time);

      const text = document.createElement('span');
      text.className = 'meeting-log-text';
      text.textContent = entry.text;

      item.append(time, text);
      log.appendChild(item);
    });
    logPanel.appendChild(log);

    body.appendChild(logPanel);
  }

  page.append(header, body);

  const dock = document.createElement('aside');
  dock.className = 'meeting-guide-dock';

  if (isBlocked) {
    const guideContent = GUIDE_CHARACTER_CONTENT['block-fight'];
    dock.appendChild(createGuideBubble({
      characterFile: guideContent.characterFile,
      lines: guideContent.lines,
    }));
  } else if (dynamicGuide) {
    const options = dynamicGuide.options?.map(({ label, action }) => ({
      label,
      onClick: action === 'help'
        ? () => handlers.onMeetingGuideHelp?.()
        : () => handlers.onMeetingGuideDismiss?.(),
    }));
    dock.appendChild(createGuideBubble({
      characterFile: dynamicGuide.characterFile,
      lines: dynamicGuide.lines,
      onSelect: options,
    }));
  } else if (showsWelcome) {
    dock.appendChild(createGuideBubble({
      characterFile: GUIDE_CHARACTER_CONTENT.welcome.characterFile,
      lines: GUIDE_CHARACTER_CONTENT.welcome.lines,
      onSelect: [
        { label: '도움이 필요하세요?', onClick: () => handlers.onMeetingGuideHelp?.() },
      ],
      onCharacterClick: () => handlers.onMeetingGuideOpen?.(),
    }));
  } else if (showsTopicsGuide) {
    dock.appendChild(createGuideBubble({
      characterFile: GUIDE_CHARACTER_CONTENT.topics.characterFile,
      lines: GUIDE_CHARACTER_CONTENT.topics.lines,
      onSelect: MEETING_TOPIC_PROMPTS.map((prompt, index) => ({
        label: prompt,
        onClick: () => handlers.onMeetingTopicSelect?.(index),
        selected: index === handlers.activeTopicIndex,
      })),
      onCharacterClick: () => handlers.onMeetingGuideOpen?.(),
    }));
  } else if (showsTopicChosen) {
    const question = MEETING_TOPIC_QUESTIONS[handlers.activeTopicIndex];
    dock.appendChild(createGuideBubble({
      characterFile: GUIDE_CHARACTER_CONTENT['topic-chosen'].characterFile,
      lines: question ? [question] : null,
      onCharacterClick: () => handlers.onMeetingGuideOpen?.(),
    }));
  } else {
    dock.appendChild(createGuideBubble({
      characterFile: '책6_인사.png',
      lines: null,
      onCharacterClick: () => handlers.onMeetingGuideOpen?.(),
    }));
  }

  page.appendChild(dock);

  detail.appendChild(page);
  body.scrollTop = body.scrollHeight;
}

function removeRatingModal() {
  const overlay = document.getElementById('rating-modal');
  if (!overlay) return;
  const returnFocus = overlay.returnFocus;
  overlay.remove();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else document.querySelector('.detail-rating-trigger')?.focus({ preventScroll: true });
}

function createStarPicker(initialValue, onChange) {
  const picker = document.createElement('div');
  picker.className = 'rating-picker';
  picker.setAttribute('role', 'slider');
  picker.setAttribute('aria-label', '별점 선택');
  picker.setAttribute('aria-valuemin', '0.5');
  picker.setAttribute('aria-valuemax', '5');
  picker.tabIndex = 0;

  let value = initialValue;
  const clampValue = (rating) => Math.max(0.5, Math.min(5, Math.round(rating * 2) / 2));
  const select = (rating) => {
    value = clampValue(rating);
    buttons.forEach((button, index) => {
      const fillAmount = Math.max(0, Math.min(1, value - index));
      button.fill.style.width = `${fillAmount * 100}%`;
    });
    picker.setAttribute('aria-valuenow', String(value));
    picker.setAttribute('aria-valuetext', `${value}점`);
    onChange(value);
  };
  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rating-picker-star';
    button.tabIndex = -1;
    button.setAttribute('aria-hidden', 'true');

    const empty = document.createElement('span');
    empty.className = 'rating-picker-star-empty';
    empty.textContent = '★';
    const fill = document.createElement('span');
    fill.className = 'rating-picker-star-fill';
    fill.textContent = '★';
    button.append(empty, fill);
    button.fill = fill;

    button.addEventListener('click', (event) => {
      const { left, width } = button.getBoundingClientRect();
      const isHalf = event.clientX - left < width / 2;
      select(n - (isHalf ? 0.5 : 0));
    });
    return button;
  });
  picker.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0.5 : event.key === 'End' ? 5
      : value + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 0.5 : -0.5);
    select(next);
  });
  select(initialValue);
  picker.append(...buttons);
  picker.getValue = () => value;
  picker.setValue = select;
  return picker;
}

function createRatingScrollFrame(scroller, label) {
  const frame = document.createElement('div');
  frame.className = 'rating-scroll-frame';
  frame.appendChild(scroller);
  for (const [direction, distance, text] of [['up', -120, '위로'], ['down', 120, '아래로']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scroll-arrow-btn scroll-arrow-${direction}`;
    button.setAttribute('aria-label', `${label} ${text} 스크롤`);
    button.setAttribute('aria-controls', scroller.id);
    button.addEventListener('click', () => scroller.scrollBy({ top: distance, behavior: 'smooth' }));
    frame.appendChild(button);
  }
  return frame;
}

function renderRatingModal(book, handlers, { editable = false } = {}) {
  removeRatingModal();

  const overlay = document.createElement('div');
  overlay.id = 'rating-modal';
  overlay.className = 'rating-modal-overlay';
  overlay.returnFocus = document.activeElement;

  const modal = document.createElement('section');
  modal.className = 'rating-modal rating-window';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${book.title || '이 책'} 감상평`);

  const titlebar = document.createElement('div');
  titlebar.className = 'rating-window-titlebar';
  const closeButton = document.createElement('button');
  closeButton.className = 'rating-modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '닫기');
  closeButton.addEventListener('click', removeRatingModal);
  titlebar.appendChild(closeButton);

  const list = document.createElement('ul');
  list.id = 'rating-review-list';
  list.className = 'rating-modal-list';
  list.tabIndex = 0;
  list.setAttribute('aria-label', '감상평 목록');
  const reviews = book.reviews || [];
  let editingIndex = null;

  if (reviews.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'rating-modal-empty';
    empty.textContent = '아직 감상평이 없어요. 가장 먼저 남겨보세요!';
    list.appendChild(empty);
  } else {
    reviews.forEach((review, index) => {
      const item = document.createElement('li');
      item.className = 'rating-modal-item';
      const head = document.createElement('p');
      head.className = 'rating-modal-item-head';
      head.append(`[${review.name || '익명'}]의 감상평 : `, createStars(review.rating));
      const body = document.createElement('p');
      body.className = 'rating-modal-item-body';
      body.textContent = review.review || '';
      item.append(head, body);

      if (editable) {
        const itemActions = document.createElement('div');
        itemActions.className = 'rating-modal-item-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'detail-top-action';
        editButton.textContent = '수정';
        editButton.addEventListener('click', () => {
          editingIndex = index;
          nameInput.value = review.name || '';
          picker.setValue(review.rating || 5);
          reviewInput.value = review.review || '';
          submitButton.textContent = '수정 저장';
          nameInput.focus({ preventScroll: true });
        });

        const actionDivider = document.createElement('span');
        actionDivider.className = 'detail-top-separator';
        actionDivider.textContent = '|';

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'detail-top-action';
        deleteButton.textContent = '삭제';
        deleteButton.addEventListener('click', () => {
          if (!window.confirm('이 감상평을 삭제할까요?')) return;
          const updatedReviews = reviews.filter((_, i) => i !== index);
          handlers.onRatingSave(book.id, updatedReviews);
          renderRatingModal({ ...book, reviews: updatedReviews }, handlers, { editable });
        });

        itemActions.append(editButton, actionDivider, deleteButton);
        item.appendChild(itemActions);
      }

      list.appendChild(item);
    });
  }

  const form = document.createElement('form');
  form.className = 'rating-modal-form';
  const toolbar = document.createElement('div');
  toolbar.className = 'rating-compose-toolbar';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'rating-name-label';
  nameLabel.textContent = '이름';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'rating-modal-name';
  nameInput.setAttribute('aria-label', '이름');
  nameInput.required = true;
  nameLabel.appendChild(nameInput);

  const reviewInput = document.createElement('textarea');
  reviewInput.id = 'rating-review-draft';
  reviewInput.className = 'rating-modal-review';
  reviewInput.placeholder = '감상평을 남겨주세요';
  reviewInput.setAttribute('aria-label', '감상평');

  const picker = createStarPicker(5, () => {});
  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'detail-action-primary btn-rating-submit';
  submitButton.textContent = '보내기';
  toolbar.append(nameLabel, picker, submitButton);
  form.append(toolbar, createRatingScrollFrame(reviewInput, '감상평 입력'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    const reviewData = { name, rating: picker.getValue(), review: reviewInput.value.trim() };
    const updatedReviews = editingIndex !== null
      ? reviews.map((entry, i) => (i === editingIndex ? reviewData : entry))
      : [...reviews, reviewData];
    handlers.onRatingSave(book.id, updatedReviews);
    removeRatingModal();
  });

  modal.append(titlebar, createRatingScrollFrame(list, '감상평 목록'), form);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) removeRatingModal();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      removeRatingModal();
    } else if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('button, input, textarea, [tabindex]')]
        .filter((element) => !element.disabled && element.tabIndex >= 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.body.appendChild(overlay);
  nameInput.focus({ preventScroll: true });
}

function removeUploadDateModal() {
  document.getElementById('upload-date-modal')?.remove();
}

export function renderUploadDateModal({ onConfirm, onCancel } = {}) {
  removeUploadDateModal();

  const overlay = document.createElement('div');
  overlay.id = 'upload-date-modal';
  overlay.className = 'rating-modal-overlay';

  const modal = document.createElement('section');
  modal.className = 'rating-modal upload-date-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '모임 날짜 입력');

  const closeButton = document.createElement('button');
  closeButton.className = 'rating-modal-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '닫기');
  closeButton.addEventListener('click', () => {
    removeUploadDateModal();
    onCancel?.();
  });

  const label = document.createElement('p');
  label.className = 'upload-date-label';
  label.textContent = '이 녹음본의 모임 날짜를 입력해주세요';

  const form = document.createElement('form');
  form.className = 'upload-date-form';

  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'upload-date-input';
  input.required = true;
  const today = new Date();
  input.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const actions = document.createElement('div');
  actions.className = 'upload-date-actions';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'detail-action-secondary';
  cancelButton.textContent = '취소';
  cancelButton.addEventListener('click', () => {
    removeUploadDateModal();
    onCancel?.();
  });

  const confirmButton = document.createElement('button');
  confirmButton.type = 'submit';
  confirmButton.className = 'detail-action-primary';
  confirmButton.textContent = '확인';

  actions.append(cancelButton, confirmButton);
  form.append(input, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value;
    removeUploadDateModal();
    onConfirm?.(value);
  });

  modal.append(closeButton, label, form);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      removeUploadDateModal();
      onCancel?.();
    }
  });
  document.body.appendChild(overlay);
  input.focus();
}

export function updateMonthGridScrollArrowVisibility() {
  const grid = document.getElementById('month-grid');
  const frame = grid?.closest('.calendar-scroll-frame');
  if (!grid || !frame) return;

  const canScroll = grid.scrollHeight > grid.clientHeight + 1;
  frame.querySelectorAll(':scope > .scroll-arrow-up, :scope > .scroll-arrow-down')
    .forEach((button) => { button.hidden = !canScroll; });
  grid.classList.toggle('is-not-scrollable', !canScroll);
}

export function renderBookSlider(books, selectedPeriod, handlers) {
  const container = document.getElementById('book-slider');
  const detail = document.getElementById('month-detail');
  if (!container || !detail) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const monthBooks = buildMonthBookMap(books);
  const selectedBook = monthBooks.get(periodKey(selectedPeriod.year, selectedPeriod.month));

  const previousGrid = container.querySelector('.month-grid');
  const previousScrollTop = previousGrid?.dataset.year === String(selectedPeriod.year) ? previousGrid.scrollTop : 0;
  container.innerHTML = '';
  container.classList.toggle('is-meeting-left', handlers.view === 'meeting-intro' || handlers.view === 'meeting-rules' || handlers.view === 'meeting-active');

  if (handlers.view === 'meeting-intro') {
    renderMeetingLeft(container, selectedBook, selectedPeriod, handlers.view);
    renderMeetingIntro(detail, handlers);
    return;
  }

  if (handlers.view === 'meeting-rules') {
    renderMeetingLeft(container, selectedBook, selectedPeriod, handlers.view);
    renderMeetingRules(detail, handlers);
    return;
  }

  if (handlers.view === 'meeting-active') {
    renderMeetingLeft(container, selectedBook, selectedPeriod, handlers.view);
    renderMeetingActive(detail, selectedPeriod, handlers);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'main-left-stack';
  stack.appendChild(createInlineLogo());

  const board = document.createElement('section');
  board.className = 'month-board';

  const header = document.createElement('div');
  header.className = 'year-header';

  const prevYear = document.createElement('button');
  prevYear.className = 'year-nav-btn year-nav-prev';
  prevYear.type = 'button';
  prevYear.setAttribute('aria-label', '이전 연도');
  prevYear.addEventListener('click', () => handlers.onYearChange(selectedPeriod.year - 1));

  const yearTitle = document.createElement('p');
  yearTitle.className = 'year-title';
  yearTitle.textContent = String(selectedPeriod.year);

  const nextYear = document.createElement('button');
  nextYear.className = 'year-nav-btn year-nav-next';
  nextYear.type = 'button';
  nextYear.disabled = selectedPeriod.year >= currentYear;
  nextYear.setAttribute('aria-label', '다음 연도');
  nextYear.addEventListener('click', () => handlers.onYearChange(selectedPeriod.year + 1));

  header.append(prevYear, yearTitle, nextYear);
  board.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'month-grid';
  grid.id = 'month-grid';
  grid.dataset.year = String(selectedPeriod.year);
  grid.setAttribute('aria-label', `${selectedPeriod.year}년 월별 도서`);
  MONTHS.forEach((month) => {
    const book = monthBooks.get(periodKey(selectedPeriod.year, month));
    grid.appendChild(createMonthCell(selectedPeriod.year, month, book, selectedPeriod, handlers));
  });

  const calendarFrame = document.createElement('div');
  calendarFrame.className = 'calendar-scroll-frame';
  calendarFrame.appendChild(grid);
  for (const [direction, distance, label] of [['up', -160, '이전 달 보기'], ['down', 160, '다음 달 보기']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scroll-arrow-btn scroll-arrow-${direction}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', grid.id);
    button.addEventListener('click', () => grid.scrollBy({ top: distance, behavior: 'smooth' }));
    calendarFrame.appendChild(button);
  }
  board.appendChild(calendarFrame);
  stack.appendChild(board);
  container.appendChild(stack);
  grid.scrollTop = previousScrollTop;
  updateMonthGridScrollArrowVisibility();

  if (handlers.view === 'search' || handlers.view === 'edit-search') {
    detail.innerHTML = '';
    renderSearchPanel(detail, selectedPeriod, handlers.searchState, handlers);
  } else {
    renderMonthDetail(detail, selectedBook, selectedPeriod, handlers);
  }
}
