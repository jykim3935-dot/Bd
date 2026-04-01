import { Project, ProjectSource, SEARCH_PRESETS } from './types';

const BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

export async function fetchProjects(
  sources?: ProjectSource[],
  keyword?: string,
  dateRange?: string
): Promise<Project[]> {
  const params = new URLSearchParams();
  if (sources && sources.length > 0) {
    params.set('sources', sources.join(','));
  }
  if (keyword) {
    params.set('keyword', keyword);
  }
  if (dateRange && dateRange !== 'all') {
    params.set('dateRange', dateRange);
  }

  const res = await fetch(`${BASE_URL}/api/projects?${params.toString()}`, {
    next: { revalidate: 300 }, // 5분 캐시
  });

  if (!res.ok) {
    throw new Error('데이터를 불러오는데 실패했습니다.');
  }

  return res.json();
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  const res = await fetch(`${BASE_URL}/api/projects?id=${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] || null : data;
}

export function getDefaultKeywords(): string[] {
  return SEARCH_PRESETS.keywords;
}
