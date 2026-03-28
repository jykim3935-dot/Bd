export type ProjectSource = 'g2b' | 'ntis' | 'hospital';

export interface Project {
  id: string;
  source: ProjectSource;
  title: string;
  organization: string;
  budget: string;
  deadline: string;
  postedDate: string;
  category: string;
  description: string;
  url: string;
  keywords: string[];
}

export interface SourceConfig {
  key: ProjectSource;
  label: string;
  color: string;
  bgColor: string;
}

export const SOURCE_CONFIG: Record<ProjectSource, SourceConfig> = {
  g2b: {
    key: 'g2b',
    label: '나라장터',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  ntis: {
    key: 'ntis',
    label: 'NTIS',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  hospital: {
    key: 'hospital',
    label: '병원',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
  },
};

// 기관 프리셋 - 자동 검색용 키워드
export const SEARCH_PRESETS = {
  keywords: [
    '인공지능', 'AI', '머신러닝', '딥러닝', 'GPT', 'LLM',
    '자연어처리', 'NLP', '컴퓨터비전', '음성인식',
    '챗봇', '생성형AI', '데이터분석', '빅데이터',
  ],
  organizations: {
    g2b: [
      '과학기술정보통신부', '한국지능정보사회진흥원', '정보통신산업진흥원',
      '한국전자통신연구원', '국방부', '교육부', '보건복지부',
      '한국데이터산업진흥원', '소프트웨어정책연구소',
      '한국과학기술원', '국립암센터',
    ],
    ntis: [
      '과학기술정보통신부', '산업통상자원부', '보건복지부',
      '교육부', '국방부', '중소벤처기업부',
      '한국연구재단', '정보통신기획평가원',
    ],
    hospital: [
      '서울대학교병원', '삼성서울병원', '서울아산병원',
      '세브란스병원', '고려대학교병원', '서울성모병원',
      '분당서울대학교병원', '국립암센터', '국립중앙의료원',
      '한림대학교성심병원', '가천대길병원',
    ],
  },
};

export interface SearchFilters {
  keyword: string;
  sources: ProjectSource[];
  dateRange: 'all' | '1week' | '1month' | '3months';
}
