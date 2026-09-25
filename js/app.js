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
  uploadBookCover,
} from './firebase.js';
import {
  renderBookSlider,
  renderUploadDateModal,
  updateMonthGridScrollArrowVisibility,
  GUIDE_CHARACTER_CONTENT,
  MEETING_TOPIC_PROMPTS,
} from './bookSlider.js';
import { searchBooks } from './search.js';
import { DecibelMonitor } from './decibelMonitor.js';
import { Recorder } from './recorder.js';
import { calcAverage } from './ratings.js';
import { computeGuideState, GUIDE_STATES } from './guideState.js';
import { toLocalDateString } from './meetingFormat.js';
import { shareOrDownloadCard } from './shareCard.js';

const LEVEL_COLORS = { quiet: '#4caf50', moderate: '#ffc107', loud: '#f44336' };
const MEETING_LEVELS = Object.keys(LEVEL_COLORS);

let currentBookId = null;
let editingBookId = null;
let allBooks = [];
let meetingStream = null;
let decibelMonitor = null;
let currentRecorder = null;
let levelSinceMs = Date.now();
let guideState = GUIDE_STATES.NONE;
let meetingGuideView = 'closed';
let activeMeetingTopicIndex = null;
let meetingLog = [];
let uploadedFile = null;
let meetingStartedAt = null;
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

async function copyInviteLink() {
  if (!generatedInviteLink) return false;

  try {
    await navigator.clipboard.writeText(generatedInviteLink);
    return true;
  } catch (err) {
    try {
      const input = document.getElementById('club-invite-link');
      input?.select();
      return document.execCommand('copy');
    } catch (fallbackErr) {
      return false;
    }
  }
}

let splashStep = 'welcome';
let splashClubName = '';
let splashClubId = '';
let splashCopySucceeded = false;

async function handleClubCreate(event) {
  event.preventDefault();

  const input = document.getElementById('club-name-input');
  const button = document.getElementById('club-create-btn');
  const name = input.value.trim();
  if (!name) return;

  button.disabled = true;
  try {
    const clubId = await createClub(name);
    splashClubId = clubId;
    splashClubName = name;
    generatedInviteLink = buildInviteUrl(clubId);
    splashStep = 'link-ready';
    renderSplashGuide();
  } catch (err) {
    alert(err?.message || '초대 링크를 만들지 못했습니다. 다시 시도해주세요.');
    button.disabled = false;
  }
}

function enterCreatedClub() {
  currentClubId = splashClubId;
  const url = new URL(window.location.href);
  url.searchParams.set('club', currentClubId);
  window.history.replaceState({}, '', url);
  subscribeCurrentClub();
  renderMain();
  enterMainFromSplash();
}

function createGuideBubbleLine(text) {
  const line = document.createElement('p');
  line.className = 'guide-bubble-line';
  line.textContent = text;
  return line;
}

