// js/app.js
import { showScreen } from './screens.js';
import {
  createClub,
  subscribeBooks,
  addBook,
  updateBook,
  deleteBook,
  uploadRecording,
  analyzeRecording,
} from './firebase.js';
import { renderBookSlider } from './bookSlider.js';
import { renderBookDetail } from './bookDetail.js';
import { searchBooks } from './search.js';
import { DecibelMonitor } from './decibelMonitor.js';
import { Recorder } from './recorder.js';
import { calcAverage } from './ratings.js';

const LEVEL_COLORS = { quiet: '#4caf50', moderate: '#ffc107', loud: '#f44336' };
const MEETING_LEVELS = Object.keys(LEVEL_COLORS);

let currentBookId = null;
let editingBookId = null;
let allBooks = [];
let meetingStream = null;
let decibelMonitor = null;
let currentRecorder = null;
let loudSinceMs = null;
let uploadedFile = null;
const today = new Date();
let selectedPeriod = {
  year: today.getFullYear(),
  month: today.getMonth() + 1,
};
let mainView = 'detail';
let monthSearch = {
  query: '',
  status: 'idle',
  results: [],
};
let meetingLevel = 'quiet';
let meetingWarningVisible = false;
let meetingPermissionMessage = '';
let mobilePage = 'calendar';
let currentClubId = getClubIdFromUrl();
let unsubscribeBooks = null;
let generatedInviteLink = '';
let hasEnteredMain = false;

function getClubIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const clubId = params.get('club') || '';
  const trimmedClubId = clubId.trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(trimmedClubId) ? trimmedClubId : '';
}

function buildInviteUrl(clubId) {
  const url = new URL(window.location.href);
  url.searchParams.set('club', clubId);
  return url.toString();
}

function showClubGate() {
  setLogoMode('splash');
  document.getElementById('club-gate')?.classList.remove('hidden');
  showScreen('screen-splash');
}

async function copyInviteLink() {
  if (!generatedInviteLink) return;

  try {
    await navigator.clipboard.writeText(generatedInviteLink);
  } catch (err) {
    const input = document.getElementById('club-invite-link');
    input?.select();
    document.execCommand('copy');
  }

  document.getElementById('club-copy-guide')?.classList.remove('hidden');
}

async function handleClubCreate(event) {
  event.preventDefault();

  const input = document.getElementById('club-name-input');
  const button = document.getElementById('club-create-btn');
  const name = input.value.trim();
  if (!name) return;

  button.disabled = true;
  try {
    const clubId = await createClub(name);
    generatedInviteLink = buildInviteUrl(clubId);
    document.getElementById('club-invite-link').value = generatedInviteLink;
    document.getElementById('club-create-form')?.classList.add('hidden');
    document.getElementById('club-invite-result')?.classList.remove('hidden');
  } catch (err) {
    alert(err?.message || '초대 링크를 만들지 못했습니다. 다시 시도해주세요.');
    button.disabled = false;
  }
}

function setLogoMode(mode) {
  const logo = document.getElementById('app-logo');
  logo.classList.remove('logo-splash', 'logo-docked', 'logo-meeting', 'logo-hidden');
  logo.classList.add(`logo-${mode}`);
}

function syncLogoMode() {
  if (!hasEnteredMain) return;
  setLogoMode('docked');
}

function updateMeetingLevelClass(level = meetingLevel) {
  const layout = document.querySelector('.main-layout');
  if (!layout) return;

  MEETING_LEVELS.forEach((entry) => layout.classList.remove(`meeting-level-${entry}`));
  if (mainView === 'meeting-active') {
    layout.classList.add(`meeting-level-${level}`);
  }
}

