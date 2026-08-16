// js/reviewsForm.js
export function renderReviewsForm(count) {
  const container = document.getElementById('reviews-form-container');
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'review-entry';

    const label = document.createElement('p');
    label.textContent = `참석자 ${i + 1}`;

    const ratingSelect = document.createElement('select');
    ratingSelect.className = 'review-rating';
    [1, 2, 3, 4, 5].forEach((n) => {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `★${n}`;
      ratingSelect.appendChild(opt);
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'review-text';
    textarea.placeholder = '리뷰를 입력하세요';

    wrapper.appendChild(label);
    wrapper.appendChild(ratingSelect);
    wrapper.appendChild(textarea);
    container.appendChild(wrapper);
  }
}

export function collectReviews() {
  const entries = document.querySelectorAll('#reviews-form-container .review-entry');
  return Array.from(entries).map((entry) => ({
    rating: Number(entry.querySelector('.review-rating').value),
    review: entry.querySelector('.review-text').value.trim(),
  }));
}
