// js/app.js
import { showScreen } from './screens.js';
import { subscribeBooks, addBook, updateBook, uploadRecording } from './firebase.js';
import { renderBookSlider } from './bookSlider.js';
import { renderBookDetail } from './bookDetail.js';
import { searchBooks } from './search.js';
import { DecibelMonitor } from './decibelMonitor.js';
import { Recorder } from './recorder.js';
import { generateMockSummary } from './mockAnalysis.js';
import { renderReviewsForm, collectReviews } from './reviewsForm.js';
import { calcAverage } from './ratings.js';

const LEVEL_COLORS = { quiet: '#4caf50', moderate: '#ffc107', loud: '#f44336' };

let currentBookId = null;
let allBooks = [];
let meetingStream = null;
let decibelMonitor = null;
let currentRecorder = null;
let loudSinceMs = null;
let uploadedFile = null;

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleBookClick(bookId) {
  currentBookId = bookId;
  const book = allBooks.find((b) => b.id === bookId);
  if (book) renderBookDetail(book);
  showScreen('screen-detail');
}

function handleAddClick() {
  showScreen('screen-search');
}

function handleDecibelLevel(level) {
  document.getElementById('meeting-bg').style.backgroundColor = LEVEL_COLORS[level];
  const warningEl = document.getElementById('meeting-warning');

  if (level === 'loud') {
    if (loudSinceMs === null) loudSinceMs = Date.now();
    if (Date.now() - loudSinceMs > 3000) warningEl.classList.remove('hidden');
  } else {
    loudSinceMs = null;
    warningEl.classList.add('hidden');
  }
}

async function startMeeting() {
  try {
    meetingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    alert('마이크 권한이 필요합니다. 대신 "녹음본 업로드"를 이용해주세요.');
    return;
  }
  decibelMonitor = new DecibelMonitor(meetingStream, handleDecibelLevel);
  currentRecorder = new Recorder(meetingStream);
  showScreen('screen-meeting');
}

async function runAnalysis(blob) {
  showScreen('screen-analyzing');
  const recordingUrl = await uploadRecording(currentBookId, blob);
  const book = allBooks.find((b) => b.id === currentBookId);
  const summary = generateMockSummary(book ? book.title : '');
  await updateBook(currentBookId, { recordingUrl, summary });
  document.getElementById('summary-text').textContent = summary;
  showScreen('screen-summary');
}

subscribeBooks((books) => {
  allBooks = books;
  renderBookSlider(books, handleBookClick, handleAddClick);
  if (currentBookId) {
    const updated = books.find((b) => b.id === currentBookId);
    if (updated) renderBookDetail(updated);
  }
});

document.getElementById('search-close-btn').addEventListener('click', () => showScreen('screen-main'));

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
      const bookId = await addBook(book);
      document.getElementById('search-input').value = '';
      resultsEl.innerHTML = '';
      handleBookClick(bookId);
    });
    resultsEl.appendChild(li);
  });
});

document.getElementById('detail-back-btn').addEventListener('click', () => {
  currentBookId = null;
  showScreen('screen-main');
});

document.getElementById('start-meeting-btn').addEventListener('click', startMeeting);

document.getElementById('meeting-finish-btn').addEventListener('click', async () => {
  decibelMonitor.stop();
  meetingStream.getTracks().forEach((t) => t.stop());
  const blob = await currentRecorder.stop();
  await runAnalysis(blob);
});

document.getElementById('upload-recording-btn').addEventListener('click', () => showScreen('screen-upload'));
document.getElementById('upload-back-btn').addEventListener('click', () => showScreen('screen-detail'));

document.getElementById('upload-file-input').addEventListener('change', (e) => {
  uploadedFile = e.target.files[0] || null;
  document.getElementById('upload-confirm-btn').disabled = !uploadedFile;
});

document.getElementById('upload-confirm-btn').addEventListener('click', async () => {
  if (!uploadedFile) return;
  await runAnalysis(uploadedFile);
});

document.getElementById('summary-continue-btn').addEventListener('click', () => showScreen('screen-participant-count'));

document.getElementById('participant-count-confirm').addEventListener('click', () => {
  const count = Number(document.getElementById('participant-count-input').value);
  if (!count || count < 1) {
    alert('1명 이상의 인원수를 입력해주세요.');
    return;
  }
  renderReviewsForm(count);
  showScreen('screen-reviews-form');
});

document.getElementById('reviews-save-btn').addEventListener('click', async () => {
  const reviews = collectReviews();
  const avgRating = calcAverage(reviews);
  const participantCount = reviews.length;

  await updateBook(currentBookId, {
    status: 'analyzed',
    reviews,
    avgRating,
    participantCount,
  });

  currentBookId = null;
  showScreen('screen-main');
});

startSplashAnimation();
