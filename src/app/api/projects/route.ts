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
    fetchAgencyProjects(aiKeywords),
  ]);

  const projects: Project[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      projects.push(...result.value);
    } else {
      console.error('Source fetch failed:', result.reason);
    }
  }

  // 스크래핑 결과가 없으면 데모 데이터로 폴백 (네트워크 차단 환경 대응)
  if (projects.length === 0) {
    return getFallbackDemoData();
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
// 진흥기관 (NIPA, NIA, IITP, KISA 등)
// ==========================================
async function fetchAgencyProjects(keywords: string[]): Promise<Project[]> {
  const projects: Project[] = [];

  const agencies = [
    // NIPA (정보통신산업진흥원)
    {
      name: 'NIPA(정보통신산업진흥원)',
      urls: [
        'https://www.nipa.kr/main/selectBbsList.do?bbsId=BBS_0000006',
        'https://www.nipa.kr/main/selectBbsList.do?bbsId=BBS_0000005',
      ],
      detailBase: 'https://www.nipa.kr',
      category: 'ICT사업공고',
    },
    // NIA (한국지능정보사회진흥원)
    {
      name: 'NIA(한국지능정보사회진흥원)',
      urls: [
        'https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=82615',
      ],
      detailBase: 'https://www.nia.or.kr',
      category: 'AI사업공고',
    },
    // IITP (정보통신기획평가원)
    {
      name: 'IITP(정보통신기획평가원)',
      urls: [
        'https://www.iitp.kr/kr/1/business/businessNotice/list.it',
      ],
      detailBase: 'https://www.iitp.kr',
      category: 'R&D사업공고',
    },
    // KISA (한국인터넷진흥원)
    {
      name: 'KISA(한국인터넷진흥원)',
      urls: [
        'https://www.kisa.or.kr/401',
      ],
      detailBase: 'https://www.kisa.or.kr',
      category: '보안·AI사업공고',
    },
    // KDATA (한국데이터산업진흥원)
    {
      name: 'KDATA(한국데이터산업진흥원)',
      urls: [
        'https://www.kdata.or.kr/board/list.do?boardId=notice',
      ],
      detailBase: 'https://www.kdata.or.kr',
      category: '데이터사업공고',
    },
    // NRF (한국연구재단)
    {
      name: 'NRF(한국연구재단)',
      urls: [
        'https://www.nrf.re.kr/biz/list?menu_no=378',
      ],
      detailBase: 'https://www.nrf.re.kr',
      category: '연구사업공고',
    },
    // KOCCA (한국콘텐츠진흥원)
    {
      name: 'KOCCA(한국콘텐츠진흥원)',
      urls: [
        'https://www.kocca.kr/kocca/bbs/list/B0000147/1835258_1977.do',
      ],
      detailBase: 'https://www.kocca.kr',
      category: '콘텐츠사업공고',
    },
    // ETRI (한국전자통신연구원)
    {
      name: 'ETRI(한국전자통신연구원)',
      urls: [
        'https://www.etri.re.kr/kor/sub6/sub6_0401.etri',
      ],
      detailBase: 'https://www.etri.re.kr',
      category: 'ICT R&D공고',
    },
    // KIAT (한국산업기술진흥원)
    {
      name: 'KIAT(한국산업기술진흥원)',
      urls: [
        'https://www.kiat.or.kr/front/board/boardList.do?board_id=BOARD_00063',
      ],
      detailBase: 'https://www.kiat.or.kr',
      category: '산업기술사업공고',
    },
    // KEIT (한국산업기술평가관리원)
    {
      name: 'KEIT(한국산업기술평가관리원)',
      urls: [
        'https://www.keit.re.kr/board/list.do?boardId=NOTICE',
      ],
      detailBase: 'https://www.keit.re.kr',
      category: '산업기술평가공고',
    },
    // KISTI (한국과학기술정보연구원)
    {
      name: 'KISTI(한국과학기술정보연구원)',
      urls: [
        'https://www.kisti.re.kr/post/news-notice',
      ],
      detailBase: 'https://www.kisti.re.kr',
      category: '과학기술정보공고',
    },
    // KITECH (한국생산기술연구원)
    {
      name: 'KITECH(한국생산기술연구원)',
      urls: [
        'https://www.kitech.re.kr/main/board/list.do?boardId=BBS_0000015',
      ],
      detailBase: 'https://www.kitech.re.kr',
      category: '생산기술공고',
    },
  ];

  const agencyResults = await Promise.allSettled(
    agencies.map((agency) => fetchSingleAgency(agency))
  );

  for (const result of agencyResults) {
    if (result.status === 'fulfilled') {
      projects.push(...result.value);
    }
  }

  return deduplicateProjects(projects);
}

async function fetchSingleAgency(agency: {
  name: string;
  urls: string[];
  detailBase: string;
  category: string;
}): Promise<Project[]> {
  const projects: Project[] = [];

  for (const url of agency.urls) {
    try {
      const res = await fetchWithTimeout(url, 10000);
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      // 다양한 게시판 구조에 대응하는 셀렉터
      const selectors = [
        'table tbody tr',
        '.board-list li',
        '.bbs-list li',
        '.notice-list li',
        'ul.list-body li',
        '.list-wrap li',
        '.tbl_list tbody tr',
        '.board_list tbody tr',
        'div.list-item',
        '.post-list li',
        '.data-list li',
      ];

      const combinedSelector = selectors.join(', ');

      $(combinedSelector).each((i, el) => {
        const titleEl = $(el).find(
          'a, .title, .subject, .ttl, td.subject a, td:nth-child(2) a, .board-title'
        ).first();
        const title = titleEl.text().trim().replace(/\s+/g, ' ');

        if (!title || title.length < 5) return;
        if (!isAIRelated(title)) return;

        const href = titleEl.attr('href') || '';
        const dateEl = $(el).find(
          '.date, .day, .regist-day, td:last-child, td.date, .write-date, time'
        ).first();
        const date = dateEl.text().trim();

        // 예산 정보 추출 시도
        const fullText = $(el).text();
        const budgetMatch = fullText.match(
          /(\d{1,3}[,.]?\d{0,3})\s*(억|백만|만)\s*원/
        );
        const budget = budgetMatch ? `${budgetMatch[1]}${budgetMatch[2]}원` : '미공개';

        projects.push({
          id: `agency-${agency.name}-${i}`,
          source: 'agency',
          title: title.substring(0, 200),
          organization: agency.name,
          budget,
          deadline: date || '미정',
          postedDate: extractDate(date) || new Date().toISOString().split('T')[0],
          category: agency.category,
          description: `[${agency.name}] ${title}`,
          url: href.startsWith('http')
            ? href
            : href.startsWith('/')
              ? `${agency.detailBase}${href}`
              : `${agency.detailBase}/${href}`,
          keywords: extractKeywords(title),
        });
      });
    } catch (e) {
      console.error(`Agency fetch error (${agency.name}):`, e);
    }
  }

  return projects;
}

// ==========================================
// 폴백 데모 데이터
// ==========================================
function getFallbackDemoData(): Project[] {
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    // 나라장터
    {
      id: 'g2b-demo-1',
      source: 'g2b',
      title: '2026년 인공지능 기반 행정서비스 고도화 사업',
      organization: '행정안전부',
      budget: '25억원',
      deadline: nextMonth,
      postedDate: today,
      category: '입찰공고',
      description: '[나라장터 입찰공고] 행정업무 자동화를 위한 AI 기반 행정서비스 플랫폼 고도화 및 생성형AI 도입',
      url: 'https://www.g2b.go.kr',
      keywords: ['인공지능', 'AI', '생성형AI'],
    },
    {
      id: 'g2b-demo-2',
      source: 'g2b',
      title: '국방 AI 영상분석 시스템 구축 사업',
      organization: '국방부',
      budget: '42억원',
      deadline: nextMonth,
      postedDate: twoDaysAgo,
      category: '입찰공고',
      description: '[나라장터 입찰공고] 국방 분야 딥러닝 기반 영상 분석 및 이상탐지 시스템 구축',
      url: 'https://www.g2b.go.kr',
      keywords: ['AI', '딥러닝', '컴퓨터비전'],
    },
    {
      id: 'g2b-demo-3',
      source: 'g2b',
      title: '공공 빅데이터 분석 플랫폼 운영 용역',
      organization: '한국지능정보사회진흥원',
      budget: '18억원',
      deadline: nextMonth,
      postedDate: threeDaysAgo,
      category: '입찰공고',
      description: '[나라장터 입찰공고] 공공부문 빅데이터 분석 및 AI 활용 지원 플랫폼 운영',
      url: 'https://www.g2b.go.kr',
      keywords: ['빅데이터', 'AI', '데이터분석'],
    },
    {
      id: 'g2b-demo-4',
      source: 'g2b',
      title: '스마트시티 자율주행 실증사업 용역',
      organization: '국토교통부',
      budget: '35억원',
      deadline: nextMonth,
      postedDate: fiveDaysAgo,
      category: '입찰공고',
      description: '[나라장터 입찰공고] 스마트시티 자율주행 인프라 구축 및 AI 교통관제 시스템 실증',
      url: 'https://www.g2b.go.kr',
      keywords: ['자율주행', 'AI', '스마트'],
    },
    // NTIS
    {
      id: 'ntis-demo-1',
      source: 'ntis',
      title: '초거대 AI 모델 경량화 및 온디바이스 추론 기술 개발',
      organization: '과학기술정보통신부',
      budget: '120억원 (3년)',
      deadline: nextMonth,
      postedDate: today,
      category: 'R&D과제',
      description: '[NTIS 국가R&D과제] 초거대 언어모델(LLM)의 경량화 기술 및 엣지 디바이스 추론 최적화 연구',
      url: 'https://www.ntis.go.kr',
      keywords: ['AI', 'LLM', '딥러닝'],
    },
    {
      id: 'ntis-demo-2',
      source: 'ntis',
      title: 'AI 기반 신약 후보물질 발굴 플랫폼 구축',
      organization: '보건복지부',
      budget: '85억원 (5년)',
      deadline: nextMonth,
      postedDate: twoDaysAgo,
      category: 'R&D과제',
      description: '[NTIS 국가R&D과제] 머신러닝·딥러닝을 활용한 신약 후보물질 스크리닝 및 독성 예측 플랫폼',
      url: 'https://www.ntis.go.kr',
      keywords: ['AI', '머신러닝', '딥러닝'],
    },
    {
      id: 'ntis-demo-3',
      source: 'ntis',
      title: '자연어처리 기반 법률 AI 서비스 기술 연구',
      organization: '정보통신기획평가원',
      budget: '30억원 (2년)',
      deadline: nextMonth,
      postedDate: fiveDaysAgo,
      category: 'R&D과제',
      description: '[NTIS 국가R&D과제] 한국어 특화 법률 NLP 모델 및 자동 판례 분석 기술 개발',
      url: 'https://www.ntis.go.kr',
      keywords: ['자연어처리', 'NLP', 'AI'],
    },
    // 진흥기관
    {
      id: 'agency-nipa-demo-1',
      source: 'agency',
      title: '2026년 AI 바우처 지원사업 공고',
      organization: 'NIPA(정보통신산업진흥원)',
      budget: '200억원',
      deadline: nextMonth,
      postedDate: today,
      category: 'ICT사업공고',
      description: '[NIPA] 중소·중견기업 대상 인공지능 솔루션 도입을 위한 AI 바우처 지원사업',
      url: 'https://www.nipa.kr',
      keywords: ['AI', '인공지능'],
    },
    {
      id: 'agency-nia-demo-1',
      source: 'agency',
      title: 'AI 학습용 데이터 구축 사업(2차)',
      organization: 'NIA(한국지능정보사회진흥원)',
      budget: '350억원',
      deadline: nextMonth,
      postedDate: twoDaysAgo,
      category: 'AI사업공고',
      description: '[NIA] 한국어 AI 학습용 데이터 구축 및 데이터 품질관리 체계 고도화',
      url: 'https://www.nia.or.kr',
      keywords: ['AI', '인공지능', '빅데이터'],
    },
    {
      id: 'agency-iitp-demo-1',
      source: 'agency',
      title: '차세대 지능형 반도체 설계 핵심기술 개발',
      organization: 'IITP(정보통신기획평가원)',
      budget: '150억원 (5년)',
      deadline: nextMonth,
      postedDate: threeDaysAgo,
      category: 'R&D사업공고',
      description: '[IITP] AI 반도체 설계 자동화 및 뉴로모픽 컴퓨팅 핵심기술 개발',
      url: 'https://www.iitp.kr',
      keywords: ['AI', '인공지능'],
    },
    {
      id: 'agency-kisa-demo-1',
      source: 'agency',
      title: 'AI 기반 사이버보안 위협 탐지 기술 개발',
      organization: 'KISA(한국인터넷진흥원)',
      budget: '40억원 (3년)',
      deadline: nextMonth,
      postedDate: threeDaysAgo,
      category: '보안·AI사업공고',
      description: '[KISA] AI를 활용한 지능형 사이버 위협 실시간 탐지 및 대응 시스템 구축',
      url: 'https://www.kisa.or.kr',
      keywords: ['AI', '인공지능'],
    },
    {
      id: 'agency-kdata-demo-1',
      source: 'agency',
      title: '데이터 기반 AI 서비스 실증 지원사업',
      organization: 'KDATA(한국데이터산업진흥원)',
      budget: '50억원',
      deadline: nextMonth,
      postedDate: fiveDaysAgo,
      category: '데이터사업공고',
      description: '[KDATA] 공공·민간 데이터 결합 활용 AI 서비스 실증 및 사업화 지원',
      url: 'https://www.kdata.or.kr',
      keywords: ['AI', '빅데이터', '데이터분석'],
    },
    {
      id: 'agency-kocca-demo-1',
      source: 'agency',
      title: '생성형AI 활용 콘텐츠 제작 지원사업',
      organization: 'KOCCA(한국콘텐츠진흥원)',
      budget: '30억원',
      deadline: nextMonth,
      postedDate: fiveDaysAgo,
      category: '콘텐츠사업공고',
      description: '[KOCCA] 생성형 AI를 활용한 영상·음악·웹툰 등 콘텐츠 제작 기업 지원',
      url: 'https://www.kocca.kr',
      keywords: ['AI', '생성형AI'],
    },
    // 병원
    {
      id: 'hospital-demo-1',
      source: 'hospital',
      title: 'AI 기반 의료영상 판독 보조 시스템 도입',
      organization: '서울대학교병원',
      budget: '12억원',
      deadline: nextMonth,
      postedDate: today,
      category: '병원공고',
      description: '[서울대학교병원] X-ray, CT, MRI 영상 AI 자동판독 보조 시스템 구축 및 운영',
      url: 'https://www.snuh.org',
      keywords: ['AI', '인공지능', '딥러닝'],
    },
    {
      id: 'hospital-demo-2',
      source: 'hospital',
      title: '스마트병원 구축을 위한 AI 음성인식 전자차트 시스템',
      organization: '삼성서울병원',
      budget: '8억원',
      deadline: nextMonth,
      postedDate: threeDaysAgo,
      category: '병원공고',
      description: '[삼성서울병원] 진료현장 음성인식 AI 기반 전자의무기록(EMR) 자동 작성 시스템',
      url: 'https://www.samsunghospital.com',
      keywords: ['AI', '음성인식', '스마트'],
    },
    {
      id: 'hospital-demo-3',
      source: 'hospital',
      title: 'AI 기반 패혈증 조기경보 시스템 연구',
      organization: '서울아산병원',
      budget: '5억원',
      deadline: nextMonth,
      postedDate: fiveDaysAgo,
      category: '병원공고',
      description: '[서울아산병원] 머신러닝 기반 패혈증 조기 예측 및 경보 알고리즘 개발 연구',
      url: 'https://www.amc.seoul.kr',
      keywords: ['AI', '머신러닝'],
    },
    {
      id: 'hospital-khidi-demo-1',
      source: 'hospital',
      title: '디지털 헬스케어 AI 의료기기 임상지원 사업',
      organization: '한국보건산업진흥원',
      budget: '60억원',
      deadline: nextMonth,
      postedDate: lastWeek,
      category: '보건산업과제',
      description: '[KHIDI] AI 기반 디지털 치료기기 및 SaMD 임상시험 지원 사업',
      url: 'https://www.khidi.or.kr',
      keywords: ['AI', '인공지능', '디지털전환'],
    },
  ];
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
