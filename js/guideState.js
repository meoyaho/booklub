// js/guideState.js
export const GUIDE_STATES = {
  NONE: 'none',
  IDLE_HELP: 'idle-help',
  ENCOURAGE: 'encourage',
  WARN_LOUD: 'warn-loud',
  BLOCK_FIGHT: 'block-fight',
};

export const QUIET_HELP_MS = 8000;
export const LOUD_WARN_MS = 5000;
export const LOUD_BLOCK_MS = 15000;
export const ENCOURAGE_INTERVAL_MS = 30000;

export function computeGuideState({ level, levelSinceMs, now, lastEncourageAt }) {
  const elapsed = now - levelSinceMs;

  if (level === 'quiet') {
    return elapsed >= QUIET_HELP_MS ? GUIDE_STATES.IDLE_HELP : GUIDE_STATES.NONE;
  }

  if (level === 'loud') {
    if (elapsed >= LOUD_BLOCK_MS) return GUIDE_STATES.BLOCK_FIGHT;
    if (elapsed >= LOUD_WARN_MS) return GUIDE_STATES.WARN_LOUD;
    return GUIDE_STATES.NONE;
  }

  const sinceEncourage = lastEncourageAt === null ? Infinity : now - lastEncourageAt;
  return sinceEncourage >= ENCOURAGE_INTERVAL_MS ? GUIDE_STATES.ENCOURAGE : GUIDE_STATES.NONE;
}
