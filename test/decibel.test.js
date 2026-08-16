import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmsToDb, classifyLevel, THRESHOLD_LOUD_DB, THRESHOLD_QUIET_DB } from '../js/decibel.js';

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
