import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Project, ProjectSource, SEARCH_PRESETS } from '@/lib/types';

// 캐시 (메모리, 5분)
let cache: { data: Project[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sourcesParam = searchParams.get('sources');
  const keyword = searchParams.get('keyword');
  const dateRange = searchParams.get('dateRange');
  const id = searchParams.get('id');

  try {
    let projects = await getAllProjects();

    // ID로 단건 조회
    if (id) {
      const project = projects.find((p) => p.id === id);
      return NextResponse.json(project ? [project] : []);
    }

    // 소스 필터
    if (sourcesParam) {
      const sources = sourcesParam.split(',') as ProjectSource[];
      projects = projects.filter((p) => sources.includes(p.source));
    }

    // 키워드 필터
    if (keyword) {
      const kw = keyword.toLowerCase();
      projects = projects.filter(
        (p) =>
          p.title.toLowerCase().includes(kw) ||
          p.organization.toLowerCase().includes(kw) ||
          p.description.toLowerCase().includes(kw) ||
          p.keywords.some((k) => k.toLowerCase().includes(kw))
      );
    }

    // 날짜 필터
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (dateRange) {
        case '1week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1month':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }
      projects = projects.filter((p) => new Date(p.postedDate) >= cutoff);
    }

    // 최신순 정렬
    projects.sort(
      (a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
    );

    return NextResponse.json(projects);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: '데이터를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function getAllProjects(): Promise<Project[]> {
  // 캐시 확인
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  const aiKeywords = SEARCH_PRESETS.keywords.slice(0, 5); // 주요 키워드만

  const results = await Promise.allSettled([
    fetchG2BProjects(aiKeywords),
    fetchNTISProjects(aiKeywords),
    fetchHospitalProjects(aiKeywords),
  ]);

  const projects: Project[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      projects.push(...result.value);
    } else {
      console.error('Source fetch failed:', result.reason);
    }
  }

  cache = { data: projects, timestamp: Date.now() };
  return projects;
}

// ==========================================
// 나라장터 (G2B) 스크래핑
// ==========================================
async function fetchG2BProjects(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const url = `https://www.g2b.go.kr:8101/ep/tbid/tbidList.do?taskClCds=&bidNm=${encodeURIComponent(keyword)}&searchDtType=1&fromBidDt=&toBidDt=&fromOpenBidDt=&toOpenBidDt=&radOrgan=1&dminsttCd=&orgNm=&area=&areaNm=&industry=&industryNm=&budgetCompare=&budgetFrom=&budgetTo=&maxPageViewNoBy498=1&recordCountPerPage=20`;

      const res = await fetchWithTimeout(url, 10000);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      $('table.table_list tbody tr, table.tb_list tbody tr, div.results_list table tr').each((i, el) => {
        const tds = $(el).find('td');
        if (tds.length < 4) return;

        const title = $(tds[1]).text().trim() || $(tds[2]).text().trim();
        const org = $(tds[3]).text().trim() || $(tds[4]).text().trim();

        if (!title || !isAIRelated(title)) return;

        const bidNo = $(tds[0]).text().trim();
        const deadline = $(tds[tds.length - 2]).text().trim();
        const budget = $(tds[tds.length - 3]).text().trim();

        projects.push({
          id: `g2b-${bidNo || i}-${keyword}`,
          source: 'g2b',
          title: title.substring(0, 200),
          organization: org || '미지정',
          budget: budget || '미공개',
          deadline: deadline || '미정',
          postedDate: extractDate(deadline) || new Date().toISOString().split('T')[0],
          category: '입찰공고',
          description: `[나라장터 입찰공고] ${title}`,
          url: `https://www.g2b.go.kr:8101/ep/tbid/tbidList.do?bidNm=${encodeURIComponent(keyword)}`,
          keywords: extractKeywords(title),
        });
      });
    } catch (e) {
      console.error(`G2B fetch error for "${keyword}":`, e);
    }
  }

  // 스크래핑 실패 시 RSS 시도
  if (projects.length === 0) {
    try {
      const rssProjects = await fetchG2BRSS(keywords);
      projects.push(...rssProjects);
    } catch (e) {
      console.error('G2B RSS fallback failed:', e);
    }
  }

  return deduplicateProjects(projects);
}