function renderSplashGuide() {
  const container = document.getElementById('splash-guide');
  if (!container) return;
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'guide-bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'guide-bubble';

  if (currentClubId || splashStep === 'welcome') {
    bubble.appendChild(createGuideBubbleLine('환영합니다! 아이콘을 클릭해주세요'));
  } else if (splashStep === 'name-input') {
    bubble.appendChild(createGuideBubbleLine('독서 모임 이름을 입력해주세요'));

    const form = document.createElement('form');
    form.id = 'club-create-form';
    form.addEventListener('submit', handleClubCreate);

    const input = document.createElement('input');
    input.id = 'club-name-input';
    input.type = 'text';
    input.placeholder = '독서모임명을 입력하세요';
    input.autocomplete = 'off';
    form.appendChild(input);

    const nameOptions = document.createElement('div');
    nameOptions.className = 'guide-bubble-options';
    const submitBtn = document.createElement('button');
    submitBtn.id = 'club-create-btn';
    submitBtn.type = 'submit';
    submitBtn.className = 'guide-bubble-option';
    submitBtn.textContent = '만들기';
    nameOptions.appendChild(submitBtn);
    form.appendChild(nameOptions);

    bubble.appendChild(form);
  } else if (splashStep === 'link-ready' || splashStep === 'link-confirm') {
    const linkInput = document.createElement('input');
    linkInput.id = 'club-invite-link';
    linkInput.type = 'text';
    linkInput.readOnly = true;
    linkInput.value = generatedInviteLink;
    linkInput.setAttribute('aria-label', '초대 링크');
    bubble.appendChild(linkInput);

    const options = document.createElement('div');
    options.className = 'guide-bubble-options';

    if (splashStep === 'link-ready') {
      bubble.appendChild(createGuideBubbleLine(
        `앞으로 ${splashClubName}의 독서 모임 링크는 위 링크로만 접속할 수 있으므로, 조심히 보관해주세요`,
      ));

      const ackBtn = document.createElement('button');
      ackBtn.type = 'button';
      ackBtn.className = 'guide-bubble-option';
      ackBtn.textContent = '알겠어, 복사할게';
      ackBtn.addEventListener('click', async () => {
        splashCopySucceeded = await copyInviteLink();
        splashStep = 'link-confirm';
        renderSplashGuide();
      });
      options.appendChild(ackBtn);
    } else {
      bubble.appendChild(createGuideBubbleLine(
        splashCopySucceeded ? '링크를 복사했어요!' : '복사에 실패했어요. 위 링크를 직접 복사해주세요.',
      ));
      bubble.appendChild(createGuideBubbleLine('이제 입장해볼까요?'));

      const enterBtn = document.createElement('button');
      enterBtn.type = 'button';
      enterBtn.className = 'guide-bubble-option';
      enterBtn.textContent = '입장하기';
      enterBtn.addEventListener('click', enterCreatedClub);
      options.appendChild(enterBtn);
    }

    bubble.appendChild(options);
  }

  const icon = document.createElement('img');
  icon.className = 'guide-character guide-character-clickable';
  icon.src = 'assets/characters/책6_인사.png';
  icon.alt = '길잡이 캐릭터';
  icon.setAttribute('role', 'button');
  icon.setAttribute('tabindex', '0');
  icon.addEventListener('click', handleSplashIconClick);
  icon.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSplashIconClick();
    }
  });

  wrap.append(bubble, icon);
  container.appendChild(wrap);

  if (splashStep === 'name-input' && !currentClubId) {
    document.getElementById('club-name-input')?.focus({ preventScroll: true });
  }
}

function handleSplashIconClick() {
  if (hasEnteredMain) return;
  if (currentClubId) {
    enterMainFromSplash();
    return;
  }
  if (splashStep === 'welcome') {
    splashStep = 'name-input';
    renderSplashGuide();
  }
}

function setLogoMode(mode) {
  const logo = document.getElementById('app-logo');
  logo.classList.remove('logo-docked', 'logo-meeting', 'logo-hidden');
  logo.classList.add(`logo-${mode}`);
}

function syncLogoMode() {
  if (!hasEnteredMain) return;
  setLogoMode('docked');
}

function logGuideMessage(text) {
  if (!text) return;
  const elapsed = meetingStartedAt ? (Date.now() - meetingStartedAt) / 1000 : 0;
  meetingLog = [...meetingLog, { time: elapsed, text }];
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

  const isMeetingScreen = mainView === 'meeting-intro' || mainView === 'meeting-rules' || mainView === 'meeting-active';
  const isMobileDetailPage = !isMeetingScreen && mobilePage === 'detail';
  layout.classList.toggle('is-meeting-intro', mainView === 'meeting-intro');
  layout.classList.toggle('is-meeting-rules', mainView === 'meeting-rules');
  layout.classList.toggle('is-meeting-active', mainView === 'meeting-active');
  layout.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  document.body.classList.toggle('is-meeting-screen', isMeetingScreen);
  document.body.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  document.getElementById('screen-main')?.classList.toggle('is-meeting-screen', isMeetingScreen);
  document.getElementById('screen-main')?.classList.toggle('is-mobile-detail-page', isMobileDetailPage);
  updateMeetingLevelClass();
  updateScrollArrowVisibility();
}

