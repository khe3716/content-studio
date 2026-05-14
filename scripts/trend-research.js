// 네이버 데이터랩 + 구글 트렌드 기반 경제·재테크 키워드 자동 추출
//
// 사용법:
//   node scripts/trend-research.js              # 키워드 추출만 (JSON 출력)
//   node scripts/trend-research.js --count 5    # Top N 키워드
//   node scripts/trend-research.js --debug      # 디버그 로그
//
// 입력 환경변수:
//   NAVER_DATALAB_CLIENT_ID, NAVER_DATALAB_CLIENT_SECRET (.env)
//
// 출력:
//   tmp/trend-keywords-YYYY-MM-DD.json
//   stdout JSON: { date, keywords: [{ keyword, score, sources }], category }

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const TMP_DIR = path.join(REPO_ROOT, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function loadEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}
loadEnv();

const args = process.argv.slice(2);
const COUNT = args.indexOf('--count') >= 0 ? parseInt(args[args.indexOf('--count') + 1], 10) : 5;
const DEBUG = args.includes('--debug');

const dlog = (...m) => DEBUG && console.error('[debug]', ...m);

// ========== 경제·재테크 관련 시드 키워드 (검색량 측정용) ==========
// 네이버 데이터랩은 자유 키워드 검색량 조회 가능 (트렌드 API)
// 다음 시드 풀에서 검색량 높은 것들을 동적으로 픽업
const SEED_KEYWORDS = [
  // 금리·예적금
  '기준금리', '예금금리', '적금금리', '파킹통장', '자유적금', '정기예금',
  // 청년·정부 정책
  '청년도약계좌', '청년희망적금', '청년주택드림청약', '주택청약', 'ISA계좌',
  // 대출
  '주택담보대출', '신용대출', '대환대출', '버팀목전세자금대출', '디딤돌대출',
  // 카드·소비
  '신용카드추천', '체크카드추천', '카드포인트', '연말정산',
  // 보험
  '실손보험', '암보험', '자동차보험',
  // 부동산·경제 일반
  '전세사기', '월세지원', '주택청약가점',
  // 시사 경제
  '환율', '코스피', '미국주식', '금값', '비트코인', '인플레이션',
  // 재테크 입문
  '재테크초보', '월급쟁이재테크', '비상금통장', '연금저축펀드',
];

// ========== 네이버 데이터랩 검색어 트렌드 API ==========
// POST https://openapi.naver.com/v1/datalab/search
// 최근 7일 검색량 트렌드 → 상위 키워드 추출
async function naverDataLabSearch(keywords) {
  const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
  const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('⚠ NAVER_DATALAB_CLIENT_ID/SECRET 없음 (네이버 트렌드 스킵)');
    return [];
  }

  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);

  // 네이버 데이터랩은 최대 5그룹 동시 조회 → 키워드 5개씩 묶어 호출
  const results = [];
  for (let i = 0; i < keywords.length; i += 5) {
    const batch = keywords.slice(i, i + 5);
    const body = {
      startDate, endDate, timeUnit: 'date',
      keywordGroups: batch.map(k => ({ groupName: k, keywords: [k] })),
    };

    try {
      const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        dlog('네이버 API 실패', res.status, (await res.text()).slice(0, 200));
        continue;
      }
      const data = await res.json();
      for (const r of (data.results || [])) {
        // 최근 7일 ratio 합 = 트렌드 점수
        const score = (r.data || []).reduce((sum, d) => sum + (d.ratio || 0), 0);
        results.push({ keyword: r.title, score });
      }
    } catch (e) {
      dlog('네이버 호출 예외', e.message);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

// ========== 구글 트렌드 (직접 호출, 비공식 endpoint) ==========
// google-trends-api 패키지 없이 fetch로 처리
// daily trends 한국 → 경제·재테크 카테고리 필터
async function googleTrendsDaily() {
  try {
    const url = 'https://trends.google.com/trends/api/dailytrends?geo=KR&hl=ko';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      dlog('구글 트렌드 실패', res.status);
      return [];
    }
    let text = await res.text();
    // 구글 트렌드는 응답 앞 5자 ")]}',"가 prefix로 붙음
    if (text.startsWith(")]}',")) text = text.slice(5);
    const data = JSON.parse(text);
    const trends = (data.default?.trendingSearchesDays?.[0]?.trendingSearches) || [];
    // 경제·재테크 관련 키워드만 필터 (간단 휴리스틱)
    const economyTerms = ['금리', '예금', '적금', '대출', '청년', '주택', '카드', '보험', '환율',
      '주식', '코스피', '비트코인', '인플레이션', '재테크', '월급', '연금', '전세', '월세',
      '경제', '부동산', '금융', '투자', '세금', '연말정산'];
    const filtered = trends
      .filter(t => {
        const title = t.title?.query || '';
        return economyTerms.some(term => title.includes(term));
      })
      .map(t => ({ keyword: t.title.query, score: parseInt(t.formattedTraffic?.replace(/[^0-9]/g, '') || '0', 10) }));
    return filtered;
  } catch (e) {
    dlog('구글 트렌드 예외', e.message);
    return [];
  }
}

// ========== 메인: 두 소스 교차·점수 합산 ==========
(async () => {
  console.error('🔍 네이버 데이터랩 + 구글 트렌드 조회 중...');
  const [naverResults, googleResults] = await Promise.all([
    naverDataLabSearch(SEED_KEYWORDS),
    googleTrendsDaily(),
  ]);

  console.error(`   네이버: ${naverResults.length}개 / 구글: ${googleResults.length}개`);

  // 점수 합산 (네이버 ratio 0~100, 구글 검색량 정규화)
  const merged = new Map();
  for (const r of naverResults) {
    merged.set(r.keyword, { keyword: r.keyword, naverScore: r.score, googleScore: 0, sources: ['naver'] });
  }
  for (const r of googleResults) {
    const exist = merged.get(r.keyword);
    if (exist) {
      exist.googleScore = r.score;
      exist.sources.push('google');
    } else {
      merged.set(r.keyword, { keyword: r.keyword, naverScore: 0, googleScore: r.score, sources: ['google'] });
    }
  }

  // 점수 산정: 네이버 ratio(0~100*7) + 구글 정규화. 양쪽 출현 키워드는 보너스
  const scored = Array.from(merged.values()).map(k => {
    const normNaver = k.naverScore;                // 0~700 (7일 ratio 합)
    const normGoogle = Math.min(k.googleScore / 10000, 100); // 검색량 만 단위 → 0~100
    const bonus = k.sources.length === 2 ? 100 : 0; // 양쪽 모두 출현 시
    return { ...k, totalScore: normNaver + normGoogle + bonus };
  });

  const top = scored.sort((a, b) => b.totalScore - a.totalScore).slice(0, COUNT);

  const out = {
    date: new Date().toISOString().slice(0, 10),
    generated_at: new Date().toISOString(),
    category: 'economy_finance',
    count: top.length,
    keywords: top.map(k => ({
      keyword: k.keyword,
      total_score: Math.round(k.totalScore),
      naver_score: Math.round(k.naverScore),
      google_score: k.googleScore,
      sources: k.sources,
    })),
  };

  // 파일 저장
  const outPath = path.join(TMP_DIR, `trend-keywords-${out.date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`💾 ${outPath}`);

  // stdout — JSON
  console.log(JSON.stringify(out, null, 2));
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