async function fetchG2BRSS(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];
  // 나라장터 검색 결과를 다른 경로로 시도
  for (const keyword of keywords.slice(0, 2)) {
    try {
      const url = `https://www.g2b.go.kr:8101/ep/tbid/tbidList.do?bidNm=${encodeURIComponent(keyword)}&recordCountPerPage=10&taskClCds=`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) continue;

      const text = await res.text();
      const $ = cheerio.load(text);

      // 다양한 셀렉터 시도
      $('a[href*="tbidDetail"], a[href*="bidDetail"]').each((i, el) => {
        const title = $(el).text().trim();
        if (!title || !isAIRelated(title)) return;

        const href = $(el).attr('href') || '';
        const row = $(el).closest('tr');
        const cells = row.find('td');

        projects.push({
          id: `g2b-rss-${i}-${keyword}`,
          source: 'g2b',
          title: title.substring(0, 200),
          organization: cells.length > 3 ? $(cells[3]).text().trim() : '미지정',
          budget: cells.length > 4 ? $(cells[4]).text().trim() : '미공개',
          deadline: cells.length > 5 ? $(cells[5]).text().trim() : '미정',
          postedDate: new Date().toISOString().split('T')[0],
          category: '입찰공고',
          description: `[나라장터] ${title}`,
          url: href.startsWith('http') ? href : `https://www.g2b.go.kr:8101${href}`,
          keywords: extractKeywords(title),
        });
      });
    } catch (e) {
      console.error('G2B RSS error:', e);
    }
  }
  return projects;
}

// ==========================================
// NTIS 정부 R&D 과제
// ==========================================
async function fetchNTISProjects(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];

  for (const keyword of keywords.slice(0, 3)) {
    try {
      // NTIS 과제검색 페이지
      const url = `https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do`;
      const res = await fetchWithTimeout(url, 10000);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // NTIS 과제 목록 파싱
      $('table tbody tr, .search-result-item, .list-item').each((i, el) => {
        const title = $(el).find('a, .title, td:nth-child(2)').first().text().trim();
        if (!title || !isAIRelated(title)) return;

        const org = $(el).find('.org, td:nth-child(3), .agency').first().text().trim();
        const period = $(el).find('.period, td:nth-child(4)').first().text().trim();
        const budget = $(el).find('.budget, td:nth-child(5)').first().text().trim();

        projects.push({
          id: `ntis-${i}-${keyword}`,
          source: 'ntis',
          title: title.substring(0, 200),
          organization: org || '미지정',
          budget: budget || '미공개',
          deadline: period || '미정',
          postedDate: extractDate(period) || new Date().toISOString().split('T')[0],
          category: 'R&D과제',
          description: `[NTIS 국가R&D과제] ${title}`,
          url: `https://www.ntis.go.kr/rndgate/eg/un/ra/mng.do`,
          keywords: extractKeywords(title),
        });
      });
    } catch (e) {
      console.error(`NTIS fetch error for "${keyword}":`, e);
    }
  }

  // NTIS API 시도 (공개 API)
  if (projects.length === 0) {
    try {
      const apiProjects = await fetchNTISAPI(keywords);
      projects.push(...apiProjects);
    } catch (e) {
      console.error('NTIS API fallback failed:', e);
    }
  }

  return deduplicateProjects(projects);
}

async function fetchNTISAPI(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];
  // NTIS 공개 검색 API
  for (const keyword of keywords.slice(0, 2)) {
    try {
      const url = `https://www.ntis.go.kr/ThSearchSvc/selectTotalSearch.do?searchWord=${encodeURIComponent(keyword)}&searchField=ALL&pageSize=10`;
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) continue;

      const text = await res.text();
      // JSON 응답인 경우
      try {
        const data = JSON.parse(text);
        const items = data.items || data.result || data.data || [];
        for (const item of (Array.isArray(items) ? items : [])) {
          const title = item.title || item.rndPrjtNm || item.name || '';
          if (!isAIRelated(title)) continue;

          projects.push({
            id: `ntis-api-${item.id || projects.length}`,
            source: 'ntis',
            title: title.substring(0, 200),
            organization: item.org || item.instNm || '미지정',
            budget: item.budget || item.govFnd || '미공개',
            deadline: item.period || item.prdEnd || '미정',
            postedDate: item.date || item.prdStart || new Date().toISOString().split('T')[0],
            category: 'R&D과제',
            description: item.description || `[NTIS] ${title}`,
            url: item.url || `https://www.ntis.go.kr`,
            keywords: extractKeywords(title),
          });
        }
      } catch {
        // HTML 응답인 경우 cheerio로 파싱
        const $ = cheerio.load(text);
        $('a, .result-title').each((i, el) => {
          const title = $(el).text().trim();
          if (!isAIRelated(title)) return;
          projects.push({
            id: `ntis-html-${i}`,
            source: 'ntis',
            title: title.substring(0, 200),
            organization: '미지정',
            budget: '미공개',
            deadline: '미정',
            postedDate: new Date().toISOString().split('T')[0],
            category: 'R&D과제',
            description: `[NTIS] ${title}`,
            url: 'https://www.ntis.go.kr',
            keywords: extractKeywords(title),
          });
        });
      }
    } catch (e) {
      console.error('NTIS API error:', e);
    }
  }
  return projects;
}

