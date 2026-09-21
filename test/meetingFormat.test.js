import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLocalDateString, formatDurationSeconds, formatMeetingDate } from '../js/meetingFormat.js';

test('toLocalDateString: 로컬 날짜를 YYYY-MM-DD로', () => {
  assert.equal(toLocalDateString(new Date(2026, 2, 27)), '2026-03-27');
  assert.equal(toLocalDateString(new Date(2026, 0, 5)), '2026-01-05');
});

test('formatDurationSeconds: 1시간 이상은 시/분/초 모두 표시', () => {
  assert.equal(formatDurationSeconds(9315), '2시간 35분 15초');
});

test('formatDurationSeconds: 1시간 미만 1분 이상은 분/초만', () => {
  assert.equal(formatDurationSeconds(95), '1분 35초');
});

test('formatDurationSeconds: 1분 미만은 초만', () => {
  assert.equal(formatDurationSeconds(45), '45초');
});

test('formatDurationSeconds: 0/음수/NaN은 0초', () => {
  assert.equal(formatDurationSeconds(0), '0초');
  assert.equal(formatDurationSeconds(-5), '0초');
  assert.equal(formatDurationSeconds(NaN), '0초');
  assert.equal(formatDurationSeconds(undefined), '0초');
});

test('formatMeetingDate: 정상 날짜 문자열 변환', () => {
  assert.equal(formatMeetingDate('2026-03-27'), '2026년 3월 27일 금요일');
  assert.equal(formatMeetingDate('2026-01-01'), '2026년 1월 1일 목요일');
});

test('formatMeetingDate: 잘못된 입력은 빈 문자열', () => {
  assert.equal(formatMeetingDate(''), '');
  assert.equal(formatMeetingDate('not-a-date'), '');
  assert.equal(formatMeetingDate(undefined), '');
});
