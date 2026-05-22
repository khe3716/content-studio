// 공용 stock 사진 검색 헬퍼 (Pexels + Pixabay)
// fallback 순서:
//   1순위: Pexels/Pixabay 새 사진 (30일 내 미사용)
//   2순위: 30일 내 사용 사진 재사용 (한 번 더 중복 허용)
//   3순위: AI 생성 (최후 수단 — 호출자가 처리)
//
// 사용 예:
//   const { findStockPhoto } = require('./stock-photos');
//   const result = await findStockPhoto('watermelon', { blog: 'fruit' });
//   // result = { url, source: 'pexels'|'pixabay', photoId, reused: false }
//   // 또는 result = null (둘 다 결과 없음 → 호출자가 AI fallback)

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO_ROOT = path.join(__dirname, '..', '..');
const USAGE_PATH = path.join(REPO_ROOT, 'data', 'image-usage.json');
const REUSE_WINDOW_DAYS = 30;

// ─────────── usage 기록 로드/저장 ───────────
function loadUsage() {
  if (!fs.existsSync(USAGE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveUsage(usage) {
  fs.mkdirSync(path.dirname(USAGE_PATH), { recursive: true });
  fs.writeFileSync(USAGE_PATH, JSON.stringify(usage, null, 2), 'utf8');
}

// 30일 내 사용된 photo ID 집합 반환
function getRecentlyUsedIds() {
  const usage = loadUsage();
  const cutoff = Date.now() - REUSE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = new Set();
  for (const [dateStr, ids] of Object.entries(usage)) {
    const ts = new Date(dateStr).getTime();
    if (ts >= cutoff && Array.isArray(ids)) {
      ids.forEach(id => recent.add(id));
    }
  }
  return recent;
}

function recordUsage(photoId) {
  const usage = loadUsage();
  const today = new Date().toISOString().slice(0, 10);
  if (!usage[today]) usage[today] = [];
  if (!usage[today].includes(photoId)) usage[today].push(photoId);

  // 60일 넘은 기록은 청소 (파일 비대 방지)
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  for (const dateStr of Object.keys(usage)) {
    if (new Date(dateStr).getTime() < cutoff) delete usage[dateStr];
  }

  saveUsage(usage);
}

// ─────────── Pexels 검색 ───────────
async function searchPexels(query, page = 1) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  return new Promise((resolve) => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&page=${page}&orientation=landscape`;
    const req = https.get(url, {
      headers: { Authorization: apiKey },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const photos = (data.photos || []).map(p => ({
            photoId: `pexels_${p.id}`,
            url: p.src?.large2x || p.src?.large || p.src?.original,
            source: 'pexels',
            photographer: p.photographer,
            originalUrl: p.url,
          }));
          resolve(photos);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
  });
}

// ─────────── Pixabay 검색 ───────────
async function searchPixabay(query, page = 1) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];

  return new Promise((resolve) => {
    const url = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=30&page=${page}&image_type=photo&orientation=horizontal&safesearch=true`;
    const req = https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const photos = (data.hits || []).map(p => ({
            photoId: `pixabay_${p.id}`,
            url: p.largeImageURL || p.webformatURL,
            source: 'pixabay',
            photographer: p.user,
            originalUrl: p.pageURL,
          }));
          resolve(photos);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
  });
}

// ─────────── 메인 검색 함수 ───────────
// query: 검색어 (영어 권장)
// opts: { blog, maxPages, skipRecord }
//   - blog: 로그용 (예: 'fruit', 'economy', 'finance')
//   - maxPages: 페이지 끝까지 돌릴 한계 (기본 5)
//   - skipRecord: usage 기록 안 함 (테스트용)
// 반환: { url, source, photoId, photographer, reused, originalUrl } | null
async function findStockPhoto(query, opts = {}) {
  const { blog = 'unknown', maxPages = 5, skipRecord = false } = opts;
  const recentlyUsed = getRecentlyUsedIds();

  // 1순위: 새 사진 (Pexels → Pixabay, 최대 maxPages 페이지)
  for (let page = 1; page <= maxPages; page++) {
    const pexelsResults = await searchPexels(query, page);
    const fresh = pexelsResults.find(p => !recentlyUsed.has(p.photoId));
    if (fresh) {
      if (!skipRecord) recordUsage(fresh.photoId);
      console.log(`  [stock-photos] ${blog} "${query}" → ${fresh.source} (new, page=${page})`);
      return { ...fresh, reused: false };
    }
  }
  for (let page = 1; page <= maxPages; page++) {
    const pixabayResults = await searchPixabay(query, page);
    const fresh = pixabayResults.find(p => !recentlyUsed.has(p.photoId));
    if (fresh) {
      if (!skipRecord) recordUsage(fresh.photoId);
      console.log(`  [stock-photos] ${blog} "${query}" → ${fresh.source} (new, page=${page})`);
      return { ...fresh, reused: false };
    }
  }

  // 2순위: 30일 내 재사용 허용 (한 번 더만)
  // Pexels 1페이지 첫 결과
  const pexelsFallback = await searchPexels(query, 1);
  if (pexelsFallback.length > 0) {
    const reused = pexelsFallback[0];
    if (!skipRecord) recordUsage(reused.photoId);
    console.log(`  [stock-photos] ${blog} "${query}" → ${reused.source} (REUSED, 30일내 중복)`);
    return { ...reused, reused: true };
  }
  const pixabayFallback = await searchPixabay(query, 1);
  if (pixabayFallback.length > 0) {
    const reused = pixabayFallback[0];
    if (!skipRecord) recordUsage(reused.photoId);
    console.log(`  [stock-photos] ${blog} "${query}" → ${reused.source} (REUSED, 30일내 중복)`);
    return { ...reused, reused: true };
  }

  // 3순위: null 반환 → 호출자가 AI 생성 fallback
  console.log(`  [stock-photos] ${blog} "${query}" → 결과 없음, AI fallback 필요`);
  return null;
}

// ─────────── 사진 다운로드 (URL → 로컬 파일) ───────────
async function downloadPhoto(url, outPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 리다이렉트 처리
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => file.close(() => resolve(outPath)));
        }).on('error', reject);
      } else {
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(outPath)));
      }
    }).on('error', reject);
  });
}

module.exports = {
  findStockPhoto,
  downloadPhoto,
  // 테스트·디버깅용
  getRecentlyUsedIds,
  recordUsage,
  loadUsage,
};
