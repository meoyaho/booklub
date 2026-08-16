// js/bookDetail.js
export function renderBookDetail(book) {
  document.getElementById('detail-cover').src = book.thumbnail || '';
  document.getElementById('detail-title').textContent = book.title;
  document.getElementById('detail-authors').textContent = book.authors;

  const pendingActions = document.getElementById('detail-pending-actions');
  const analyzedContent = document.getElementById('detail-analyzed-content');

  if (book.status === 'analyzed') {
    pendingActions.classList.add('hidden');
    analyzedContent.classList.remove('hidden');

    document.getElementById('detail-summary').textContent = book.summary || '';
    document.getElementById('detail-avg-rating').textContent =
      `평균 별점: ${book.avgRating != null ? book.avgRating : 0} / 5`;

    const reviewsEl = document.getElementById('detail-reviews');
    reviewsEl.innerHTML = '';
    (book.reviews || []).forEach((r) => {
      const li = document.createElement('li');
      li.textContent = `★${r.rating} - ${r.review}`;
      reviewsEl.appendChild(li);
    });
  } else {
    pendingActions.classList.remove('hidden');
    analyzedContent.classList.add('hidden');
  }
}
