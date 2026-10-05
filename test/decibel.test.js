import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rmsToDb, classifyLevel, THRESHOLD_LOUD_DB, THRESHOLD_QUIET_DB,
  setThresholds, getThresholds, resetThresholds, MIN_THRESHOLD_GAP_DB, SLIDER_MIN_DB, SLIDER_MAX_DB,
  createLevelTracker,
} from '../js/decibel.js';

test('rmsToDb: rms 0 이하는 -Infinity', () => {
  assert.equal(rmsToDb(0), -Infinity);
  assert.equal(rmsToDb(-1), -Infinity);
});

test('rmsToDb: rms 1은 0dB', () => {
  assert.equal(rmsToDb(1), 0);
});

test('rmsToDb: rms 0.5는 약 -6.02dB', () => {
  assert.ok(Math.abs(rmsToDb(0.5) - (-6.0206)) < 0.001);
});

test('classifyLevel: 임계값 경계 분류', () => {
  assert.equal(classifyLevel(THRESHOLD_QUIET_DB - 1), 'quiet');
  assert.equal(classifyLevel((THRESHOLD_QUIET_DB + THRESHOLD_LOUD_DB) / 2), 'moderate');
  assert.equal(classifyLevel(THRESHOLD_LOUD_DB), 'loud');
  assert.equal(classifyLevel(0), 'loud');
});

test('setThresholds: 바꾼 기준으로 분류', () => {
  setThresholds({ quiet: -40, loud: -30 });
  assert.equal(classifyLevel(-41), 'quiet');
  assert.equal(classifyLevel(-35), 'moderate');
  assert.equal(classifyLevel(-30), 'loud');
  resetThresholds();
  assert.deepEqual(getThresholds(), { quiet: THRESHOLD_QUIET_DB, loud: THRESHOLD_LOUD_DB });
});

test('setThresholds: 조용함 기준이 시끄러움 기준을 넘지 않음', () => {
  assert.deepEqual(setThresholds({ quiet: -10, loud: -12 }), { quiet: -12 - MIN_THRESHOLD_GAP_DB, loud: -12 });
  assert.deepEqual(setThresholds({ quiet: -100, loud: 10 }), { quiet: SLIDER_MIN_DB, loud: SLIDER_MAX_DB });
  resetThresholds();
});

// 진폭 rms를 평균 제곱으로 바꿔 넣는 도우미
const power = (db) => (10 ** (db / 20)) ** 2;

test('createLevelTracker: 말 사이 짧은 쉼은 단계를 바꾸지 않음', () => {
  const tracker = createLevelTracker({ averageMs: 1000, confirmMs: 1500 });
  let t = 0;
  let result;
  for (; t <= 5000; t += 20) result = tracker.update(power(-18), t);
  assert.equal(result.level, 'moderate');
  const since = result.since;
  // 0.3초 동안 조용해져도 그대로 적당함
  for (let end = t + 300; t <= end; t += 20) result = tracker.update(power(-60), t);
  for (let end = t + 2000; t <= end; t += 20) result = tracker.update(power(-18), t);
  assert.equal(result.level, 'moderate');
  assert.equal(result.since, since);
});

test('createLevelTracker: 새 단계가 confirmMs 이어지면 바뀌고, since는 처음 바뀐 시점', () => {
  const tracker = createLevelTracker({ averageMs: 1000, confirmMs: 1500 });
  let t = 0;
  let result;
  for (; t <= 3000; t += 20) result = tracker.update(power(-60), t);
  assert.equal(result.level, 'quiet');
  const loudStart = t;
  for (let end = t + 1000; t <= end; t += 20) result = tracker.update(power(-3), t);
  assert.equal(result.level, 'quiet');
  for (let end = t + 3000; t <= end; t += 20) result = tracker.update(power(-3), t);
  assert.equal(result.level, 'loud');
  assert.ok(result.since >= loudStart && result.since < loudStart + 1000);
});

test('createLevelTracker: reset하면 조용함부터 다시 시작', () => {
  const tracker = createLevelTracker({ averageMs: 1000, confirmMs: 1500 });
  let result;
  for (let t = 0; t <= 5000; t += 20) result = tracker.update(power(-3), t);
  assert.equal(result.level, 'loud');
  tracker.reset(6000);
  result = tracker.update(power(-3), 6020);
  assert.equal(result.level, 'quiet');
  assert.equal(result.since, 6000);
});
