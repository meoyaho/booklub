export const THRESHOLD_QUIET_DB = -25;
export const THRESHOLD_LOUD_DB = -12;
export const SLIDER_MIN_DB = -60;
export const SLIDER_MAX_DB = 0;
export const MIN_THRESHOLD_GAP_DB = 3;

let thresholds = { quiet: THRESHOLD_QUIET_DB, loud: THRESHOLD_LOUD_DB };

export function getThresholds() {
  return { ...thresholds };
}

// 조용함 기준은 시끄러움 기준보다 최소 MIN_THRESHOLD_GAP_DB 만큼 낮게 유지한다.
export function setThresholds({ quiet = thresholds.quiet, loud = thresholds.loud } = {}) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const nextLoud = clamp(loud, SLIDER_MIN_DB + MIN_THRESHOLD_GAP_DB, SLIDER_MAX_DB);
  const nextQuiet = clamp(quiet, SLIDER_MIN_DB, nextLoud - MIN_THRESHOLD_GAP_DB);
  thresholds = { quiet: nextQuiet, loud: nextLoud };
  return getThresholds();
}

export function resetThresholds() {
  thresholds = { quiet: THRESHOLD_QUIET_DB, loud: THRESHOLD_LOUD_DB };
  return getThresholds();
}

export function rmsToDb(rms) {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export function classifyLevel(db, { quiet, loud } = thresholds) {
  if (db < quiet) return 'quiet';
  if (db < loud) return 'moderate';
  return 'loud';
}

export const LEVEL_AVERAGE_MS = 1000;
export const LEVEL_CONFIRM_MS = 1500;

// 최근 averageMs 동안의 평균 소리 크기로 단계를 정하고,
// 새 단계가 confirmMs 이상 이어져야 단계를 바꾼다. 말 사이의 짧은 쉼을 무시하기 위함.
// since는 새 단계가 처음 나타난 시점이라, 기다린 시간만큼 길잡이 반응이 늦어지지 않는다.
export function createLevelTracker({ averageMs = LEVEL_AVERAGE_MS, confirmMs = LEVEL_CONFIRM_MS } = {}) {
  let samples = [];
  let level = 'quiet';
  let since = null;
  let candidate = null;
  let candidateSince = null;

  function reset(now) {
    samples = [];
    level = 'quiet';
    since = now;
    candidate = null;
    candidateSince = null;
  }

  function update(meanSquare, now) {
    if (since === null) since = now;
    samples.push({ time: now, power: meanSquare });
    while (samples.length && samples[0].time < now - averageMs) samples.shift();

    const average = samples.reduce((sum, sample) => sum + sample.power, 0) / samples.length;
    const db = average > 0 ? 10 * Math.log10(average) : -Infinity;
    const next = classifyLevel(db);

    if (next === level) {
      candidate = null;
    } else {
      if (candidate !== next) {
        candidate = next;
        candidateSince = now;
      }
      if (now - candidateSince >= confirmMs) {
        level = candidate;
        since = candidateSince;
        candidate = null;
      }
    }
    return { level, since, db };
  }

  return { update, reset };
}
