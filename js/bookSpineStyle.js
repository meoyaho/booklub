const PALETTE = [
  '#8e2f2f', '#2f5d8e', '#2f7d4f', '#6b3f8e', '#8e6a2f',
  '#2f7d7d', '#8e2f6a', '#4f4f8e', '#7d5a2f', '#3f6b3f',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getSpineStyle(bookId, title) {
  const id = String(bookId);
  const colorIndex = hashString(id) % PALETTE.length;
  const rotationDeg = (hashString(`${id}:rotation`) % 13) - 6;
  const offsetX = (hashString(`${id}:offset`) % 25) - 12;

  const length = (title || '').length;
  const width = clamp(140 + length * 9, 160, 480);
  const height = clamp(44 + length * 1.5, 48, 100);

  return {
    width,
    height,
    rotationDeg,
    offsetX,
    color: PALETTE[colorIndex],
  };
}
