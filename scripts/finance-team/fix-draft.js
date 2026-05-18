// 박재은 draft 수정기 — QA 피드백 받아 본문/메타 재작성
//
// 사용법:
//   node scripts/finance-team/fix-draft.js --slug <slug>
//
// 입력:
//   - finance-blog/drafts/{slug}.html (현재 본문)
//   - finance-blog/drafts/{slug}-meta.json (현재 메타)
//   - finance-blog/drafts/{slug}-qa.json (QA 피드백 — critical_failures + warnings)
//   - finance-blog/research/{slug}.json (원본 컨텍스트)
//
// 출력 (덮어쓰기):
//   - finance-blog/drafts/{slug}.html
//   - finance-blog/drafts/{slug}-meta.json
//   - finance-blog/drafts/{slug}-narration.json
//
// 흐름:
//   1. QA 피드백 로드 (critical + warning)
//   2. 기존 draft + 피드백을 Gemini에 주입 → 수정된 JSON 재생성
//   3. 금기어 자가 검증 (write-draft.js와 동일)
//   4. 디스크 저장 (덮어쓰기)

const fs = require('fs');
const path = require('path');

const {
  REPO_ROOT,
  loadPersona,
  callGemini,
  writeJSON,
  ensureDir,
  readJSON,
} = require('./lib');

const DRAFTS_DIR = path.join(REPO_ROOT, 'finance-blog', 'drafts');
const RESEARCH_DIR = path.join(REPO_ROOT, 'finance-blog', 'research');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { slug: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--slug' && args[i + 1]) { out.slug = args[i + 1]; i += 1; }
  }
  if (!out.slug) {
    console.error('❌ --slug <slug> 필요');
    process.exit(1);
  }
  return out;
}

function extractDraftJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw e;
  }
}

function validateDraft(draft) {
  const errs = [];
  const required = ['title', 'meta_description', 'labels', 'html', 'summary_3lines', 'narration_long', 'narration_short'];
  for (const k of required) {
    if (!draft[k]) errs.push(`필드 누락: ${k}`);
  }
  if (draft.html && draft.html.length < 1500) errs.push(`본문 너무 짧음 (${draft.html.length}자)`);
  if (draft.html && draft.html.length > 8000) errs.push(`본문 너무 김 (${draft.html.length}자)`);
  const text = (draft.html || '') + ' ' + (draft.narration_long || '') + ' ' + (draft.narration_short || '');
  const banned = [
    /100\s*%\s*승인/,
    /원금\s*보장/,
    /절대\s*손해/,
    /무조건\s*이득/,
  ];
  for (const re of banned) {
    if (re.test(text)) errs.push(`금기 표현 감지: ${re}`);
  }
  return errs;
}

function formatFeedback(qa) {
  const lines = [];
  if (qa.critical_failures?.length) {
    lines.push('## ❌ CRITICAL — 반드시 수정');
    qa.critical_failures.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.category}] ${f.issue}`);
      lines.push(`   사유: ${f.reason}`);
    });
  }
  if (qa.warnings?.length) {
    lines.push('\n## ⚠️ WARNING — 가능하면 수정');
    qa.warnings.slice(0, 8).forEach((f, i) => {
      lines.push(`${i + 1}. [${f.category}] ${f.issue}`);
    });
  }
  if (qa.summary) {
    lines.push(`\n## 검수자 요약\n${qa.summary}`);
  }
  return lines.join('\n');
}