function syncMainLayoutState() {
  const layout = document.querySelector('.main-layout');
  if (!layout) return;

  const isMeetingScreen = mainView === 'meeting-rules' || mainView === 'meeting-active';
  const isMobileDetailPage = !isMeetingScreen && mobilePage === 'detail';
  layout.classList.toggle('is-meeting-rules', mainView === 'meeting-rules');
  layout.classList.toggle('is-meeting-active', mainView === 'meeting-active');
  layout.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  document.body.classList.toggle('is-meeting-screen', isMeetingScreen);
  document.body.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  document.getElementById('screen-main')?.classList.toggle('is-meeting-screen', isMeetingScreen);
  document.getElementById('screen-main')?.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  updateMeetingLevelClass();
}

function setMeetingWarningVisible(visible) {
  meetingWarningVisible = visible;
  document.getElementById('meeting-warning')?.classList.toggle('hidden', !visible);
}

function setMeetingLeftWarningVisible(visible) {
  document.querySelector('.meeting-left-warning')?.classList.toggle('hidden', !visible);
}

async function startSplashAnimation() {
  const logo = document.getElementById('app-logo');
  if (!logo.complete) {
    await new Promise((resolve) => {
      logo.onload = resolve;
      logo.onerror = resolve;
    });
  }
  setTimeout(() => {
    hasEnteredMain = true;
    setLogoMode('docked');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleAddClick(period) {
  if (period) selectedPeriod = period;
  currentBookId = null;
  editingBookId = null;
  mobilePage = 'calendar';
  mainView = 'search';
  monthSearch = {
    query: '',
    status: 'idle',
    results: [],
  };
  renderMain();
  showScreen('screen-main');
}

function clampPeriod(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year > currentYear) {
    return { year: currentYear, month: currentMonth };
  }
  if (year === currentYear && month > currentMonth) {
    return { year, month: currentMonth };
  }
  return { year, month };
}

function renderMain() {
  renderBookSlider(allBooks, selectedPeriod, {
    view: mainView,
    searchState: monthSearch,
    meetingLevel,
    meetingWarningVisible,
    meetingPermissionMessage,
    mobilePage,
    onMonthSelect(period) {
      selectedPeriod = period;
      currentBookId = null;
      editingBookId = null;
      mobilePage = 'detail';
      mainView = 'detail';
      meetingWarningVisible = false;
      meetingPermissionMessage = '';
      renderMain();
    },
    onYearChange(year) {
      selectedPeriod = clampPeriod(year, selectedPeriod.month);
      currentBookId = null;
      editingBookId = null;
      mobilePage = 'calendar';
      mainView = 'detail';
      meetingWarningVisible = false;
      meetingPermissionMessage = '';
      renderMain();
    },
    onAddClick: handleAddClick,
    onSearch: handleMonthSearch,
    onSearchClose() {
      mainView = mainView === 'edit-search' ? 'book-edit' : 'detail';
      editingBookId = null;
      renderMain();
    },
    onMobileBack() {
      mobilePage = 'calendar';
      editingBookId = null;
      if (
        mainView === 'book-edit'
        || mainView === 'edit-search'
        || mainView === 'review-entry'
        || mainView === 'analysis-loading'
      ) {
        mainView = 'detail';
      }
      renderMain();
    },
    onSearchResult: addSearchResultToMonth,
    onEditBook: openBookEdit,
    onEditCover: openBookCoverSearch,
    onDeleteBook: deleteSelectedBook,
    onStartMeeting(bookId) {
      currentBookId = bookId;
      openMeetingRules();
    },
    onMeetingConsent: startMeeting,
    onMeetingFinish: finishMeeting,
    onReviewSave: saveMagazineReviews,
    onEditContentSave: saveEditedBookContent,
    onUploadRecording(bookId) {
      openUploadScreen(bookId);
    },
  });
  syncLogoMode();
  syncMainLayoutState();
}

async function handleMonthSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) return;

  monthSearch = {
    query: trimmed,
    status: 'loading',
    results: [],
  };
  renderMain();

  try {
    const results = await searchBooks(trimmed);
    monthSearch = {
      query: trimmed,
      status: results.length > 0 ? 'results' : 'empty',
      results,
    };
  } catch (err) {
    monthSearch = {
      query: trimmed,
      status: 'error',
      results: [],
    };
  }

  renderMain();
}

