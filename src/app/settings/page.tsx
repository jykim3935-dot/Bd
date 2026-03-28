'use client';

import { useState, useEffect } from 'react';
import { SEARCH_PRESETS } from '@/lib/types';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const key = localStorage.getItem('ai-monitor-api-key') || '';
    setApiKey(key);
  }, []);

  const handleSave = () => {
    localStorage.setItem('ai-monitor-api-key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearBookmarks = () => {
    if (confirm('저장된 북마크를 모두 삭제하시겠습니까?')) {
      localStorage.removeItem('ai-monitor-bookmarks');
      alert('북마크가 삭제되었습니다.');
    }
  };

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white mb-6">설정</h1>

      {/* API 키 설정 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-white mb-3">
          공공데이터포털 API 키
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          data.go.kr에서 발급받은 API 키를 입력하면 나라장터 실시간 데이터를
          더 정확하게 수집할 수 있습니다.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API 키 입력"
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-500/20 text-green-400'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {saved ? '저장됨' : '저장'}
          </button>
        </div>
      </section>

      {/* 모니터링 소스 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-white mb-3">모니터링 소스</h2>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl divide-y divide-slate-700/50">
          <SourceItem
            label="나라장터 (G2B)"
            description="조달청 전자입찰 AI 관련 공고"
            color="text-blue-400"
          />
          <SourceItem
            label="NTIS"
            description="국가R&D 과제 정보 (과학기술정보통신부)"
            color="text-emerald-400"
          />
          <SourceItem
            label="병원 공고"
            description="주요 대학병원 AI 관련 공고 및 과제"
            color="text-violet-400"
          />
          <SourceItem
            label="KHIDI"
            description="한국보건산업진흥원 AI 보건의료 과제"
            color="text-violet-400"
          />
        </div>
      </section>

      {/* 검색 프리셋 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-white mb-3">
          자동 검색 키워드 프리셋
        </h2>
        <div className="flex flex-wrap gap-2">
          {SEARCH_PRESETS.keywords.map((kw) => (
            <span
              key={kw}
              className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              {kw}
            </span>
          ))}
        </div>
      </section>

      {/* 기관 프리셋 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-white mb-3">
          모니터링 기관 프리셋
        </h2>
        {Object.entries(SEARCH_PRESETS.organizations).map(([source, orgs]) => (
          <div key={source} className="mb-3">
            <p className="text-xs text-slate-400 mb-1.5">
              {source === 'g2b' ? '나라장터' : source === 'ntis' ? 'NTIS' : '병원'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {orgs.map((org) => (
                <span
                  key={org}
                  className="px-2 py-0.5 bg-slate-800/80 text-slate-400 rounded text-[10px]"
                >
                  {org}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 데이터 관리 */}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-white mb-3">데이터 관리</h2>
        <button
          onClick={handleClearBookmarks}
          className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-sm hover:bg-red-500/20 transition-colors"
        >
          북마크 전체 삭제
        </button>
      </section>

      {/* 앱 정보 */}
      <section className="text-center py-6 border-t border-slate-800">
        <p className="text-xs text-slate-500">AI 과제 모니터 v1.0.0</p>
        <p className="text-[10px] text-slate-600 mt-1">
          나라장터 · NTIS · 병원 AI 과제 통합 모니터링
        </p>
      </section>
    </div>
  );
}

function SourceItem({
  label,
  description,
  color,
}: {
  label: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className={`text-sm font-medium ${color}`}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-400" title="활성" />
    </div>
  );
}
