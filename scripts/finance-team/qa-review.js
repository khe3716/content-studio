// 박재은 글 QA 검수 — 정확성·정책·톤·SEO 자동 검증
// 사용법: node scripts/finance-team/qa-review.js --slug <slug>
//
// 입력: finance-blog/drafts/{slug}.html + meta.json
// 출력:
//   - finance-blog/drafts/{slug}-qa.json (검수 결과)
//   - critical 이슈 발견 시 exit 1 (워크플로 publish 단계 차단)
//
// 단계:
//   1. 정책 키워드 감지 (지원금·보조금·민생·복지·장려금·쿠폰·환급 등)
//      → 감지 시 사실 검증 더 엄격하게 + 자동 발행 차단 권고
//   2. Gemini로 qa-reviewer 페르소나 실행 (사실·정책·톤·SEO 체크리스트)
//   3. JSON 출력 + critical_failures 있으면 exit 1

const fs = require('fs');
const path = require('path');
const { REPO_ROOT, notifyTelegram } = require('./lib');

const DRAFTS_DIR = path.join(REPO_ROOT, 'finance-blog', 'drafts');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents', 'finance');

// 정책·금전 관련 키워드 — 잘못 쓰면 사고
const POLICY_KEYWORDS = [
  '지원금', '보조금', '민생', '복지', '장려금', '쿠폰', '환급금',
  '추경', '정부지원', '정책자금', '청년정책', '소비쿠폰',
  '재난지원', '긴급지원', '저소득', '기초생활', '차상위',
  '주거급여', '생계급여', '의료급여', '교육급여',
];

function parseArgs() {
  const args = process.argv.slice(2);
  let slug = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--slug' && args[i + 1]) { slug = args[i + 1]; i += 1; }
  }
  if (!slug) {
    console.error('❌ --slug 필요');
    process.exit(1);
  }
  return { slug };
}

function detectPolicyKeywords(text) {
  return POLICY_KEYWORDS.filter(kw => text.includes(kw));
}

async function callGeminiQA(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY 미설정');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function qaReview(html, meta, policyHits) {
  const persona = fs.readFileSync(path.join(AGENTS_DIR, 'qa-reviewer.md'), 'utf8');

  const extraStrict = policyHits.length > 0
    ? `\n\n⚠️ **정책·금전 키워드 감지: ${policyHits.join(', ')}**
이 글은 정부 정책/지원금/보조금 관련이라 사실 확인이 매우 중요합니다.
다음 항목은 반드시 검증하세요:
- 금액 (얼마인지) — 추측·환각 금지
- 신청 기간 (언제부터 언제까지)
- 대상자 (누구인지)
- 지급 방식 (일회성/월 지급/지역화폐 등)
- 출처가 명시되어 있는지

위 항목 중 "추측·일반론·구체 수치가 확인 안 된 것"이 있으면 CRITICAL로 표시하세요.`
    : '';

  const systemPrompt = persona;
  const userPrompt = `다음은 박재은의 재테크 블로그 초안입니다. 검수해주세요.

제목: ${meta.title}
키워드: ${(meta.keywords || []).join(', ')}
${extraStrict}

**출력은 반드시 JSON만. 다른 텍스트 없이.**
{
  "passed": true | false,
  "critical_failures": [
    { "category": "사실|정책|톤|SEO|디자인", "issue": "구체 문장", "reason": "왜 문제인지" }
  ],
  "warnings": [
    { "category": "...", "issue": "...", "reason": "..." }
  ],
  "summary": "한 줄 요약"
}

규칙:
- 사실 정확성에서 **확인 안 된 수치/날짜/조건**은 무조건 critical_failures
- 정책 글에서 출처 없는 단정은 critical_failures
- 톤·SEO는 warnings (단 너무 심하면 critical)

===== 초안 HTML =====
${html.slice(0, 12000)}`;

  const resp = await callGeminiQA(systemPrompt, userPrompt);
  const cleaned = resp.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('⚠️ QA JSON 파싱 실패, 원문:', resp.slice(0, 500));
    return {
      passed: false,
      critical_failures: [{ category: '시스템', issue: 'QA JSON 파싱 실패', reason: e.message }],
      warnings: [],
      summary: 'QA 자동 검수 실패 → 사람 검수 필요',
    };
  }
}

(async () => {
  const { slug } = parseArgs();
  const htmlPath = path.join(DRAFTS_DIR, `${slug}.html`);
  const metaPath = path.join(DRAFTS_DIR, `${slug}-meta.json`);

  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ ${htmlPath} 없음`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const textOnly = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const titleAndText = `${meta.title || ''} ${textOnly}`;
  const policyHits = detectPolicyKeywords(titleAndText);

  console.log('\n' + '═'.repeat(60));
  console.log(`🔍 QA 검수 시작 — ${slug}`);
  console.log('═'.repeat(60));

  if (policyHits.length > 0) {
    console.log(`⚠️ 정책·금전 키워드 감지: ${policyHits.join(', ')}`);
    console.log('   → 엄격 모드로 검수 + 자동 발행 차단 권고');
  }

  const result = await qaReview(html, meta, policyHits);
  const reportPath = path.join(DRAFTS_DIR, `${slug}-qa.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\n📋 검수 결과:`);
  console.log(`   passed: ${result.passed}`);
  console.log(`   critical: ${result.critical_failures?.length || 0}`);
  console.log(`   warning: ${result.warnings?.length || 0}`);
  console.log(`   요약: ${result.summary}`);

  if (result.critical_failures?.length > 0) {
    console.log('\n❌ CRITICAL 이슈:');
    result.critical_failures.forEach((f, i) => {
      console.log(`   ${i + 1}. [${f.category}] ${f.issue}`);
      console.log(`      → ${f.reason}`);
    });
  }
  if (result.warnings?.length > 0) {
    console.log('\n⚠️ Warnings:');
    result.warnings.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. [${f.category}] ${f.issue}`);
    });
  }

  console.log(`\n💾 ${reportPath}`);

  // 정책 키워드 + critical → 발행 자동 차단
  const hasCriticalPolicy = policyHits.length > 0 && (result.critical_failures?.length || 0) > 0;
  if (hasCriticalPolicy || !result.passed) {
    const reason = hasCriticalPolicy
      ? `정책 글 critical 이슈 (${policyHits.join(', ')}) — 자동 발행 차단`
      : `QA 미통과 — 자동 발행 차단`;
    console.log(`\n🛑 ${reason}`);
    await notifyTelegram(
      `🚨 *박재은 QA 차단*\nslug: \`${slug}\`\n제목: ${meta.title}\n사유: ${reason}\ncritical: ${result.critical_failures?.length || 0}건\n\n글은 DRAFT로만 저장되고 발행은 차단됩니다.`
    );
    process.exit(2); // exit 2 → run.js에서 publish 단계 스킵
  }

  console.log('\n✅ QA 통과 → 다음 단계 진행');
})().catch(async e => {
  console.error('\n❌ QA 검수 실패:', e.message);
  await notifyTelegram(`❌ 박재은 QA 검수 실패\n${e.message.slice(0, 300)}`);
  process.exit(1);
});
