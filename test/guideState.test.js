import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGuideState,
  GUIDE_STATES,
  QUIET_HELP_MS,
  LOUD_WARN_MS,
  LOUD_BLOCK_MS,
  ENCOURAGE_INTERVAL_MS,
} from '../js/guideState.js';

test('quiet: 임계값 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - (QUIET_HELP_MS - 1),
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('quiet: 8초 이상 지속되면 IDLE_HELP', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - QUIET_HELP_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.IDLE_HELP);
});

test('loud: 5초 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - (LOUD_WARN_MS - 1),
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('loud: 5초 이상 15초 미만이면 WARN_LOUD', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - LOUD_WARN_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.WARN_LOUD);
});

test('loud: 15초 이상이면 BLOCK_FIGHT', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now - LOUD_BLOCK_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.BLOCK_FIGHT);
});

test('moderate: lastEncourageAt이 null이면 바로 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});

test('moderate: 마지막 격려 후 interval 미만이면 NONE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: now - (ENCOURAGE_INTERVAL_MS - 1),
  });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('moderate: 마지막 격려 후 interval 이상이면 다시 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now - 1000,
    now,
    lastEncourageAt: now - ENCOURAGE_INTERVAL_MS,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});
