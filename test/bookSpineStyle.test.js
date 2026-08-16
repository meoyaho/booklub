import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpineStyle } from '../js/bookSpineStyle.js';

test('getSpineStyle: 같은 입력에 항상 같은 결과 (결정론적)', () => {
  const a = getSpineStyle('book-1', '데미안');
  const b = getSpineStyle('book-1', '데미안');
  assert.deepEqual(a, b);
});

test('getSpineStyle: 제목이 길수록 width/height가 커짐', () => {
  const short = getSpineStyle('book-2', '토지');
  const long = getSpineStyle('book-3', '어린 왕자와 함께하는 아주 길고 긴 제목의 모험 이야기');
  assert.ok(long.width > short.width);
  assert.ok(long.height > short.height);
});

test('getSpineStyle: width/height는 지정된 범위 내에 있음', () => {
  const empty = getSpineStyle('book-4', '');
  const veryLong = getSpineStyle('book-5', 'a'.repeat(200));
  assert.ok(empty.width >= 160 && empty.width <= 480);
  assert.ok(empty.height >= 48 && empty.height <= 100);
  assert.ok(veryLong.width >= 160 && veryLong.width <= 480);
  assert.ok(veryLong.height >= 48 && veryLong.height <= 100);
});

test('getSpineStyle: rotationDeg와 offsetX는 지정된 범위 내에 있음', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  ids.forEach((id) => {
    const style = getSpineStyle(id, '제목');
    assert.ok(style.rotationDeg >= -6 && style.rotationDeg <= 6);
    assert.ok(style.offsetX >= -12 && style.offsetX <= 12);
  });
});

test('getSpineStyle: color는 문자열이며 비어있지 않음', () => {
  const style = getSpineStyle('book-6', '제목');
  assert.equal(typeof style.color, 'string');
  assert.ok(style.color.length > 0);
});

test('getSpineStyle: 서로 다른 id는 대체로 다른 색/회전/오프셋을 가짐 (완전히 동일하지 않음을 확인)', () => {
  const a = getSpineStyle('book-a', '제목');
  const b = getSpineStyle('book-b', '제목');
  const same = a.color === b.color && a.rotationDeg === b.rotationDeg && a.offsetX === b.offsetX;
  assert.equal(same, false);
});
