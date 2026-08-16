// js/screens.js
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === screenId);
  });

  const logo = document.getElementById('app-logo');
  if (logo) {
    if (screenId === 'screen-main') {
      logo.classList.remove('logo-hidden');
    } else if (screenId !== 'screen-splash') {
      logo.classList.add('logo-hidden');
    }
  }
}
