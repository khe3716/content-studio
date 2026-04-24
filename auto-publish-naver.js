// 과일 블로그(Blogger) 글 → 네이버 스마트에디터용 HTML
// - Gemini 리라이팅으로 네이버 톤(이웃 대상, 3,000자+, 체험·구어체)
// - Imagen 4 Fast로 섹션별 이미지 5~6장 자동 생성
// - 스마트에디터 복붙 포맷으로 클리닝
//
// 사용법:
//   node auto-publish-naver.js                # topics.yaml의 최근 draft/ready 주제
//   node auto-publish-naver.js --day 2        # 특정 Day
//   node auto-publish-naver.js --skip-rewrite # Gemini 건너뛰고 클리닝만 (디버그용)

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const sharp = require('sharp');

// ========== env ==========
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
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
const GEMINI_MODEL = 'gemini-2.5-pro';

const FRUIT_DRAFTS_DIR = path.join(__dirname, 'fruit-blog', 'drafts');
const NAVER_DRAFTS_DIR = path.join(__dirname, 'naver-blog', 'drafts');
const NAVER_IMAGES_DIR = path.join(__dirname, 'naver-blog', 'images');
const TOPICS_PATH = path.join(__dirname, 'fruit-blog', 'topics.yaml');
const PERSONA_PATH = path.join(__dirname, 'agents', 'park-gwail-naver.md');

// ========== 텔레그램 ==========
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
    if (!res.ok) console.error('⚠️ 텔레그램 실패:', await res.text());
  } catch (e) { console.error('⚠️ 텔레그램 예외:', e.message); }
}

// ========== Gemini ==========
async function callGemini(userPrompt, systemPrompt, { temperature = 0.7, maxTokens = 16384, model = GEMINI_MODEL } = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 없음');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답 비어있음');
  return text;
}

