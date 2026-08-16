// js/screens.js
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('active', el.id === screenId);
  });
}
