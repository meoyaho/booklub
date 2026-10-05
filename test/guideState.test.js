import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGuideState,
  GUIDE_STATES,
  QUIET_HELP_MS,
  MODERATE_ENCOURAGE_MS,
  LOUD_BLOCK_MS,
} from '../js/guideState.js';

const now = 100000;

test('quiet: 기준 시간 전에는 NONE', () => {
  const state = computeGuideState({ level: 'quiet', levelSinceMs: now - (QUIET_HELP_MS - 1), now });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('quiet: 기준 시간 이상 지속되면 IDLE_HELP', () => {
  const state = computeGuideState({ level: 'quiet', levelSinceMs: now - QUIET_HELP_MS, now });
  assert.equal(state, GUIDE_STATES.IDLE_HELP);
});

test('moderate: 기준 시간 전에는 NONE', () => {
  const state = computeGuideState({ level: 'moderate', levelSinceMs: now - (MODERATE_ENCOURAGE_MS - 1), now });
  assert.equal(state, GUIDE_STATES.NONE);
});

test('moderate: 기준 시간 이상 지속되면 ENCOURAGE', () => {
  const state = computeGuideState({ level: 'moderate', levelSinceMs: now - MODERATE_ENCOURAGE_MS, now });
  assert.equal(state, GUIDE_STATES.ENCOURAGE);
});

test('loud: 시끄러워지면 바로 WARN_LOUD', () => {
  const state = computeGuideState({ level: 'loud', levelSinceMs: now, now });
  assert.equal(state, GUIDE_STATES.WARN_LOUD);
});

test('loud: 기준 시간 이상 지속되면 BLOCK_FIGHT', () => {
  const state = computeGuideState({ level: 'loud', levelSinceMs: now - LOUD_BLOCK_MS, now });
  assert.equal(state, GUIDE_STATES.BLOCK_FIGHT);
});

test('알 수 없는 레벨은 NONE', () => {
  const state = computeGuideState({ level: 'unknown', levelSinceMs: now - 1000, now });
  assert.equal(state, GUIDE_STATES.NONE);
});