// ========== Nano Banana (Gemini 2.5 Flash Image Preview) ==========
// Imagen 4 Fast (일일 70장) → Nano Banana (일일 2,000장) 전환.
// API 형식이 다름: generateContent + responseModalities=IMAGE.
async function generateImage(prompt, outputPath) {
  const model = 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  // 안티-AI티 · 리얼리즘 강제 규칙:
  // 1) 사람·손 등장 금지
  // 2) 텍스트·한글 삽입 금지 (AI가 한국어 텍스트를 항상 깨뜨림)
  // 3) 베리류 꼭지(calyx·green stem) 금지 — 유통 과일은 꼭지 제거된 상태
  // 4) 물리법칙 준수 + 실제 스마트폰 사진 같은 리얼리즘 (AI 아티팩트 제거)
  let safePrompt = prompt;
  if (!/no people/i.test(safePrompt)) safePrompt += '. No people, no hands, no human figures.';
  if (!/no text/i.test(safePrompt)) safePrompt += ' No text, no writing, no korean characters, no labels, no captions, no signs, no watermarks, no posters, no notes.';
  if (/raspberr|blueberr|산딸기|블루베리|berry|berries/i.test(safePrompt) && !/calyx|stem/i.test(safePrompt)) {
    safePrompt += ' Berries without green calyx or stem attached — clean, hulled fruit only.';
  }
  // 물리·리얼리즘 강제: 프롬프트 후단에 항상 추가
  safePrompt += ' Physically accurate, correct proportions, consistent shadows and lighting from a single natural light source, realistic depth of field, authentic unedited smartphone photograph quality, natural color temperature, subtle imperfections and slight grain, no AI artifacts, no floating or levitating objects, no impossible geometry, no melting or distorted shapes, no duplicate or malformed items.';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: safePrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!res.ok) throw new Error(`Nano Banana API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart) throw new Error('Nano Banana 응답에 이미지 없음');
  const b64 = imagePart.inlineData.data;
  const resized = await sharp(Buffer.from(b64, 'base64'))
    .resize(800, 800, { kernel: 'lanczos3', fit: 'cover' })
    .jpeg({ quality: 82 })
    .toBuffer();
  const jpgPath = outputPath.replace(/\.png$/i, '.jpg');
  fs.writeFileSync(jpgPath, resized);
  return jpgPath;
}

// ========== 네이버 샘플 로드 (스타일 few-shot) ==========
function loadWritingSamples(count = 2, maxCharsPerSample = 6000) {
  // 네이버 블로그 전용 샘플 우선. 없으면 구글 블로거 샘플 fallback.
  const naverDir = path.join(__dirname, 'naver-blog', 'samples');
  const naverIdx = path.join(naverDir, 'index.json');
  let dir = naverDir;
  let idx = naverIdx;
  if (!fs.existsSync(idx)) {
    // fallback
    dir = path.join(__dirname, 'fruit-blog', 'samples');
    idx = path.join(dir, 'index.json');
    if (!fs.existsSync(idx)) return [];
  }
  const items = JSON.parse(fs.readFileSync(idx, 'utf8'));
  const picked = items.length <= count ? items : [...items].sort(() => Math.random() - 0.5).slice(0, count);
  return picked.map(m => {
    const fp = path.join(dir, m.file);
    if (!fs.existsSync(fp)) return null;
    let html = fs.readFileSync(fp, 'utf8');
    if (html.length > maxCharsPerSample) html = html.slice(0, maxCharsPerSample) + '\n<!-- ...(뒷부분 생략) -->';
    return { title: m.title, html };
  }).filter(Boolean);
}

// ========== HTML 클리닝 ==========
function cleanForNaver(html, { imageBaseUrl } = {}) {
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  out = out.replace(
    /<div[^>]*text-align:center;margin:0 0 (?:24|32)px 0;[^>]*>\s*<img[^>]*\/?>[\s\S]*?<\/div>\s*/gi,
    ''
  );
  out = out.replace(/\sclass="[^"]*"/gi, '');
  if (imageBaseUrl) {
    out = out.replace(/src="(?!https?:|data:)([^"]+)"/gi, (m, relPath) => {
      const clean = relPath.replace(/^\.?\/?/, '');
      return `src="${imageBaseUrl}/${clean}"`;
    });
  }
  out = out.replace(/<p>\s*<\/p>/gi, '');
  out = out.replace(/<div>\s*<\/div>/gi, '');

  // 네이버 스마트에디터 줄바꿈 강화:
  // 네이버는 <p> 간 margin이 기본 0이라 문단이 한 덩어리로 보임.
  // 각 <p> / <h> 앞에 빈 <p><br></p> 삽입해 강제 공백.
  out = out.replace(/(<\/p>)\s*(<p[^>]*>)/gi, '$1\n<p>&nbsp;</p>\n$2');
  out = out.replace(/(<\/p>)\s*(<h[1-6])/gi, '$1\n<p>&nbsp;</p>\n$2');
  out = out.replace(/(<\/h[1-6]>)\s*(<p[^>]*>)/gi, '$1\n<p>&nbsp;</p>\n$2');
  out = out.replace(/(<\/ol>|<\/ul>)\s*(<p[^>]*>|<h[1-6])/gi, '$1\n<p>&nbsp;</p>\n$2');

  // 네이버 관습 + 사용자 요청: 전체 블록 요소 가운데 정렬.
  // <h1>, <h2>, <h3>, <p>, <blockquote>, <li> 모두에 text-align:center 추가.
  // 이미 style이 있으면 text-align만 앞에 붙이고, 없으면 style 통째로 추가.
  const centerTags = ['h1', 'h2', 'h3', 'p', 'blockquote', 'li'];
  centerTags.forEach(tag => {
    const re = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
    out = out.replace(re, (m, attrs = '') => {
      if (/style=/i.test(attrs)) {
        if (/text-align/i.test(attrs)) return m;
        return m.replace(/style="([^"]*)"/i, 'style="text-align:center;$1"');
      }
      return `<${tag}${attrs || ''} style="text-align:center;">`;
    });
  });

  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function wrapForCopyPaste(cleanedHtml, { title, day }) {
  return `<!--
  네이버 블로그 ${day ? 'Day ' + day + ' — ' : ''}${title}
  이 HTML 전체를 복사해서 네이버 블로그 스마트에디터 우하단 '</>' 버튼 눌러 붙여넣으세요.
  이미지는 자동으로 네이버 서버에 재업로드됩니다 (약간 기다리세요).
-->
${cleanedHtml}
`;
}

// ========== Gemini 네이버 전용 새 작성 ==========
// 구글 Blogger 원본은 '사실 확인용 참고 자료'로만 사용하고,
// 네이버 블로그 글은 처음부터 새로 씀 (섹션 구성·사진 배치·흐름 모두 네이버 관습).
async function rewriteForNaver(topic, originalHtml) {
  const persona = fs.readFileSync(PERSONA_PATH, 'utf8');
  const samples = loadWritingSamples(2, 2000);

  const samplesHint = samples.length > 0
    ? `\n\n# 스타일 참고 (네이버 블로그 전용 샘플 — 이 톤·구조·어조를 반드시 그대로 따라올 것) ★★★\n\n아래 샘플은 네이버 블로그 특유의 수다체, 드라마틱한 섹션 제목, 의인화 비유, 이모지 밀도, 문단 길이, 마무리 구조의 **모범 답안**입니다. 새 글은 이 샘플과 **같은 어조·같은 구조·같은 리듬**으로 만들어 주세요. 단, 사진 수는 샘플보다 **훨씬 많게(10~12장)** 배치하세요.\n\n${samples.map((s, i) => `===== 샘플 ${i + 1}: ${s.title} =====\n${s.html}\n===== 샘플 ${i + 1} 끝 =====`).join('\n\n')}\n`
    : '';

  const systemPrompt = `${persona}${samplesHint}`;

  const topicLabels = Array.isArray(topic.labels) ? topic.labels.join(', ') : '';
  const clusterHint = topic.cluster ? `카테고리: ${topic.cluster}` : '';

  const userPrompt = `네이버 블로그용 글을 **처음부터 새로 작성**해 주세요. 아래 구글 Blogger 원본은 **사실 확인용 참고 자료**입니다 — 그대로 번역·리라이팅하지 말고, 핵심 사실(수치, 과학 원리, 선별 포인트)만 추출해 네이버 블로그 관습대로 완전히 재구성하세요.

주제: Day ${topic.day} — ${topic.title}
${clusterHint}
${topicLabels ? `핵심 키워드: ${topicLabels}` : ''}

== 참고 자료 (사실 확인용만 — 표현·구조는 옮기지 말 것) ==
${originalHtml}

== 작성 지침 ★★★ ==
1. **원본을 그대로 옮기지 말 것**: 원본은 정보체 2000~2500자 구글 글이고, 네이버는 수다체 3000~3500자 + 사진 10장+ 글이야. 완전히 다른 매체라서 **섹션 구성·예시·비유·흐름을 샘플 스타일로 처음부터 짜야** 해.
2. **제목**: 샘플처럼 공감 질문 + 숫자 약속 + 이모지 포함한 긴 제목. 예: "[내돈내산] ... 속상하셨죠? 😭 2배 오래 가는 3단계 ..."
3. **도입부 400자**: 인사("안녕하세요 이웃님들~!") + 본인 소개("과일 박사, 박과일이에요 😊") + 구체적 개인 스토리 + 공감대 형성 + 오늘의 약속
4. **섹션 5~6개**, 제목은 반드시 **드라마틱하게** (예: "저의 눈물겨운 실패담 😭", "도대체 왜 이렇게 예민할까요?", "'산딸기 호텔' 만들어주기")
5. **각 섹션 문단 2~3개, 각 문단 3~5줄**. 긴 문단 금지. 네이버 가독성 핵심은 **여백**.
6. **★ 사진은 섹션당 2장 이상, 글 전체 10~12장 필수**. 플레이스홀더 <!-- [[IMG_1]] --> ~ <!-- [[IMG_10]] --> (필요 시 11, 12까지) 를 섹션 문단 사이사이 배치. 레시피·과정형 포스트는 12장까지.
7. **★ 사진 유형 다양화**: 히어로 샷·재료 레이아웃·도구 샷·과정 샷·Before/After·단면 클로즈업·용기 샷·플레이팅·분위기 컷·비교 샷 중 **최소 5가지 이상** 섞을 것. 같은 유형 반복 금지.
8. **의인화·비유 풍부하게**: "피부 얇은 아기", "뽀송뽀송 침대", "사회적 거리두기", "숨구멍" 같은 표현
9. **이모지 적극**: 섹션당 2~5개 (😭🙌😊👍😱❤️🫐🍓📌💡)
10. **핵심 키워드 <strong>**로 볼드
11. **마무리**: 3줄 요약 <ol> + 댓글 유도 + 이웃 유도 + 다음 글 예고 (샘플 마무리 그대로 따라)
12. **★ 가운데 정렬 강조 문구**: 섹션 안에 체크리스트 헤더·한 줄 핵심 강조·인용 문구는 **<blockquote>로 감싸기** (자동 가운데 정렬됨). 예: <blockquote>💡 한눈에 보는 산딸기 선별 체크리스트</blockquote>, <blockquote>"용기 바닥만 확인해도 실패 확률 확 줄어요!"</blockquote>. 표 바로 위 또는 핵심 결론 자리에 배치.
13. 총 3,000~3,500자
14. 달콤살랑·스토어·상품명·외부 쇼핑 링크 절대 금지
15. **image-prompts 섹션에 반드시 10~12개** 프롬프트 생성 (사진 유형 다양화 규칙 준수). 사람·손 등장 금지 (no people, no hands).
   - **★ 스튜디오 vs 홈샷 혼합**: 12장 중 2장만 스튜디오풍("Photorealistic food photography, clean studio lighting, shallow depth of field, ..."), 나머지 8~10장은 아마추어 스마트폰 샷풍 — 아래 패턴 중 하나를 반드시 섞을 것:
     - "Casual smartphone photo taken in a Korean home kitchen, natural window light, slightly imperfect composition, of ..."
     - "Amateur iPhone snapshot of ... on a Korean kitchen counter, soft afternoon daylight, realistic unedited look"
     - "Korean naver blog style food photo, handheld, home kitchen background, authentic everyday feel, of ..."
     - "Unedited close-up phone photo of ..., natural home lighting, slight motion blur, lived-in feel"
     - "Everyday home cooking photo, diffused window light, plain dish on wooden table, casual arrangement of ..."
   - 금지 토큰: "8k", "hyperrealistic", "professional studio", "cinematic", "food magazine cover" — AI 티만 더 납니다.
   - 권장 토큰: "natural window light", "slightly imperfect", "casual", "home kitchen", "unedited", "authentic", "Korean home cooking", "lived-in"
16. 출력은 <naver-html>...</naver-html> + <image-prompts>...</image-prompts> 포맷만`;

  const response = await callGemini(userPrompt, systemPrompt, { temperature: 0.8, maxTokens: 16384 });
  return response;
}

