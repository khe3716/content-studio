// 과일 블로그 로봇 — 주제 선정 → 글 → 팩트체크 → Blogger 업로드 (+ 선택적 예약 발행)
//
// 사용법:
//   node auto-publish-fruit.js                     # 다음 'ready' → 즉시 발행
//   node auto-publish-fruit.js --day 5             # 특정 Day
//   node auto-publish-fruit.js --dry-run           # 글만 생성
//   node auto-publish-fruit.js --keep-draft        # DRAFT 유지
//   node auto-publish-fruit.js --offset-days 2     # 모레 18:00 예약
//   node auto-publish-fruit.js --publish-at "2026-04-24T18:00:00+09:00"
//
// 기본: publishDate = 'now' (즉시 발행). cron이 18:00 KST에 발동되면 = 해당 시각 발행.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const sharp = require('sharp');
const { spawnSync } = require('child_process');
const { SLOTS, slotToISO, formatSlotKorean } = require('./scripts/slot-utils');

// ========== 환경 변수 ==========
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    });
  }
}
loadEnv();

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY 환경변수 없음');
  process.exit(1);
}

// ========== 텔레그램 알림 ==========
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) console.error('⚠️ 텔레그램 알림 실패:', await res.text());
  } catch (e) {
    console.error('⚠️ 텔레그램 알림 예외:', e.message);
  }
}

