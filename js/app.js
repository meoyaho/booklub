// js/app.js
import { showScreen } from './screens.js';
import {
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

function setLogoMode(mode) {
  const logo = document.getElementById('app-logo');
  logo.classList.remove('logo-splash', 'logo-docked', 'logo-meeting', 'logo-hidden');
  logo.classList.add(`logo-${mode}`);
}

function syncLogoMode() {
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
  layout.classList.toggle('is-meeting-rules', mainView === 'meeting-rules');
  layout.classList.toggle('is-meeting-active', mainView === 'meeting-active');
  document.body.classList.toggle('is-meeting-screen', isMeetingScreen);
  document.getElementById('screen-main')?.classList.toggle('is-meeting-screen', isMeetingScreen);
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
    setLogoMode('docked');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleAddClick(period) {
  if (period) selectedPeriod = period;
  currentBookId = null;
  editingBookId = null;
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
    onMonthSelect(period) {
      selectedPeriod = period;
      currentBookId = null;
      editingBookId = null;
      mainView = 'detail';
      meetingWarningVisible = false;
      meetingPermissionMessage = '';
      renderMain();
    },
    onYearChange(year) {
      selectedPeriod = clampPeriod(year, selectedPeriod.month);
      currentBookId = null;
      editingBookId = null;
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

    await updateBook(bookId, replacement);
    allBooks = allBooks.map((entry) => (
      entry.id === bookId ? { ...entry, ...replacement } : entry
    ));
    currentBookId = bookId;
    editingBookId = null;
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

  const bookId = await addBook({
    ...book,
    ...periodData,
  });

  currentBookId = bookId;
  mainView = 'detail';
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
    await deleteBook(bookId);
    allBooks = allBooks.filter((entry) => entry.id !== bookId);
    if (currentBookId === bookId) currentBookId = null;
    if (editingBookId === bookId) editingBookId = null;
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
  showScreen('screen-analyzing');
  try {
    const book = allBooks.find((b) => b.id === currentBookId);
    const recording = await uploadRecording(currentBookId, blob);
    const analysis = await analyzeRecording({
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
      analysisMeta: analysis.analysisMeta || null,
    };
    allBooks = allBooks.map((entry) => (
      entry.id === currentBookId
        ? { ...entry, ...analysisUpdate }
        : entry
    ));
    mainView = 'review-entry';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    showScreen('screen-main');
    throw err;
  }
}

async function saveEditedBookContent(bookId, summary, reviews) {
  const trimmedSummary = summary.trim();
  const avgRating = calcAverage(reviews);
  const status = trimmedSummary || reviews.length > 0 ? 'analyzed' : 'pending';

  try {
    await updateBook(bookId, {
      summary: trimmedSummary,
      reviews,
      avgRating,
      participantCount: reviews.length,
      status,
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, summary: trimmedSummary, reviews, avgRating, participantCount: reviews.length, status }
        : book
    ));
    currentBookId = bookId;
    mainView = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

async function saveMagazineReviews(bookId, reviews) {
  if (reviews.length === 0) {
    alert('리뷰를 한 줄 이상 입력해주세요.');
    return;
  }

  try {
    const avgRating = calcAverage(reviews);
    await updateBook(bookId, {
      status: 'analyzed',
      reviews,
      avgRating,
      participantCount: reviews.length,
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, status: 'analyzed', reviews, avgRating, participantCount: reviews.length }
        : book
    ));
    currentBookId = bookId;
    mainView = 'detail';
    renderMain();
    showScreen('screen-main');
  } catch (err) {
    alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

subscribeBooks((books) => {
  allBooks = books;
  renderMain();
  if (currentBookId) {
    const updated = books.find((b) => b.id === currentBookId);
    if (updated) renderBookDetail(updated);
  }
});

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

startSplashAnimation();