function parseRewriteResponse(response) {
  const htmlMatch = response.match(/<naver-html>([\s\S]*?)<\/naver-html>/);
  const promptsMatch = response.match(/<image-prompts>([\s\S]*?)<\/image-prompts>/);
  if (!htmlMatch) throw new Error('리라이팅 응답에 <naver-html> 태그 없음');
  const html = htmlMatch[1].trim();
  const promptsRaw = promptsMatch ? promptsMatch[1].trim() : '';
  const prompts = promptsRaw
    .split('\n')
    .map(l => l.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean);
  return { html, prompts };
}

async function generateSectionImages(topic, prompts) {
  if (!fs.existsSync(NAVER_IMAGES_DIR)) fs.mkdirSync(NAVER_IMAGES_DIR, { recursive: true });
  const ts = Date.now();
  const dayId = `day-${String(topic.day).padStart(2, '0')}`;
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    const outPath = path.join(NAVER_IMAGES_DIR, `${dayId}-naver-${ts}-${i + 1}.jpg`);
    console.log(`   🎨 이미지 ${i + 1}/${prompts.length}: ${prompt.slice(0, 60)}...`);
    try {
      const saved = await generateImage(prompt, outPath);
      const rel = path.relative(__dirname, saved).replace(/\\/g, '/');
      results.push(rel);
      console.log(`      ✓ ${path.basename(saved)}`);
    } catch (e) {
      console.warn(`      ⚠️ 실패 (스킵): ${e.message}`);
      results.push(null);
    }
  }
  return results;
}

