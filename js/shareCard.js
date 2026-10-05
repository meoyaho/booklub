const CARD_WIDTH = 900;
const FALLBACK_COVER_RATIO = 1.5;
const REVIEW_ROW_HEIGHT = 116;
const LOGO_URL = new URL('../assets/logo.png', import.meta.url).href;

function sanitizeFilename(name) {
  return String(name || '카드')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 60) || '카드';
}

function loadCoverImage(url) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeoutId = setTimeout(() => finish(null), 5000);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timeoutId);
      finish(img);
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      finish(null);
    };
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

function cardHeight(coverImg) {
  const coverWidth = coverImg?.naturalWidth || coverImg?.width;
  const coverHeight = coverImg?.naturalHeight || coverImg?.height;
  const ratio = coverWidth && coverHeight ? coverHeight / coverWidth : FALLBACK_COVER_RATIO;
  return Math.round(CARD_WIDTH * ratio);
}

function bookPeriodLabel(book) {
  const yearMonth = String(book.yearMonth || '').match(/^(\d{4})-(\d{1,2})$/);
  const periods = [
    [Number(book.readYear), Number(book.readMonth)],
    [Number(yearMonth?.[1]), Number(yearMonth?.[2])],
  ];
  const period = periods.find(([year, month]) => (
    Number.isInteger(year) && year >= 1000 && year <= 9999
    && Number.isInteger(month) && month >= 1 && month <= 12
  ));
  return period ? ` · ${period[0]}년 ${period[1]}월의 책` : '';
}

function drawStars(ctx, rating, x, y, fontSize) {
  const stars = '★★★★★';
  const filledRatio = Math.max(0, Math.min(1, (Number(rating) || 0) / 5));
  const width = ctx.measureText(stars).width;

  ctx.fillStyle = '#c9c9c2';
  ctx.fillText(stars, x, y);

  if (filledRatio > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - fontSize, width * filledRatio, fontSize * 3);
    ctx.clip();
    ctx.fillStyle = '#ff4a14';
    ctx.fillText(stars, x, y);
    ctx.restore();
  }

  return width;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value) return [];

  const lines = [];
  let line = '';
  for (const character of value) {
    if (line && ctx.measureText(line + character).width > maxWidth) {
      lines.push(line.trim());
      if (lines.length === maxLines) {
        lines[maxLines - 1] = truncateToWidth(ctx, `${lines[maxLines - 1]}…`, maxWidth);
        return lines;
      }
      line = character.trimStart();
    } else {
      line += character;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

function drawBackground(ctx, coverImg, width, height) {
  if (coverImg) {
    ctx.drawImage(coverImg, 0, 0, width, height);
  } else {
    const fallback = ctx.createLinearGradient(0, 0, width, height);
    fallback.addColorStop(0, '#516a8b');
    fallback.addColorStop(1, '#15243b');
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = 'rgba(7, 13, 24, 0.24)';
  ctx.fillRect(0, 0, width, height);
  const footerShade = ctx.createLinearGradient(0, height - 330, 0, height);
  footerShade.addColorStop(0, 'rgba(5, 10, 20, 0)');
  footerShade.addColorStop(1, 'rgba(5, 10, 20, 0.86)');
  ctx.fillStyle = footerShade;
  ctx.fillRect(0, height - 330, width, 330);
}

function drawReviewPanel(ctx, book, clubName, width, height) {
  const reviews = book.reviews || [];
  const panelWidth = width - 120;
  const panelX = (width - panelWidth) / 2;
  const panelHeight = Math.min(height - 430, Math.max(260, 134 + reviews.length * REVIEW_ROW_HEIGHT));
  const panelY = Math.max(90, Math.round((height - 210 - panelHeight) / 2 + 40));
  const panelBottom = panelY + panelHeight;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(panelX + 14, panelY + 16, panelWidth, panelHeight);
  ctx.fillStyle = '#f8faf9';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(panelX + 4, panelY + 4, panelWidth - 8, panelHeight - 8);

  const titlebar = ctx.createLinearGradient(panelX, 0, panelX + panelWidth, 0);
  titlebar.addColorStop(0, '#5d8090');
  titlebar.addColorStop(1, '#080078');
  ctx.fillStyle = titlebar;
  ctx.fillRect(panelX + 8, panelY + 8, panelWidth - 16, 60);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  const headerSuffix = bookPeriodLabel(book);
  const headerX = panelX + 30;
  const headerWidth = panelWidth - 60;
  let headerFontSize = 26;
  ctx.font = `900 ${headerFontSize}px GalmuriMono11, sans-serif`;
  while (headerFontSize > 18 && ctx.measureText(clubName + headerSuffix).width > headerWidth) {
    headerFontSize -= 1;
    ctx.font = `900 ${headerFontSize}px GalmuriMono11, sans-serif`;
  }
  const headerY = panelY + 25 + (26 - headerFontSize) / 2;
  const suffixWidth = ctx.measureText(headerSuffix).width;
  const displayedClubName = truncateToWidth(ctx, clubName, headerWidth - suffixWidth);
  ctx.fillText(displayedClubName, headerX, headerY);
  ctx.fillText(headerSuffix, headerX + ctx.measureText(displayedClubName).width, headerY);

  const listTop = panelY + 104;
  const listHeight = panelBottom - 30 - listTop;
  if (reviews.length === 0) {
    ctx.fillStyle = '#777777';
    ctx.font = '400 21px GalmuriMono11, sans-serif';
    ctx.fillText('아직 감상평이 없어요.', panelX + 30, listTop + 24);
    return;
  }

  let visibleCount = Math.max(1, Math.floor(listHeight / REVIEW_ROW_HEIGHT));
  if (reviews.length > visibleCount) {
    visibleCount = Math.max(1, Math.floor((listHeight - 34) / REVIEW_ROW_HEIGHT));
  }
  reviews.slice(0, visibleCount).forEach((review, index) => {
    const rowY = listTop + index * REVIEW_ROW_HEIGHT;
    ctx.fillStyle = '#111111';
    ctx.font = '900 21px GalmuriMono11, sans-serif';
    ctx.fillText(truncateToWidth(ctx, review.name || '익명', panelWidth - 250), panelX + 30, rowY);

    ctx.font = '400 19px GalmuriMono11, sans-serif';
    drawStars(ctx, review.rating, panelX + panelWidth - 155, rowY + 1, 19);
    ctx.fillStyle = '#4a4a4a';
    ctx.font = '400 19px GalmuriMono11, sans-serif';
    wrapText(ctx, review.review || '', panelWidth - 60, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, panelX + 30, rowY + 38 + lineIndex * 28);
    });

    if (index < visibleCount - 1) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + 30, rowY + REVIEW_ROW_HEIGHT - 13);
      ctx.lineTo(panelX + panelWidth - 30, rowY + REVIEW_ROW_HEIGHT - 13);
      ctx.stroke();
    }
  });

  if (reviews.length > visibleCount) {
    ctx.fillStyle = '#686868';
    ctx.font = '400 18px GalmuriMono11, sans-serif';
    ctx.fillText(`외 ${reviews.length - visibleCount}개의 감상평이 더 있어요`, panelX + 30, panelBottom - 43);
  }
}

