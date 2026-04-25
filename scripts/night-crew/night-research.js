// 야간 리서치 4라운드 오케스트레이터
//
// 매일 밤 01:00 KST에 GitHub Actions가 이 스크립트 실행.
//
// 흐름 (라운드당):
//   1. 이호기심 (트렌드 조사, 이전 라운드 주제 제외)
//   2. 서사업 (이호기심 결과 → 1인 사업화 구체화)
//   3. 구현실 (서사업 결과 → 현실 체크·반론)
//   각 페르소나: 빈약 응답 시 최대 3회 재시도
//
// 4라운드 완료 후:
//   4. 박결재 (전체 라운드 결과 → 사장용 텔레그램 브리핑 최종본)
//
// 산출물:
//   - reports/YYYY-MM-DD.md       (박결재 최종 브리핑, push-morning이 읽음)
//   - reports/YYYY-MM-DD-raw.md   (4라운드 × 3명 원본, /morning 상세 조회용)
//
// 사용법:
//   node scripts/night-crew/night-research.js
//   node scripts/night-crew/night-research.js --date 2026-04-25
//   node scripts/night-crew/night-research.js --rounds 2          # 테스트용 라운드 수 감소
//   node scripts/night-crew/night-research.js --mock              # Gemini 호출 없이 뼈대 검증
//   node scripts/night-crew/night-research.js --sleep 0           # 라운드 간 sleep 생략

const fs = require('fs');
const path = require('path');

const { callWithRetry, defaultIsBankrupt } = require('./crew-runner');
const { collectNightContext, RoundMemory } = require('./data-collect');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');

// ========== 인자 파싱 ==========
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { date: null, rounds: 4, mock: false, sleepSec: 15 };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--mock') out.mock = true;
    else if (args[i] === '--date' && args[i + 1]) { out.date = args[i + 1]; i += 1; }
    else if (args[i] === '--rounds' && args[i + 1]) { out.rounds = parseInt(args[i + 1], 10); i += 1; }
    else if (args[i] === '--sleep' && args[i + 1]) { out.sleepSec = parseInt(args[i + 1], 10); i += 1; }
  }
  return out;
}

function todayKST() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sleep(sec) {
  if (!sec || sec <= 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, sec * 1000));
}

