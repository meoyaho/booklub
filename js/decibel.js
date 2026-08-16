export const THRESHOLD_QUIET_DB = -35;
export const THRESHOLD_LOUD_DB = -18;

export function rmsToDb(rms) {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export function classifyLevel(db) {
  if (db < THRESHOLD_QUIET_DB) return 'quiet';
  if (db < THRESHOLD_LOUD_DB) return 'moderate';
  return 'loud';
}
