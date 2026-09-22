import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGuideState,
  GUIDE_STATES,
  QUIET_HELP_MS,
} from '../js/guideState.js';

test('quiet: 침묵 1분 전에는 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - (QUIET_HELP_MS - 1),
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});

test('quiet: 침묵이 1분 이상 지속되면 IDLE_HELP', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'quiet',
    levelSinceMs: now - QUIET_HELP_MS,
    now,
    lastEncourageAt: null,
  });
  assert.equal(state, GUIDE_STATES.IDLE_HELP);
});

test('moderate: 낮은 기준 이상 높은 기준 미만이면 계속 WARN_LOUD', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: now,
    now,
  });
  assert.equal(state, GUIDE_STATES.WARN_LOUD);
});

test('moderate: 오래 지속되어도 WARN_LOUD', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'moderate',
    levelSinceMs: 0,
    now,
  });
  assert.equal(state, GUIDE_STATES.WARN_LOUD);
});

test('loud: 높은 기준 이상이면 즉시 BLOCK_FIGHT', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'loud',
    levelSinceMs: now,
    now,
  });
  assert.equal(state, GUIDE_STATES.BLOCK_FIGHT);
});

test('알 수 없는 레벨은 ENCOURAGE', () => {
  const now = 100000;
  const state = computeGuideState({
    level: 'unknown',
    levelSinceMs: now - 1000,
    now,
  });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});