(async () => {
  const { slug } = parseArgs();
  console.log(`▶ Fixer (박재은) 시작 — ${slug}`);

  const htmlPath = path.join(DRAFTS_DIR, `${slug}.html`);
  const metaPath = path.join(DRAFTS_DIR, `${slug}-meta.json`);
  const qaPath = path.join(DRAFTS_DIR, `${slug}-qa.json`);
  const researchPath = path.join(RESEARCH_DIR, `${slug}.json`);
  const narrationPath = path.join(DRAFTS_DIR, `${slug}-narration.json`);

  for (const p of [htmlPath, metaPath, qaPath, researchPath]) {
    if (!fs.existsSync(p)) {
      console.error(`❌ ${p} 없음`);
      process.exit(1);
    }
  }

  const currentHtml = fs.readFileSync(htmlPath, 'utf8');
  const currentMeta = readJSON(metaPath);
  const qa = readJSON(qaPath);
  const research = readJSON(researchPath);
  const currentNarration = fs.existsSync(narrationPath) ? readJSON(narrationPath) : { long: '', short: '' };

  const feedback = formatFeedback(qa);
  console.log('\n[1/3] QA 피드백:');
  console.log(feedback);

  const persona = loadPersona('park-jaeeun');

  const systemPrompt = persona + `

# 응답 규약 (반드시 따를 것)
응답은 **순수 JSON 1개**만. 앞뒤 설명·코드 펜스 금지.

스키마:
{
  "title": "이모지 1개 포함 제목 (35자 이내)",
  "meta_description": "120~160자 SEO용 (인사·이모지 금지)",
  "labels": ["라벨1", "라벨2", "라벨3", "라벨4"],
  "html": "<div class=\\"post-finance\\">...1500~2500자...</div>",
  "summary_3lines": ["핵심1", "핵급2", "핵심3"],
  "narration_long": "1분 롱폼 대본 350~430자",
  "narration_short": "30초 쇼츠 대본 180~220자"
}

# 절대 금지 (박재은 페르소나 + 정책)
- 정치인·정당·이념 발언
- 부동산 가격 전망
- 주식 종목 추천 (자본시장법)
- "100% 승인", "원금 보장", "절대 손해 없음" 단정 표현
- 출처 없는 통계·금리·한도
- 미래 시점 단정 ("2026년 X월 세법은 ~~다" → "2026년 X월 기준 현재 ~~로 알려져 있으며 변동 가능합니다" 식 단서)
`;

  const userPrompt = `이전에 작성한 박재은 글이 QA 검수에서 막혔다. **QA 피드백을 반영해서 같은 주제로 다시 써라.**

## 원본 컨텍스트 (research.json)
${JSON.stringify({
  topic: research.topic,
  main_keyword: research.main_keyword,
  long_tail: research.long_tail,
  season: research.season,
  playbook: research.playbook,
  verified_rate_data: research.verified_rate_data ? {
    asOfPublishDate: research.verified_rate_data.asOfPublishDate,
    bankTop10: research.verified_rate_data.bankTop10,
    savingbankTop5: research.verified_rate_data.savingbankTop5,
  } : null,
}, null, 2)}

## 이전 버전 (이걸 베이스로 고쳐)
title: ${currentMeta.title}
meta_description: ${currentMeta.meta_description}
labels: ${JSON.stringify(currentMeta.labels || [])}

html:
${currentHtml.slice(0, 8000)}

narration_long: ${currentNarration.long || ''}
narration_short: ${currentNarration.short || ''}

## QA 피드백 (이걸 모두 해결)
${feedback}

## 수정 지침
- CRITICAL은 **모두 반드시 해결**. 안 고치면 또 막힌다.
- 사실 정확성이 문제면 → 단정 표현을 **"현재 기준 / 변동 가능 / 가입 직전 확인" 단서**로 바꿔라.
- 미래 시점 세법·정책을 단정한 거면 → "${(research.topic.title || '').match(/\d{4}/)?.[0] || '2026'}년 ${(research.topic.title || '').match(/(\d{1,2})월/)?.[1] || '5'}월 기준 현재 ~~로 알려져 있으며 변동 가능합니다" 식으로 풀어라.
- 출처 없는 수치는 → "은행연합회 공시 기준" "금융감독원 공시 기준" 같은 출처를 명기하거나, 정확하지 않다면 범위 추정으로 바꿔라.
- 톤·이모지·SEO 경고는 가능하면 해결.

## 출력
순수 JSON 1개. 위 스키마 모두 채워서. 코드 펜스 금지.`;

  console.log('\n[2/3] Gemini 호출 (수정 시도)');
  let raw = '';
  let draft = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`   ↳ 시도 ${attempt}/3 ...`);
      raw = await callGemini(userPrompt, systemPrompt, { temperature: 0.55, maxTokens: 12000 });
      draft = extractDraftJSON(raw);
      const errs = validateDraft(draft);
      if (errs.length) throw new Error(`검증 실패:\n  - ${errs.join('\n  - ')}`);
      console.log(`   ✓ 본문 ${draft.html.length}자, 롱폼 ${draft.narration_long.length}자, 쇼츠 ${draft.narration_short.length}자`);
      break;
    } catch (e) {
      lastErr = e;
      console.warn(`   ⚠ ${e.message.split('\n')[0]}`);
      if (attempt === 3) {
        console.error('❌ Fix 3회 실패. 마지막 원문 앞 500자:\n', raw.slice(0, 500));
        throw lastErr;
      }
    }
  }

  console.log('\n[3/3] 디스크 저장 (덮어쓰기)');
  ensureDir(DRAFTS_DIR);
  fs.writeFileSync(htmlPath, draft.html, 'utf8');
  writeJSON(narrationPath, {
    slug,
    voice: 'Leda',
    speed: 1.3,
    long: draft.narration_long,
    short: draft.narration_short,
  });
  writeJSON(metaPath, {
    slug,
    day_number: research.topic.day,
    category: research.topic.category,
    pattern: research.topic.pattern,
    title: draft.title,
    meta_description: draft.meta_description,
    labels: draft.labels,
    summary_3lines: draft.summary_3lines,
  });
  console.log(`   ✓ ${slug}.html, -meta.json, -narration.json 덮어쓰기 완료`);
  console.log('\n✓ Fixer 완료 → 다음 단계: QA 재검수');
})().catch(e => {
  console.error('❌ Fixer 실패:', e.message);
  process.exit(1);
});