async function addSearchResultToMonth(book) {
  if (!currentClubId) return null;

  const readMonth = selectedPeriod.month;
  const periodData = {
    readYear: selectedPeriod.year,
    readMonth,
    yearMonth: `${selectedPeriod.year}-${String(readMonth).padStart(2, '0')}`,
  };

  if (editingBookId) {
    const bookId = editingBookId;
    const existingBook = allBooks.find((entry) => entry.id === bookId);
    const replacement = {
      ...book,
      ...periodData,
      status: existingBook?.status || 'pending',
      reviews: existingBook?.reviews || [],
      summary: existingBook?.summary || '',
      avgRating: existingBook?.avgRating || 0,
      participantCount: existingBook?.participantCount || 0,
      recordingUrl: existingBook?.recordingUrl || '',
    };

    await updateBook(currentClubId, bookId, replacement);
    allBooks = allBooks.map((entry) => (
      entry.id === bookId ? { ...entry, ...replacement } : entry
    ));
    currentBookId = bookId;
    editingBookId = null;
    mobilePage = 'detail';
    mainView = 'book-edit';
    monthSearch = {
      query: '',
      status: 'idle',
      results: [],
    };
    renderMain();
    showScreen('screen-main');
    return bookId;
  }

  const bookId = await addBook(currentClubId, {
    ...book,
    ...periodData,
  });

  currentBookId = bookId;
  mainView = 'detail';
  mobilePage = 'detail';
  monthSearch = {
    query: '',
    status: 'idle',
    results: [],
  };
  renderMain();
  showScreen('screen-main');
  return bookId;
}

function openBookEdit(bookId) {
  currentBookId = bookId;
  editingBookId = null;
  mobilePage = 'detail';
  mainView = 'book-edit';
  monthSearch = {
    query: '',
    status: 'idle',
    results: [],
  };
  renderMain();
  showScreen('screen-main');
}

function openBookCoverSearch(bookId) {
  currentBookId = bookId;
  editingBookId = bookId;
  mobilePage = 'detail';
  mainView = 'edit-search';
  monthSearch = {
    query: '',
    status: 'idle',
    results: [],
  };
  renderMain();
  showScreen('screen-main');
}

