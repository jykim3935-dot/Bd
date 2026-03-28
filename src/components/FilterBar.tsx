'use client';

import { ProjectSource, SOURCE_CONFIG } from '@/lib/types';

interface FilterBarProps {
  selectedSources: ProjectSource[];
  onSourceToggle: (source: ProjectSource) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const dateOptions = [
  { value: 'all', label: '전체' },
  { value: '1week', label: '1주' },
  { value: '1month', label: '1개월' },
  { value: '3months', label: '3개월' },
];

export default function FilterBar({
  selectedSources,
  onSourceToggle,
  dateRange,
  onDateRangeChange,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      {/* 소스 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {Object.values(SOURCE_CONFIG).map((config) => {
          const isSelected = selectedSources.includes(config.key);
          return (
            <button
              key={config.key}
              onClick={() => onSourceToggle(config.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? `${config.bgColor} ${config.color} ring-1 ring-current`
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {config.label}
            </button>
          );
        })}
      </div>

      {/* 날짜 필터 */}
      <div className="flex gap-2">
        {dateOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onDateRangeChange(opt.value)}
            className={`px-3 py-1 rounded-lg text-xs transition-all ${
              dateRange === opt.value
                ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
