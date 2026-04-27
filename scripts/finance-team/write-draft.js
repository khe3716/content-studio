// 재테크 팀 — 2단계 본문·대본 작성 (copywriter 에이전트 = 박재은)
//
// 사용법:
//   node scripts/finance-team/write-draft.js --slug salary-30-savings-1y-simulation
//   node scripts/finance-team/write-draft.js --slug ... --dry-run     # 글 생성 후 저장 안 함 (콘솔 출력만)
//
// 입력:
//   - finance-blog/research/{slug}.json (researcher 산출물)
//   - agents/park-jaeeun.md (브랜드 작가 페르소나, 단일 소스)
//
// 출력:
//   - finance-blog/drafts/{slug}.html
//   - finance-blog/drafts/{slug}-narration.json (long: 60s, short: 30s)
//   - finance-blog/drafts/{slug}-meta.json (title, meta_description, labels)

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

// ========== 인자 파싱 ==========
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { slug: null, dryRun: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--slug' && args[i + 1]) { out.slug = args[i + 1]; i += 1; }
    else if (args[i] === '--dry-run') { out.dryRun = true; }
  }
  if (!out.slug) {
    console.error('❌ --slug <slug> 필요');
    process.exit(1);
  }
  return out;
}

// ========== Gemini 응답 파싱 ==========
// 박재은이 JSON으로 깔끔하게 응답하지만 ```json fence가 붙거나 본문이 ```html로 감싸질 수 있음
function extractDraftJSON(raw) {
  let cleaned = raw.trim();
  // 첫 ```json or ```fence 제거
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // JSON 안 본문 html이 ```html ... ``` 로 감싸진 경우 정상이라 1차 파싱은 OK여야 함.
    // 그래도 실패 시 첫 { 와 마지막 } 사이만 추출 시도.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        throw new Error(`JSON 파싱 실패 (1차+2차): ${e2.message}\n--- 원문 앞 500자 ---\n${cleaned.slice(0, 500)}`);
      }
    }
    throw new Error(`JSON 파싱 실패: ${e.message}\n--- 원문 앞 500자 ---\n${cleaned.slice(0, 500)}`);
  }
}

