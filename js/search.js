// js/search.js

const DEFAULT_GOOGLE_BOOKS_API_KEY = 'AIzaSyDUvMisEvkvsTJRGdjt1aspeeJ9q5DiP9w';

function createRequestError(response) {
  const error = new Error(`검색 요청 실패: ${response.status}`);
  error.status = response.status;
  return error;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw createRequestError(res);
  return res.json();
}

function normalizeImageUrl(url = '') {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed.replace(/^http:/, 'https:');
}

function getGoogleBooksApiKey() {
  return globalThis.bookSearchConfig?.googleBooksApiKey
    || globalThis.localStorage?.getItem('googleBooksApiKey')
    || DEFAULT_GOOGLE_BOOKS_API_KEY;
}

function createGoogleBooksUrl(query) {
  const params = new URLSearchParams({
    q: query,
    maxResults: '12',
    printType: 'books',
    projection: 'lite',
    source: 'reading-club',
  });

  const apiKey = getGoogleBooksApiKey();
  if (apiKey) params.set('key', apiKey);

  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

function getIsbn(info = {}) {
  const identifiers = info.industryIdentifiers || [];
  const isbn13 = identifiers.find((entry) => entry.type === 'ISBN_13')?.identifier;
  const isbn10 = identifiers.find((entry) => entry.type === 'ISBN_10')?.identifier;
  return isbn13 || isbn10 || '';
}

function mapGoogleBooks(data) {
  return (data.items || [])
    .map((item) => {
      const info = item.volumeInfo || {};
      return {
        googleBooksId: item.id,
        googleBooksUrl: info.infoLink || '',
        isbn: getIsbn(info),
        title: info.title || '제목 없음',
        authors: (info.authors || []).join(', '),
        publisher: info.publisher || '',
        publishedDate: info.publishedDate || '',
        thumbnail: normalizeImageUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail),
      };
    })
    .filter((book) => book.authors || book.thumbnail);
}

export async function searchBooks(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const data = await fetchJson(createGoogleBooksUrl(trimmed));
  return mapGoogleBooks(data);
}
