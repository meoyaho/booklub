// js/app.js
import { showScreen } from './screens.js';
import { subscribeBooks, addBook } from './firebase.js';
import { renderBookSlider } from './bookSlider.js';
import { searchBooks } from './search.js';
import { renderBookDetail } from './bookDetail.js';

let currentBookId = null;
let allBooks = [];

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

subscribeBooks((books) => {
  allBooks = books;
  renderBookSlider(books, handleBookClick, handleAddClick);

  if (currentBookId) {
    const updated = books.find((b) => b.id === currentBookId);
    if (updated) renderBookDetail(updated);
  }
});

startSplashAnimation();

document.getElementById('detail-back-btn').addEventListener('click', () => {
  currentBookId = null;
  showScreen('screen-main');
});

document.getElementById('search-close-btn').addEventListener('click', () => {
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
      const bookId = await addBook(book);
      document.getElementById('search-input').value = '';
      resultsEl.innerHTML = '';
      handleBookClick(bookId);
    });
    resultsEl.appendChild(li);
  });
});