// ==========================================
// 병원 AI 과제
// ==========================================
async function fetchHospitalProjects(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];

  const hospitalSites = [
    {
      name: '서울대학교병원',
      url: 'https://www.snuh.org/board/B003/list.do',
      detailBase: 'https://www.snuh.org',
    },
    {
      name: '삼성서울병원',
      url: 'https://www.samsunghospital.com/home/reservation/noticeList.do',
      detailBase: 'https://www.samsunghospital.com',
    },
    {
      name: '서울아산병원',
      url: 'https://www.amc.seoul.kr/asan/hospital/notice/noticeList.do',
      detailBase: 'https://www.amc.seoul.kr',
    },
    {
      name: '세브란스병원',
      url: 'https://sev.severance.healthcare/sev/index.do',
      detailBase: 'https://sev.severance.healthcare',
    },
  ];

  for (const hospital of hospitalSites) {
    try {
      const res = await fetchWithTimeout(hospital.url, 8000);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // 일반적인 게시판 구조 파싱
      $('table tbody tr, .board-list li, .notice-list li, ul.list li').each(
        (i, el) => {
          const titleEl = $(el).find('a, .title, .subject').first();
          const title = titleEl.text().trim();
          if (!title || !isAIRelated(title)) return;

          const href = titleEl.attr('href') || '';
          const date = $(el).find('.date, .day, td:last-child').first().text().trim();

          projects.push({
            id: `hospital-${hospital.name}-${i}`,
            source: 'hospital',
            title: title.substring(0, 200),
            organization: hospital.name,
            budget: '미공개',
            deadline: date || '미정',
            postedDate: extractDate(date) || new Date().toISOString().split('T')[0],
            category: '병원공고',
            description: `[${hospital.name}] ${title}`,
            url: href.startsWith('http')
              ? href
              : `${hospital.detailBase}${href}`,
            keywords: extractKeywords(title),
          });
        }
      );
    } catch (e) {
      console.error(`Hospital fetch error (${hospital.name}):`, e);
    }
  }

  // 추가: KHIDI(한국보건산업진흥원) AI 관련 과제
  try {
    const khidiProjects = await fetchKHIDI(keywords);
    projects.push(...khidiProjects);
  } catch (e) {
    console.error('KHIDI fetch failed:', e);
  }

  return deduplicateProjects(projects);
}

async function fetchKHIDI(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];
  try {
    const url = 'https://www.khidi.or.kr/board/list?menuId=MENU00085&siteId=SITE00002';
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return projects;

    const html = await res.text();
    const $ = cheerio.load(html);

    $('table tbody tr, .board-list li').each((i, el) => {
      const title = $(el).find('a, .title').first().text().trim();
      if (!title || !isAIRelated(title)) return;

      const date = $(el).find('.date, td:last-child').first().text().trim();
      const href = $(el).find('a').first().attr('href') || '';

      projects.push({
        id: `khidi-${i}`,
        source: 'hospital',
        title: title.substring(0, 200),
        organization: '한국보건산업진흥원',
        budget: '미공개',
        deadline: date || '미정',
        postedDate: extractDate(date) || new Date().toISOString().split('T')[0],
        category: '보건산업과제',
        description: `[한국보건산업진흥원] ${title}`,
        url: href.startsWith('http') ? href : `https://www.khidi.or.kr${href}`,
        keywords: extractKeywords(title),
      });
    });
  } catch (e) {
    console.error('KHIDI error:', e);
  }
  return projects;
}

// ==========================================
// 유틸리티
// ==========================================
function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  return fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  }).finally(() => clearTimeout(id));
}

function isAIRelated(text: string): boolean {
  const aiTerms = [
    '인공지능', 'AI', 'ai', '머신러닝', '딥러닝', 'GPT', 'LLM',
    '자연어처리', 'NLP', '컴퓨터비전', '음성인식', '챗봇',
    '생성형', '데이터분석', '빅데이터', '기계학습', '신경망',
    'machine learning', 'deep learning', 'artificial intelligence',
    '지능형', '스마트', '자율주행', '로봇', 'ICT', '디지털전환',
    '클라우드', '메타버스', '디지털트윈',
  ];
  const lower = text.toLowerCase();
  return aiTerms.some((term) => lower.includes(term.toLowerCase()));
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const terms = [
    '인공지능', 'AI', '머신러닝', '딥러닝', 'GPT', 'LLM',
    '자연어처리', 'NLP', '컴퓨터비전', '음성인식', '챗봇',
    '빅데이터', '클라우드', '디지털전환', '로봇', '자율주행',
  ];
  for (const term of terms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      keywords.push(term);
    }
  }
  return keywords;
}

function extractDate(text: string): string | null {
  if (!text) return null;
  // YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY/MM/DD
  const match = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return null;
}

function deduplicateProjects(projects: Project[]): Project[] {
  const seen = new Set<string>();
  return projects.filter((p) => {
    const key = `${p.source}-${p.title.substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