// ========== 이호기심 prompt builder ==========
function buildHogigsimPrompt(ctx, roundNum, totalRounds, previousTopics, retryHint) {
  const base = [
    `## 현재 라운드: ${roundNum}/${totalRounds}`,
    '',
    '## 사용자 사업 컨텍스트 (이 목록과 겹치는 주제 금지)',
    '```json',
    JSON.stringify({
      active_channels: ctx.active_channels.map(c => c.name),
      exclude_domains: ctx.exclude_domains,
      user_profile: ctx.user_profile,
    }, null, 2),
    '```',
    '',
    previousTopics.length > 0
      ? `## 이전 라운드들이 이미 다룬 주제 (반드시 제외)\n- ${previousTopics.join('\n- ')}`
      : '## 이전 라운드 주제: 없음 (첫 라운드)',
    '',
    '## 라운드 가이드 (라운드별 다른 영역 탐색)',
    '- Round 1: 라이프스타일·소비·취미 (인스타·커뮤니티 중심)',
    '- Round 2: 돈·재테크·부업 (쓰레드·뉴스레터 중심)',
    '- Round 3: 테크·디지털 제품·AI 활용 (레딧·디스코드 중심)',
    '- Round 4: 관계·건강·자기계발 (팟캐스트·블로그 중심)',
    '',
    '## 요청',
    '이번 라운드에 해당하는 영역에서 요즘 뜨는 주제 3~5개를 조사하고, 각 주제가 1인 사업으로 이어질 수 있는 힌트 한 줄씩 붙여주세요.',
    '페르소나 프로필의 출력 형식을 엄수하세요.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const HOGIGSIM_RETRY_HINTS = [
  '지난 응답이 빈약했습니다. 다른 플랫폼(예: 쓰레드 대신 디스코드·레딧·팟캐스트)에서 찾아보세요. 주제 3개 이상 필수.',
  '지난 응답도 빈약했습니다. 이번엔 다른 연령·성별(예: 20대 남성·40대 여성)·해외 트렌드·로컬 커뮤니티 쪽으로 시야를 바꿔보세요.',
];

// ========== 서사업 prompt builder ==========
function buildSaeopPrompt(ctx, roundNum, hogigsimOutput, previousSaeopBusinesses, retryHint) {
  const base = [
    `## 현재 라운드: ${roundNum}`,
    '',
    '## 이호기심의 트렌드 조사 결과',
    hogigsimOutput,
    '',
    '## 사용자 기존 자산 (활용 가능하면 우선)',
    '```json',
    JSON.stringify({
      active_channels: ctx.active_channels,
      product_categories: ctx.product_categories,
      user_profile: ctx.user_profile,
    }, null, 2),
    '```',
    '',
    previousSaeopBusinesses.length > 0
      ? `## 이전 라운드 사업 후보 (중복 제안 금지)\n- ${previousSaeopBusinesses.join('\n- ')}`
      : '## 이전 라운드 후보 없음 (첫 라운드)',
    '',
    '## 엄격한 제약 (재확인)',
    '- 추가 자본 0원 베스트, **최대 10만원** (Apple $99 = 13만원 → 한도 초과)',
    '- 주 10~20시간 운영',
    '- 비개발자, 노코드/튜토리얼 수준',
    '- 학습 곡선 8주 초과 금지',
    '- 3주 내 첫 수익 또는 첫 고객 피드백 가능성',
    '',
    '## 요청',
    '이호기심이 제시한 주제 중 1인 사업화 가능한 2~3개를 실행 계획으로 구체화하세요. 페르소나 프로필의 출력 형식을 엄수하세요.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const SAEOP_RETRY_HINTS = [
  '지난 응답이 빈약했습니다. 각 후보마다 주간 단위 실행 단계 3개를 툴 이름과 함께 명시하세요 (예: "월요일 Glide로 MVP, 수요일 트위터에 10개 맞팔").',
  '지난 응답도 빈약했습니다. 수익 모델과 첫 고객 확보 경로를 구체 숫자·채널로 명시하세요.',
];

// ========== 구현실 prompt builder ==========
function buildHyeonsilPrompt(ctx, roundNum, hogigsimOutput, saeopOutput, retryHint) {
  const base = [
    `## 현재 라운드: ${roundNum}`,
    '',
    '## 이호기심 원본 (근거 추적용)',
    hogigsimOutput,
    '',
    '## 서사업 사업화 리포트 (검수 대상)',
    saeopOutput,
    '',
    '## 사용자 프로필',
    '```json',
    JSON.stringify(ctx.user_profile, null, 2),
    '```',
    '',
    '## 5대 검수 기준',
    '1. 자본 한계 (10만원 이하, 숨은 비용 포함)',
    '2. 시간 현실성 (주 20시간, 학습 곡선 포함)',
    '3. 시장 포화·경쟁',
    '4. 기술 난도 (비개발자 기준, 4주 초과=조건부, 8주 초과=반려)',
    '5. 수익화 속도 (3주 내 첫 수익 플랫폼 제약 포함)',
    '',
    '## 요청',
    '서사업의 후보 각각에 대해 ✅승인 / ⚠️조건부 / ❌반려 판정과 위험 2~4개를 제시하세요. 페르소나 프로필 출력 형식 엄수.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const HYEONSIL_RETRY_HINTS = [
  '지난 응답이 빈약했습니다. 반드시 후보마다 위험 요소 2개 이상을 구체 근거로 제시하세요.',
  '지난 응답도 빈약했습니다. 5대 기준(자본·시간·시장 포화·기술 난도·수익화 속도) 중 3개 이상을 반드시 체크하세요.',
];

// ========== 서사업 후보 이름 추출 (중복 회피용) ==========
function extractBusinessNames(saeopOutput) {
  if (!saeopOutput) return [];
  const names = [];
  const lines = saeopOutput.split('\n');
  for (const l of lines) {
    // "## 후보 1: [이름]" 또는 "## 후보 1: **이름**" 등
    const m = l.match(/^##\s+후보\s+\d+[:\s]+(.+)/);
    if (m) {
      const name = m[1].replace(/\*\*/g, '').replace(/[\[\]]/g, '').trim();
      if (name) names.push(name);
    }
  }
  return names;
}

// ========== 이호기심 주제 추출 (이전 라운드 제외용) ==========
function extractHogigsimTopics(hogigsimOutput) {
  if (!hogigsimOutput) return [];
  const topics = [];
  const lines = hogigsimOutput.split('\n');
  for (const l of lines) {
    // "- 🔥 [주제]: ..." 또는 "- 🔥 주제: ..."
    const m = l.match(/^[-•*]\s+🔥\s*(.+?)[:：]/);
    if (m) topics.push(m[1].replace(/\[|\]/g, '').trim());
  }
  return topics;
}

// ========== 박결재 prompt builder ==========
function buildGyeoljaePrompt(date, allRounds, ctx) {
  const skippedCount = allRounds.filter(r => r.status !== 'complete').length;
  return [
    `## 오늘 날짜: ${date}`,
    `## 4라운드 실행 결과 (전체)`,
    '',
    '```json',
    JSON.stringify({
      date,
      total_rounds: allRounds.length,
      skipped_rounds: skippedCount,
      rounds: allRounds.map(r => ({
        number: r.number,
        status: r.status,
        hogigsim_output: r.hogigsim,
        saeop_output: r.saeop,
        hyeonsil_output: r.hyeonsil,
      })),
    }, null, 2).slice(0, 28000),
    '```',
    '',
    '## 사용자 프로필 (최종 체크용)',
    '```json',
    JSON.stringify(ctx.user_profile, null, 2),
    '```',
    '',
    '## 요청',
    '1. 구현실 ❌ 반려 건 자동 제외',
    '2. 중복 사업 통합',
    '3. 자본 10만원 초과 건 보류 (Apple $99 포함 체크)',
    '4. 별점 산정 후 상위 3~5개 선별',
    '5. 오늘 한 건 지정 (★★★ 중 자본 0원·실행 가장 쉬운 것)',
    '6. 핸드폰 3분 브리핑 작성 (프로필 출력 형식 엄수, 4000자 이내)',
    '',
    '## 후보 디테일 (필수 7필드)',
    '각 사업화 후보는 반드시 아래 7필드를 모두 채워주세요. raw 응답(서사업·구현실)에서 정보를 길어 올리고, 그래도 부족하면 "(미확정)"으로 표기 — 빈 필드 금지.',
    '- **형태**: 디지털 가이드 / 노코드 웹앱 / 컨설팅 / 구독 뉴스레터 등 (1줄)',
    '- **누구에게**: 구체 타겟·연령·상황 (1줄)',
    '- **수익 모델**: 건당 N원 × 월 N건 / 구독 N원 등 — 숫자 포함 (1줄)',
    '- **실행 3주**: 1주차 / 2주차 / 3주차 각 할 일 (1줄)',
    '- **첫 수익 시점**: N주차 예상, N원 수준',
    '- **활용 자산**: 기존 스토어·블로그·고객 DB·인스타 등 어떻게 (1줄)',
    '- **구현실 위험**: 반론 핵심 1줄',
    '',
    skippedCount === allRounds.length
      ? '**전 라운드 수확 없음 → "수확 없음 에스컬레이션" 형식으로 작성**'
      : '',
  ].join('\n');
}

// ========== 메인 ==========
(async () => {
  const opts = parseArgs();
  const date = opts.date || todayKST();
  const mock = opts.mock || !process.env.GEMINI_API_KEY;

  console.log(`🌙 야간 리서치 시작 — ${date} (${opts.rounds}라운드, 모드: ${mock ? 'MOCK' : 'LIVE'})`);
  if (mock) console.log('⚠️  GEMINI_API_KEY 없음 또는 --mock. 스텁 응답으로 진행.\n');

  const ctx = collectNightContext();
  const memory = new RoundMemory();
  const allRounds = [];
  const allSaeopBusinesses = [];

  for (let r = 1; r <= opts.rounds; r += 1) {
    console.log(`\n━━━━━━━━━━━━━━━ Round ${r}/${opts.rounds} ━━━━━━━━━━━━━━━`);
    const round = { number: r, hogigsim: '', saeop: '', hyeonsil: '', status: 'pending' };

    // 1. 이호기심
    console.log(`[R${r}] 이호기심 호출...`);
    const hogigsimRes = await callWithRetry('lee-hogigsim', (hint) =>
      buildHogigsimPrompt(ctx, r, opts.rounds, memory.snapshot(), hint), {
        retryHints: HOGIGSIM_RETRY_HINTS,
        mock,
        mockOutput: `### 이호기심 — 요즘 뜨는 것 (Round ${r})\n\n## 관찰한 주제 3~5개\n- 🔥 MOCK 주제 ${r}-A: 샘플 설명\n- 🔥 MOCK 주제 ${r}-B: 샘플 설명\n- 🔥 MOCK 주제 ${r}-C: 샘플 설명\n\n## 공통 흐름\nMOCK 공통점\n\n## 사업화 힌트\n- 주제 A → 1인 사업 힌트\n- 주제 B → 1인 사업 힌트\n- 주제 C → 1인 사업 힌트`,
        geminiOpts: { temperature: 0.6, maxTokens: 8192 },
      });
    round.hogigsim = hogigsimRes.output;
    if (hogigsimRes.bankrupt) {
      console.log(`  🔴 R${r} 이호기심 수확 없음 — 라운드 스킵`);
      round.status = 'skipped';
      allRounds.push(round);
      await sleep(opts.sleepSec);
      continue;
    }
    memory.add(extractHogigsimTopics(round.hogigsim));
    await sleep(opts.sleepSec);

    // 2. 서사업
    console.log(`[R${r}] 서사업 호출...`);
    const saeopRes = await callWithRetry('seo-saeop', (hint) =>
      buildSaeopPrompt(ctx, r, round.hogigsim, allSaeopBusinesses, hint), {
        retryHints: SAEOP_RETRY_HINTS,
        mock,
        mockOutput: `### 서사업 — 1인 사업화 기획 (Round ${r})\n\n## 후보 1: MOCK 사업 R${r}-1\n- 자본: 0원\n- 주간: 5시간\n- 실행 단계: 1주 MVP · 2주 피드백 · 3주 첫 수익 시도\n\n## 후보 2: MOCK 사업 R${r}-2\n- 자본: 3만원\n- 주간: 10시간`,
        geminiOpts: { temperature: 0.5, maxTokens: 8192 },
      });
    round.saeop = saeopRes.output;
    if (saeopRes.bankrupt) {
      console.log(`  🔴 R${r} 서사업 수확 없음 — 구현실 생략`);
      round.status = 'partial';
      allRounds.push(round);
      await sleep(opts.sleepSec);
      continue;
    }
    allSaeopBusinesses.push(...extractBusinessNames(round.saeop));
    await sleep(opts.sleepSec);

    // 3. 구현실
    console.log(`[R${r}] 구현실 호출...`);
    const hyeonsilRes = await callWithRetry('gu-hyeonsil', (hint) =>
      buildHyeonsilPrompt(ctx, r, round.hogigsim, round.saeop, hint), {
        retryHints: HYEONSIL_RETRY_HINTS,
        mock,
        mockOutput: `### 구현실 — 사업화안 반론 (Round ${r})\n\n## 후보 1: MOCK 사업 R${r}-1\n- 판정: ✅ 승인\n- 위험 1: MOCK 시장 포화 가능성\n- 위험 2: MOCK 초기 홍보 부담\n\n## 후보 2: MOCK 사업 R${r}-2\n- 판정: ⚠️ 조건부`,
        geminiOpts: { temperature: 0.4, maxTokens: 8192 },
      });
    round.hyeonsil = hyeonsilRes.output;
    round.status = hyeonsilRes.bankrupt ? 'partial' : 'complete';
    allRounds.push(round);
    console.log(`  ✅ R${r} 완료 (status: ${round.status})`);
    await sleep(opts.sleepSec);
  }

  // 4. 박결재 — 전체 종합
  console.log('\n━━━━━━━━━━━━━━━ 박결재 최종 종합 ━━━━━━━━━━━━━━━');
  const gyeoljaeRes = await callWithRetry('park-gyeoljae', (hint) => buildGyeoljaePrompt(date, allRounds, ctx), {
    retryHints: [
      '지난 응답이 빈약했습니다. 반드시 페르소나 프로필의 출력 형식(💡 오늘 한 건 / 📋 사업화 후보 / ⏸️ 보류)을 지켜주세요.',
    ],
    mock,
    mockOutput: buildMockGyeoljae(date, allRounds),
    isBankrupt: (o) => !o || o.length < 200,
    geminiOpts: { temperature: 0.3, maxTokens: 12288 },
  });

  // 5. 리포트 저장
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, `${date}.md`);
  const rawPath = path.join(REPORTS_DIR, `${date}-raw.md`);

  fs.writeFileSync(outPath, gyeoljaeRes.output + '\n', 'utf8');
  console.log(`\n📝 최종 브리핑 저장: ${outPath}`);

  // raw (4라운드 원본)
  const rawContent = [
    `# 야간 리서치 원본 — ${date}`,
    `> 생성: ${new Date().toISOString()} · 라운드: ${opts.rounds} · 모드: ${mock ? 'MOCK' : 'LIVE'}`,
    '',
    ...allRounds.flatMap(r => [
      `---\n\n## Round ${r.number} (status: ${r.status})\n`,
      `### 이호기심\n${r.hogigsim || '(수확 없음)'}\n`,
      `### 서사업\n${r.saeop || '(생략)'}\n`,
      `### 구현실\n${r.hyeonsil || '(생략)'}\n`,
    ]),
  ].join('\n');
  fs.writeFileSync(rawPath, rawContent, 'utf8');
  console.log(`📝 원본 저장: ${rawPath}`);

  const summary = {
    rounds_total: opts.rounds,
    rounds_complete: allRounds.filter(r => r.status === 'complete').length,
    rounds_partial: allRounds.filter(r => r.status === 'partial').length,
    rounds_skipped: allRounds.filter(r => r.status === 'skipped').length,
  };
  console.log(`\n🌅 완료: ${JSON.stringify(summary)}`);
})().catch(err => {
  console.error('❌ night-research 실패:', err);
  process.exit(1);
});

// ========== MOCK 박결재 ==========
function buildMockGyeoljae(date, allRounds) {
  const completeCount = allRounds.filter(r => r.status === 'complete').length;
  if (completeCount === 0) {
    return [
      `🌅 야간 브리핑 (${date})`,
      '',
      '오늘 수확 없음 — 전 라운드 수확 실패 (MOCK 모드).',
      '실제 Gemini 호출 시 정상 브리핑이 생성됩니다.',
    ].join('\n');
  }
  const completeRounds = allRounds.filter(r => r.status === 'complete');
  return [
    `🌅 야간 브리핑 (${date}, ${allRounds.length}라운드)`,
    '',
    '💡 **오늘 한 건만 보시려면**',
    `**MOCK 최우선 사업** (★★★)`,
    '└ 왜 쉬움: MOCK 설명',
    '└ 첫 액션: MOCK 액션',
    '',
    `📋 **사업화 후보 (${completeRounds.length}개 생존, MOCK)**`,
    '',
    ...completeRounds.flatMap((r, i) => [
      `${i + 1}. **MOCK Round ${r.number} 후보** (★★★)`,
      '   ├ 형태: MOCK 디지털 가이드',
      '   ├ 누구에게: MOCK 30~40대 초보',
      '   ├ 수익 모델: 건당 9,900원 × 월 30건',
      '   ├ 실행 3주: 1주차 MVP · 2주차 베타 · 3주차 첫 판매',
      '   ├ 첫 수익 시점: 3주차, ~10만원',
      '   ├ 활용 자산: 기존 스토어 고객 DB',
      '   └ 구현실 위험: 시장 검증 부족',
      '',
    ]),
    '⏸️ **보류** (없음)',
    '',
    '📊 4라운드 전체 상세: /morning',
  ].join('\n');
}
