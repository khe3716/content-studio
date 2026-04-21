// 달콤살랑 스마트스토어 상품 SEO 진단
// 상품명·태그·카테고리를 분석해 개선 체크리스트 생성
//
// 사용법:
//   node scripts/audit-smartstore-seo.js              # 콘솔 리포트
//   node scripts/audit-smartstore-seo.js --telegram   # 텔레그램으로 발송

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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

const PRODUCTS_PATH = path.join(__dirname, '..', 'fruit-blog', 'products.json');

// ---- 스코어링 규칙 ----
// 상품명 40점 / 태그 30점 / 카테고리 10점 / 운영 20점
const RULES = {
  name: {
    minLength: 25,        // 너무 짧으면 키워드 부족
    maxLength: 50,        // 네이버 쇼핑 검색 결과에서 잘림
    keywordHints: {
      origin: ['산지', '국산', '영암', '제주', '전남', '충북', '경북', '나주', '진주', '산청', '청도', '거창', '충주', '의성', '고성', '문경', '여주', '김제'],
      weight: ['kg', 'g', '개', '박스', '팩', '송이'],
      usage: ['생과', '선물', '제철', '당일', '수제청', '잼', '주스', '즉석', '세척', '손질'],
      attribute: ['고당도', '무농약', '저당', '프리미엄', '못난이', '가정용', '선물용', '당일수확', '즉석'],
    },
  },
  tags: {
    target: 10,           // 네이버 최대 10개
    minUnique: 8,         // 중복 제외
  },
  category: {
    minDepth: 4,          // 식품>농산물>과일>X
  },
};

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_PATH)) {
    console.error(`❌ ${PRODUCTS_PATH} 없음. 먼저 상품 데이터 가져오세요.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
}

function auditName(name) {
  const issues = [];
  let score = 40;

  if (name.length < RULES.name.minLength) {
    issues.push(`상품명 너무 짧음 (${name.length}자, ${RULES.name.minLength}자 이상 권장)`);
    score -= 10;
  }
  if (name.length > RULES.name.maxLength) {
    issues.push(`상품명 너무 김 (${name.length}자, 네이버 검색 결과에서 잘림 — ${RULES.name.maxLength}자 이내 권장)`);
    score -= 8;
  }

  const lower = name.toLowerCase();
  const missing = [];
  for (const [kind, hints] of Object.entries(RULES.name.keywordHints)) {
    const hit = hints.some(h => name.includes(h) || lower.includes(h.toLowerCase()));
    if (!hit) missing.push(kind);
  }

  const labelMap = {
    origin: '산지 키워드 (예: 영암산, 국산)',
    weight: '중량 키워드 (예: 1kg, 2kg)',
    usage: '용도 키워드 (예: 생과, 선물, 제철)',
    attribute: '특성 키워드 (예: 고당도, 무농약, 당일수확)',
  };
  if (missing.length > 0) {
    issues.push(`키워드 누락: ${missing.map(m => labelMap[m]).join(', ')}`);
    score -= missing.length * 5;
  }

  return { score: Math.max(0, score), issues };
}

function auditTags(tags) {
  const issues = [];
  let score = 30;

  const list = Array.isArray(tags) ? tags : [];
  if (list.length === 0) {
    issues.push('태그가 없음 (10개 꽉 채우는 게 좋음)');
    return { score: 0, issues };
  }

  if (list.length < RULES.tags.target) {
    issues.push(`태그 ${list.length}/10 — ${RULES.tags.target - list.length}개 더 채울 수 있음`);
    score -= (RULES.tags.target - list.length) * 2;
  }

  const unique = new Set(list.map(t => t.trim().toLowerCase()));
  if (unique.size < list.length) {
    issues.push(`중복 태그 ${list.length - unique.size}개`);
    score -= 5;
  }

  // 유사어 체크 (간단)
  const similar = [];
  const arr = [...unique];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i].includes(arr[j]) || arr[j].includes(arr[i])) {
        similar.push([arr[i], arr[j]]);
      }
    }
  }
  if (similar.length > 0) {
    issues.push(`유사 태그 ${similar.length}쌍 — 한 개는 더 다양한 키워드로 교체 권장 (예: ${similar[0].join(' ↔ ')})`);
    score -= similar.length * 2;
  }

  return { score: Math.max(0, score), issues };
}

function auditCategory(category) {
  const issues = [];
  let score = 10;
  if (!category) {
    issues.push('카테고리 없음');
    return { score: 0, issues };
  }
  const depth = category.split('>').length;
  if (depth < RULES.category.minDepth) {
    issues.push(`카테고리 깊이 ${depth} — ${RULES.category.minDepth} 이상 권장 (예: 식품>농산물>과일>딸기)`);
    score -= (RULES.category.minDepth - depth) * 3;
  }
  return { score: Math.max(0, score), issues };
}

function auditOps(p) {
  const issues = [];
  let score = 20;
  if (!p.image) { issues.push('대표 이미지 없음'); score -= 10; }
  if (p.stock === 0) { issues.push('재고 0 (판매 중단 상태)'); score -= 5; }
  if (p.discounted && p.discounted === p.price) { issues.push('할인가 = 정가 (할인 효과 없음)'); score -= 3; }
  return { score: Math.max(0, score), issues };
}

function auditProduct(p) {
  const n = auditName(p.name || '');
  const t = auditTags(p.tags || []);
  const c = auditCategory(p.category || '');
  const o = auditOps(p);
  const total = n.score + t.score + c.score + o.score;
  const allIssues = [
    ...n.issues.map(i => ['상품명', i]),
    ...t.issues.map(i => ['태그', i]),
    ...c.issues.map(i => ['카테고리', i]),
    ...o.issues.map(i => ['운영', i]),
  ];
  return { name: p.name, total, breakdown: { name: n.score, tags: t.score, category: c.score, ops: o.score }, issues: allIssues };
}

function formatReport(audits) {
  const avg = Math.round(audits.reduce((s, a) => s + a.total, 0) / audits.length);
  const sorted = [...audits].sort((a, b) => a.total - b.total);
  const worst = sorted.slice(0, 5);

  let out = `📊 달콤살랑 SEO 진단 리포트\n`;
  out += `━━━━━━━━━━━━━━━━━━━━\n`;
  out += `총 상품: ${audits.length}개 / 평균 ${avg}점\n\n`;

  out += `🚨 우선 고쳐야 할 상품 Top ${worst.length}\n`;
  out += `━━━━━━━━━━━━━━━━━━━━\n`;
  worst.forEach((a, i) => {
    out += `\n${i + 1}. ${a.total}점 — ${a.name.slice(0, 40)}${a.name.length > 40 ? '…' : ''}\n`;
    const byArea = a.issues.reduce((acc, [area, msg]) => {
      (acc[area] = acc[area] || []).push(msg);
      return acc;
    }, {});
    for (const [area, msgs] of Object.entries(byArea)) {
      out += `   [${area}]\n`;
      msgs.forEach(m => { out += `     • ${m}\n`; });
    }
  });

  return out;
}

function formatTelegram(audits) {
  const avg = Math.round(audits.reduce((s, a) => s + a.total, 0) / audits.length);
  const sorted = [...audits].sort((a, b) => a.total - b.total);
  const worst = sorted.slice(0, 3);

  let out = `📊 <b>달콤살랑 SEO 진단</b>\n`;
  out += `━━━━━━━━━━━━━━\n`;
  out += `총 <b>${audits.length}개</b> 상품 / 평균 <b>${avg}점</b>\n\n`;
  out += `🚨 <b>우선 고쳐야 할 상품 Top ${worst.length}</b>\n\n`;

  worst.forEach((a, i) => {
    const shortName = a.name.length > 30 ? a.name.slice(0, 30) + '…' : a.name;
    out += `<b>${i + 1}. ${a.total}점</b> — ${shortName}\n`;
    a.issues.slice(0, 3).forEach(([area, msg]) => {
      out += `  • [${area}] ${msg}\n`;
    });
    if (a.issues.length > 3) out += `  • 외 ${a.issues.length - 3}건\n`;
    out += `\n`;
  });

  out += `💡 <b>개선 순서</b>\n`;
  out += `1. 상품명에 산지·중량·용도 키워드 넣기\n`;
  out += `2. 태그 10개 꽉 채우기 (유사어는 빼고)\n`;
  out += `3. 재고·할인가 상태 점검\n\n`;
  out += `전체 리포트는 콘솔에서 확인 (<code>node scripts/audit-smartstore-seo.js</code>)`;

  return out;
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('⚠️ TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음 — 텔레그램 발송 생략');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) {
    console.error('❌ 텔레그램 발송 실패:', await res.text());
  } else {
    console.log('✅ 텔레그램 발송 완료');
  }
}

(async () => {
  const products = loadProducts();
  const audits = products.map(auditProduct);
  console.log(formatReport(audits));

  if (process.argv.includes('--telegram')) {
    await sendTelegram(formatTelegram(audits));
  }
})();
