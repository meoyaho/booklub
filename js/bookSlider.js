// js/bookSlider.js
import { formatDurationSeconds, formatMeetingDate } from './meetingFormat.js';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MEETING_RULES = [
  '싸우지 않습니다.',
  '우기지 않습니다.',
  '무시하지 않습니다.',
  '말 끊지 않습니다.',
  '딴짓하지 않습니다.',
];
const MEETING_TOPIC_PROMPTS = [
  '어떻게 읽었는지 서로 이야기해보기',
  '가장 인상에 깊었던 페이지를 서로 이야기해보기',
  '내가 별로라고 생각했던 점',
  '내가 좋다고 생각했던점',
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

function createDetailTopbar(selectedPeriod, book, handlers, { showShare = false } = {}) {
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
  editButton.textContent = '수정';
  editButton.addEventListener('click', () => handlers.onEditBook?.(book.id));

  const divider = document.createElement('span');
  divider.className = 'detail-top-separator';
  divider.textContent = '|';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'detail-top-action';
  deleteButton.type = 'button';
  deleteButton.textContent = '삭제';
  deleteButton.addEventListener('click', () => handlers.onDeleteBook?.(book.id));

  if (showShare) {
    actions.append(shareButton, shareDivider);
  }
  actions.append(editButton, divider, deleteButton);
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

    if (book.reviews?.length) {
      const reviews = document.createElement('section');
      reviews.className = 'book-completed-reviews';

      const reviewList = document.createElement('ul');
      reviewList.className = 'month-review-list';
      (book.reviews || []).forEach((review) => {
        const item = document.createElement('li');
        item.className = 'review-display-row';

        const reviewName = document.createElement('strong');
        reviewName.className = 'reviewer-name';
        reviewName.textContent = review.name || '익명';

        const reviewStars = createStars(review.rating);
        reviewStars.classList.add('review-stars');

        const reviewText = document.createElement('p');
        reviewText.className = 'detail-body-copy';
        reviewText.textContent = review.review || '리뷰가 비어 있습니다.';

        item.append(reviewName, reviewStars, reviewText);
        reviewList.appendChild(item);
      });
      reviews.appendChild(reviewList);
      page.appendChild(reviews);
    }
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
  scroll.className = 'month-detail-scroll book-edit-page';

  const hero = document.createElement('div');
  hero.className = 'detail-hero book-edit-hero';

  const coverStage = document.createElement('div');
  coverStage.className = 'detail-cover-stage detail-cover-stage-editable';
  coverStage.appendChild(createCover(book, 'month-detail-cover'));

  const coverEditButton = document.createElement('button');
  coverEditButton.className = 'cover-edit-btn';
  coverEditButton.type = 'button';
  coverEditButton.textContent = '수정';
  coverEditButton.addEventListener('click', () => handlers.onEditCover?.(book.id));
  coverStage.appendChild(coverEditButton);

  const info = document.createElement('div');
  info.className = 'detail-info';

  const title = document.createElement('h1');
  title.className = 'month-detail-title';
  title.textContent = book.title || '제목 없음';

  const authors = document.createElement('p');
  authors.className = 'month-detail-authors';
  authors.textContent = book.authors || '작가 정보 없음';

  const ratingRow = document.createElement('div');
  ratingRow.className = 'detail-rating-row';
  ratingRow.appendChild(createStars(book.avgRating));

  const ratingText = document.createElement('span');
  ratingText.textContent = Number(book.avgRating || 0).toFixed(1);
  ratingRow.appendChild(ratingText);

  info.append(title, authors, ratingRow);
  hero.append(coverStage, info);

  const actionBar = document.createElement('div');
  actionBar.className = 'month-detail-actions book-edit-actions';

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

  actionBar.append(startButton, uploadButton);

  const form = document.createElement('form');
  form.className = 'book-edit-form';

  const summaryInput = document.createElement('textarea');
  summaryInput.className = 'magazine-summary-input';
  summaryInput.value = book.summary || '';
  summaryInput.placeholder = '요약';
  summaryInput.setAttribute('aria-label', '요약');

  const reviewForm = document.createElement('div');
  reviewForm.className = 'magazine-review-form';

  const existingReviews = book.reviews?.length ? book.reviews : Array.from({ length: 5 }, () => ({}));
  existingReviews.forEach((review) => reviewForm.appendChild(createReviewFormRow(review)));

  const actions = document.createElement('div');
  actions.className = 'magazine-review-actions';

  const addRowButton = document.createElement('button');
  addRowButton.className = 'detail-action-secondary';
  addRowButton.type = 'button';
  addRowButton.textContent = '행 추가';
  addRowButton.addEventListener('click', () => {
    reviewForm.insertBefore(createReviewFormRow(), actions);
  });

  const saveButton = document.createElement('button');
  saveButton.className = 'detail-action-primary';
  saveButton.type = 'submit';
  saveButton.textContent = '저장';

  actions.append(addRowButton, saveButton);
  reviewForm.appendChild(actions);
  form.append(summaryInput, reviewForm);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onEditContentSave(book.id, summaryInput.value, collectMagazineReviews(form));
  });

  scroll.append(createDetailTopbar(selectedPeriod, book, handlers), hero, actionBar, form);
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

