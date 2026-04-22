// 인스타 카드뉴스 5장 자동 생성
// - Gemini로 텍스트·캡션·해시태그 생성
// - Imagen 4 Fast로 배경 이미지 5장
// - SVG 오버레이 → Sharp PNG 합성 (1080×1350)
// - 텔레그램으로 이미지 + 캡션 묶음 전송
//
// 사용법:
//   node insta/generate-card-news.js             # topics.yaml의 다음 ready 주제
//   node insta/generate-card-news.js --day 1     # 특정 Day

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const sharp = require('sharp');

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEY 없음'); process.exit(1); }

const GEMINI_MODEL = 'gemini-2.5-pro';
const TOPICS_PATH = path.join(__dirname, 'topics.yaml');
const DRAFTS_DIR = path.join(__dirname, 'drafts');
const PERSONA_PATH = path.join(__dirname, '..', 'agents', 'insta-writer.md');

// ========== 텔레그램 ==========
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) { console.error('⚠️ 텔레그램 예외:', e.message); }
}

// 텔레그램 sendPhoto (URL 기반 — 로컬 파일 업로드 대신 GitHub raw URL 사용)
async function sendTelegramPhotoByUrl(photoUrl, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption ? caption.slice(0, 1024) : undefined }),
    });
    if (!res.ok) { console.error('⚠️ 사진 전송 실패:', await res.text()); return false; }
    return true;
  } catch (e) { console.error('⚠️ 사진 전송 예외:', e.message); return false; }
}

// ========== Gemini ==========
async function callGemini(userPrompt, systemPrompt, { temperature = 0.8, maxTokens = 8192 } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답 비어있음');
  return JSON.parse(text);
}

// ========== Imagen 4 Fast ==========
async function generateImage(prompt, outputPath, { width = 1080, height = 1350 } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '3:4', personGeneration: 'dont_allow' },
    }),
  });
  if (!res.ok) throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const b64 = j.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen 응답에 이미지 없음');
  const buf = await sharp(Buffer.from(b64, 'base64'))
    .resize(width, height, { kernel: 'lanczos3', fit: 'cover' })
    .toBuffer();
  fs.writeFileSync(outputPath, buf);
  return outputPath;
}

// ========== SVG 오버레이 ==========
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur += ' ' + w;
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

