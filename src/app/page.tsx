'use client';

import { useEffect, useState } from 'react';
import { Project, ProjectSource } from '@/lib/types';
import ProjectCard from '@/components/ProjectCard';
import FilterBar from '@/components/FilterBar';

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<ProjectSource[]>([]);
  const [dateRange, setDateRange] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSources.length > 0) {
        params.set('sources', selectedSources.join(','));
      }
      if (dateRange !== 'all') {
        params.set('dateRange', dateRange);
      }
      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error('불러오기 실패');
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSources, dateRange]);

  const handleSourceToggle = (source: ProjectSource) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <div className="px-4 pt-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">AI 과제 모니터</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            나라장터 · NTIS · 병원 AI 과제 통합 모니터링
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          aria-label="새로고침"
        >
          <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
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

      {/* 통계 */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">
              {projects.filter((p) => p.source === 'g2b').length}
            </p>
            <p className="text-[10px] text-slate-400">나라장터</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-emerald-400">
              {projects.filter((p) => p.source === 'ntis').length}
            </p>
            <p className="text-[10px] text-slate-400">NTIS</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-amber-400">
              {projects.filter((p) => p.source === 'agency').length}
            </p>
            <p className="text-[10px] text-slate-400">진흥기관</p>
          </div>
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-violet-400">
              {projects.filter((p) => p.source === 'hospital').length}
            </p>
            <p className="text-[10px] text-slate-400">병원</p>
          </div>
        </div>
      )}

      {/* 프로젝트 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-800/50 rounded-xl p-4 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
              <div className="h-4 bg-slate-700 rounded w-full mb-2" />
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          ))}
          <p className="text-center text-sm text-slate-400 mt-4">
            실시간 데이터를 수집하고 있습니다...
          </p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">
            조건에 맞는 AI 과제가 없습니다.
          </p>
          <p className="text-slate-500 text-xs mt-1">
            필터를 변경하거나 나중에 다시 확인해주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            총 {projects.length}건의 AI 관련 과제
          </p>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