function injectImages(html, imageRelPaths, imageBaseUrl) {
  let out = html;
  imageRelPaths.forEach((rel, i) => {
    const n = i + 1;
    const placeholder = new RegExp(`<!--\\s*\\[\\[IMG_${n}\\]\\]\\s*-->`, 'g');
    if (!rel) {
      out = out.replace(placeholder, ''); // 실패한 이미지는 그냥 제거
      return;
    }
    const src = `${imageBaseUrl}/${rel}`;
    const tag = `<p style="text-align:center;"><img src="${src}" alt="Day image ${n}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
    out = out.replace(placeholder, tag);
  });
  // 혹시 남은 플레이스홀더 제거
  out = out.replace(/<!--\s*\[\[IMG_\d+\]\]\s*-->/g, '');
  return out;
}

// ========== Day 선택 ==========
function loadTopics() { return yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8')); }
function pickTopic(dayArg) {
  const data = loadTopics();
  if (dayArg) {
    const t = data.topics.find(t => t.day === dayArg);
    if (!t) throw new Error(`Day ${dayArg} 없음`);
    return t;
  }
  const draft = [...data.topics].reverse().find(t => t.status === 'draft');
  if (draft) return draft;
  const ready = data.topics.find(t => t.status === 'ready');
  if (ready) return ready;
  throw new Error('변환할 주제 없음');
}
function findDraftFile(topic) {
  const prefix = `day-${String(topic.day).padStart(2, '0')}-${topic.slug}`;
  const candidates = fs.readdirSync(FRUIT_DRAFTS_DIR).filter(f => f.startsWith(prefix) && f.endsWith('.html'));
  if (candidates.length === 0) throw new Error(`Blogger 드래프트 없음: ${prefix}*.html`);
  return path.join(FRUIT_DRAFTS_DIR, candidates[0]);
}

// ========== 메인 ==========
(async () => {
  try {
    const args = process.argv.slice(2);
    const dayArg = args.indexOf('--day') >= 0 ? parseInt(args[args.indexOf('--day') + 1]) : null;
    const skipRewrite = args.includes('--skip-rewrite');

    const topic = pickTopic(dayArg);
    console.log(`\n🍎 네이버 변환: Day ${topic.day} — ${topic.title}`);

    const srcPath = findDraftFile(topic);
    const originalHtml = fs.readFileSync(srcPath, 'utf8');
    console.log(`   📄 원본: ${path.relative(__dirname, srcPath)} (${Math.round(originalHtml.length / 1024)}KB)`);

    const repo = process.env.GITHUB_REPOSITORY || 'khe3716/content-studio';
    const imageBaseUrl = `https://raw.githubusercontent.com/${repo}/main`;

    let finalHtml;
    if (skipRewrite) {
      console.log(`   ⏭️  Gemini 리라이팅 스킵 (--skip-rewrite)`);
      finalHtml = cleanForNaver(originalHtml, { imageBaseUrl });
    } else {
      console.log(`\n✍️ [1/3] Gemini 리라이팅 중... (네이버 톤, 3,000자+)`);
      const rewriteRaw = await callWithRetry(() => rewriteForNaver(topic, originalHtml), 2);
      const { html: rewrittenHtml, prompts } = parseRewriteResponse(rewriteRaw);
      console.log(`   ✓ 리라이팅 완료 (${Math.round(rewrittenHtml.length / 1024)}KB, 이미지 프롬프트 ${prompts.length}개)`);

      console.log(`\n🖼️ [2/3] 섹션별 이미지 ${prompts.length}장 생성 중...`);
      const imagePaths = await generateSectionImages(topic, prompts);

      console.log(`\n🧹 [3/3] 이미지 삽입 + 클리닝 중...`);
      let withImages = injectImages(rewrittenHtml, imagePaths, imageBaseUrl);
      finalHtml = cleanForNaver(withImages, { imageBaseUrl });
    }

    const wrapped = wrapForCopyPaste(finalHtml, { title: topic.title, day: topic.day });

    if (!fs.existsSync(NAVER_DRAFTS_DIR)) fs.mkdirSync(NAVER_DRAFTS_DIR, { recursive: true });
    const outName = path.basename(srcPath);
    const outPath = path.join(NAVER_DRAFTS_DIR, outName);
    fs.writeFileSync(outPath, wrapped, 'utf8');
    console.log(`\n💾 저장: ${path.relative(__dirname, outPath)} (${Math.round(wrapped.length / 1024)}KB)`);

    const rawUrl = `${imageBaseUrl}/naver-blog/drafts/${outName}`;
    console.log(`   🔗 ${rawUrl}`);

    await notifyTelegram(
      `📝 <b>네이버 블로그 변환 완료</b>\n\n` +
      `Day ${topic.day} — ${topic.title}\n` +
      `💡 Gemini 네이버 톤 리라이팅 + 섹션 이미지 자동 생성\n\n` +
      `1️⃣ 아래 링크 열기\n<a href="${rawUrl}">${outName}</a>\n\n` +
      `2️⃣ <b>HTML 주석(&lt;!-- --&gt;) 아래</b>부터 전체 복사\n\n` +
      `3️⃣ 네이버 블로그 <b>글쓰기 → 우하단 &lt;/&gt;(HTML) 버튼</b> 누르고 붙여넣기\n\n` +
      `⚠️ 초기 3개월 지수 쌓을 때까지 <b>달콤살랑 링크·언급 금지</b>`
    );

    console.log('\n✅ 완료. 텔레그램에서 복사 안내 확인.');
  } catch (err) {
    console.error('❌ 실패:', err.message);
    process.exit(1);
  }
})();

async function callWithRetry(fn, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      console.warn(`   ⚠️ 시도 ${i + 1} 실패: ${e.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}