// ========== 제미나이 ==========
async function callGemini(userPrompt, systemPrompt, { temperature = 0.7, maxTokens = 16384, model = GEMINI_MODEL, disableThinking = false } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (disableThinking) {
    body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API 오류 (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답에 텍스트 없음: ' + JSON.stringify(data).slice(0, 500));
  return text;
}

function loadPersona(name) {
  return fs.readFileSync(path.join(__dirname, 'agents', `${name}.md`), 'utf8');
}

// 사장님 기존 글 3편 랜덤 선택 + 각 2,500자로 잘라 few-shot 샘플로 사용
function loadWritingSamples(count = 3, maxCharsPerSample = 2500) {
  const samplesDir = path.join(__dirname, 'fruit-blog', 'samples');
  const indexPath = path.join(samplesDir, 'index.json');
  if (!fs.existsSync(indexPath)) return [];

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  if (index.length === 0) return [];

  // 랜덤 섞어서 앞에서 count개
  const shuffled = [...index].sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map(meta => {
    const filepath = path.join(samplesDir, meta.file);
    if (!fs.existsSync(filepath)) return null;
    let html = fs.readFileSync(filepath, 'utf8');
    if (html.length > maxCharsPerSample) {
      html = html.slice(0, maxCharsPerSample) + '\n<!-- ...(뒷부분 생략) -->';
    }
    return { title: meta.title, html };
  }).filter(Boolean);
}

// ========== Imagen 4 Fast 이미지 생성 (생성 후 리사이즈) ==========
async function generateImage(prompt, outputPath) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: '1:1', personGeneration: 'dont_allow' },
    }),
  });
  if (!res.ok) throw new Error(`Imagen API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const b64 = j.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen 응답에 이미지 없음: ' + JSON.stringify(j).slice(0, 300));
  // 본문 이미지는 600×600 JPG로 압축 (Blogger가 작은 파일을 대표 썸네일 후보에서 제외)
  // → 디자인 썸네일(1500×1500 PNG, 30KB)이 대표로 선택됨
  const resized = await sharp(Buffer.from(b64, 'base64'))
    .resize(600, 600, { kernel: 'lanczos3' })
    .jpeg({ quality: 75 })
    .toBuffer();
  // 확장자 .jpg로 저장 (outputPath이 .png여도 JPG로 저장)
  const jpgPath = outputPath.replace(/\.png$/i, '.jpg');
  fs.writeFileSync(jpgPath, resized);
  return jpgPath;
}

// 주제에 맞는 영문 이미지 프롬프트 2개 생성 (Gemini로)
async function generateImagePrompts(topic) {
  const systemPrompt = `You are a prompt engineer for food photography. Generate two distinct English prompts for photorealistic food photography matching the given Korean fruit blog topic. Each prompt must be single line, under 200 characters, describing a different composition or angle. Return ONLY two prompts separated by " ||| " - no numbering, no explanation.`;
  const userPrompt = `Topic (Korean): ${topic.title}
Keywords: ${(topic.labels || []).join(', ')}
Cluster: ${topic.cluster}

Write 2 photography prompts - both natural, professional, food-blog style. No people. Korean fruits if mentioned should be specific (e.g., "Korean wild raspberries bokbunja" for 산딸기, "gold mango" for 골드망고).

Example output:
A close-up photograph of fresh Korean wild raspberries in a wooden bowl, natural light, rustic wooden table, food photography ||| A basket of ripe Korean raspberries on a kitchen counter with mint leaves, soft morning light, overhead shot, high quality`;
  // flash 모델 + thinking 비활성화 (pro는 thinking 토큰이 예산 다 잡아먹음)
  const raw = await callGemini(userPrompt, systemPrompt, {
    temperature: 0.7,
    maxTokens: 500,
    model: 'gemini-2.5-flash',
    disableThinking: true,
  });
  const parts = raw.split('|||').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    // 폴백: 주제 단순화 프롬프트
    const fallback = `A photorealistic photograph of fresh ${topic.thumb_title || topic.cluster}, natural light, food photography, high quality`;
    return [fallback, fallback];
  }
  return [parts[0], parts[1]];
}

function loadProducts() {
  const p = path.join(__dirname, 'fruit-blog', 'products.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// 주제 키워드와 매칭되는 관련 상품 3개 추려냄 (이미지 있는 것만)
function findRelatedProducts(topic, products, count = 3) {
  if (!products || products.length === 0) return [];
  const withImage = products.filter(p => p.image && p.name);
  if (withImage.length === 0) return [];

  const keywords = [
    topic.cluster,
    topic.thumb_title,
    ...(topic.labels || []),
  ].filter(Boolean).map(k => k.toLowerCase());

  const scored = withImage.map(p => {
    const hay = (p.name + ' ' + (p.tags || []).join(' ') + ' ' + (p.category || '')).toLowerCase();
    const score = keywords.reduce((s, k) => s + (hay.includes(k) ? 1 : 0), 0);
    return { product: p, score };
  });

  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const matchedProducts = matched.map(s => s.product);

  // 부족하면 같은 과일 카테고리에서 랜덤 보충
  if (matchedProducts.length < count) {
    const usedNos = new Set(matchedProducts.map(p => p.no));
    const fruitCategory = withImage.filter(p =>
      !usedNos.has(p.no) && (p.category || '').includes('과일')
    );
    // 섞어서 보충
    const shuffled = fruitCategory.sort(() => Math.random() - 0.5);
    matchedProducts.push(...shuffled.slice(0, count - matchedProducts.length));
  }

  return matchedProducts.slice(0, count);
}

// 이미지 태그 HTML 생성 (가운데 정렬, 둥근 모서리)
function imgTag(url, alt = '', caption = '') {
  const captionHtml = caption
    ? `<p style="text-align:center;color:#888;font-size:14px;font-style:italic;margin:8px 0 0 0;">${caption}</p>`
    : '';
  return `<div style="text-align:center;margin:32px 0;">` +
    `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"/>` +
    captionHtml +
    `</div>`;
}

// 같은 클러스터에 이미 발행된(draft 상태) 글들의 요약을 가져옴. Gemini가 중복 회피하도록.
function loadSameClusterPosts(topic, topicsData) {
  const draftsDir = path.join(__dirname, 'fruit-blog', 'drafts');
  if (!fs.existsSync(draftsDir)) return [];

  const prior = (topicsData.topics || []).filter(t =>
    t.cluster === topic.cluster &&
    t.day !== topic.day &&
    t.status === 'draft' &&
    t.day < topic.day
  );

  return prior.map(t => {
    const prefix = `day-${String(t.day).padStart(2, '0')}-${t.slug}`;
    const files = fs.readdirSync(draftsDir).filter(f => f.startsWith(prefix) && f.endsWith('.html'));
    if (files.length === 0) return null;
    const html = fs.readFileSync(path.join(draftsDir, files[0]), 'utf8');
    // 태그 제거하고 앞 1,500자만 (이전 글 핵심 파악용)
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { day: t.day, title: t.title, summary: text.slice(0, 1500) };
  }).filter(Boolean);
}

