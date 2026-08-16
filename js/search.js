// js/search.js
export async function searchBooks(query) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('검색 요청 실패');
  const data = await res.json();
  if (!data.items) return [];

  return data.items.map((item) => {
    const info = item.volumeInfo || {};
    return {
      googleBooksId: item.id,
      title: info.title || '제목 없음',
      authors: (info.authors || []).join(', '),
      thumbnail: info.imageLinks ? info.imageLinks.thumbnail : '',
    };
  });
}
