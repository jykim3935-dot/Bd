'use client';

import Link from 'next/link';
import { Project } from '@/lib/types';
import Badge from './Badge';
import { toggleBookmark, isBookmarked } from '@/lib/bookmarks';
import { useState } from 'react';

export default function ProjectCard({ project }: { project: Project }) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(project.id));

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleBookmark(project.id);
    setBookmarked(result);
  };

  return (
    <Link href={`/project/${encodeURIComponent(project.id)}`}>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800 transition-colors active:bg-slate-700/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge source={project.source} />
              <span className="text-xs text-slate-400">{project.category}</span>
            </div>
            <h3 className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2">
              {project.title}
            </h3>
            <p className="text-xs text-slate-400 mb-1">{project.organization}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {project.budget !== '미공개' && (
                <span>💰 {project.budget}</span>
              )}
              <span>📅 {project.deadline}</span>
            </div>
          </div>
          <button
            onClick={handleBookmark}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label={bookmarked ? '북마크 해제' : '북마크 추가'}
          >
            {bookmarked ? (
              <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            )}
          </button>
        </div>
        {project.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.keywords.slice(0, 3).map((kw) => (
              <span
                key={kw}
                className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
