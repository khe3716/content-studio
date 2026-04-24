// 야간 리서치 공용 헬퍼
//   - 페르소나 md 로드
//   - Gemini 2.5 Pro 호출 (auto-publish.js 패턴 재사용)
//   - 빈약 아웃풋 시 재시도 로직 (최대 3회, 페르소나별 재시도 힌트 누적)
//   - mock 모드 (GEMINI_API_KEY 없을 때 스텁 반환)

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
// 탐색 순서: agents/night/ (야간 활성) → agents/ (낮 페르소나)
// 낮 페르소나는 야간 팀이 참조할 일 없지만 크로스 참조 대비.
function loadPersona(name) {
  const candidates = [
    path.join(AGENTS_DIR, 'night', `${name}.md`),
    path.join(AGENTS_DIR, `${name}.md`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error(`페르소나 파일 없음: ${name} (시도 경로: ${candidates.join(', ')})`);
}

// ========== Gemini 호출 ==========
async function callGemini(userPrompt, systemPrompt, opts = {}) {
  const { temperature = 0.55, maxTokens = 4096, model = DEFAULT_MODEL } = opts;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 환경변수 없음');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답 비어있음');
  return text.trim();
}

// ========== 페르소나 + 야간 모드 명시 호출 ==========
async function callPersona(name, userPrompt, opts = {}) {
  const profile = loadPersona(name);
  const systemPrompt =
    `현재 모드: **야간 리서치 팀 실행 중**\n\n` +
    `아래 페르소나 프로필의 규칙을 엄격히 따르세요. ` +
    `출력 형식·제약·금지 사항을 모두 준수합니다. ` +
    `프로필에 없는 정보를 창작하지 마세요.\n\n` +
    `---\n\n` +
    profile;
  return callGemini(userPrompt, systemPrompt, opts);
}

// ========== 빈약 아웃풋 판정 ==========
// 각 페르소나 특성에 맞춘 기본 판정 (isBankrupt 오버라이드 가능)
function defaultIsBankrupt(output) {
  if (!output || typeof output !== 'string') return true;
  const trimmed = output.trim();
  if (trimmed.length < 80) return true;
  const bankruptPhrases = [
    '특이사항 없음',
    '딱히 없',
    '정보가 없',
    '알 수 없',
    '모르겠',
    '해당 없음',
  ];
  const lower = trimmed.toLowerCase();
  // 너무 짧은 응답에만 문구 매칭 (긴 응답에서 부분 언급은 OK)
  if (trimmed.length < 200) {
    for (const p of bankruptPhrases) {
      if (trimmed.includes(p)) return true;
    }
  }
  // 빈 bullet만 있는 경우
  const bulletCount = (trimmed.match(/^[-•*]\s+\S/gm) || []).length;
  if (trimmed.length < 300 && bulletCount < 2) return true;
  return false;
}

// ========== 재시도 래퍼 (핵심) ==========
// - buildPrompt(retryHint) : 재시도 힌트를 받아 userPrompt를 리빌드하는 콜백
// - retryHints : 1차·2차·3차 재시도에 각각 추가될 힌트 배열 (페르소나별 커스텀)
// - isBankrupt : 아웃풋이 빈약한지 판정하는 콜백 (기본: defaultIsBankrupt)
// - opts.mock : true면 mockOutput 반환, false면 실제 Gemini 호출
// 반환: { output, attempts, bankrupt } — bankrupt=true면 3회 모두 실패
async function callWithRetry(name, buildPrompt, options = {}) {
  const {
    retryHints = [],
    isBankrupt = defaultIsBankrupt,
    mock = false,
    mockOutput = null,
    geminiOpts = {},
  } = options;

  if (mock) {
    const out = mockOutput || `[MOCK ${name}]\n- 실제 Gemini 호출 시 여기에 리서치 결과가 들어감\n- GEMINI_API_KEY 환경에서만 실제 작동\n- 재시도 로직 정상`;
    return { output: out, attempts: 1, bankrupt: false };
  }

  const maxTries = 1 + retryHints.length;
  let lastOutput = '';
  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const hint = attempt === 0 ? null : retryHints[attempt - 1];
    const userPrompt = buildPrompt(hint);
    try {
      const output = await callGemini(userPrompt, loadPersonaSystem(name), geminiOpts);
      lastOutput = output;
      if (!isBankrupt(output)) {
        return { output, attempts: attempt + 1, bankrupt: false };
      }
      console.log(`  ⚠️ ${name} 빈약 아웃풋 (시도 ${attempt + 1}/${maxTries}) — 재시도`);
    } catch (err) {
      console.error(`  ❌ ${name} 호출 실패 (시도 ${attempt + 1}/${maxTries}): ${err.message}`);
      lastOutput = '';
    }
  }
  console.log(`  🔴 ${name} 최종 빈약 — 수확 없음 처리`);
  return { output: lastOutput, attempts: maxTries, bankrupt: true };
}

function loadPersonaSystem(name) {
  const profile = loadPersona(name);
  return (
    `현재 모드: **야간 리서치 팀 실행 중**\n\n` +
    `아래 페르소나 프로필의 규칙을 엄격히 따르세요.\n\n---\n\n` +
    profile
  );
}

// ========== 단순 스텁 (mock 테스트용) ==========
function mockPersona(name, userPrompt) {
  return `[MOCK ${name}]\n입력 요약: ${userPrompt.slice(0, 80).replace(/\n/g, ' ')}...\n- 뼈대 검증용 스텁\n- 실제 호출은 GEMINI_API_KEY 있을 때만`;
}

module.exports = {
  callGemini,
  callPersona,
  callWithRetry,
  loadPersona,
  defaultIsBankrupt,
  mockPersona,
};
