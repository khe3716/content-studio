// 네이버 데이터랩 검색어 트렌드 — 금융 카테고리 비교
// 사용법: node keyword-trend/fetch-datalab.js
//
// 환경변수: NAVER_DATALAB_CLIENT_ID, NAVER_DATALAB_CLIENT_SECRET
// 출력: keyword-trend/results/YYYY-MM-DD-trend.json + 콘솔 요약 표

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// .env 직접 로드 (dotenv 없이 단순 파싱)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}

const CLIENT_ID = process.env.NAVER_DATALAB_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_DATALAB_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ NAVER_DATALAB_CLIENT_ID / SECRET 가 .env 에 없음');
  process.exit(1);
}

const fmt = d => d.toISOString().slice(0, 10);
const today = new Date();
const endDate = new Date(today);
endDate.setDate(endDate.getDate() - 1);
const startDate = new Date(today);
startDate.setFullYear(startDate.getFullYear() - 1);

const yamlPath = path.join(__dirname, 'keywords.yaml');
const config = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
const keywordGroups = config.groups.map(g => ({
  groupName: g.name,
  keywords: g.keywords,
}));

async function fetchDatalab(timeUnit) {
  const body = {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    timeUnit,
    keywordGroups,
  };

  const res = await fetch('https://openapi.naver.com/v1/datalab/search', {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': CLIENT_ID,
      'X-Naver-Client-Secret': CLIENT_SECRET,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json();
}

function summarize(monthly) {
  const summary = monthly.results.map(r => {
    const points = r.data.map(d => d.ratio);
    if (!points.length) return null;
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    const recent3 = points.slice(-3);
    const prev3 = points.slice(-6, -3);
    const recentAvg = recent3.reduce((a, b) => a + b, 0) / Math.max(recent3.length, 1);
    const prevAvg = prev3.length
      ? prev3.reduce((a, b) => a + b, 0) / prev3.length
      : recentAvg;
    const momentum = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
    const peak = Math.max(...points);
    const peakIdx = points.indexOf(peak);
    const peakMonth = r.data[peakIdx]?.period || '-';
    return {
      group: r.title,
      avgRatio: Number(avg.toFixed(1)),
      recentAvg: Number(recentAvg.toFixed(1)),
      momentumPct: Number(momentum.toFixed(1)),
      peak: Number(peak.toFixed(1)),
      peakMonth,
    };
  }).filter(Boolean);
  return summary.sort((a, b) => b.avgRatio - a.avgRatio);
}

(async () => {
  console.log(`📅 기간: ${fmt(startDate)} ~ ${fmt(endDate)}\n`);

  console.log('⏳ 월별 트렌드 호출...');
  const monthly = await fetchDatalab('month');

  const summary = summarize(monthly);

  console.log('\n=== 카테고리별 검색량 비교 (네이버 데이터랩 상대 ratio, 100=최대값) ===\n');
  console.log('카테고리 | 1년 평균 | 최근 3개월 | 전3개월대비 모멘텀 | 최고점 | 최고점 시점');
  console.log('-'.repeat(90));
  summary.forEach(s => {
    const arrow = s.momentumPct > 5 ? '📈' : s.momentumPct < -5 ? '📉' : '➡️';
    console.log(
      `${s.group.padEnd(8)} | ${String(s.avgRatio).padStart(7)} | ${String(s.recentAvg).padStart(9)} | ${arrow} ${String(s.momentumPct).padStart(6)}% | ${String(s.peak).padStart(5)} | ${s.peakMonth}`
    );
  });

  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  const outPath = path.join(resultsDir, `${fmt(today)}-trend.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    period: { start: fmt(startDate), end: fmt(endDate) },
    summary,
    raw: monthly,
  }, null, 2), 'utf8');
  console.log(`\n💾 ${path.relative(path.join(__dirname, '..'), outPath)}`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
