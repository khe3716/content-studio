// 재테크 팀 — 1단계 리서치 (researcher 에이전트)
//
// 사용법:
//   node scripts/finance-team/research.js --day 4
//   node scripts/finance-team/research.js --slug salary-30-savings-1y-simulation
//
// 흐름:
//   1. finance-blog/topics.yaml 에서 토픽 찾기 (--day N 또는 --slug)
//   2. keyword-trend/results 최신 JSON 로드 (없으면 fetch-datalab.js 자동 실행)
//   3. 카테고리 모멘텀 + 시즌 매치 분석
//   4. 박재은 페르소나가 글 쓸 때 쓸 research/{slug}.json 생성

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawnSync } = require('child_process');

const { REPO_ROOT, writeJSON, ensureDir, todayKST } = require('./lib');

const TOPICS_PATH = path.join(REPO_ROOT, 'finance-blog', 'topics.yaml');
const RESEARCH_DIR = path.join(REPO_ROOT, 'finance-blog', 'research');
const TREND_RESULTS_DIR = path.join(REPO_ROOT, 'keyword-trend', 'results');
const RATES_DIR = path.join(REPO_ROOT, 'finance-blog', 'rates');

// ========== 인자 파싱 ==========
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { day: null, slug: null, force: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--day' && args[i + 1]) { out.day = parseInt(args[i + 1], 10); i += 1; }
    else if (args[i] === '--slug' && args[i + 1]) { out.slug = args[i + 1]; i += 1; }
    else if (args[i] === '--force') { out.force = true; }
  }
  if (!out.day && !out.slug) {
    console.error('❌ --day N 또는 --slug <slug> 중 하나 필요');
    process.exit(1);
  }
  return out;
}

