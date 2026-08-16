// js/bookSlider.js
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const MEETING_RULES = [
  '싸우지 않습니다.',
  '우기지 않습니다.',
  '무시하지 않습니다.',
  '말 끊지 않습니다.',
  '딴짓하지 않습니다.',
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

function createCover(book, className) {
  if (!book.thumbnail) {
    const fallback = document.createElement('div');
    fallback.className = `${className} cover-fallback`;
    fallback.textContent = book.title ? book.title.slice(0, 1) : '?';
    return fallback;
  }

  const image = document.createElement('img');
  image.className = className;
  image.src = book.thumbnail;
  image.alt = `${book.title || '책'} 표지`;
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

  if (!isFuture) {
    const label = document.createElement('span');
    label.className = 'month-label';
    label.textContent = `${month}월`;
    cell.appendChild(label);
  }

  if (book) {
    const coverWrap = document.createElement('span');
    coverWrap.className = 'month-cover-wrap';
    coverWrap.appendChild(createCover(book, 'month-cover'));
    cell.appendChild(coverWrap);

    const rating = createStars(book.avgRating);
    rating.classList.add('month-stars');
    cell.appendChild(rating);
  } else {
    const empty = document.createElement('span');
    empty.className = 'month-empty';
    empty.textContent = '';
    cell.appendChild(empty);
  }

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

function createDetailTopbar(selectedPeriod, book, handlers) {
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

  actions.append(editButton, divider, deleteButton);
  topbar.append(left, actions);
  return topbar;
}

function renderDetailWithBook(detail, book, selectedPeriod, handlers) {
  const scroll = document.createElement('div');
  scroll.className = 'month-detail-scroll';

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

  const ratingRow = document.createElement('div');
  ratingRow.className = 'detail-rating-row';
  ratingRow.appendChild(createStars(book.avgRating));

  const ratingText = document.createElement('span');
  ratingText.textContent = Number(book.avgRating || 0).toFixed(1);
  ratingRow.appendChild(ratingText);

  info.append(title, authors, ratingRow);
  hero.append(coverStage, info);
  scroll.append(createDetailTopbar(selectedPeriod, book, handlers), hero);

  if (book.status === 'analyzed') {
    const summary = document.createElement('section');
    summary.className = 'detail-section';

    const summaryText = document.createElement('p');
    summaryText.className = 'detail-body-copy';
    summaryText.textContent = book.summary || '요약이 아직 없습니다.';

    summary.appendChild(summaryText);
    scroll.appendChild(summary);

    const reviews = document.createElement('section');
    reviews.className = 'detail-section';

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
    scroll.appendChild(reviews);
  } else if (handlers.view === 'analysis-loading') {
    const actions = document.createElement('div');
    actions.className = 'month-detail-actions month-detail-analysis';

    const loading = document.createElement('p');
    loading.className = 'month-analysis-copy';
    loading.textContent = '분석중';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');

    actions.appendChild(loading);
    scroll.appendChild(actions);
  } else {
    const actions = document.createElement('div');
    actions.className = 'month-detail-actions';

    const startButton = document.createElement('button');
    startButton.className = 'detail-action-primary';
    startButton.type = 'button';
    startButton.textContent = '독서모임 시작';
    startButton.addEventListener('click', () => handlers.onStartMeeting(book.id));

    const uploadButton = document.createElement('button');
    uploadButton.className = 'detail-action-secondary';
    uploadButton.type = 'button';
    uploadButton.textContent = '녹음본 업로드';
    uploadButton.addEventListener('click', () => handlers.onUploadRecording(book.id));

    actions.append(startButton, uploadButton);
    scroll.appendChild(actions);
  }

  detail.appendChild(scroll);
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
  startButton.className = 'detail-action-primary';
  startButton.type = 'button';
  startButton.textContent = '독서모임 시작';
  startButton.addEventListener('click', () => handlers.onStartMeeting(book.id));

  const uploadButton = document.createElement('button');
  uploadButton.className = 'detail-action-secondary';
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
  summaryTitle.textContent = '모임 요약';

  const needsManualSummary = Boolean(book.analysisError) || !book.summary;
  const summary = needsManualSummary
    ? document.createElement('textarea')
    : document.createElement('p');
  summary.className = needsManualSummary
    ? 'magazine-summary-input magazine-summary-manual'
    : 'magazine-summary-copy';
  if (needsManualSummary) {
    summary.value = book.summary || '';
    summary.placeholder = '모임 요약';
    summary.setAttribute('aria-label', '모임 요약');
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

function removeSearchModal() {
  document.getElementById('month-search-modal')?.remove();
}

function renderSearchModal(selectedPeriod, searchState, handlers) {
  removeSearchModal();

  const monthTitle = `${selectedPeriod.year}년 ${selectedPeriod.month}월`;
  const overlay = document.createElement('div');
  overlay.id = 'month-search-modal';
  overlay.className = 'month-search-overlay';

  const modal = document.createElement('section');
  modal.className = 'month-search-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', `${monthTitle} 책 검색`);

  const closeButton = document.createElement('button');
  closeButton.className = 'month-search-close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '검색창 닫기');
  closeButton.addEventListener('click', handlers.onSearchClose);

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

  modal.append(closeButton, header, form);

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

    modal.appendChild(list);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  input.focus();
}

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
  } else if (handlers.view !== 'search') {
    removeSearchModal();
  }
}

function renderMeetingRules(detail, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-rules-page';

  page.appendChild(createMeetingCopy({
    includeConsent: true,
    onConfirm: handlers.onMeetingConsent,
    className: 'mobile-meeting-copy',
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
  title.textContent = '건전한 독서모임을 위한 수칙';

  const rules = createMeetingRulesList();
  copy.append(title, rules);

  const prompt = document.createElement('p');
  prompt.className = 'meeting-consent-copy';
  prompt.textContent = '동의하시겠습니까?';

  const confirmButton = document.createElement('button');
  confirmButton.className = 'detail-action-primary meeting-confirm-btn';
  confirmButton.type = 'button';
  confirmButton.textContent = '확인';

  if (includeConsent) {
    confirmButton.addEventListener('click', onConfirm);
  } else {
    prompt.classList.add('meeting-consent-placeholder');
    confirmButton.classList.add('meeting-consent-placeholder');
    confirmButton.disabled = true;
    confirmButton.tabIndex = -1;
    prompt.setAttribute('aria-hidden', 'true');
    confirmButton.setAttribute('aria-hidden', 'true');
  }

  copy.append(prompt, confirmButton);

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

function renderMeetingLeft(container, handlers) {
  const panel = document.createElement('div');
  panel.className = 'meeting-left-panel desktop-meeting-copy';
  panel.appendChild(createMeetingCopy({
    includeConsent: handlers.view === 'meeting-rules',
    onConfirm: handlers.onMeetingConsent,
    notice: handlers.meetingPermissionMessage,
  }));

  const warning = document.createElement('p');
  warning.className = 'meeting-left-warning';
  warning.textContent = '건강한 독서모임을 응원합니다';
  warning.setAttribute('aria-live', 'polite');
  if (handlers.meetingLevel !== 'loud') {
    warning.classList.add('hidden');
  }
  panel.appendChild(warning);
  container.appendChild(panel);
}

function renderMeetingActive(detail, handlers) {
  detail.innerHTML = '';

  const page = document.createElement('div');
  page.className = 'month-detail-scroll meeting-page meeting-active-page';

  const copy = createMeetingCopy({ className: 'mobile-meeting-copy' });

  const finishButton = document.createElement('button');
  finishButton.className = 'detail-action-primary meeting-finish-btn';
  finishButton.type = 'button';
  finishButton.textContent = '완료';
  finishButton.addEventListener('click', handlers.onMeetingFinish);

  page.append(copy, finishButton);
  detail.appendChild(page);
}

export function renderBookSlider(books, selectedPeriod, handlers) {
  const container = document.getElementById('book-slider');
  const detail = document.getElementById('month-detail');
  if (!container || !detail) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const monthBooks = buildMonthBookMap(books);
  const selectedBook = monthBooks.get(periodKey(selectedPeriod.year, selectedPeriod.month));

  container.innerHTML = '';
  container.classList.toggle('is-meeting-left', handlers.view === 'meeting-rules' || handlers.view === 'meeting-active');

  if (handlers.view === 'meeting-rules') {
    removeSearchModal();
    renderMeetingLeft(container, handlers);
    renderMeetingRules(detail, handlers);
    return;
  }

  if (handlers.view === 'meeting-active') {
    removeSearchModal();
    renderMeetingLeft(container, handlers);
    renderMeetingActive(detail, handlers);
    return;
  }

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
  MONTHS.forEach((month) => {
    const book = monthBooks.get(periodKey(selectedPeriod.year, month));
    grid.appendChild(createMonthCell(selectedPeriod.year, month, book, selectedPeriod, handlers));
  });

  board.appendChild(grid);
  container.appendChild(board);

  renderMonthDetail(detail, selectedBook, selectedPeriod, handlers);
  if (handlers.view === 'search' || handlers.view === 'edit-search') {
    renderSearchModal(selectedPeriod, handlers.searchState, handlers);
  } else {
    removeSearchModal();
  }
}
