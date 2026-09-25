// js/guideState.js
export const GUIDE_STATES = {
  NONE: 'none',
  IDLE_HELP: 'idle-help',
  ENCOURAGE: 'encourage',
  WARN_LOUD: 'warn-loud',
  BLOCK_FIGHT: 'block-fight',
};

export const QUIET_HELP_MS = 30000;
export const MODERATE_ENCOURAGE_MS = 30000;
export const LOUD_BLOCK_MS = 8000;

export function computeGuideState({ level, levelSinceMs, now }) {
  const elapsed = now - levelSinceMs;

  if (level === 'quiet') {
    return elapsed >= QUIET_HELP_MS ? GUIDE_STATES.IDLE_HELP : GUIDE_STATES.NONE;
  }

  if (level === 'moderate') {
    return elapsed >= MODERATE_ENCOURAGE_MS ? GUIDE_STATES.ENCOURAGE : GUIDE_STATES.NONE;
  }

  if (level === 'loud') {
    return elapsed >= LOUD_BLOCK_MS ? GUIDE_STATES.BLOCK_FIGHT : GUIDE_STATES.WARN_LOUD;
  }

  return GUIDE_STATES.NONE;
}
