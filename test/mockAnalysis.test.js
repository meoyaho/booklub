import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMockSummary } from '../js/mockAnalysis.js';

test('generateMockSummary: 책 제목을 포함한 문자열 반환', () => {
  const summary = generateMockSummary('데미안');
  assert.ok(summary.includes('데미안'));
  assert.ok(summary.length > 20);
});

test('generateMockSummary: 동일 입력에 대해 결정론적으로 동일한 결과', () => {
  assert.equal(generateMockSummary('토지'), generateMockSummary('토지'));
});