function updateScrollArrowVisibility() {
  const panel = document.getElementById('month-detail');
  const up = document.getElementById('panel-scroll-up');
  const down = document.getElementById('panel-scroll-down');
  if (!panel || !up || !down) return;

  const canScroll = panel.scrollHeight > panel.clientHeight + 1;
  up.hidden = !canScroll;
  down.hidden = !canScroll;
  panel.classList.toggle('is-not-scrollable', !canScroll);
}

function enterMainFromSplash() {
  if (hasEnteredMain) return;
  hasEnteredMain = true;
  setLogoMode('docked');
  showScreen('screen-main');
}

function handleAddClick(period) {
  if (period) selectedPeriod = period;
  currentBookId = null;
  editingBookId = null;
  mobilePage = 'detail';
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
    meetingPermissionMessage,
    guideState,
    meetingGuideView,
    activeTopicIndex: activeMeetingTopicIndex,
    meetingLog,
    mobilePage,
    onMonthSelect(period) {
      selectedPeriod = period;
      currentBookId = null;
      editingBookId = null;
      mobilePage = 'detail';
      mainView = 'detail';
      meetingPermissionMessage = '';
      renderMain();
    },
    onYearChange(year) {
      selectedPeriod = clampPeriod(year, selectedPeriod.month);
      currentBookId = null;
      editingBookId = null;
      mobilePage = 'calendar';
      mainView = 'detail';
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
    onCancelEdit: cancelBookEdit,
    onEditCover: openBookCoverSearch,
    onDeleteBook: deleteSelectedBook,
    onStartMeeting(bookId) {
      currentBookId = bookId;
      openMeetingRules();
    },
    onIntroContinue: openMeetingRules,
    onMeetingConsent: startMeeting,
    onMeetingFinish: finishMeeting,
    onMeetingGuideOpen() {
      const isOpen = meetingGuideView === 'welcome' || meetingGuideView === 'topics' || meetingGuideView === 'topic-chosen';
      meetingGuideView = isOpen ? 'closed' : 'welcome';
      renderMain();
    },
    onMeetingGuideHelp() {
      meetingGuideView = 'topics';
      renderMain();
    },
    onMeetingTopicSelect(index) {
      activeMeetingTopicIndex = index;
      meetingGuideView = 'topic-chosen';
      logGuideMessage(MEETING_TOPIC_PROMPTS[index]);
      renderMain();
    },
    onMeetingGuideDismiss() {
      meetingGuideView = 'hidden';
      if (guideState === GUIDE_STATES.IDLE_HELP) {
        levelSinceMs = Date.now();
        guideState = GUIDE_STATES.NONE;
      }
      renderMain();
    },
    onGuideReset: resetMeetingAfterFight,
    onReviewSave: saveMagazineReviews,
    onEditContentSave: saveEditedBookContent,
    onRatingSave: saveRatingReview,
    onShareCard: shareBookCard,
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

function syncBookCoverToStorage(bookId, imageUrl) {
  if (!imageUrl || !currentClubId || !bookId) return;
  if (imageUrl.includes('firebasestorage.googleapis.com')) return;

  uploadBookCover(currentClubId, bookId, imageUrl)
    .then((result) => {
      if (!result?.url) return;
      return updateBook(currentClubId, bookId, { thumbnail: result.url }).then(() => {
        allBooks = allBooks.map((entry) => (
          entry.id === bookId ? { ...entry, thumbnail: result.url } : entry
        ));
        renderMain();
      });
    })
    .catch((err) => {
      console.warn('표지 이미지를 Storage에 저장하지 못했습니다', err);
    });
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
    syncBookCoverToStorage(bookId, replacement.thumbnail);
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

  syncBookCoverToStorage(bookId, book.thumbnail);
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

function cancelBookEdit(bookId) {
  currentBookId = bookId;
  mobilePage = 'detail';
  mainView = 'detail';
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

function readAudioDurationSeconds(file) {
  return new Promise((resolve) => {
    let settled = false;
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timeoutId = setTimeout(() => finish(null), 5000);
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeoutId);
      const seconds = Number.isFinite(audio.duration) ? Math.round(audio.duration) : null;
      finish(seconds);
    });
    audio.addEventListener('error', () => {
      clearTimeout(timeoutId);
      finish(null);
    });
  });
}

function handleDecibelLevel(level) {
  if (level !== meetingLevel) {
    meetingLevel = level;
    levelSinceMs = Date.now();
  }
  updateMeetingLevelClass(level);

  const now = Date.now();
  const nextGuideState = computeGuideState({
    level,
    levelSinceMs,
    now,
  });

  if (guideState === GUIDE_STATES.BLOCK_FIGHT) return;

  const introductoryGuideOpen = meetingGuideView === 'welcome' || meetingGuideView === 'topics';
  if (introductoryGuideOpen && nextGuideState !== GUIDE_STATES.BLOCK_FIGHT) return;

  if (nextGuideState !== guideState) {
    guideState = nextGuideState;
    if (guideState === GUIDE_STATES.BLOCK_FIGHT) meetingGuideView = 'hidden';
    logGuideMessage(GUIDE_CHARACTER_CONTENT[guideState]?.bodyLines?.[0]);
    renderMain();
  }
}

function openMeetingIntro() {
  mainView = 'meeting-intro';
  renderMain();
  showScreen('screen-main');
}

function openMeetingRules() {
  mainView = 'meeting-rules';
  meetingLevel = 'quiet';
  meetingPermissionMessage = '';
  levelSinceMs = Date.now();
  guideState = GUIDE_STATES.NONE;
  meetingGuideView = 'closed';
  activeMeetingTopicIndex = null;
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

async function startMeeting({ skipWelcome = false } = {}) {
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
  meetingLevel = 'quiet';
  meetingPermissionMessage = '';
  levelSinceMs = Date.now();
  guideState = GUIDE_STATES.NONE;
  meetingGuideView = skipWelcome ? 'hidden' : 'closed';
  activeMeetingTopicIndex = null;
  meetingLog = [];
  meetingStartedAt = Date.now();
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
    meetingLevel = 'quiet';
    levelSinceMs = Date.now();
    guideState = GUIDE_STATES.NONE;
    meetingGuideView = 'closed';
    activeMeetingTopicIndex = null;
    meetingLog = [];
    mainView = 'detail';
    setLogoMode('docked');
    renderMain();

    const meta = {};
    if (meetingStartedAt) {
      meta.meetingDate = toLocalDateString(new Date(meetingStartedAt));
      meta.discussionDurationSeconds = Math.round((Date.now() - meetingStartedAt) / 1000);
    }
    meetingStartedAt = null;

    await runAnalysis(blob, meta);
  } catch (err) {
    if (event?.target) event.target.disabled = false;
  }
}

async function resetMeetingAfterFight() {
  try {
    decibelMonitor?.stop();
    meetingStream?.getTracks().forEach((track) => track.stop());
    await currentRecorder?.stop();
  } catch (err) {
    // 녹음 중단 실패는 무시하고 계속 리셋 진행
  }
  decibelMonitor = null;
  meetingStream = null;
  currentRecorder = null;
  meetingLevel = 'quiet';
  guideState = GUIDE_STATES.NONE;
  meetingGuideView = 'hidden';
  activeMeetingTopicIndex = null;
  await startMeeting({ skipWelcome: true });
}

async function runAnalysis(blob, meta = {}) {
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
    mainView = 'detail';
    mobilePage = 'detail';
    renderMain();
    showScreen('screen-main');

    if (meta.meetingDate || meta.discussionDurationSeconds != null) {
      const extra = {};
      if (meta.meetingDate) extra.meetingDate = meta.meetingDate;
      if (meta.discussionDurationSeconds != null) extra.discussionDurationSeconds = meta.discussionDurationSeconds;
      try {
        await updateBook(currentClubId, currentBookId, extra);
        allBooks = allBooks.map((entry) => (
          entry.id === currentBookId ? { ...entry, ...extra } : entry
        ));
        renderMain();
      } catch (err) {
        console.warn('모임 날짜/토론시간 저장 실패', err);
        alert('모임 날짜/토론시간을 저장하지 못했습니다. 나중에 다시 시도해주세요.');
      }
    }
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
        ...(meta.meetingDate ? { meetingDate: meta.meetingDate } : {}),
        ...(meta.discussionDurationSeconds != null ? { discussionDurationSeconds: meta.discussionDurationSeconds } : {}),
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
      mainView = 'book-edit';
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

async function saveEditedBookContent(bookId, summary, reviews, meta = {}) {
  const trimmedSummary = summary.trim();
  const avgRating = calcAverage(reviews);
  const status = trimmedSummary || reviews.length > 0 ? 'analyzed' : 'pending';
  const extra = {};
  if ('meetingDate' in meta) extra.meetingDate = meta.meetingDate || '';
  if ('discussionDurationSeconds' in meta) extra.discussionDurationSeconds = meta.discussionDurationSeconds;

  try {
    await updateBook(currentClubId, bookId, {
      summary: trimmedSummary,
      reviews,
      avgRating,
      participantCount: reviews.length,
      status,
      analysisError: '',
      ...extra,
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, summary: trimmedSummary, reviews, avgRating, participantCount: reviews.length, status, analysisError: '', ...extra }
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

async function saveRatingReview(bookId, reviews) {
  try {
    const avgRating = calcAverage(reviews);
    await updateBook(currentClubId, bookId, {
      reviews,
      avgRating,
      participantCount: reviews.length,
    });

    allBooks = allBooks.map((book) => (
      book.id === bookId
        ? { ...book, reviews, avgRating, participantCount: reviews.length }
        : book
    ));
    renderMain();
  } catch (err) {
    alert('리뷰 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

async function shareBookCard(book, buttonEl) {
  if (buttonEl) buttonEl.disabled = true;
  try {
    await shareOrDownloadCard(book);
  } catch (err) {
    alert('공유 카드를 만들지 못했습니다. 다시 시도해주세요.');
  } finally {
    if (buttonEl) buttonEl.disabled = false;
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
  });
}

document.getElementById('upload-file-input').addEventListener('change', async (e) => {
  uploadedFile = e.target.files[0] || null;
  if (!uploadedFile) return;
  const fileToUpload = uploadedFile;
  e.target.value = '';

  const discussionDurationSeconds = await readAudioDurationSeconds(fileToUpload);

  renderUploadDateModal({
    onConfirm: async (meetingDate) => {
      uploadedFile = null;
      try {
        await runAnalysis(fileToUpload, { meetingDate, discussionDurationSeconds });
      } catch (err) {
        // runAnalysis already alerted the user and returned them to the main screen.
      }
    },
    onCancel() {
      uploadedFile = null;
    },
  });
});

document.getElementById('panel-scroll-up')?.addEventListener('click', () => {
  document.getElementById('month-detail')?.scrollBy({ top: -80, behavior: 'smooth' });
});
document.getElementById('panel-scroll-down')?.addEventListener('click', () => {
  document.getElementById('month-detail')?.scrollBy({ top: 80, behavior: 'smooth' });
});
window.addEventListener('resize', () => {
  updateScrollArrowVisibility();
  updateMonthGridScrollArrowVisibility();
});

renderSplashGuide();

if (currentClubId) {
  subscribeCurrentClub();
  renderMain();
}