function buildCoverSvg({ title, subtitle, pageNum = 1, total = 5 }) {
  const W = 1080, H = 1350;
  const titleLines = wrapText(title, 14);
  const titleFontSize = title.length <= 12 ? 110 : title.length <= 18 ? 90 : 76;
  const startY = H / 2 - (titleLines.length * titleFontSize * 1.1) / 2;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .t { font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', sans-serif; font-weight: 900; letter-spacing: -2.5px; fill: white; }
      .s { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; font-weight: 700; fill: #FFE4E1; letter-spacing: -1px; }
      .b { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; font-weight: 600; fill: rgba(255,255,255,0.75); letter-spacing: -0.5px; }
    </style>
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.52)"/>
    <rect x="60" y="60" width="180" height="58" rx="29" fill="#E53935"/>
    <text x="150" y="99" class="s" font-size="30" text-anchor="middle" fill="white">FRUIT GUIDE</text>
    ${titleLines.map((line, i) => `<text x="${W/2}" y="${startY + (i+1) * titleFontSize * 1.1}" class="t" font-size="${titleFontSize}" text-anchor="middle">${escapeXml(line)}</text>`).join('\n    ')}
    ${subtitle ? `<text x="${W/2}" y="${H - 140}" class="s" font-size="38" text-anchor="middle">${escapeXml(subtitle)}</text>` : ''}
    <text x="${W - 80}" y="${H - 60}" class="b" font-size="28" text-anchor="end">${pageNum} / ${total}</text>
  </svg>`;
}

function buildContentSvg({ number, title, body, pageNum, total }) {
  const W = 1080, H = 1350;
  const titleLines = wrapText(title, 16);
  const bodyLines = wrapText(body, 22);
  const titleFont = 78;
  const bodyFont = 44;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .n { font-family: 'Pretendard', 'Noto Sans CJK KR', sans-serif; font-weight: 900; fill: #FFD54F; }
      .t { font-family: 'Pretendard', 'Noto Sans CJK KR', sans-serif; font-weight: 900; fill: white; letter-spacing: -2px; }
      .b { font-family: 'Pretendard', 'Noto Sans CJK KR', sans-serif; font-weight: 500; fill: rgba(255,255,255,0.95); letter-spacing: -0.5px; }
      .p { font-family: 'Pretendard', sans-serif; font-weight: 600; fill: rgba(255,255,255,0.7); }
    </style>
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.62)"/>
    <text x="80" y="180" class="n" font-size="140">${escapeXml(number || '')}</text>
    ${titleLines.map((line, i) => `<text x="80" y="${320 + i * titleFont * 1.15}" class="t" font-size="${titleFont}">${escapeXml(line)}</text>`).join('\n    ')}
    ${bodyLines.map((line, i) => `<text x="80" y="${320 + titleLines.length * titleFont * 1.15 + 80 + i * bodyFont * 1.4}" class="b" font-size="${bodyFont}">${escapeXml(line)}</text>`).join('\n    ')}
    <text x="${W - 80}" y="${H - 60}" class="p" font-size="28" text-anchor="end">${pageNum} / ${total}</text>
  </svg>`;
}

function buildClosingSvg({ cta, brand, pageNum, total }) {
  const W = 1080, H = 1350;
  const ctaLines = wrapText(cta, 16);
  const ctaFont = 90;
  const startY = H / 2 - (ctaLines.length * ctaFont * 1.1) / 2;

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .c { font-family: 'Pretendard', 'Noto Sans CJK KR', sans-serif; font-weight: 900; fill: white; letter-spacing: -2px; }
      .br { font-family: 'Pretendard', sans-serif; font-weight: 700; fill: rgba(255,255,255,0.9); letter-spacing: -0.5px; }
      .p { font-family: 'Pretendard', sans-serif; font-weight: 600; fill: rgba(255,255,255,0.7); }
    </style>
    <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(0,0,0,0.58)"/>
    ${ctaLines.map((line, i) => `<text x="${W/2}" y="${startY + (i+1) * ctaFont * 1.1}" class="c" font-size="${ctaFont}" text-anchor="middle">${escapeXml(line)}</text>`).join('\n    ')}
    <rect x="${W/2 - 200}" y="${H - 200}" width="400" height="4" fill="#E53935"/>
    <text x="${W/2}" y="${H - 120}" class="br" font-size="36" text-anchor="middle">${escapeXml(brand || '🍎 제철 과일 가이드')}</text>
    <text x="${W - 80}" y="${H - 60}" class="p" font-size="28" text-anchor="end">${pageNum} / ${total}</text>
  </svg>`;
}

async function overlaySvgOnImage(imagePath, svg, outputPath) {
  const svgBuf = Buffer.from(svg);
  const result = await sharp(imagePath)
    .composite([{ input: svgBuf, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  fs.writeFileSync(outputPath, result);
  return outputPath;
}

// ========== Day 선택 ==========
function loadTopics() { return yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8')); }
function saveTopics(d) { fs.writeFileSync(TOPICS_PATH, yaml.dump(d, { lineWidth: 120, noRefs: true }), 'utf8'); }
function pickTopic(dayArg) {
  const d = loadTopics();
  if (dayArg) {
    const t = d.topics.find(t => t.day === dayArg);
    if (!t) throw new Error(`Day ${dayArg} 없음`);
    return { topic: t, data: d };
  }
  const ready = d.topics.find(t => t.status === 'ready' && t.format === 'card_news');
  if (!ready) throw new Error('다음 ready card_news 없음');
  return { topic: ready, data: d };
}

// ========== Gemini: 카드 콘텐츠 생성 ==========
async function generateCardContent(topic) {
  const persona = fs.readFileSync(PERSONA_PATH, 'utf8');
  const systemPrompt = persona + `\n\n반드시 JSON만 출력. 설명·주석·마크다운 금지.`;
  const userPrompt = `주제: Day ${topic.day} — ${topic.title}
훅: ${topic.hook}
클러스터: ${topic.cluster}

위 주제로 인스타 카드뉴스 5장 + 캡션 + 해시태그 + 이미지 프롬프트를 만들어주세요.

출력 형식 (엄격):
{
  "cards": [
    {"slide": 1, "type": "cover", "title": "20~30자", "subtitle": "10~15자"},
    {"slide": 2, "type": "content", "number": "1️⃣", "title": "10~15자", "body": "30~60자"},
    {"slide": 3, "type": "content", "number": "2️⃣", "title": "10~15자", "body": "30~60자"},
    {"slide": 4, "type": "content", "number": "3️⃣", "title": "10~15자", "body": "30~60자"},
    {"slide": 5, "type": "closing", "cta": "20~30자 저장 유도", "brand": "🍎 제철 과일 가이드"}
  ],
  "caption": {
    "hook": "첫 줄 30~40자",
    "body": "본문 150~250자",
    "cta": "💾 저장해두세요~"
  },
  "hashtags": ["#...", ...20~25개],
  "image_prompts": [
    "카드1 배경용 영문 프롬프트",
    "카드2 배경용",
    "카드3 배경용",
    "카드4 배경용",
    "카드5 배경용"
  ]
}

이미지 프롬프트 가이드:
- 영문, 한 줄, 100자 이내
- photorealistic food photography
- 과일 주제에 맞는 장면
- no people
- 각 카드마다 다른 앵글·구성`;

  return await callGemini(userPrompt, systemPrompt);
}

// ========== 메인 ==========
(async () => {
  try {
    const args = process.argv.slice(2);
    const dayArg = args.indexOf('--day') >= 0 ? parseInt(args[args.indexOf('--day') + 1]) : null;
    const { topic, data: topicsData } = pickTopic(dayArg);

    if (topic.format !== 'card_news') {
      throw new Error(`Day ${topic.day} 은 ${topic.format} 포맷 (이 스크립트는 card_news 전용)`);
    }

    console.log(`\n📸 인스타 카드뉴스 생성: Day ${topic.day} — ${topic.title}`);

    if (!fs.existsSync(DRAFTS_DIR)) fs.mkdirSync(DRAFTS_DIR, { recursive: true });
    const dayId = `day-${String(topic.day).padStart(2, '0')}`;
    const ts = Date.now();
    const outPrefix = path.join(DRAFTS_DIR, `${dayId}-${ts}`);

    console.log(`\n✍️ [1/3] Gemini 카드 콘텐츠 생성 중...`);
    const content = await generateCardContent(topic);
    console.log(`   ✓ 카드 ${content.cards.length}장, 해시태그 ${content.hashtags.length}개`);

    console.log(`\n🎨 [2/3] Imagen 배경 이미지 5장 생성 중...`);
    const bgPaths = [];
    for (let i = 0; i < 5; i++) {
      const p = content.image_prompts[i] || `photorealistic food photography, fresh ${topic.cluster}, natural light`;
      const bgPath = `${outPrefix}-bg-${i + 1}.jpg`;
      console.log(`   ${i + 1}/5: ${p.slice(0, 60)}...`);
      try {
        await generateImage(p, bgPath);
        bgPaths.push(bgPath);
      } catch (e) {
        console.warn(`      ⚠️ 실패 (단색 대체): ${e.message}`);
        // 단색 대체
        const solid = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: { r: 229, g: 57, b: 53 } } }).jpeg({ quality: 90 }).toBuffer();
        fs.writeFileSync(bgPath, solid);
        bgPaths.push(bgPath);
      }
    }

    console.log(`\n🖼️ [3/3] SVG 오버레이 합성 중...`);
    const finalPaths = [];
    for (let i = 0; i < 5; i++) {
      const card = content.cards[i];
      const pageNum = i + 1;
      let svg;
      if (card.type === 'cover') {
        svg = buildCoverSvg({ title: card.title, subtitle: card.subtitle, pageNum, total: 5 });
      } else if (card.type === 'content') {
        svg = buildContentSvg({ number: card.number, title: card.title, body: card.body, pageNum, total: 5 });
      } else {
        svg = buildClosingSvg({ cta: card.cta, brand: card.brand, pageNum, total: 5 });
      }
      const outPath = `${outPrefix}-card-${pageNum}.jpg`;
      await overlaySvgOnImage(bgPaths[i], svg, outPath);
      finalPaths.push(outPath);
      console.log(`   ✓ 카드 ${pageNum}: ${path.basename(outPath)}`);
    }

    // 배경 이미지는 삭제 (카드에 합성됐음)
    bgPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    // 캡션 + 해시태그 저장
    const captionText = `${content.caption.hook}\n\n${content.caption.body}\n\n${content.caption.cta}\n\n━━━━━━━━━━━━━━━━━━\n${content.hashtags.join(' ')}`;
    const captionPath = `${outPrefix}-caption.txt`;
    fs.writeFileSync(captionPath, captionText, 'utf8');
    const metaPath = `${outPrefix}-meta.json`;
    fs.writeFileSync(metaPath, JSON.stringify({ topic, content }, null, 2), 'utf8');

    console.log(`\n💾 저장:`);
    console.log(`   이미지: ${finalPaths.length}장`);
    console.log(`   캡션: ${path.relative(process.cwd(), captionPath)}`);

    // 텔레그램 전송 — GitHub raw URL 사용 (GitHub Actions 환경)
    // 로컬 실행 시엔 커밋이 안 되므로 파일 경로 안내만
    const repo = process.env.GITHUB_REPOSITORY;
    const isCI = process.env.GITHUB_ACTIONS === 'true' && repo;

    console.log(`\n📤 텔레그램 안내 전송 중...`);
    await notifyTelegram(
      `📸 <b>인스타 카드뉴스 완성</b>\n\n` +
      `Day ${topic.day} — ${topic.title}\n` +
      `📂 파일 ${finalPaths.length}장 생성됨`
    );

    if (isCI) {
      // CI 환경: GitHub raw URL로 이미지 전송 (커밋은 워크플로우가 이후 단계에서)
      const baseUrl = `https://raw.githubusercontent.com/${repo}/main`;
      for (let i = 0; i < finalPaths.length; i++) {
        const relPath = path.relative(path.join(__dirname, '..'), finalPaths[i]).replace(/\\/g, '/');
        const url = `${baseUrl}/${relPath}`;
        await sendTelegramPhotoByUrl(url, `[${i + 1}/${finalPaths.length}] ${i === 0 ? topic.title : ''}`);
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      // 로컬 환경: 파일 경로 안내만
      await notifyTelegram(
        `ℹ️ 로컬 실행 — 텔레그램 이미지 전송 스킵\n\n` +
        `📁 파일 위치:\n<code>${path.relative(process.cwd(), DRAFTS_DIR)}</code>\n\n` +
        `파일 이름: ${path.basename(finalPaths[0]).replace('-card-1.jpg', '-card-N.jpg')}`
      );
    }

    // 캡션 별도 메시지
    await notifyTelegram(
      `📝 <b>캡션 (복사용)</b>\n\n<pre>${captionText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>\n\n` +
      `📋 인스타 업로드 순서:\n` +
      `1️⃣ 위 카드 5장 폰에 저장\n` +
      `2️⃣ 인스타 앱 → 새 게시물 → 이미지 5장 선택 (순서대로)\n` +
      `3️⃣ 위 캡션 복사 → 붙여넣기\n` +
      `4️⃣ 게시\n\n` +
      `⏱️ 3분이면 끝나요!`
    );

    // 상태 업데이트
    topic.status = 'draft';
    topic.generated_at = new Date().toISOString();
    const nextPending = topicsData.topics.find(t => t.status === 'pending');
    if (nextPending) { nextPending.status = 'ready'; console.log(`🔄 다음 주제: Day ${nextPending.day} — ${nextPending.title}`); }
    saveTopics(topicsData);

    console.log(`\n✅ 인스타 카드뉴스 완성! 텔레그램 확인하세요.`);
  } catch (err) {
    console.error('❌ 실패:', err.message);
    process.exit(1);
  }
})();
