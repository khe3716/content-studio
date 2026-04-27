// 재테크 팀 공용 헬퍼
//   - .env 로더
//   - Gemini 2.5 Pro 호출 (callGemini)
//   - 페르소나 md 로더 (agents/finance/ → agents/ 순서)
//   - Blogger OAuth 토큰 발급 (publish-draft.js 패턴 재사용)
//   - 텔레그램 알림 (선택적)

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const DEFAULT_MODEL = 'gemini-2.5-pro';

// ========== .env 로더 ==========
function loadEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
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
loadEnv();

// ========== 페르소나 로드 ==========
// 탐색 순서: agents/finance/{name}.md → agents/{name}.md
function loadPersona(name) {
  const candidates = [
    path.join(AGENTS_DIR, 'finance', `${name}.md`),
    path.join(AGENTS_DIR, `${name}.md`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error(`페르소나 파일 없음: ${name} (시도 경로: ${candidates.join(', ')})`);
}

// ========== Gemini 호출 ==========
async function callGemini(userPrompt, systemPrompt, opts = {}) {
  const { temperature = 0.6, maxTokens = 8192, model = DEFAULT_MODEL } = opts;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수 없음');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const finishReason = data.candidates?.[0]?.finishReason || 'unknown';
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(
      `Gemini 응답 비어있음 (finishReason=${finishReason}` +
      (blockReason ? `, blockReason=${blockReason}` : '') + ')'
    );
  }
  return text.trim();
}

// ========== Gemini 재시도 래퍼 ==========
// JSON 응답 파싱 실패하거나 너무 짧으면 최대 N회 재시도
async function callGeminiJSON(userPrompt, systemPrompt, opts = {}) {
  const { maxRetries = 3, minLength = 50, ...rest } = opts;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const raw = await callGemini(userPrompt, systemPrompt, rest);
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      if (cleaned.length < minLength) throw new Error(`응답 너무 짧음 (${cleaned.length}자)`);
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        await sleep(2000 * attempt);
      }
    }
  }
  throw new Error(`callGeminiJSON 최종 실패: ${lastErr.message}`);
}

// ========== Blogger OAuth ==========
async function getBloggerAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN 미설정');
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Blogger OAuth 토큰 발급 실패: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.access_token;
}

// ========== 텔레그램 알림 ==========
async function notifyTelegram(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.log('[telegram] skip — TELEGRAM_BOT_TOKEN / CHAT_ID 미설정');
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.warn('[telegram] 전송 실패 (무시):', e.message);
  }
}

// ========== 작은 유틸 ==========
const sleep = ms => new Promise(r => setTimeout(r, ms));

function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

module.exports = {
  REPO_ROOT,
  AGENTS_DIR,
  loadPersona,
  callGemini,
  callGeminiJSON,
  getBloggerAccessToken,
  notifyTelegram,
  sleep,
  todayKST,
  readJSON,
  writeJSON,
  ensureDir,
};
