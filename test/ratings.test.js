import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcAverage } from '../js/ratings.js';

test('calcAverage: 빈 배열은 0', () => {
  assert.equal(calcAverage([]), 0);
  assert.equal(calcAverage(undefined), 0);
});

test('calcAverage: 단일 리뷰는 그 값 그대로', () => {
  assert.equal(calcAverage([{ rating: 4, review: 'good' }]), 4);
});

test('calcAverage: 여러 리뷰 평균, 소수 첫째 자리 반올림', () => {
  const reviews = [
    { rating: 5, review: 'a' },
    { rating: 4, review: 'b' },
    { rating: 3, review: 'c' },
  ];
  assert.equal(calcAverage(reviews), 4);

  const reviews2 = [
    { rating: 5, review: 'a' },
    { rating: 4, review: 'b' },
  ];
  assert.equal(calcAverage(reviews2), 4.5);
});
