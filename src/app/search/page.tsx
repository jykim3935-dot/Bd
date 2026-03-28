'use client';

import { useEffect, useState } from 'react';
import { Project, ProjectSource, SEARCH_PRESETS } from '@/lib/types';
import ProjectCard from '@/components/ProjectCard';
import FilterBar from '@/components/FilterBar';
import SearchInput from '@/components/SearchInput';

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<ProjectSource[]>([]);
  const [dateRange, setDateRange] = useState('all');
  const [searched, setSearched] = useState(false);

  const search = async (searchKeyword?: string) => {
    const kw = searchKeyword || keyword;
    if (!kw.trim() && selectedSources.length === 0) return;

    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (kw.trim()) params.set('keyword', kw.trim());
      if (selectedSources.length > 0) params.set('sources', selectedSources.join(','));
      if (dateRange !== 'all') params.set('dateRange', dateRange);

      const res = await fetch(`/api/projects?${params.toString()}`);
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceToggle = (source: ProjectSource) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  // 키워드 변경 시 디바운스 검색
  useEffect(() => {
    if (!keyword.trim() && selectedSources.length === 0) return;
    const timer = setTimeout(() => search(), 500);
    return () => clearTimeout(timer);
  }, [keyword, selectedSources, dateRange]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white mb-4">검색</h1>

      {/* 검색 입력 */}
      <div className="mb-4">
        <SearchInput value={keyword} onChange={setKeyword} />
      </div>

      {/* 필터 */}
      <div className="mb-4">
        <FilterBar
          selectedSources={selectedSources}
          onSourceToggle={handleSourceToggle}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* 추천 키워드 */}
      {!searched && (
        <div className="mb-6">
          <p className="text-xs text-slate-400 mb-2">추천 검색어</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_PRESETS.keywords.map((kw) => (
              <button
                key={kw}
                onClick={() => {
                  setKeyword(kw);
                  search(kw);
                }}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-full text-xs hover:bg-slate-700 transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
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
      ) : searched ? (
        projects.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">{projects.length}건 검색됨</p>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">검색 결과가 없습니다.</p>
            <p className="text-slate-500 text-xs mt-1">
              다른 키워드로 검색해보세요.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
