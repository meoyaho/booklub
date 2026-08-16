// js/bookSlider.js
import { getSpineStyle } from './bookSpineStyle.js';

export function renderBookSlider(books, onBookClick, onAddClick) {
  const container = document.getElementById('book-slider');
  container.innerHTML = '';

  const addBtn = document.createElement('button');
  addBtn.className = 'add-book-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', onAddClick);
  container.appendChild(addBtn);

  const newestFirst = books.slice().reverse();
  newestFirst.forEach((book) => {
    const spine = document.createElement('button');
    spine.className = 'book-spine';

    const label = document.createElement('span');
    label.className = 'book-spine-label';
    label.textContent = book.title || '';
    spine.appendChild(label);

    const style = getSpineStyle(book.id, book.title);
    spine.style.width = `${style.width}px`;
    spine.style.height = `${style.height}px`;
    spine.style.backgroundColor = style.color;
    spine.style.transform = `translateX(${style.offsetX}px) rotate(${style.rotationDeg}deg)`;

    spine.addEventListener('click', () => onBookClick(book.id));
    container.appendChild(spine);
  });
}
