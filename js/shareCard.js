const CARD_WIDTH = 900;
const CARD_HEADER_HEIGHT = 90;
const CARD_PADDING = 40;
const COVER_WIDTH = 160;
const COVER_HEIGHT = 240;
const REVIEW_ROW_HEIGHT = 34;

function sanitizeFilename(name) {
  return String(name || '카드')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60) || '카드';
}

function loadCoverImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function truncateToWidth(ctx, text, maxWidth) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function cardHeight(book) {
  const reviewCount = (book.reviews || []).length;
  return CARD_HEADER_HEIGHT + CARD_PADDING * 2 + COVER_HEIGHT + 30 + 40 + reviewCount * REVIEW_ROW_HEIGHT + 40;
}

function drawCard(ctx, book, coverImg, width, height) {
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#ece9d8';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#3f5d95';
  ctx.fillRect(0, 0, width, CARD_HEADER_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 28px GalmuriMono11, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('책 쫌 읽읍시다', CARD_PADDING, CARD_HEADER_HEIGHT / 2);

  const y = CARD_HEADER_HEIGHT + CARD_PADDING;

  if (coverImg) {
    ctx.drawImage(coverImg, CARD_PADDING, y, COVER_WIDTH, COVER_HEIGHT);
  } else {
    ctx.fillStyle = '#111111';
    ctx.fillRect(CARD_PADDING, y, COVER_WIDTH, COVER_HEIGHT);
  }

  const textX = CARD_PADDING + COVER_WIDTH + 30;
  const textMaxWidth = width - textX - CARD_PADDING;

  ctx.fillStyle = '#111111';
  ctx.font = '900 26px GalmuriMono11, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(truncateToWidth(ctx, book.title || '제목 없음', textMaxWidth), textX, y);

  ctx.font = '400 18px GalmuriMono11, sans-serif';
  ctx.fillStyle = '#707070';
  ctx.fillText(truncateToWidth(ctx, book.authors || '', textMaxWidth), textX, y + 40);

  const avgRating = Number(book.avgRating || 0);
  const filled = Math.max(0, Math.min(5, Math.round(avgRating)));
  ctx.font = '400 20px GalmuriMono11, sans-serif';
  ctx.fillStyle = '#ff4a14';
  ctx.fillText(`${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}  ${avgRating.toFixed(1)}`, textX, y + 75);

  let rowY = y + COVER_HEIGHT + 30;
  ctx.strokeStyle = '#8c8c84';
  ctx.beginPath();
  ctx.moveTo(CARD_PADDING, rowY);
  ctx.lineTo(width - CARD_PADDING, rowY);
  ctx.stroke();
  rowY += 30;

  (book.reviews || []).forEach((review) => {
    ctx.fillStyle = '#111111';
    ctx.font = '900 18px GalmuriMono11, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(truncateToWidth(ctx, review.name || '익명', 90), CARD_PADDING, rowY);

    const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating) || 0)));
    ctx.fillStyle = '#ff4a14';
    ctx.font = '400 16px GalmuriMono11, sans-serif';
    ctx.fillText(`${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`, CARD_PADDING + 100, rowY);

    ctx.fillStyle = '#707070';
    ctx.font = '400 16px GalmuriMono11, sans-serif';
    const reviewText = truncateToWidth(ctx, review.review || '', width - CARD_PADDING - 220);
    ctx.fillText(reviewText, CARD_PADDING + 220, rowY);

    rowY += REVIEW_ROW_HEIGHT;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    // 오염된 캔버스에서는 toBlob이 동기적으로 SecurityError를 던진다.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('카드 이미지를 생성하지 못했습니다.'))), 'image/png');
  });
}

// 표지 이미지가 CORS 헤더 없이 그려지면 캔버스가 영구적으로 오염되고,
// 오염 표시는 캔버스 단위라 같은 캔버스에 다시 그려도 해제되지 않는다.
// 그래서 재시도는 반드시 새 캔버스에서 해야 한다.
function renderCard(book, coverImg) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = cardHeight(book);
  const ctx = canvas.getContext('2d');
  drawCard(ctx, book, coverImg, canvas.width, canvas.height);
  return canvas;
}

export async function generateShareCardBlob(book) {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      // 폰트 로딩 실패는 무시하고 기본 폰트로 진행
    }
  }

  const coverImg = await loadCoverImage(book.thumbnail);

  if (coverImg) {
    try {
      return await canvasToBlob(renderCard(book, coverImg));
    } catch (err) {
      // 캔버스 오염(CORS) 등으로 실패 시 표지 이미지 없이 새 캔버스에 재시도
    }
  }

  return canvasToBlob(renderCard(book, null));
}

export async function shareOrDownloadCard(book) {
  const blob = await generateShareCardBlob(book);
  const filename = `책좀읽읍시다_${sanitizeFilename(book.title)}_카드.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: book.title || '독서모임 카드' });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      // 공유 실패 시 아래 다운로드로 폴백
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