// ========== 1단계: 박과일 초안 작성 ==========
async function writeArticle(topic, nextTopic, images, topicsData) {
  const parkGwail = loadPersona('park-gwail');
  const products = loadProducts();
  const samples = loadWritingSamples(3, 2500);
  const clusterPosts = topicsData ? loadSameClusterPosts(topic, topicsData) : [];

  const relatedProducts = products
    .filter(p => {
      const hay = (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
      return topic.labels.some(l => hay.includes(l.toLowerCase())) ||
             hay.includes(topic.cluster.toLowerCase());
    })
    .slice(0, 3)
    .map(p => `- ${p.name} (${p.category})`);

  const productHint = relatedProducts.length
    ? `\n\n# 참고: 현재 이 블로그 운영자가 판매하는 관련 상품 (직접 언급 금지, 상식 수준 참고만)\n${relatedProducts.join('\n')}`
    : '';

  // 이미지 삽입은 Gemini에 맡기지 않음 (Gemini가 placeholder 무시하고 엉뚱한 URL 넣음)
  // 대신 생성 후 코드에서 <h2> 경계 찾아 프로그래밍 방식으로 삽입
  const imagePlaceholderHint = `\n\n# 이미지 규칙 (매우 중요)
- 본문에 <img> 태그를 절대 삽입하지 마세요.
- [[...]], {{...}} 같은 placeholder도 쓰지 마세요.
- 외부 URL (unsplash, pexels 등) 이미지 추가 금지.
- 오직 텍스트와 표·박스 HTML만 출력. 이미지는 자동화 스크립트가 나중에 알아서 끼워 넣습니다.`;

  const nextPreviewHint = nextTopic
    ? `다음 글 예고 문구에 반드시 "**${nextTopic.title}**" 언급.`
    : '다음 글 예고는 "다음에도 과일 정보 꾸준히 올릴 예정입니다" 식으로.';

  // Few-shot: 사장님 기존 글 스타일 학습
  const samplesHint = samples.length > 0
    ? `\n\n# 스타일 레퍼런스 (사장님 기존 글 — 톤·구조·문장 리듬을 반드시 이 스타일로)
아래는 이 블로그 운영자가 실제로 발행한 글들입니다. 당신은 이 글을 쓴 **같은 사람**으로서 글을 써야 합니다.
- 말투 어미, 문장 길이, 문단 리듬 그대로
- 박스·표·h2·h3 스타일 그대로
- 경고·강조 표현 톤 그대로
- "저도~" 체험 삽입 방식 그대로
- 단, 내용·구체적 수치·주제는 오늘 쓸 주제에 맞게 새로 씀 (복붙 금지)

${samples.map((s, i) => `===== 샘플 ${i + 1}: ${s.title} =====\n${s.html}`).join('\n\n')}

===== 샘플 끝 =====
`
    : '';

  // 같은 클러스터 이전 글 — 중복 회피용
  const clusterHint = clusterPosts.length > 0
    ? `\n\n# 같은 클러스터(${topic.cluster}) 이전 글 — 중복 설명 금지 ★★★

이 블로그에 이미 발행한 같은 과일 글이 있어요. **그 글에서 자세히 다룬 팩트는 다시 깊게 설명하지 말고**, 한 줄 언급만 하고 **오늘 주제(${topic.title})의 고유 내용에 집중**하세요.

공통 팩트(수분 함량, 호흡률, 기본 특성 등)를 반복하면 독자가 지루해지고 네이버 DIA가 양산형 블로그로 판정합니다.

${clusterPosts.map(p => `===== Day ${p.day}: ${p.title} =====\n${p.summary}\n===== 끝 =====`).join('\n\n')}

오늘 글은 **반드시 위 글들과 다른 각도·정보 중심**으로 작성하세요.`
    : '';

  const systemPrompt = `${parkGwail}${productHint}${samplesHint}${clusterHint}${imagePlaceholderHint}`;

  const userPrompt = `오늘 쓸 글 정보:
- Day: ${topic.day}
- 주제: ${topic.title}
- 클러스터: ${topic.cluster}
- 썸네일 안 짧은 제목: ${topic.thumb_title}
- ${nextPreviewHint}

# ⚠️ 중요: 출력 맨 앞 조심

**본문은 반드시 <p>태그로 시작.** 제목을 본문 안에 중복으로 넣지 마세요 (Blogger가 제목 별도 관리).

# 필수 구조

1. **분량**: 2,000~2,500자 (공백 포함, 시그니처 제외)
2. **구조** (순서 엄수):
   - <p>도입부</p> (200~300자, 공감 질문 + "저도~" 체험 1회 + "3가지만 알려드릴게요")
   - <h2>1. ...</h2> 문제 제기 또는 핵심 팩트 (숫자·출처 포함)
   - <h2>2. ...</h2> 비교/구분법 + <table> + <div> 💡 핵심 포인트 박스
   - <h2>3. 실전 3단계</h2>
     - <h3>1단계: ...</h3> (2~3문장)
     - <h3>2단계: ...</h3>
     - <h3>3단계: ...</h3>
   - <h2>4. 주의사항</h2> + <div> ⚠️ 주의 박스 (선택)
   - <hr>
   - 마무리 <p>문단</p> (150~200자, "결국 핵심은~" + 개인 체험 + 다음 글 예고)
   - 시그니처 고정: <p style="text-align:center;color:#666;font-style:italic;margin-top:24px;">📍 과일정보연구소 — 제철 과일, 제대로 고르고 제대로 먹기</p>

3. **개인 체험**: "저도" 총 3~4회 (도입 1, 본문 각 섹션 1, 마무리 1)
4. **출처 인용**: 숫자·통계에는 반드시 출처 (한국소비자원, 농촌진흥청, 식약처 등) 명시
5. **표 스타일**: border-collapse, border:1px solid #ddd, padding:10px
6. **박스 스타일**: 💡는 #e7f3ff 배경, ⚠️는 #fff5f5 배경

# 절대 금지
- 판매 유도 ("사세요", "구매하세요", "저희 매장")
- 특정 브랜드/상품명 직접 언급 ("달콤살랑", "XX상품")
- 과장 ("완전", "최고", "무조건", "역대급")
- 건강 효능 단정 ("다이어트 성공", "질병 치료")
- 출처 없는 숫자
- 📍 외 장식 이모지 (💡, ⚠️, 🍎🍇🍑🍈🥭 중 필요한 것만)

# 출력 형식
**HTML 코드만** 출력. \`\`\`html 마크다운, 설명문 없이.
<p>로 시작하는 도입부부터 바로. 썸네일 <div>는 삽입 금지 (publish-draft-fruit.js가 자동 처리).`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.8 });
}

