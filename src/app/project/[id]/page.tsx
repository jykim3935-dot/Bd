'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project } from '@/lib/types';
import Badge from '@/components/Badge';
import { toggleBookmark, isBookmarked } from '@/lib/bookmarks';

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const id = decodeURIComponent(params.id as string);
    fetch(`/api/projects?id=${encodeURIComponent(id)}`)
      .then((res) => res.json())
      .then((data) => {
        const p = Array.isArray(data) ? data[0] : data;
        setProject(p || null);
        if (p) setBookmarked(isBookmarked(p.id));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleBookmark = () => {
    if (!project) return;
    const result = toggleBookmark(project.id);
    setBookmarked(result);
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3 mb-4" />
        <div className="h-8 bg-slate-700 rounded w-full mb-3" />
        <div className="h-4 bg-slate-700 rounded w-2/3 mb-6" />
        <div className="space-y-3">
          <div className="h-4 bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-700 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="px-4 pt-6 text-center">
        <p className="text-slate-400">과제를 찾을 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      {/* 뒤로가기 */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </button>

      {/* 소스 뱃지 */}
      <div className="flex items-center gap-2 mb-3">
        <Badge source={project.source} />
        <span className="text-xs text-slate-400">{project.category}</span>
      </div>

      {/* 제목 */}
      <h1 className="text-lg font-bold text-white leading-snug mb-4">
        {project.title}
      </h1>

      {/* 상세 정보 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-4 space-y-3">
        <InfoRow label="발주기관" value={project.organization} />
        <InfoRow label="예산" value={project.budget} />
        <InfoRow label="마감일" value={project.deadline} />
        <InfoRow label="등록일" value={project.postedDate} />
      </div>

      {/* 설명 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-4">
        <h2 className="text-sm font-medium text-white mb-2">상세 내용</h2>
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {project.description}
        </p>
      </div>

      {/* 키워드 */}
      {project.keywords.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-medium text-white mb-2">관련 키워드</h2>
          <div className="flex flex-wrap gap-2">
            {project.keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 mt-6">
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          원문 보기
        </a>
        <button
          onClick={handleBookmark}
          className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
            bookmarked
              ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {bookmarked ? '★ 저장됨' : '☆ 저장'}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start">
      <span className="text-xs text-slate-400 w-16 flex-shrink-0">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}