async function deleteSelectedBook(bookId) {
  if (!bookId) return;
  const book = allBooks.find((entry) => entry.id === bookId);
  const title = book?.title || '이 책';
  if (!window.confirm(`${title}을(를) 삭제할까요?`)) return;

  try {
    await deleteBook(currentClubId, bookId);
    allBooks = allBooks.filter((entry) => entry.id !== bookId);
    if (currentBookId === bookId) currentBookId = null;
    if (editingBookId === bookId) editingBookId = null;
    mobilePage = 'calendar';
    mainView = 'detail';
    monthSearch = {
      query: '',
      status: 'idle',
      results: [],
    };
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('삭제 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

function openUploadScreen(bookId = currentBookId) {
  currentBookId = bookId;
  uploadedFile = null;
  const fileInput = document.getElementById('upload-file-input');
  fileInput.value = '';
  fileInput.click();
}

function handleDecibelLevel(level) {
  meetingLevel = level;
  updateMeetingLevelClass(level);
  setMeetingLeftWarningVisible(level === 'loud');

  if (level === 'loud') {
    if (loudSinceMs === null) loudSinceMs = Date.now();
    if (Date.now() - loudSinceMs > 3000) setMeetingWarningVisible(true);
  } else {
    loudSinceMs = null;
    setMeetingWarningVisible(false);
  }
}

function openMeetingRules() {
  mainView = 'meeting-rules';
  meetingLevel = 'quiet';
  meetingWarningVisible = false;
  meetingPermissionMessage = '';
  loudSinceMs = null;
  renderMain();
  showScreen('screen-main');
}

function getMicrophoneErrorMessage(err) {
  if (!navigator.mediaDevices?.getUserMedia) {
    return '마이크 권한 요청은 HTTPS 주소에서 사용할 수 있습니다.';
  }

  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return '브라우저의 마이크 권한을 허용해주세요.';
  }

  if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
    return '사용 가능한 마이크를 찾지 못했습니다.';
  }

  return '마이크를 시작하지 못했습니다. 권한과 연결 상태를 확인해주세요.';
}

async function startMeeting() {
  try {
    meetingPermissionMessage = '';
    meetingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    meetingPermissionMessage = getMicrophoneErrorMessage(err);
    mainView = 'meeting-rules';
    renderMain();
    showScreen('screen-main');
    return;
  }
  loudSinceMs = null;
  meetingLevel = 'quiet';
  meetingWarningVisible = false;
  meetingPermissionMessage = '';
  mainView = 'meeting-active';
  decibelMonitor = new DecibelMonitor(meetingStream, handleDecibelLevel);
  currentRecorder = new Recorder(meetingStream);
  renderMain();
  showScreen('screen-main');
}

async function finishMeeting(event) {
  event?.target?.setAttribute('disabled', '');
  try {
    decibelMonitor?.stop();
    meetingStream?.getTracks().forEach((track) => track.stop());
    const blob = await currentRecorder.stop();
    decibelMonitor = null;
    meetingStream = null;
    currentRecorder = null;
    loudSinceMs = null;
    meetingLevel = 'quiet';
    meetingWarningVisible = false;
    mainView = 'detail';
    setLogoMode('docked');
    renderMain();
    await runAnalysis(blob);
  } catch (err) {
    if (event?.target) event.target.disabled = false;
  }
}

async function runAnalysis(blob) {
  if (!blob?.size) {
    alert('녹음본 파일이 비어 있습니다. 다시 녹음하거나 다른 음성 파일을 올려주세요.');
    return;
  }

  const book = allBooks.find((b) => b.id === currentBookId);
  let recording = null;

  mainView = 'analysis-loading';
  mobilePage = 'detail';
  renderMain();
  showScreen('screen-main');

  try {
    recording = await uploadRecording(currentClubId, currentBookId, blob);
    const analysis = await analyzeRecording({
      clubId: currentClubId,
      bookId: currentBookId,
      storagePath: recording.path,
      recordingUrl: recording.url,
      contentType: recording.contentType,
      book: {
        title: book?.title || '',
        authors: book?.authors || '',
        publisher: book?.publisher || '',
        publishedDate: book?.publishedDate || '',
        participantCount: book?.participantCount || 0,
      },
    });
    const analysisUpdate = {
      recordingUrl: analysis.recordingUrl || recording.url,
      recordingPath: analysis.recordingPath || recording.path,
      summary: analysis.summary || '',
      status: analysis.status || 'reviewing',
      reviews: analysis.reviews || [],
      avgRating: Number(analysis.avgRating || 0),
      participantCount: Number(analysis.participantCount || 0),
      analysisError: '',
      analysisMeta: analysis.analysisMeta || null,
    };
    allBooks = allBooks.map((entry) => (
      entry.id === currentBookId
        ? { ...entry, ...analysisUpdate }
        : entry
    ));
    mainView = 'review-entry';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    const message = (err?.message || '').trim() || '다시 시도해주세요.';

    if (recording && currentBookId) {
      const manualUpdate = {
        recordingUrl: recording.url,
        recordingPath: recording.path,
        summary: book?.summary || '',
        status: 'reviewing',
        reviews: book?.reviews || [],
        avgRating: Number(book?.avgRating || 0),
        participantCount: Number(book?.participantCount || 0),
        analysisError: message,
        analysisMeta: {
          ...(book?.analysisMeta || {}),
          analysisFailed: true,
          analysisError: message,
        },
      };

      try {
        await updateBook(currentClubId, currentBookId, manualUpdate);
      } catch (saveErr) {
        console.warn('Failed to save manual analysis state', saveErr);
      }

      allBooks = allBooks.map((entry) => (
        entry.id === currentBookId
          ? { ...entry, ...manualUpdate }
          : entry
      ));
      alert(`AI 분석에 실패해서 직접 작성 화면으로 이동합니다.\n${message}`);
      mainView = 'review-entry';
      mobilePage = 'detail';
      renderMain();
      showScreen('screen-main');
      return;
    }

    alert(`분석 중 오류가 발생했습니다.\n${message}`);
    mainView = 'detail';
    renderMain();
    showScreen('screen-main');
    throw err;
  }
}

async function saveEditedBookContent(bookId, summary, reviews) {
  const trimmedSummary = summary.trim();
  const avgRating = calcAverage(reviews);
  const status = trimmedSummary || reviews.length > 0 ? 'analyzed' : 'pending';

  try {
    await updateBook(currentClubId, bookId, {
      summary: trimmedSummary,
      reviews,
      avgRating,
      participantCount: reviews.length,
      status,
      analysisError: '',
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, summary: trimmedSummary, reviews, avgRating, participantCount: reviews.length, status, analysisError: '' }
        : book
    ));
    currentBookId = bookId;
    mobilePage = 'detail';
    mainView = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

async function saveMagazineReviews(bookId, reviews, summary = '') {
  const currentBook = allBooks.find((book) => book.id === bookId);
  const trimmedSummary = (summary || currentBook?.summary || '').trim();

  if (reviews.length === 0 && !trimmedSummary) {
    alert('요약이나 리뷰를 한 줄 이상 입력해주세요.');
    return;
  }

  try {
    const avgRating = calcAverage(reviews);
    await updateBook(currentClubId, bookId, {
      status: 'analyzed',
      summary: trimmedSummary,
      reviews,
      avgRating,
      participantCount: reviews.length,
      analysisError: '',
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, status: 'analyzed', summary: trimmedSummary, reviews, avgRating, participantCount: reviews.length, analysisError: '' }
        : book
    ));
    currentBookId = bookId;
    mobilePage = 'detail';
    mainView = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

function subscribeCurrentClub() {
  if (!currentClubId || unsubscribeBooks) return;

  unsubscribeBooks = subscribeBooks(currentClubId, (books) => {
    allBooks = books;
    renderMain();
    if (currentBookId) {
      const updated = books.find((b) => b.id === currentBookId);
      if (updated) renderBookDetail(updated);
    }
  });
}

document.getElementById('search-close-btn').addEventListener('click', () => {
  mainView = 'detail';
  showScreen('screen-main');
});

document.getElementById('search-btn').addEventListener('click', async () => {
  const query = document.getElementById('search-input').value.trim();
  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '';
  if (!query) return;

  let results;
  try {
    results = await searchBooks(query);
  } catch (err) {
    resultsEl.innerHTML = '<li>검색 중 오류가 발생했습니다. 다시 시도해주세요.</li>';
    return;
  }

  if (results.length === 0) {
    resultsEl.innerHTML = '<li>검색 결과가 없습니다.</li>';
    return;
  }

  results.forEach((book) => {
    const li = document.createElement('li');
    li.textContent = `${book.title} - ${book.authors}`;
    li.addEventListener('click', async () => {
      const bookId = await addSearchResultToMonth(book);
      document.getElementById('search-input').value = '';
      resultsEl.innerHTML = '';
      currentBookId = bookId;
      showScreen('screen-main');
    });
    resultsEl.appendChild(li);
  });
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

document.getElementById('upload-file-input').addEventListener('change', async (e) => {
  uploadedFile = e.target.files[0] || null;
  if (!uploadedFile) return;
  const fileToUpload = uploadedFile;
  try {
    await runAnalysis(fileToUpload);
    uploadedFile = null;
  } catch (err) {
    // runAnalysis already alerted the user and returned them to the main screen.
    uploadedFile = null;
  } finally {
    e.target.value = '';
  }
});

document.getElementById('club-create-form')?.addEventListener('submit', handleClubCreate);
document.getElementById('club-copy-btn')?.addEventListener('click', copyInviteLink);

if (currentClubId) {
  subscribeCurrentClub();
  renderMain();
  startSplashAnimation();
} else {
  showClubGate();
}