// ========== 검증 ==========
function validateDraft(draft) {
  const errs = [];
  const required = ['title', 'meta_description', 'labels', 'html', 'summary_3lines', 'narration_long', 'narration_short'];
  for (const k of required) {
    if (!draft[k]) errs.push(`필드 누락: ${k}`);
  }
  if (draft.html && draft.html.length < 1500) errs.push(`본문 너무 짧음 (${draft.html.length}자, 최소 1500자)`);
  if (draft.html && draft.html.length > 8000) errs.push(`본문 너무 김 (${draft.html.length}자, 최대 ~8000자)`);
  if (draft.narration_long && draft.narration_long.length < 200) errs.push('롱폼 대본 너무 짧음');
  if (draft.narration_short && draft.narration_short.length < 100) errs.push('쇼츠 대본 너무 짧음');
  if (Array.isArray(draft.summary_3lines) && draft.summary_3lines.length !== 3) errs.push('summary_3lines는 3줄');

  // 박재은 금기 단어 자가 검증
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

// ========== 메인 ==========
(async () => {
  const { slug, dryRun } = parseArgs();
  console.log('▶ Copywriter (박재은) 시작');

  console.log('\n[1/4] research.json 로드');
  const researchPath = path.join(RESEARCH_DIR, `${slug}.json`);
  if (!fs.existsSync(researchPath)) {
    console.error(`❌ research 파일 없음: ${researchPath}`);
    console.error(`   먼저 실행: node scripts/finance-team/research.js --slug ${slug}`);
    process.exit(1);
  }
  const research = readJSON(researchPath);
  console.log(`   ✓ ${research.topic.title} (${research.topic.pattern}, ${research.topic.category})`);

  console.log('\n[2/4] 박재은 페르소나 로드');
  const persona = loadPersona('park-jaeeun');
  console.log(`   ✓ ${persona.length} 자`);

  console.log('\n[3/4] Gemini 호출 (본문 + 대본 동시 생성)');
  const systemPrompt = persona + `

# 응답 규약 (반드시 따를 것)

응답은 **순수 JSON 1개**만 반환. 앞뒤 설명·코드 펜스 금지.

스키마:
{
  "title": "이모지 1개 포함 제목 (35자 이내)",
  "meta_description": "120~160자 SEO용 첫 단락 발췌 (인사·이모지 금지)",
  "labels": ["라벨1", "라벨2", "라벨3", "라벨4"],
  "html": "<div class=\\"post-finance\\">...전체 본문 1500~2500자...</div>",
  "summary_3lines": ["핵심1", "핵심2", "핵심3"],
  "narration_long": "1분 롱폼 영상 대본 (박재은 톤, 자연스러운 한국어 구어, 60초 분량 약 350~430자)",
  "narration_short": "30초 쇼츠 영상 대본 (박재은 톤, 핵심만, 약 180~220자)"
}

# html 작성 규칙
- 시작 태그: <div class="post-finance">
- 도입부 2단 구조 (SEO 단락 + 친근 단락)
- H2 섹션 (research.playbook.body_sections 개수)
- 비교표 또는 체크리스트 1개 이상
- ⚠️ 주의 박스 1개
- 정리 섹션 (3줄 요약)
- 시그니처 마지막: <p>💼 월급쟁이 재테크 — 박재은이 정리합니다</p>
- 모든 금리·한도·조건은 출처+시점 명기 (예: 은행연합회 2026년 5월 1일 공시 기준)

# narration 작성 규칙
- 박재은 친근 톤 그대로 (~해요, ~거든요, ~잖아요)
- 첫 3초 후킹 ("안녕하세요" 류 인사 금지)
- 숫자는 자연 발음 ("4.5퍼" / "연 4점 5퍼센트" / "월 100만원")
- 마지막 3초 "전체는 블로그에서 / 이웃 추가" 류 CTA
- 정치인·정당·부동산 가격 전망·주식 종목 추천·"100% 승인" 단정 표현 모두 금지

# 절대 금지 (박재은 페르소나 + 정책)
- 정치인·정당·이념 발언
- 부동산 가격 전망
- 주식 종목 추천 (자본시장법)
- "100% 승인", "원금 보장", "절대 손해 없음" 단정 표현
- 출처 없는 통계·금리·한도
`;

  const userPrompt = `오늘 작성할 글 컨텍스트(research.json):

${JSON.stringify({
  topic: research.topic,
  main_keyword: research.main_keyword,
  long_tail: research.long_tail,
  season: research.season,
  playbook: research.playbook,
  fact_check_required: research.fact_check_required,
  verified_rate_data: research.verified_rate_data,
  notebooklm_verified: research.notebooklm_verified,
}, null, 2)}

${research.verified_rate_data ? `
🚨🚨🚨 매우 중요 — 데이터 정확성 강제 규칙 🚨🚨🚨
verified_rate_data는 금융감독원 OpenAPI에서 직접 수집한 1차 공식 데이터다 (공시일 ${research.verified_rate_data.asOfPublishDate}).

[절대 규칙]
1. 표에 들어가는 모든 은행·상품·금리는 verified_rate_data.bankTop10 / savingbankTop5 안에 있는 것만 사용. **추정·창작·일반 상식 절대 금지.**
2. 데이터에 없는 상품을 추가하면 안 된다. 표가 짧아져도 괜찮다.
3. 글 어딘가에 "2026년 ${(research.verified_rate_data.asOfPublishDate || '').slice(0,4)}년 ${(research.verified_rate_data.asOfPublishDate || '').slice(4,6)}월 ${(research.verified_rate_data.asOfPublishDate || '').slice(6,8)}일 금융감독원 공시 기준" 같은 시점 명기 필수.
4. "최고 금리는 우대조건 충족 시이며, 가입 직전 해당 은행 앱에서 직접 확인하세요" 안내 필수 (박재은 톤으로).
5. 우대조건은 verified_rate_data.special_brief를 참고하되 핵심 1~2줄로 요약.
6. join_member나 join_way에 특이사항(예: "스마트폰 전용", "실명의 개인") 있으면 표나 본문에 짧게 표기.

[강력 권장]
- 1금융권 + 저축은행 통합 비교 또는 1금융권 TOP 5 + 저축은행 TOP 5 분리 형식 추천
- 저축은행 금리가 1금융권보다 훨씬 높다는 사실을 솔직히 언급 ("사실 1금융권보다 저축은행이 더 셉니다" 박재은 톤)
- 일반 직장인이 가입 가능한 상품만 (verified_rate_data가 이미 청년/아동/사업자 한정 제외 필터링 했음)
` : ''}
${research.notebooklm_verified ? '\n📚 notebooklm_verified는 추가 참고 자료. verified_rate_data가 있다면 그걸 우선해.\n' : ''}

이 컨텍스트로 박재은 페르소나 규칙을 모두 지켜서 글 + 영상 대본 2종을 작성해줘.

⚠️ 주의:
- 모든 금리·한도·우대조건은 그럴듯하지만 **출처+시점**을 분명히 명기 (예: "은행연합회 2026년 5월 1일 공시 기준"). 만약 정확한 최신 데이터를 모르면 "최근 공시 기준" 또는 "2026년 5월 기준"으로 명기하고 구체 숫자는 합리적 추정 범위 사용.
- 시즌 매치(${research.season?.seasonMatch || 'unknown'}) 고려해서 도입부 뉴스 짚기.
- 응답은 순수 JSON 1개. 코드 펜스나 설명 금지.`;

  let raw = '';
  let draft = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(`   ↳ 시도 ${attempt}/3 ...`);
      raw = await callGemini(userPrompt, systemPrompt, { temperature: 0.65, maxTokens: 12000 });
      draft = extractDraftJSON(raw);
      const errs = validateDraft(draft);
      if (errs.length) throw new Error(`검증 실패:\n  - ${errs.join('\n  - ')}`);
      console.log(`   ✓ 본문 ${draft.html.length}자, 롱폼 대본 ${draft.narration_long.length}자, 쇼츠 ${draft.narration_short.length}자`);
      break;
    } catch (e) {
      lastErr = e;
      console.warn(`   ⚠ ${e.message}`);
      if (attempt === 3) {
        console.error('\n❌ 3회 실패. 마지막 원문 앞 1000자:\n', raw.slice(0, 1000));
        throw lastErr;
      }
    }
  }

  console.log('\n[4/4] 디스크 저장');
  if (dryRun) {
    console.log('   ⚠ --dry-run 모드: 저장 생략');
    console.log('--- title ---');
    console.log(draft.title);
    console.log('--- meta_description ---');
    console.log(draft.meta_description);
    console.log('--- html (앞 500자) ---');
    console.log(draft.html.slice(0, 500));
    console.log('--- narration_long (앞 200자) ---');
    console.log(draft.narration_long.slice(0, 200));
    console.log('--- narration_short ---');
    console.log(draft.narration_short);
    return;
  }

  ensureDir(DRAFTS_DIR);

  // {slug}.html — 본문만
  const htmlPath = path.join(DRAFTS_DIR, `${slug}.html`);
  fs.writeFileSync(htmlPath, draft.html, 'utf8');
  console.log(`   ✓ ${path.relative(REPO_ROOT, htmlPath)}`);

  // {slug}-narration.json — TTS용
  const narrationPath = path.join(DRAFTS_DIR, `${slug}-narration.json`);
  writeJSON(narrationPath, {
    slug,
    voice: 'Leda',
    speed: 1.3,
    long: draft.narration_long,
    short: draft.narration_short,
  });
  console.log(`   ✓ ${path.relative(REPO_ROOT, narrationPath)}`);

  // {slug}-meta.json — 발행 시 사용
  const metaPath = path.join(DRAFTS_DIR, `${slug}-meta.json`);
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
  console.log(`   ✓ ${path.relative(REPO_ROOT, metaPath)}`);

  console.log('\n─'.repeat(60));
  console.log(`✓ Copywriter (박재은) 완료: ${slug}`);
  console.log(`  다음 단계: node scripts/finance-team/orchestrator.js ${slug}`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