// ========== 토픽 로드 ==========
function loadTopic({ day, slug }) {
  const config = yaml.load(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const topics = config.topics || [];
  const found = topics.find(t => (day && t.day === day) || (slug && t.slug === slug));
  if (!found) {
    throw new Error(`토픽 없음 (--day ${day} / --slug ${slug})`);
  }
  return found;
}

// ========== 키워드 트렌드 데이터 ==========
function findLatestTrendJSON() {
  if (!fs.existsSync(TREND_RESULTS_DIR)) return null;
  const files = fs.readdirSync(TREND_RESULTS_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}-trend\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  return path.join(TREND_RESULTS_DIR, files[files.length - 1]);
}

function trendIsStale(jsonPath, daysThreshold = 7) {
  const m = path.basename(jsonPath).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return true;
  const fileDate = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > daysThreshold;
}

function fetchTrendIfNeeded({ force = false } = {}) {
  let latest = findLatestTrendJSON();
  const stale = !latest || trendIsStale(latest) || force;
  if (stale) {
    console.log('   ↳ Datalab 트렌드 새로 호출 중...');
    const result = spawnSync('node', [path.join('keyword-trend', 'fetch-datalab.js')], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.warn('   ⚠ Datalab 호출 실패. 기존 데이터로 진행 (없으면 빈 트렌드)');
    }
    latest = findLatestTrendJSON();
  }
  if (!latest) return null;
  return JSON.parse(fs.readFileSync(latest, 'utf8'));
}

// ========== 카테고리 모멘텀 ==========
function categoryInsight(trend, category) {
  if (!trend?.summary) return null;
  // topics.yaml category(영문) → 트렌드 group(한글) 매핑
  const map = { savings: '적금', loan: '대출', card: '카드', insurance: '보험' };
  const groupName = map[category] || category;
  const found = trend.summary.find(s => s.group === groupName);
  if (!found) return null;
  return {
    category,
    avgRatio: found.avgRatio,
    recentAvg: found.recentAvg,
    momentumPct: found.momentumPct,
    peakMonth: found.peakMonth,
    seasonMatch: monthMatchesPeak(found.peakMonth),
  };
}

function monthMatchesPeak(peakMonth) {
  if (!peakMonth) return null;
  const peakNum = parseInt(peakMonth.split('-')[1], 10);
  const currentNum = new Date().getMonth() + 1;
  const diff = Math.min(
    Math.abs(peakNum - currentNum),
    12 - Math.abs(peakNum - currentNum)
  );
  if (diff === 0) return 'PEAK';
  if (diff <= 1) return 'NEAR_PEAK';
  if (diff <= 2) return 'APPROACHING';
  return 'OFF_SEASON';
}

// ========== 패턴별 플레이북 ==========
function playbookFor(pattern) {
  const playbooks = {
    ranking: {
      intro_pattern: '한국은행 / 은행연합회 최신 공시 짚기 → "그래서 우리 월급쟁이는?"',
      body_structure: '비교표 (10위~1위) + 항목별 2~3줄 코멘트 + 1위 강조 박스',
      body_sections: 4,
      cta: '다음 달 갱신 시 다시 알려드릴게요',
    },
    vs: {
      intro_pattern: '두 상품 등장 배경 짚기 → 어느 게 나에게 맞나?',
      body_structure: '비교표(3~6 속성) + 케이스별 추천 박스 + 양쪽 단점 솔직 언급',
      body_sections: 3,
      cta: '본인 상황에 맞춰 선택, 댓글로 질문 받음',
    },
    guide: {
      intro_pattern: '왜 알아야 하는지 + 제도/정책 시점 명기',
      body_structure: '단계형 (1단계 → 5단계) + 화면 흐름 + 자주 묻는 질문 Q&A',
      body_sections: 5,
      cta: '신청 가능 기간·조건 변경 시 갱신',
    },
    qa: {
      intro_pattern: '흔한 오해 짚기 → "근데 사실은요"',
      body_structure: 'Q&A 4~5쌍 + 마지막 "결국 핵심은~" 정리',
      body_sections: 5,
      cta: '추가 질문은 댓글로',
    },
    simulation: {
      intro_pattern: '사례 시나리오 제시 → 숫자로 보여드릴게요',
      body_structure: '월별 시뮬레이션 표 + 그래프 + 시나리오별 결론',
      body_sections: 3,
      cta: '본인 상황 시뮬레이션 댓글 요청',
    },
    review: {
      intro_pattern: '왜 이 상품을 봤는가 + 어떤 분에게 추천',
      body_structure: '장점·단점·우대조건·한도 분석 + 솔직 평가',
      body_sections: 4,
      cta: '갱신 시 재리뷰',
    },
    recap: {
      intro_pattern: '한 달간 다룬 주제 짚기 → 핵심 액션 정리',
      body_structure: '카테고리별 요약 + 다음 달 예고',
      body_sections: 4,
      cta: '구독·이웃 추가 유도',
    },
  };
  return playbooks[pattern] || playbooks.ranking;
}

// ========== 검증된 금리 데이터 (FSS Finlife API) ==========
// 자동 수집된 rates JSON에서 카테고리에 맞는 데이터 추출 + 일반 개인 가입 가능 필터링
function loadVerifiedRates(category) {
  // savings 카테고리: 적금
  // 추후 deposit, loan 등도 매핑
  const typeMap = {
    savings: 'savings',
    // loan: 'creditLoan' 등
  };
  const type = typeMap[category];
  if (!type) return null;

  if (!fs.existsSync(RATES_DIR)) return null;
  const files = fs.readdirSync(RATES_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}-/.test(f) && f.endsWith(`${type}.json`))
    .sort();
  if (!files.length) return null;
  const latest = files[files.length - 1];
  const dataPath = path.join(RATES_DIR, latest);

  // 갱신 권장: 7일 초과 시 경고 (자동 갱신 X — 사용자가 fetch-rates.js 재실행)
  const m = latest.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const fileDate = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > 7) {
    console.warn(`   ⚠ 금리 데이터 ${ageDays.toFixed(0)}일 오래됨. fetch-rates.js 재실행 권장`);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return { data, file: latest, ageDays };
}

// 우대조건 텍스트에서 핵심 키워드만 추출 (모바일 표 가독성)
function summarizeCondition(text) {
  if (!text) return '없음';
  const t = text.toLowerCase();
  const kws = [];
  if (/급여\s*이체|급여\s*입금/.test(text)) kws.push('급여이체');
  if (/카드\s*(실적|결제|사용)/.test(text)) kws.push('카드실적');
  if (/자동이체/.test(text)) kws.push('자동이체');
  if (/마케팅\s*동의/.test(text)) kws.push('마케팅동의');
  if (/오픈뱅킹/.test(text)) kws.push('오픈뱅킹');
  if (/공과금/.test(text)) kws.push('공과금자동이체');
  if (/신규|첫\s*거래|첫거래/.test(text)) kws.push('신규/첫거래');
  if (/걸음수|걸음/.test(text)) kws.push('걸음수');
  if (/롯데카드/.test(text)) kws.push('롯데카드');
  if (/주\s*1회|주\s*\d회/.test(text)) kws.push('주1회 자동납입');
  if (/쿠폰/.test(text)) kws.push('금리우대쿠폰');
  if (kws.length === 0) {
    if (/없음|해당없음/.test(text)) return '없음';
    return text.slice(0, 28).replace(/\s+/g, ' ').trim() + (text.length > 28 ? '...' : '');
  }
  return kws.slice(0, 3).join(' · ');
}

