// js/bookSlider.js
export function renderBookSlider(books, onBookClick, onAddClick) {
  const container = document.getElementById('book-slider');
  container.innerHTML = '';

  books.forEach((book) => {
    const img = document.createElement('img');
    img.src = book.thumbnail || '';
    img.alt = book.title;
    img.className = 'book-cover';
    img.addEventListener('click', () => onBookClick(book.id));
    container.appendChild(img);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'add-book-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', onAddClick);
  container.appendChild(addBtn);
}
