// js/guideState.js
export const GUIDE_STATES = {
  NONE: 'none',
  IDLE_HELP: 'idle-help',
  ENCOURAGE: 'encourage',
  WARN_LOUD: 'warn-loud',
  BLOCK_FIGHT: 'block-fight',
};

export const QUIET_HELP_MS = 60000;

export function computeGuideState({ level, levelSinceMs, now }) {
  const elapsed = now - levelSinceMs;

  if (level === 'quiet') {
    return elapsed >= QUIET_HELP_MS ? GUIDE_STATES.IDLE_HELP : GUIDE_STATES.ENCOURAGE;
  }

  if (level === 'moderate') return GUIDE_STATES.WARN_LOUD;
  if (level === 'loud') return GUIDE_STATES.BLOCK_FIGHT;

  return GUIDE_STATES.ENCOURAGE;
}