// 일반 개인 가입 가능 필터 (청년·아동·사업자·소상공인 한정 제외)
function filterEligibleForGeneralPublic(products) {
  const restrictions = /청년|만\s*\d+세|소상공인|개인사업자|사업자|아이|어린이|걸음마|신생아|출산|육아|학생|장병|군|새출발/;

  return products.filter(p => {
    const text = `${p.product || ''} ${p.joinMember || ''} ${p.special || ''} ${p.etcNote || ''}`;
    return !restrictions.test(text);
  });
}

// 카테고리·서브 패턴별로 검증 데이터를 가공해 verified_rate_data로 반환
function buildVerifiedRateData(topic, ratesPayload) {
  if (!ratesPayload) return null;

  const allProducts = ratesPayload.data.products || [];
  const eligibleProducts = filterEligibleForGeneralPublic(allProducts);

  // savings → 1금융권 TOP 10 + 저축은행 TOP 5 분리 (가독성·정확성)
  const bankTop = eligibleProducts
    .filter(p => p.finGroup === 'bank' && p.max12m)
    .sort((a, b) => b.max12m - a.max12m)
    .slice(0, 10);

  const savingbankTop = eligibleProducts
    .filter(p => p.finGroup === 'savingbank' && p.max12m)
    .sort((a, b) => b.max12m - a.max12m)
    .slice(0, 5);

  // 박재은 글에 들어갈 깔끔한 형태로 변환
  // product 이름에서 (자유적립식) (정액적립식) 자동 추출 → 별도 reserve_type 필드
  const slim = (arr) => arr.map((p, i) => {
    const productRaw = (p.product || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    let reserveType = '';
    let productClean = productRaw;
    if (/자유적립식/.test(productRaw)) {
      reserveType = '자유적립식';
      productClean = productRaw.replace(/\(자유적립식\)/, '').trim();
    } else if (/정액적립식/.test(productRaw)) {
      reserveType = '정액적립식';
      productClean = productRaw.replace(/\(정액적립식\)/, '').trim();
    }

    return {
      rank: i + 1,
      bank: p.bank,
      product: productClean,
      reserve_type: reserveType,           // 자유적립식/정액적립식
      base12m: p.base12m,
      max12m: p.max12m,
      maxLimit: p.maxLimit,
      join_member: (p.joinMember || '').slice(0, 60),
      join_way: (p.joinWay || '').slice(0, 60),
      special_brief: p.special.slice(0, 200),
      special_short: summarizeCondition(p.special),  // 1줄 핵심 요약 (자동)
    };
  });

  return {
    asOfPublishDate: ratesPayload.data.asOfPublishDate,
    asOfFetchDate: ratesPayload.data.generatedAt?.slice(0, 10),
    sourceFile: ratesPayload.file,
    sourceApi: '금융감독원 금융상품한눈에 OpenAPI (finlife.fss.or.kr)',
    totalProductsScanned: allProducts.length,
    afterEligibilityFilter: eligibleProducts.length,
    excludedReason: '청년/아동/사업자/소상공인/출산·육아 한정 상품 자동 제외 (일반 직장인 가입 불가)',
    bankTop10: slim(bankTop),
    savingbankTop5: slim(savingbankTop),
    instruction_for_park_jaeeun: [
      '⭐ 매우 중요: 표에는 verified_rate_data.bankTop10 또는 savingbankTop5에 있는 상품만 사용. 추정·창작 절대 금지.',
      '⭐ 데이터에 없는 은행/상품 추가 금지. 만약 데이터 부족하면 항목 수 줄이기.',
      `⭐ 글에 "2026년 ${ratesPayload.data.asOfPublishDate?.slice(0, 4)}-${ratesPayload.data.asOfPublishDate?.slice(4, 6)}-${ratesPayload.data.asOfPublishDate?.slice(6, 8)} 공시 기준" 시점 명기 강제.`,
      '⭐ "최고 금리는 우대조건 충족 시이며, 가입 직전 해당 은행 앱에서 직접 확인" 안내 강제.',
      '⭐ 우대조건은 special_brief를 참고하되 너무 길면 "급여이체·자동이체 조건" 같이 핵심만 1줄.',
      '⭐ join_member 또는 join_way에 "스마트폰 전용" 같은 정보 있으면 본문에 짧게 언급.',
      '🔥 매우 중요 — 적립방식: reserve_type이 "자유적립식" 또는 "정액적립식"인 경우 표나 본문에 반드시 명시. 같은 상품이라도 자유/정액 따로 등록되어 금리 다름. 명시 안 하면 독자가 다른 사이트(네이버페이 등)에서 다른 숫자 보고 혼란.',
      '🔥 두 표 통일 — 1금융권·저축은행 표 모두 동일한 컬럼 사용: **[순위, 은행, 상품명, 적립방식, 최고금리(연), 월 한도, 핵심 우대조건]**',
      '🔥 적립방식 정보 없으면 (reserve_type이 빈 문자열) "-" 또는 "정액" 기본값 표기. 빈 셀 금지.',
      '🔥 핵심 우대조건은 special_short 필드 (이미 1줄로 자동 요약됨, 예: "급여이체 · 카드실적") 그대로 사용. 절대 special_brief 200자 원본 사용 금지.',
      '🔥 본문에 한 줄 추가 권장: "💡 자유적립식과 정액적립식은 별개 상품으로 등록되어 금리가 다를 수 있어요. 표에 적립방식을 함께 표기했어요."',
    ],
  };
}

// ========== 메인 ==========
(async () => {
  const { day, slug, force } = parseArgs();
  console.log('▶ Researcher 시작');

  console.log('\n[1/4] 토픽 로드');
  const topic = loadTopic({ day, slug });
  console.log(`   ✓ Day ${topic.day} — ${topic.title} (${topic.category}, ${topic.pattern})`);

  console.log('\n[2/4] Datalab 트렌드 데이터');
  const trend = fetchTrendIfNeeded({ force });
  const insight = trend ? categoryInsight(trend, topic.category) : null;
  if (insight) {
    const seasonEmoji = { PEAK: '🔥', NEAR_PEAK: '📈', APPROACHING: '↗️', OFF_SEASON: '⏸️' };
    console.log(
      `   ✓ ${topic.category} 모멘텀: avg ${insight.avgRatio} / recent ${insight.recentAvg} / ${insight.momentumPct >= 0 ? '+' : ''}${insight.momentumPct}% ` +
      `${seasonEmoji[insight.seasonMatch] || ''} (${insight.seasonMatch}, peak ${insight.peakMonth})`
    );
  } else {
    console.log('   ⚠ 트렌드 데이터 없음 — 시즌 분석 생략');
  }

  console.log('\n[3/5] 패턴별 플레이북 매칭');
  const playbook = playbookFor(topic.pattern);
  console.log(`   ✓ pattern=${topic.pattern} → ${playbook.body_sections} 섹션 구조`);

  console.log('\n[4/5] 검증된 금리 데이터 로드 (FSS Finlife)');
  const ratesPayload = loadVerifiedRates(topic.category);
  const verified = buildVerifiedRateData(topic, ratesPayload);
  if (verified) {
    console.log(`   ✓ ${verified.sourceFile} (${verified.totalProductsScanned}개 → 일반 가입 가능 ${verified.afterEligibilityFilter}개)`);
    console.log(`   ✓ 1금융권 TOP 10 + 저축은행 TOP 5 추출 (공시일 ${verified.asOfPublishDate})`);
  } else {
    console.log(`   ⚠ 카테고리 '${topic.category}'에 대한 검증 데이터 없음`);
    console.log(`   → fetch-rates.js로 먼저 데이터 수집 권장`);
  }

  console.log('\n[5/5] research.json 저장');
  const research = {
    generatedAt: new Date().toISOString(),
    todayKST: todayKST(),
    topic: {
      day: topic.day,
      slug: topic.slug,
      category: topic.category,
      pattern: topic.pattern,
      title: topic.title,
    },
    main_keyword: topic.keywords?.[0] || '',
    long_tail: topic.keywords?.slice(1) || [],
    season: insight,
    playbook,
    fact_check_required: [
      '모든 금리·한도·우대조건은 출처(은행연합회/한국은행/금융감독원) + 시점 명기',
      '제도/정책명·시행일·시점 정확',
      '광고 사용 시 "광고 포함" 명시',
    ],
    verified_rate_data: verified,
    forbidden: [
      '정치인·정당·이념 발언',
      '부동산 가격 전망',
      '주식 종목 추천 (자본시장법)',
      '"100% 승인", "원금 보장" 단정 표현',
      '출처 없는 통계·금리·한도',
    ],
  };

  ensureDir(RESEARCH_DIR);
  const outPath = path.join(RESEARCH_DIR, `${topic.slug}.json`);
  writeJSON(outPath, research);
  console.log(`   ✓ ${path.relative(REPO_ROOT, outPath)}`);

  console.log('\n─'.repeat(60));
  console.log(`✓ Researcher 완료: ${topic.slug}`);
  console.log(`  다음 단계: node scripts/finance-team/write-draft.js --slug ${topic.slug}`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
