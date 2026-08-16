// js/screens.js
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === screenId);
  });

  const logo = document.getElementById('app-logo');
  if (screenId === 'screen-main') {
    logo.classList.remove('logo-hidden');
  } else if (screenId !== 'screen-splash') {
    logo.classList.add('logo-hidden');
  }

  const activeScreen = document.getElementById(screenId);
  if (activeScreen && activeScreen.classList.contains('book-screen')) {
    const book = activeScreen.querySelector('.book');
    if (book) {
      book.classList.remove('page-turn');
      void book.offsetWidth; // 강제 리플로우: 같은 화면에 재진입해도 애니메이션이 다시 재생되도록 함
      book.classList.add('page-turn');
    }
  }
}
