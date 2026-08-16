// js/app.js
import { showScreen } from './screens.js';

function startSplashAnimation() {
  const logo = document.querySelector('.splash-logo');
  setTimeout(() => {
    logo.classList.add('rise');
    setTimeout(() => showScreen('screen-main'), 800);
  }, 1200);
}

startSplashAnimation();
