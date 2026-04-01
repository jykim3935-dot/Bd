# AI 과제 모니터링 웹앱

정부/공공기관 AI 관련 과제·입찰 정보를 자동 수집하여 모니터링하는 모바일 최적화 웹 애플리케이션.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS 4 · Cheerio · Vercel

## Structure

- `src/app/page.tsx`              — 대시보드 (프로젝트 목록 + 필터 + 통계)
- `src/app/search/page.tsx`       — 키워드 검색 (프리셋 14개)
- `src/app/bookmarks/page.tsx`    — 북마크 (localStorage)
- `src/app/settings/page.tsx`     — 설정 (API키, 소스 설명)
- `src/app/project/[id]/page.tsx` — 프로젝트 상세
- `src/app/api/projects/route.ts` — 데이터 수집 API (5분 캐시)
- `src/components/`               — Badge, BottomNav, FilterBar, ProjectCard, SearchInput
- `src/lib/types.ts`              — 타입 + 소스 설정 + 검색 프리셋
- `src/lib/api.ts`                — Fetch 유틸
- `src/lib/bookmarks.ts`          — 북마크 관리

## Data Sources (4종)

| 소스 | 키 | 수집 방식 |
|------|----|-----------|
| 나라장터 (G2B) | `g2b` | Cheerio 스크래핑 |
| NTIS | `ntis` | Cheerio 스크래핑 |
| 진흥기관 (12개) | `agency` | 전용 스크래퍼 (NIPA, NIA, IITP, KISA 등) |
| 병원 | `hospital` | Cheerio 스크래핑 |

## Commands

- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npx tsc --noEmit` — 타입 체크

## Key Rules

1. 스크래핑 실패 시 데모 데이터 폴백 — 오프라인에서도 동작 보장.
2. 모바일 퍼스트 — dark theme, 하단 네비게이션, safe-area 대응.
3. 한국어 UI — 모든 텍스트 한국어.
4. 5분 메모리 캐시 — API 응답 캐싱으로 소스 서버 부하 최소화.
5. AI 키워드 필터 — `isAIRelated()` / `isAIRelatedLoose()`로 관련 과제만 수집.