const GUIDE_CHARACTER_CONTENT = {
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
    bodyLines: ['아무도 말을 하고 있지 않습니다....', '목소리가 커지고 있습니다!'],
  },
  'block-fight': {
    characterFile: '책1_금지.png',
    lines: ['잠깐! 수칙을 다같이 외쳐보아요!'],
    bodyLines: [],
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
  const showsTopics = !isBlocked
    && (handlers.meetingGuideView === 'topics' || handlers.meetingGuideView === 'topics-hidden');
  const dynamicGuide = !showsWelcome && !showsTopicsGuide
    ? (GUIDE_CHARACTER_CONTENT[handlers.guideState] || GUIDE_CHARACTER_CONTENT.encourage)
    : null;

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
  } else {
    const status = document.createElement('p');
    status.className = 'meeting-recording-status';
    status.textContent = '녹음중입니다...';
    body.appendChild(status);
  }

  if (dynamicGuide && !isBlocked) {
    page.classList.add(`guide-state-${handlers.guideState === 'none' ? 'encourage' : handlers.guideState}`);
    dynamicGuide.bodyLines.forEach((line) => {
      const message = document.createElement('p');
      message.className = 'meeting-state-message';
      message.textContent = line;
      body.appendChild(message);
    });
  }

  if (showsTopics) {
    const topics = document.createElement('ol');
    topics.className = 'meeting-topic-list';
    MEETING_TOPIC_PROMPTS.forEach((prompt) => {
      const item = document.createElement('li');
      item.textContent = prompt;
      topics.appendChild(item);
    });
    body.appendChild(topics);
  }

  page.append(header, body);

  if (isBlocked || dynamicGuide) {
    const guideContent = isBlocked ? GUIDE_CHARACTER_CONTENT['block-fight'] : dynamicGuide;
    const dock = document.createElement('aside');
    dock.className = 'meeting-guide-dock';
    const options = guideContent.options?.map(({ label, action }) => ({
      label,
      onClick: action === 'help'
        ? () => handlers.onMeetingGuideHelp?.()
        : () => handlers.onMeetingGuideDismiss?.(),
    }));
    dock.appendChild(createGuideBubble({
      characterFile: guideContent.characterFile,
      lines: guideContent.lines,
      onSelect: options,
    }));
    page.appendChild(dock);
  } else if (showsWelcome) {
    const dock = document.createElement('aside');
    dock.className = 'meeting-guide-dock';
    dock.appendChild(createGuideBubble({
      characterFile: '책6_인사.png',
      lines: [
        '안녕하세요?',
        '독서모임 길잡이 입니다. 이 응용프로그램을 사용하는',
        '여러분을 돕는게 제 일이죠.',
      ],
      onSelect: [
        { label: '무슨말을 해야할까요?', onClick: () => handlers.onMeetingGuideHelp?.() },
        { label: '그냥 시작할게', onClick: () => handlers.onMeetingGuideDismiss?.() },
      ],
    }));
    page.appendChild(dock);
  } else if (showsTopicsGuide) {
    const dock = document.createElement('aside');
    dock.className = 'meeting-guide-dock';
    dock.appendChild(createGuideBubble({
      characterFile: '책3_검색.png',
      lines: [
        '어떻게 시작해야할지 모르겠다면',
        '제가 여기에 대화하기 좋은 키워드들을 둘러드릴게요.',
        '키워드에 맞춰 이야기해보세요.',
      ],
      onSelect: [
        { label: '고마워', onClick: () => handlers.onMeetingGuideDismiss?.(true) },
      ],
    }));
    page.appendChild(dock);
  }

  detail.appendChild(page);
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
  picker.setAttribute('role', 'radiogroup');
  picker.setAttribute('aria-label', '별점 선택');

  let value = initialValue;
  const select = (rating) => {
    value = rating;
    buttons.forEach((button, index) => {
      button.textContent = index + 1 <= value ? '★' : '☆';
      button.setAttribute('aria-checked', String(index + 1 === value));
      button.tabIndex = index + 1 === value ? 0 : -1;
    });
    onChange(value);
  };
  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rating-picker-star';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', `${n}점`);
    button.addEventListener('click', () => select(n));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5
        : ((value - 1 + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 4)) % 5) + 1;
      select(next);
      buttons[next - 1].focus();
    });
    return button;
  });
  select(initialValue);
  picker.append(...buttons);
  picker.getValue = () => value;
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

function renderRatingModal(book, handlers) {
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
      head.append(`[${review.name || '익명'}]의 감상평 : `, createStars(review.rating));
      const body = document.createElement('p');
      body.className = 'rating-modal-item-body';
      body.textContent = review.review || '';
      item.append(head, body);
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
    const newReview = { name, rating: picker.getValue(), review: reviewInput.value.trim() };
    handlers.onRatingSave(book.id, [...(book.reviews || []), newReview]);
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

  if (handlers.view === 'search' || handlers.view === 'edit-search') {
    detail.innerHTML = '';
    renderSearchPanel(detail, selectedPeriod, handlers.searchState, handlers);
  } else {
    renderMonthDetail(detail, selectedBook, selectedPeriod, handlers);
  }
}
