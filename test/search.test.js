import assert from 'node:assert/strict';
import test from 'node:test';
import { searchBooks } from '../js/search.js';

const originalFetch = globalThis.fetch;
const originalBookSearchConfig = globalThis.bookSearchConfig;

function mockResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBookSearchConfig === undefined) {
    delete globalThis.bookSearchConfig;
  } else {
    globalThis.bookSearchConfig = originalBookSearchConfig;
  }
});

test('searchBooks: Google Books API로 책 검색', async () => {
  let requestedUrl = '';
  globalThis.bookSearchConfig = { googleBooksApiKey: 'test-google-key' };
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return mockResponse(200, {
      items: [{
        id: 'google-1',
        volumeInfo: {
          title: '싯다르타',
          authors: ['헤르만 헤세'],
          publisher: '민음사',
          publishedDate: '2002-01-01',
          industryIdentifiers: [
            { type: 'ISBN_10', identifier: '8937460588' },
            { type: 'ISBN_13', identifier: '9788937460581' },
          ],
          imageLinks: {
            thumbnail: 'http://example.com/google-cover.jpg',
          },
          infoLink: 'https://books.google.com/books?id=google-1',
        },
      }],
    });
  };

  const results = await searchBooks('싯다르타');

  assert.equal(results.length, 1);
  assert.equal(results[0].googleBooksId, 'google-1');
  assert.equal(results[0].title, '싯다르타');
  assert.equal(results[0].authors, '헤르만 헤세');
  assert.equal(results[0].publisher, '민음사');
  assert.equal(results[0].publishedDate, '2002-01-01');
  assert.equal(results[0].isbn, '9788937460581');
  assert.equal(results[0].thumbnail, 'https://example.com/google-cover.jpg');
  assert.match(requestedUrl, /www\.googleapis\.com\/books\/v1\/volumes/);
  assert.match(requestedUrl, /q=/);
  assert.match(requestedUrl, /maxResults=12/);
  assert.match(requestedUrl, /printType=books/);
  assert.match(requestedUrl, /key=test-google-key/);
});

test('searchBooks: 표지는 smallThumbnail도 사용', async () => {
  globalThis.bookSearchConfig = { googleBooksApiKey: 'test-google-key' };
  globalThis.fetch = async () => mockResponse(200, {
    items: [{
      id: 'google-2',
      volumeInfo: {
        title: '데미안',
        authors: ['Hermann Hesse'],
        imageLinks: {
          smallThumbnail: 'http://example.com/small.jpg',
        },
      },
    }],
  });

  const results = await searchBooks('데미안');

  assert.equal(results.length, 1);
  assert.equal(results[0].thumbnail, 'https://example.com/small.jpg');
});

test('searchBooks: 검색어가 비어 있으면 요청하지 않음', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return mockResponse(200, {});
  };

  const results = await searchBooks('   ');

  assert.equal(fetchCalled, false);
  assert.deepEqual(results, []);
});

test('searchBooks: 저자와 표지가 모두 없는 결과는 제외', async () => {
  globalThis.bookSearchConfig = { googleBooksApiKey: 'test-google-key' };
  globalThis.fetch = async () => mockResponse(200, {
    items: [{
      id: 'empty-google',
      volumeInfo: { title: '껍데기 결과' },
    }],
  });

  const results = await searchBooks('껍데기 결과');

  assert.deepEqual(results, []);
});
