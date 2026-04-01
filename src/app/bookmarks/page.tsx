'use client';

import { useEffect, useState } from 'react';
import { Project } from '@/lib/types';
import { getBookmarks } from '@/lib/bookmarks';
import ProjectCard from '@/components/ProjectCard';

export default function BookmarksPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBookmarks = async () => {
      const ids = getBookmarks();
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/projects');
        const allProjects: Project[] = await res.json();
        const bookmarked = allProjects.filter((p) => ids.includes(p.id));
        setProjects(bookmarked);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadBookmarks();
  }, []);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white mb-4">북마크</h1>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
              <div className="h-4 bg-slate-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-slate-400 text-sm">저장된 과제가 없습니다.</p>
          <p className="text-slate-500 text-xs mt-1">
            관심 과제의 ★ 버튼을 눌러 저장하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{projects.length}개 저장됨</p>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