// ========== 2단계: 팩트체크 ==========
async function factCheck(articleHtml, topic) {
  const systemPrompt = `당신은 과일 전문 팩트체커입니다. 블로그 초안의 사실·출처·단정 표현을 엄격히 검증합니다.
검증 영역:
- 숫자/통계의 정확성 (한국소비자원, 농촌진흥청, 식약처, RDA 자료 교차 확인)
- 건강 효능 단정 여부 ("다이어트에 좋다", "암 예방" 등 과장)
- 판매 유도성 표현
- 출처 없이 인용된 데이터
- 시즌·산지 정보의 정확성`;

  const userPrompt = `다음은 Day ${topic.day} "${topic.title}" 초안입니다. 엄격히 검증하세요.

검증 항목:
1. 모든 숫자·통계의 정확성과 출처 유효성
2. 건강 효능·영양소 주장의 근거
3. 판매 유도·과장·단정 표현 여부
4. 과일 시즌·산지·품종 정보의 정확성

**출력은 반드시 JSON만.**
{
  "status": "pass" | "needs_revision",
  "confidence": "high" | "medium" | "low",
  "issues": [
    { "severity": "high" | "medium" | "low", "sentence": "문제 문장", "reason": "이유", "suggestion": "수정 제안" }
  ],
  "summary": "한 줄 요약"
}

===== 초안 =====
${articleHtml}`;

  const resp = await callGemini(userPrompt, systemPrompt, { temperature: 0.2 });
  const cleaned = resp.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('⚠️ 팩트체크 JSON 파싱 실패:', resp.slice(0, 300));
    return { status: 'pass', issues: [], summary: 'JSON parse failed, assuming pass' };
  }
}

