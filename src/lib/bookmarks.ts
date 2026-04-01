'use client';

const STORAGE_KEY = 'ai-monitor-bookmarks';

export function getBookmarks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addBookmark(id: string): void {
  const bookmarks = getBookmarks();
  if (!bookmarks.includes(id)) {
    bookmarks.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }
}

export function removeBookmark(id: string): void {
  const bookmarks = getBookmarks().filter((b) => b !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().includes(id);
}

export function toggleBookmark(id: string): boolean {
  if (isBookmarked(id)) {
    removeBookmark(id);
    return false;
  } else {
    addBookmark(id);
    return true;
  }
}
