// js/app.js
import { showScreen } from './screens.js';
import { subscribeBooks } from './firebase.js';
import { renderBookSlider } from './bookSlider.js';

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

function handleBookClick(bookId) {
  // Task 7에서 상세 화면 렌더링 로직 연결
  console.log('book clicked', bookId);
}

function handleAddClick() {
  showScreen('screen-search');
}

subscribeBooks((books) => {
  renderBookSlider(books, handleBookClick, handleAddClick);
});

startSplashAnimation();