async function reviseArticle(articleHtml, topic, factCheckResult) {
  const issueSummary = factCheckResult.issues
    .map((iss, i) => `${i + 1}. [${iss.severity}] ${iss.sentence} → ${iss.suggestion}`)
    .join('\n');
  const systemPrompt = `당신은 박과일입니다. 팩트체커가 지적한 이슈만 보수적으로 수정하세요.`;
  const userPrompt = `이슈:\n${issueSummary}\n\n이 이슈만 반영해 수정. 다른 부분 유지. HTML 형식 유지. HTML만 출력.\n\n===== 원본 =====\n${articleHtml}`;
  return await callGemini(userPrompt, systemPrompt, { temperature: 0.3 });
}

// ========== SEO 검색 설명 ==========
async function generateSearchDescription(topic, articleHtml) {
  const systemPrompt = `당신은 SEO 전문가. 블로그 포스트의 "검색 설명(meta description)"을 작성.
규칙:
- 120~150자 (공백 포함)
- 핵심 키워드 앞쪽 배치
- 클릭 유도형, 과장 금지
- "~입니다", "~해요" 어미 통일
- 특수문자·따옴표·줄바꿈 금지
- 평문만 출력`;
  const userPrompt = `제목: ${topic.title}
라벨: ${(topic.labels || []).join(', ')}

본문 앞부분:
${articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800)}

**한 줄로, 120~150자, 평문만.**`;
  const raw = await callGemini(userPrompt, systemPrompt, {
    temperature: 0.5,
    maxTokens: 500,
    model: 'gemini-2.5-flash',
    disableThinking: true,
  });
  return raw.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
}