function drawBookCaption(ctx, book, logoImg, width, height) {
  const captionX = 60;
  const captionWidth = width - captionX * 2;
  const logoHeight = 100;
  const logoWidth = logoImg ? logoHeight * logoImg.naturalWidth / logoImg.naturalHeight : 0;
  const detailsWidth = captionWidth - logoWidth - (logoImg ? 24 : 0);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 39px GalmuriMono11, sans-serif';
  const titleLines = wrapText(ctx, book.title || '제목 없음', captionWidth, 2);
  const titleY = height - 160 - titleLines.length * 48;
  titleLines.forEach((line, index) => ctx.fillText(line, captionX, titleY + index * 48));

  ctx.font = '400 26px GalmuriMono11, sans-serif';
  ctx.fillText(truncateToWidth(ctx, book.authors || '저자 정보 없음', detailsWidth), captionX, height - 130);

  const avgRating = Number(book.avgRating) || 0;
  ctx.font = '400 28px GalmuriMono11, sans-serif';
  const starsWidth = drawStars(ctx, avgRating, captionX, height - 76, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(avgRating.toFixed(1), captionX + starsWidth + 18, height - 76);

  if (logoImg) {
    ctx.drawImage(logoImg, width - captionX - logoWidth, height - 144, logoWidth, logoHeight);
  }
}

function drawCard(ctx, book, coverImg, logoImg, clubName, width, height) {
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, coverImg, width, height);
  drawReviewPanel(ctx, book, clubName, width, height);
  drawBookCaption(ctx, book, logoImg, width, height);
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
function renderCard(book, coverImg, logoImg, clubName) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = cardHeight(coverImg);
  const ctx = canvas.getContext('2d');
  drawCard(ctx, book, coverImg, logoImg, clubName, canvas.width, canvas.height);
  return canvas;
}

export async function generateShareCardBlob(book, clubName = '독서모임') {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch (err) {
      // 폰트 로딩 실패는 무시하고 기본 폰트로 진행
    }
  }

  const [coverImg, logoImg] = await Promise.all([
    loadCoverImage(book.thumbnail),
    loadCoverImage(LOGO_URL),
  ]);

  if (coverImg) {
    try {
      return await canvasToBlob(renderCard(book, coverImg, logoImg, clubName));
    } catch (err) {
      // 캔버스 오염(CORS) 등으로 실패 시 표지 이미지 없이 새 캔버스에 재시도
    }
  }

  return canvasToBlob(renderCard(book, null, logoImg, clubName));
}

export async function shareOrDownloadCard(book, clubName) {
  const blob = await generateShareCardBlob(book, clubName);
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