// ========== 주제 ==========
function loadTopics() {
  const p = path.join(__dirname, 'fruit-blog', 'topics.yaml');
  return yaml.load(fs.readFileSync(p, 'utf8'));
}
function saveTopics(data) {
  const p = path.join(__dirname, 'fruit-blog', 'topics.yaml');
  fs.writeFileSync(p, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf8');
}

// ========== publish-draft-fruit.js 실행 ==========
function runPublishDraft({ dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labels, slug = '', searchDescription = '', publishDate = '' }) {
  const r = spawnSync(
    'node',
    ['publish-draft-fruit.js', dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labels, slug, searchDescription, publishDate],
    { cwd: __dirname, stdio: 'inherit' }
  );
  return r.status === 0;
}

// 과일 블로그용 publishDate 결정
// --keep-draft       → '' (DRAFT)
// --publish-at ISO   → ISO 그대로
// --offset-days N    → N일 뒤 18:00 KST
// 기본 → 'now' (즉시 발행)
function resolvePublishDate(args) {
  if (args.includes('--keep-draft')) return '';
  const publishAtIdx = args.indexOf('--publish-at');
  if (publishAtIdx >= 0 && args[publishAtIdx + 1]) return args[publishAtIdx + 1];

  const offsetIdx = args.indexOf('--offset-days');
  if (offsetIdx >= 0 && args[offsetIdx + 1]) {
    const offset = parseInt(args[offsetIdx + 1], 10);
    return slotToISO(SLOTS.fruit[0], offset);
  }

  return 'now';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== 메인 ==========
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dayArg = args.indexOf('--day') >= 0 ? parseInt(args[args.indexOf('--day') + 1]) : null;
  const publishDate = resolvePublishDate(args);

  const topicsData = loadTopics();
  let topic;
  if (dayArg) {
    topic = topicsData.topics.find(t => t.day === dayArg);
    if (!topic) throw new Error(`Day ${dayArg} 주제 없음`);
  } else {
    topic = topicsData.topics.find(t => t.status === 'ready');
    if (!topic) {
      console.log('✋ 다음 쓸 주제 없음 (ready 없음).');
      await notifyTelegram('ℹ️ <b>과일블로그 발행 스킵</b>\n다음 쓸 주제 없음 (ready 상태인 topic 없음).');
      return;
    }
  }

  console.log(`\n🍎 오늘의 주제: Day ${topic.day} — ${topic.title}`);
  console.log(`   클러스터: ${topic.cluster}, 이모지: ${topic.emoji}\n`);

  const topicIdx = topicsData.topics.findIndex(t => t.day === topic.day);
  const nextTopic = topicsData.topics[topicIdx + 1];

  // 관련 상품 정보 (참고용으로만, 본문 이미지는 AI로 생성)
  const allProducts = loadProducts();
  const relatedImages = findRelatedProducts(topic, allProducts, 3);

  const samplesIdxPath = path.join(__dirname, 'fruit-blog', 'samples', 'index.json');
  const samplesAvailable = fs.existsSync(samplesIdxPath)
    ? JSON.parse(fs.readFileSync(samplesIdxPath, 'utf8')).length
    : 0;
  const clusterPosts = loadSameClusterPosts(topic, topicsData);
  console.log(`📝 [1/4] 박과일 초안 작성 중... (기존 글 ${Math.min(3, samplesAvailable)}편 스타일 학습${clusterPosts.length > 0 ? `, 같은 클러스터 ${clusterPosts.length}편 중복 회피` : ''})`);
  let articleHtml = await writeArticle(topic, nextTopic, relatedImages, topicsData);
  articleHtml = articleHtml.replace(/^```html\s*/gm, '').replace(/^```\s*$/gm, '').trim();
  articleHtml = articleHtml.replace(/^\s*<h2>[^<]*Day\s*\d+[^<]*<\/h2>\s*/i, '');

  // Gemini가 실수로 끼워넣은 외부 이미지·placeholder 전부 제거
  articleHtml = articleHtml.replace(/<img[^>]*>/gi, '');
  articleHtml = articleHtml.replace(/<div[^>]*>\s*<\/div>/gi, '');
  articleHtml = articleHtml.replace(/\[\[IMAGE_BODY_\d\]\]/g, '');
  articleHtml = articleHtml.replace(/\{\{IMAGE_BODY_\d\}\}/g, '');

  console.log(`   ✓ ${articleHtml.length}자 초안 완료\n`);

  console.log('🔍 [2/4] 팩트체크 중...');
  const checkResult = await factCheck(articleHtml, topic);
  console.log(`   판정: ${checkResult.status}`);
  console.log(`   요약: ${checkResult.summary}`);
  if (checkResult.issues?.length > 0) {
    console.log(`   이슈 ${checkResult.issues.length}개:`);
    checkResult.issues.forEach((iss, i) => console.log(`     ${i + 1}. [${iss.severity}] ${iss.sentence}`));
  }
  console.log('');

  if (checkResult.status === 'needs_revision' && checkResult.issues.some(i => i.severity === 'high')) {
    console.log('✏️ [3/4] 피드백 반영 재작성 중...');
    articleHtml = await reviseArticle(articleHtml, topic, checkResult);
    articleHtml = articleHtml.replace(/^```html\s*/gm, '').replace(/^```\s*$/gm, '').trim();
    console.log(`   ✓ 수정 완료 (${articleHtml.length}자)\n`);
  } else {
    console.log('✅ [3/4] 팩트 이슈 없음, 원본 유지\n');
  }

  const dayId = `day-${String(topic.day).padStart(2, '0')}`;
  const htmlRelPath = `fruit-blog/drafts/${dayId}-${topic.slug}.html`;
  const htmlAbsPath = path.join(__dirname, htmlRelPath);

  // AI 본문 이미지 2장 생성 + HTML에 삽입
  console.log('🎨 [이미지] Imagen 4 Fast로 본문 이미지 2장 생성 중...');
  try {
    const prompts = await generateImagePrompts(topic);
    console.log(`   프롬프트 1: ${prompts[0].slice(0, 80)}...`);
    console.log(`   프롬프트 2: ${prompts[1].slice(0, 80)}...`);

    const imgDir = path.join(__dirname, 'fruit-blog', 'images');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    // 매 업로드마다 타임스탬프 붙여 Blogger CDN 캐시 회피
    const imgTs = Date.now();
    const img1RelPath = `fruit-blog/images/${dayId}-${imgTs}-body-1.jpg`;
    const img2RelPath = `fruit-blog/images/${dayId}-${imgTs}-body-2.jpg`;
    const img1AbsPath = path.join(__dirname, img1RelPath);
    const img2AbsPath = path.join(__dirname, img2RelPath);

    // 같은 dayId의 기존 이미지 파일 정리 (로컬)
    try {
      const oldImgs = fs.readdirSync(imgDir).filter(f => f.startsWith(dayId + '-') && (f.endsWith('.jpg') || f.endsWith('.png')) && !f.includes(String(imgTs)));
      oldImgs.forEach(f => fs.unlinkSync(path.join(imgDir, f)));
    } catch {}

    await generateImage(prompts[0], img1AbsPath);
    const img1Size = fs.statSync(img1AbsPath).size;
    console.log(`   ✓ 이미지 1 저장: ${img1RelPath} (${Math.round(img1Size / 1024)}KB)`);
    await generateImage(prompts[1], img2AbsPath);
    const img2Size = fs.statSync(img2AbsPath).size;
    console.log(`   ✓ 이미지 2 저장: ${img2RelPath} (${Math.round(img2Size / 1024)}KB)`);

    // HTML에 이미지 삽입 위치 결정: 2번째 <h2> 앞, 4번째 <h2> 앞
    const repo = process.env.GITHUB_REPOSITORY;
    const isCI = process.env.GITHUB_ACTIONS === 'true' && repo;

    let img1Src, img2Src;
    if (isCI) {
      img1Src = `https://raw.githubusercontent.com/${repo}/main/${img1RelPath}`;
      img2Src = `https://raw.githubusercontent.com/${repo}/main/${img2RelPath}`;
    } else {
      // 로컬: base64 (JPG)
      img1Src = `data:image/jpeg;base64,${fs.readFileSync(img1AbsPath).toString('base64')}`;
      img2Src = `data:image/jpeg;base64,${fs.readFileSync(img2AbsPath).toString('base64')}`;
    }

    const h2Positions = [];
    const h2Regex = /<h2[^>]*>/gi;
    let m;
    while ((m = h2Regex.exec(articleHtml)) !== null) {
      h2Positions.push(m.index);
    }
    const body1Tag = imgTag(img1Src, prompts[0].slice(0, 80));
    const body2Tag = imgTag(img2Src, prompts[1].slice(0, 80));
    const insertAt = [];
    if (h2Positions.length >= 4) {
      insertAt.push({ pos: h2Positions[3], html: body2Tag });
      insertAt.push({ pos: h2Positions[1], html: body1Tag });
    } else if (h2Positions.length >= 3) {
      insertAt.push({ pos: h2Positions[2], html: body2Tag });
      insertAt.push({ pos: h2Positions[1], html: body1Tag });
    } else if (h2Positions.length >= 2) {
      insertAt.push({ pos: h2Positions[1], html: body1Tag });
      articleHtml = articleHtml.replace(
        /(<p[^>]*text-align:center[^>]*>📍[^<]*<\/p>)/,
        `${body2Tag}\n$1`
      );
    }
    for (const { pos, html } of insertAt) {
      articleHtml = articleHtml.slice(0, pos) + html + '\n' + articleHtml.slice(pos);
    }

    // CI에서는 이미지를 GitHub에 커밋 & 푸시
    if (isCI) {
      const run = (args) => {
        const r = spawnSync('git', args, { cwd: __dirname, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.stdout}`);
        return r.stdout;
      };
      try {
        run(['config', 'user.name', 'github-actions[bot]']);
        run(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
        run(['add', img1RelPath, img2RelPath]);
        const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: __dirname });
        if (diff.status !== 0) {
          run(['commit', '-m', `chore: AI body images for fruit ${dayId} [skip ci]`]);
          run(['push']);
          console.log('   ✓ 이미지 GitHub 푸시 완료');
        }
      } catch (e) {
        console.warn(`   ⚠️ 이미지 푸시 실패: ${e.message}`);
      }
    }
    console.log('');
  } catch (e) {
    console.warn(`   ⚠️ 본문 이미지 생성 실패 (이미지 없이 진행): ${e.message}\n`);
  }

  fs.writeFileSync(htmlAbsPath, articleHtml, 'utf8');
  console.log(`💾 저장: ${htmlRelPath}\n`);

  console.log('🔎 [4/4] SEO 검색 설명 생성 중...');
  let searchDescription = '';
  try {
    searchDescription = await generateSearchDescription(topic, articleHtml);
    console.log(`   ✓ ${searchDescription.length}자: ${searchDescription}\n`);
  } catch (e) {
    console.warn(`   ⚠️ 검색 설명 생성 실패: ${e.message}`);
  }

  if (dryRun) {
    console.log('✋ --dry-run: 업로드 생략');
    return;
  }

  const publishLabel = !publishDate ? 'DRAFT 유지' : publishDate === 'now' ? '즉시 발행' : `예약: ${formatSlotKorean(publishDate)}`;
  console.log(`☁️ [업로드] Blogger → ${publishLabel}`);
  const ok = runPublishDraft({
    dayId,
    emoji: topic.emoji,
    postTitle: topic.title,
    thumbTitle: topic.thumb_title,
    sub1: topic.subtitle[0] || '',
    sub2: topic.subtitle[1] || '',
    htmlPath: htmlRelPath,
    labels: (topic.labels || []).join(','),
    slug: topic.slug || '',
    searchDescription,
    publishDate,
  });
  if (!ok) throw new Error(`Blogger 업로드 실패 (Day ${topic.day})`);

  const isFutureSchedule = publishDate && publishDate !== 'now' && new Date(publishDate).getTime() > Date.now();
  if (!publishDate) {
    topic.status = 'draft';
  } else if (isFutureSchedule) {
    topic.status = 'scheduled';
    topic.scheduled_for = publishDate;
  } else {
    topic.status = 'published';
    topic.published_at = new Date().toISOString();
  }
  topic.generated_at = new Date().toISOString();
  let nextPending = null;
  if (!dayArg) {
    nextPending = topicsData.topics.find(t => t.status === 'pending');
    if (nextPending) {
      nextPending.status = 'ready';
      console.log(`\n🔄 다음 주제: Day ${nextPending.day} — ${nextPending.title}`);
    }
  }
  saveTopics(topicsData);

  console.log('\n🎉 과일블로그 사이클 완료!');

  const nextInfo = nextPending
    ? `\n\n🔜 <b>다음 예정:</b> Day ${nextPending.day} — ${nextPending.title}`
    : '\n\n🏁 모든 주제 소진';
  const seoBlock = searchDescription
    ? `\n\n📎 <b>파머링크</b>\n<code>${topic.slug}</code>\n\n📝 <b>검색 설명</b>\n<code>${escapeHtml(searchDescription)}</code>`
    : `\n\n📎 <b>파머링크</b>\n<code>${topic.slug}</code>`;

  let statusHeader, statusNote;
  if (!publishDate) {
    statusHeader = '🍎 <b>과일블로그 DRAFT 업로드</b>';
    statusNote = `\n\n💡 Blogger 확인:\nhttps://www.blogger.com/u/0/blog/posts/${process.env.FRUIT_BLOG_ID || ''}`;
  } else if (isFutureSchedule) {
    statusHeader = '🍎 <b>과일블로그 예약 발행</b>';
    statusNote = `\n\n⏰ 발행 예정: <b>${formatSlotKorean(publishDate)}</b>`;
  } else {
    statusHeader = '🍎 <b>과일블로그 즉시 발행</b>';
    statusNote = '\n\n🌐 LIVE 상태';
  }

  await notifyTelegram(
    `${statusHeader}\n\n` +
    `📌 <b>Day ${topic.day}</b> — ${topic.title}\n` +
    `🏷️ ${(topic.labels || []).join(', ')}` +
    seoBlock +
    statusNote +
    nextInfo
  );
}

main().catch(async (err) => {
  console.error('❌ 실행 중 에러:', err);
  await notifyTelegram(
    `🚨 <b>과일블로그 발행 실패</b>\n\n` +
    `에러: ${String(err.message || err).slice(0, 500)}\n\n` +
    `GitHub Actions 로그:\n` +
    `https://github.com/khe3716/content-studio/actions`
  );
  process.exit(1);
});
