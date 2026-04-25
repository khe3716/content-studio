// 야간 리서치 6라운드 오케스트레이터 (deep 양질 모드)
//
// 매일 밤 01:00 KST에 GitHub Actions가 이 스크립트 실행.
//
// 흐름 (라운드당):
//   1. 이호기심 (성공 케이스 5~8건 분석)
//   2. 서사업 (이호기심 케이스 → 사업 후보 3~5개 풀 deep 사업계획서 초안)
//   3. 구현실 (서사업 후보 → 8대 기준 검증)
//   각 페르소나: 빈약 응답 시 최대 5회 재시도
//
// 6라운드 완료 후:
//   4. 한감독 (전체 통과 후보 환각·메커니즘·도달 부트스트랩·도메인 침범 더블체크 → PASS/DOWNGRADE/KILL)
//   5. 박결재 1차 (선별 + 비교 매트릭스)
//   6. 박결재 2차 (선정된 2~3개 풀 사업계획서 작성)
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
  const out = { date: null, rounds: 6, mock: false, sleepSec: 25 };
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
    '## 사용자 사업 컨텍스트 (이 도메인과 거의 같은 케이스 금지 — 메커니즘만 다른 영역에서 빌려옴)',
    '```json',
    JSON.stringify({
      active_channels: ctx.active_channels.map(c => c.name),
      exclude_domains: ctx.exclude_domains,
      user_profile: ctx.user_profile,
    }, null, 2),
    '```',
    '',
    previousTopics.length > 0
      ? `## 이전 라운드들이 이미 다룬 케이스 영역 (반드시 제외)\n- ${previousTopics.join('\n- ')}`
      : '## 이전 라운드 주제: 없음 (첫 라운드)',
    '',
    '## 라운드 가이드 (6라운드, 라운드별 다른 영역의 1인 사업 케이스 분석)',
    '- Round 1: 디지털 콘텐츠 1인 사업 (Gumroad·Stibee·메일리·페이북 — 전자책·뉴스레터·구독·템플릿·프롬프트팩)',
    '- Round 2: 노코드 앱·웹앱 1인 사업 (Glide·Softr·Bubble·Framer·Webflow — SaaS·도구·디렉토리)',
    '- Round 3: 강의·코칭·커뮤니티 1인 사업 (인프런·클래스101·디스코드 유료·1:1 코칭·줌 워크숍)',
    '- Round 4: 크리에이터·니치 IP 1인 사업 (유튜브 광고+제휴·인스타 큐레이션·팟캐스트·니치 블로그)',
    '- Round 5: 데이터·정보 큐레이션 1인 사업 (정부 지원금·세금·법률·보험 정보 / 채용·이직·연봉 데이터 / 재테크·부동산 정보 큐레이션)',
    '- Round 6: B2B 마이크로 SaaS·자동화 1인 사업 (특정 직업군용 도구·연동 자동화·Slack/Notion 봇·Chrome 확장)',
    '',
    '## 사용자 비자산 (반드시 의식)',
    '- 인스타·트위터·유튜브 팔로워 = **0**',
    '- 뉴스레터 구독자 = **0**',
    '- 블로그 트래픽 = 미미 (애드센스 심사 중)',
    '- 인플루언서 네트워크 = 없음',
    '- 자본 = 추가 0원 베스트, 최대 10만원',
    '',
    '## 🚫 절대 제외 도메인 (본업·인접 영역 전부)',
    '- 스마트스토어/쿠팡/네이버 셀러·온라인 판매자 대상 사업',
    '- e커머스 셀러 노하우 상품화 (CS·정산·반품·상세페이지·SEO 도구·템플릿·가이드·강의·뉴스레터·커뮤니티)',
    '- **과일·신선식품·식자재·요리·식문화 주제 일체** (과일 선물·제철 캘린더·식재료 감별·요리 레시피·식품 안전·과일 큐레이션 등 모두)',
    '- 농산물·산지·도매시장·식품 유통',
    '- 과일 블로그·SEO·마케팅 도구',
    '사용자는 "한국 1년차 1인 사업자, 비개발자"로만 취급. 위 영역 케이스는 가져오지 말고 **완전히 다른 영역의 1인 사업 케이스만** 발굴.',
    '',
    '## 요청',
    '이번 라운드 영역에서 **잘 된 1인 사업 케이스 3~5건**을 발굴·분석하세요.',
    '각 케이스: 사업명 / 운영자(본명·닉네임·핸들) / 플랫폼 / 매출·규모 추정 / **운영자 출발점(0인지 팔로워 N만+인지)** / 무엇을 팔았나 / 왜 잘됐나 / **첫 100명 부트스트랩 경로** / **약점·한계** / 출처 단서.',
    '환각 금지 — 사업명·운영자·플랫폼 셋 중 하나라도 모호하면 그 케이스 빼고 다른 케이스로.',
    '확실치 않으면 "추정" 또는 "확실치 않음 — 추가 검증 필요" 명시.',
    '운영자 출발점 분석은 **사용자(도달 0)와의 격차** 측정에 핵심이므로 빠뜨리면 안 됨.',
    '마지막에 **공통 성공 패턴** 2~3개 + **사용자 자산(1년치 운영 데이터·과일 도메인·1년차 사장 시야) 매핑 힌트** 한 줄.',
    '페르소나 프로필의 출력 형식을 엄수하세요.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const HOGIGSIM_RETRY_HINTS = [
  '지난 응답이 빈약했거나 환각 의심. 사업명·운영자(닉네임)·플랫폼·매출 추정 모두 명시된 케이스 5건 이상. Gumroad·인프런·메일리·X·IndieHackers에서 찾으세요.',
  '지난 응답도 빈약했습니다. 한국 외 케이스(IndieHackers·X "I built X" 영상·Reddit r/Entrepreneur)도 OK. 단 1인·3개월+·매출 인증 4조건 충족해야 함.',
  '다른 연령·성별·해외 1인 운영자(20대·40대 여성·미국·일본) 또는 다른 영역(B2B SaaS·니치 정보·1인 미디어)으로 시야 바꿔서 5건 발굴.',
  '인플루언서 자랑글·인터뷰 검색 키워드를 영어로(예: "solo founder MRR", "indie hacker stripe revenue")로 바꿔서 케이스 찾으세요.',
];

// ========== 서사업 prompt builder ==========
function buildSaeopPrompt(ctx, roundNum, hogigsimOutput, previousSaeopBusinesses, retryHint) {
  const base = [
    `## 현재 라운드: ${roundNum}`,
    '',
    '## 이호기심의 성공 케이스 분석',
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
    '## 사용자 자산·비자산 (반드시 의식)',
    '진짜 자산 (활용 가능):',
    '- **1년차 1인 사장의 시야·사고 패턴** — 시간 관리·의사결정·재정 관리를 **다른 도메인 1인 사업자에게** 일반화 (운영 노하우 자체 상품화 X)',
    '- 한국어·비개발자·핸드폰 선호·주 10~20시간 가용 시간',
    '- 본인의 일반 사회 경험·관심사·취미 (과일·식품·셀러와 무관한 부분)',
    '',
    '**과일·신선식품 도메인 지식은 자산이 아닙니다.** 그건 본업 영역. 사용자는 "한국 1년차 1인 사업자, 비개발자"로만 취급.',
    '',
    '🚫 **절대 금지 후보 (사업명·타겟·상품 중 하나라도 해당하면 자동 반려)**:',
    '- 스마트스토어/쿠팡/네이버 셀러·온라인 판매자 대상 사업 일체',
    '- e커머스 셀러 노하우 상품화 (CS·정산·반품·상세페이지·SEO 등)',
    '- **과일·신선식품·식자재·요리·식문화 주제 일체** (과일 선물·제철 캘린더·식재료 감별·요리 레시피·식품 안전 등 모두)',
    '- 농산물·산지·도매·식품 유통',
    '- 과일 블로그/스토어 SEO·마케팅 도구',
    '- **"1년간 과일 운영 경험" 자체를 신뢰성 근거로 쓰는 후보** ("과일 사장이 만든 OO" 식 = 본업 우려먹기)',
    '야간팀 존재 이유 = 본업·인접 도메인과 완전히 분리된 새 영역 탐색.',
    '',
    '비자산 (오해 금지):',
    '- 인스타·트위터·유튜브 팔로워 = **0**',
    '- 뉴스레터 구독자 = **0**',
    '- 블로그 트래픽 = 미미 (애드센스 심사 중)',
    '- 인플루언서 네트워크 = 없음',
    '- 자본 = 추가 0원 베스트, 최대 10만원',
    '',
    '## 매핑 절차 (반드시 따를 것)',
    '1. 이호기심이 분석한 케이스 중 **참고할 만한 1~2개 선택**',
    '2. 그 케이스의 **핵심 성공 메커니즘 추출** + **운영자 출발점이 사용자(도달 0)와 얼마나 다른지** 격차 측정',
    '3. **사용자 자산 중 매핑 가능한 것 식별** (위 진짜 자산 4개 중)',
    '4. **메커니즘 + 자산 = 사용자 버전 사업** 도출',
    '5. **시장 규모(TAM/SAM/SOM) + 경쟁자 2~3개 + 가격 전략 + 도달 부트스트랩(0→100명 3단계) + 단위 경제학 + 3주~1년 로드맵 + 위험 3개** 모두 작성',
    '',
    '## 엄격한 제약',
    '- 추가 자본 0원 베스트, **최대 10만원** (Apple $99 = 13만원 → 한도 초과)',
    '- 주 10~20시간 운영',
    '- 비개발자, 노코드/튜토리얼 수준',
    '- 학습 곡선 8주 초과 금지',
    '- 3주 내 첫 수익 또는 첫 고객 피드백 가능성',
    '- **참고 케이스 명시 필수** — 후보마다 이호기심 케이스 # 번호 + 빌려온 메커니즘 + 운영자 출발점 격차 명시',
    '- 참고 케이스 없는 즉흥 아이디어는 자동 반려',
    '- **도달 부트스트랩 3단계(1~2주차 / 3~6주차 / 7~12주차) 필수** — 단계마다 채널 이름·콘텐츠·기간 명시',
    '- "팔로워 활용" "기존 팬덤" 같은 빈말 금지 (사용자에겐 0)',
    '',
    '## 요청',
    '후보 **2~3개로 압축** (이전 5개 → 깊이 5배). 각 후보 1,500~2,500자. A~K 11개 섹션 모두 채우기. 페르소나 프로필의 출력 형식을 엄수하세요.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const SAEOP_RETRY_HINTS = [
  '지난 응답에 참고 케이스가 빠졌거나 모호했습니다. 후보마다 "참고 케이스: 이호기심 #N — [사업명/운영자/플랫폼]" + "빌려온 메커니즘" + "운영자 출발점 격차" 명시 필수.',
  '지난 응답도 미흡했습니다. 사용자 자산 매핑이 모호 — 어떤 자산(1년차 사장 사고 패턴·일반 사회 경험)을 정확히 어떻게 활용하는지 1줄로 명시.',
  '후보마다 A~K 11섹션 모두 채우세요. 시장 규모·경쟁자·도달 부트스트랩·단위 경제학 누락 시 자동 반려.',
  '도달 부트스트랩 1단계(채널 이름) / 2단계(전환율 가정) / 3단계(채널 자산화) 모두 구체적이어야 함. "적극 마케팅" 같은 빈말 금지.',
];

// ========== 구현실 prompt builder ==========
function buildHyeonsilPrompt(ctx, roundNum, hogigsimOutput, saeopOutput, retryHint) {
  const base = [
    `## 현재 라운드: ${roundNum}`,
    '',
    '## 이호기심 케이스 분석 (참고 케이스 환각 검증용)',
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
    '## 사용자 비자산 (도달 부트스트랩 검증용 — 매우 중요)',
    '- 인스타·트위터·유튜브 팔로워 = **0**',
    '- 뉴스레터 구독자 = **0**',
    '- 블로그 트래픽 = 미미 (애드센스 심사 중)',
    '- 인플루언서 네트워크 = 없음',
    '',
    '## 8대 검수 기준',
    '1. 자본 한계 (10만원 이하, 숨은 비용 포함)',
    '2. 시간 현실성 (주 20시간, 학습 곡선 포함)',
    '3. 시장 포화·경쟁',
    '4. 기술 난도 (비개발자 기준, 4주 초과=조건부, 8주 초과=반려)',
    '5. 수익화 속도 (3주 내 첫 수익 플랫폼 제약 포함)',
    '6. **참고 케이스 검증**: 케이스 실재성·메커니즘 일치·환경 차이·시장 포화 재발. 누락·환각·미일치 시 무조건 반려.',
    '7. **도달 부트스트랩**: 사용자 도달 0 → 첫 100명까지 3단계(1~2주차 / 3~6주차 / 7~12주차) 채널·콘텐츠·기간 명시 여부. 단계 누락 시 무조건 반려.',
    '8. **단위 경제학**: 단가 vs CAC, BEP, 수수료 반영, 가정 환각 검증. CAC > 단가 50% 이상이면 무조건 반려.',
    '',
    '## 🚫 추가 자동 반려 (본업·인접 도메인 침범 — 사업명·타겟·상품 중 하나라도 해당하면 무조건 ❌ 반려)',
    '- 스마트스토어/쿠팡/네이버 셀러·온라인 판매자 대상 사업 일체',
    '- e커머스 셀러 노하우 상품화 (CS·정산·반품·상세페이지·SEO 등)',
    '- **과일·신선식품·식자재·요리·식문화 주제 일체** (과일 선물·제철 캘린더·식재료 감별·요리 레시피·식품 안전 등 모두)',
    '- 농산물·산지·도매·식품 유통',
    '- 과일 블로그/SEO·마케팅 도구',
    '- "1년간 과일 운영 경험" 자체를 신뢰성 근거로 쓰는 후보 (본업 우려먹기)',
    '',
    '## 요청',
    '서사업의 후보 각각에 대해 ✅승인 / ⚠️조건부 / ❌반려 판정 + 6/7/8번 검증 결과 명시 + 위험 2~4개를 제시하세요. 페르소나 프로필 출력 형식 엄수.',
  ].join('\n');
  if (retryHint) return base + '\n\n## 재시도 힌트\n' + retryHint;
  return base;
}

const HYEONSIL_RETRY_HINTS = [
  '지난 응답에 6/7/8번 검증 결과가 빠졌습니다. 후보마다 6번(참고 케이스)·7번(도달 부트스트랩)·8번(단위 경제학) 검증 결과를 1~2줄씩 명시하세요.',
  '지난 응답도 빈약했습니다. 8대 기준 중 5개 이상 체크하세요. 위험은 구체 근거(어느 단계·어떤 가정)로.',
  '도메인 침범(스마트스토어/과일/식품) 후보가 통과했는지 다시 점검. 본업 침범 시 무조건 ❌ 반려.',
  '한감독에게 넘길 자료가 부실하면 안 됨. 각 후보의 6/7/8번 검증 결과를 1~2줄씩 각각 명시.',
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

// ========== 한감독 prompt builder ==========
function buildGamdokPrompt(allRounds, ctx) {
  return [
    '## 임무: 모든 라운드의 통과 후보(✅ + ⚠️)를 환각·메커니즘·도달 부트스트랩·도메인 침범 더블체크',
    '',
    '## 6라운드 결과 (이호기심 케이스 + 서사업 후보 + 구현실 판정)',
    '```json',
    JSON.stringify({
      total_rounds: allRounds.length,
      rounds: allRounds.map(r => ({
        number: r.number,
        status: r.status,
        hogigsim_output: r.hogigsim,
        saeop_output: r.saeop,
        hyeonsil_output: r.hyeonsil,
      })),
    }, null, 2).slice(0, 80000),
    '```',
    '',
    '## 사용자 자산·비자산',
    '진짜 자산: 1년차 1인 사장 시야·사고 패턴 / 한국어·비개발자 / 일반 사회 경험',
    '비자산: 팔로워·구독자·블로그 트래픽 모두 0',
    '🚫 본업·인접 도메인 (자동 KILL): 스마트스토어/쿠팡/네이버 셀러 / 과일·신선식품·식자재·요리·식문화 / 농산물·식품 유통 / 과일 블로그 SEO',
    '',
    '## 검수 4가지 (구현실이 못 잡은 것만)',
    '1. **환각 의심**: 사업명·운영자·플랫폼·매출이 검증 가능한가? 의심 → DOWNGRADE, 명백 환각 → KILL',
    '2. **메커니즘 ↔ 자산 정합성**: 빌려온 메커니즘이 케이스의 진짜 성공 요인과 일치? 사용자 자산이 그 메커니즘 작동시킬 수 있나?',
    '3. **도달 부트스트랩 가정 현실성**: 1단계 채널 구체적인지, 전환율 가정 합리적인지, 3단계 자산화 검증 가능한지',
    '4. **본업·인접 도메인 침범**: 사업명·타겟·상품 중 하나라도 위 자동 KILL 영역에 해당하면 KILL',
    '',
    '## 출력',
    '구현실 통과 후보(✅·⚠️) 각각에 대해 PASS / DOWNGRADE / KILL 등급 + 검수 결과 4가지 + 한 줄 사유. 마지막에 종합(PASS X / DOWNGRADE Y / KILL Z) + 박결재 권고.',
    '구현실 ❌ 반려 건은 안 봄.',
    '페르소나 프로필 출력 형식 엄수.',
  ].join('\n');
}

// ========== 박결재 1차 prompt builder (선별 + 비교 매트릭스) ==========
function buildGyeoljae1Prompt(date, allRounds, gamdokOutput, ctx) {
  const skippedCount = allRounds.filter(r => r.status !== 'complete').length;
  return [
    `## 오늘 날짜: ${date}`,
    `## 6라운드 실행 결과 + 한감독 더블체크 등급`,
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
    }, null, 2).slice(0, 70000),
    '```',
    '',
    '## 한감독 더블체크 결과 (PASS/DOWNGRADE/KILL)',
    gamdokOutput,
    '',
    '## 사용자 자산·비자산',
    '진짜 자산: 1년차 1인 사장 사고 패턴 / 한국어·비개발자 / 일반 사회 경험',
    '비자산: 팔로워·구독자·블로그 트래픽 모두 0, 자본 0~10만원',
    '🚫 자동 보류: 스마트스토어/쿠팡/네이버 셀러 / 과일·신선식품·식자재·요리·식문화 / 식품 유통',
    '',
    '## 1차 임무 (선별 + 비교 매트릭스만 작성, 풀 사업계획서는 2차에서)',
    '1. **자동 제외**: 구현실 ❌ + 한감독 KILL',
    '2. **중복 제거**: 같은 사업이 여러 라운드에 나오면 통합',
    '3. **별점 산정**: ★★★ (한감독 PASS + 자본 0~3만원 + 도달 부트스트랩 명확) / ★★ (PASS or DOWNGRADE + 자본 3~10만원) / ★ (DOWNGRADE)',
    '4. **비교 매트릭스 작성**: 모든 통과 후보 한눈에 (사업명/별점/한감독 등급/핵심 메커니즘/도달 1단계 채널/첫 수익 시점·금액/1년 SOM)',
    '5. **상위 2~3개 후보 ID 선정** (★★★ 우선, ★★ 보조)',
    '6. **오늘 한 건 지정**: ★★★ 중 자본 0원 + 도달 부트스트랩 가장 구체적인 것 1개',
    '',
    '## 1차 출력 형식 (페르소나 프로필 1차 출력 형식 엄수)',
    '- 통과 후보 비교 매트릭스 (마크다운 표)',
    '- 최종 선정 (풀 사업계획서 작성 대상) — 후보 2~3개 ID',
    '- 오늘 한 건 (★★★ 1건)',
    '- 보류·반려 한 줄씩 (DOWNGRADE 후보 + 자본 초과 + 도메인 침범)',
    '',
    skippedCount === allRounds.length
      ? '**전 라운드 수확 없음 → "수확 없음 에스컬레이션" 형식**'
      : '',
  ].join('\n');
}

// ========== 박결재 2차 prompt builder (선정된 2~3개 풀 사업계획서) ==========
function buildGyeoljae2Prompt(date, allRounds, gamdokOutput, gyeoljae1Output, ctx) {
  return [
    `## 오늘 날짜: ${date}`,
    `## 1차 결과 (선별 + 비교 매트릭스 + 최종 선정 후보 ID)`,
    gyeoljae1Output,
    '',
    `## 한감독 더블체크 결과`,
    gamdokOutput.slice(0, 8000),
    '',
    `## 6라운드 raw 데이터 (선정된 후보의 풀 사업계획서 작성용)`,
    '```json',
    JSON.stringify({
      rounds: allRounds.map(r => ({
        number: r.number,
        status: r.status,
        hogigsim_output: r.hogigsim,
        saeop_output: r.saeop,
        hyeonsil_output: r.hyeonsil,
      })),
    }, null, 2).slice(0, 60000),
    '```',
    '',
    '## 사용자 자산·비자산',
    '진짜 자산: 1년차 1인 사장 사고 패턴 / 한국어·비개발자 / 일반 사회 경험',
    '비자산: 팔로워·구독자·블로그 트래픽 모두 0, 자본 0~10만원',
    '🚫 자동 보류: 스마트스토어/쿠팡/네이버 셀러 / 과일·신선식품·식자재·요리·식문화 / 식품 유통',
    '',
    '## 2차 임무 (1차에서 선정한 2~3개 후보의 풀 사업계획서 작성)',
    '1차에서 선정한 후보 2~3개 각각에 대해 A~J 10섹션 풀 사업계획서를 작성하세요.',
    '후보당 1,500~2,500자 (1.5~2페이지). 총 6,000~8,000자 (4페이지 분량).',
    '',
    '## 후보 디테일 (필수 A~J 10개 섹션)',
    'raw 응답에서 인용. 부족하면 "(추정)"·"(미확정)" 표기, 빈 섹션 금지.',
    '- **A. 사업 개요** 3~5줄',
    '- **B. 참고 성공 사례** 3~5줄: 사업명/운영자/플랫폼/매출 + **운영자 출발점(0인지 팔로워 N만+인지)** + 핵심 메커니즘',
    '- **C. 시장 규모** 4~6줄: TAM / SAM / SOM(도달 0 사용자 1년 안에 N명) / 시장 흐름',
    '- **D. 경쟁자 분석** 5~8줄: 경쟁자 2~3개 + 사용자 wedge',
    '- **E. 가격 전략** 3~5줄: 권장 가격 + 근거 + 진화 로드맵',
    '- **F. 도달 부트스트랩 (가장 자세히)** 8~12줄: 1단계(1~2주차) / 2단계(3~6주차) / 3단계(7~12주차) — 채널 이름·콘텐츠·기간·전환율 가정',
    '- **G. 단위 경제학** 4~6줄: 단가 / 변동 비용 / 마진/건 / CAC / LTV / BEP',
    '- **H. 실행 로드맵** 8~12줄: 1주~3주 / 1개월 / 3개월 / 1년 마일스톤',
    '- **I. 핵심 위험 + 완화** 3~5줄: 위험 3개 각각 mitigation',
    '- **J. 첫 수익 시점·금액** 1~2줄: 보수적 / 목표',
    '',
    '## 출력 형식 (페르소나 프로필 2차 형식 엄수)',
    '"## 후보 1: [사업명] (★★★)" 헤더 + A~J 섹션. 후보 2, 3 동일.',
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
        mockOutput: `### 이호기심 — 잘 된 1인 사업 케이스 (Round ${r})\n\n## 케이스 1: MOCK 사업 ${r}-A\n- 운영자: @mockuser_${r}a\n- 플랫폼: Gumroad\n- 매출/규모: 월 300만원 추정\n- 무엇을 팔았나: MOCK 디지털 상품\n- 왜 잘됐나: 좁은 타겟 + 즉시 사용성\n- 출처/단서: X 자랑글\n\n## 케이스 2: MOCK 사업 ${r}-B\n- 운영자: @mockuser_${r}b\n- 플랫폼: 인프런\n- 매출/규모: 누적 수강생 500명\n- 무엇을 팔았나: MOCK 강의\n- 왜 잘됐나: 본인 경험 기반\n- 출처/단서: 인터뷰\n\n## 케이스 3: MOCK 사업 ${r}-C\n- 운영자: @mockuser_${r}c\n- 플랫폼: 메일리\n- 매출/규모: 유료 구독 200명\n- 무엇을 팔았나: MOCK 뉴스레터\n- 왜 잘됐나: 니치 + 매주 발송\n- 출처/단서: 추정\n\n## 공통 패턴\n- 좁은 타겟 + 즉시 사용성 + 본인 경험 기반\n\n## 사용자 자산 매핑 힌트\n- 1년차 스마트스토어 사장 경험을 즉시 사용 가능한 형태로 묶기`,
        geminiOpts: { temperature: 0.6, maxTokens: 16384 },
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
        mockOutput: `### 서사업 — 케이스 메커니즘 → 사용자 자산 적용 (Round ${r})\n\n## 후보 1: MOCK 사업 R${r}-1\n- 참고 케이스: 이호기심 #1 (MOCK ${r}-A / @mockuser_${r}a / Gumroad)\n- 빌려온 메커니즘: 좁은 타겟 + 즉시 사용성\n- 사용자 자산 매핑: 1년차 스마트스토어 사장 경험\n- 자본: 0원\n- 주간: 5시간\n- 실행 단계: 1주 MVP · 2주 피드백 · 3주 첫 수익 시도\n\n## 후보 2: MOCK 사업 R${r}-2\n- 참고 케이스: 이호기심 #2 (MOCK ${r}-B / @mockuser_${r}b / 인프런)\n- 빌려온 메커니즘: 본인 경험 기반\n- 사용자 자산 매핑: 과일 도메인 지식\n- 자본: 3만원\n- 주간: 10시간`,
        geminiOpts: { temperature: 0.5, maxTokens: 24576 },
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
        mockOutput: `### 구현실 — 사업화안 반론 (Round ${r})\n\n## 후보 1: MOCK 사업 R${r}-1\n- 판정: ✅ 승인\n- 참고 케이스 검증: 케이스 실재성 OK / 메커니즘 일치 OK / 환경 차이 없음\n- 위험 1: MOCK 시장 포화 가능성\n- 위험 2: MOCK 초기 홍보 부담\n\n## 후보 2: MOCK 사업 R${r}-2\n- 판정: ⚠️ 조건부\n- 참고 케이스 검증: 케이스 실재성 OK / 환경 차이 있음`,
        geminiOpts: { temperature: 0.4, maxTokens: 16384 },
      });
    round.hyeonsil = hyeonsilRes.output;
    round.status = hyeonsilRes.bankrupt ? 'partial' : 'complete';
    allRounds.push(round);
    console.log(`  ✅ R${r} 완료 (status: ${round.status})`);
    await sleep(opts.sleepSec);
  }

  // 4. 한감독 — 전체 후보 더블체크
  console.log('\n━━━━━━━━━━━━━━━ 한감독 더블체크 ━━━━━━━━━━━━━━━');
  const gamdokRes = await callWithRetry('han-gamdok', () => buildGamdokPrompt(allRounds, ctx), {
    retryHints: [
      '지난 응답이 빈약. 통과 후보 각각에 대해 PASS/DOWNGRADE/KILL 등급 + 검수 결과 4가지 + 한 줄 사유를 반드시 명시.',
      '환각·메커니즘·도달 부트스트랩·도메인 침범 4가지 검수 결과를 후보마다 1줄씩 작성. 종합(PASS X / DOWNGRADE Y / KILL Z) 필수.',
      '구현실이 ❌ 반려한 후보는 안 봄. ✅·⚠️ 통과 후보만 검수.',
      '추상 사유 금지. 환각·메커니즘·부트스트랩·도메인 중 어느 것에 해당하는지 명시.',
    ],
    mock,
    mockOutput: `### 한감독 — 후보 더블체크 (MOCK)\n\n## 후보 1: MOCK 사업\n- 한감독 등급: ✅ PASS\n- 환각 의심: 없음 / 메커니즘: OK / 부트스트랩: OK / 도메인: 없음\n\n## 종합\n- PASS 2 / DOWNGRADE 0 / KILL 0`,
    isBankrupt: (o) => !o || o.length < 200,
    geminiOpts: { temperature: 0.3, maxTokens: 16384 },
  });
  await sleep(opts.sleepSec);

  // 5. 박결재 1차 — 선별 + 비교 매트릭스
  console.log('\n━━━━━━━━━━━━━━━ 박결재 1차 (선별 + 매트릭스) ━━━━━━━━━━━━━━━');
  const gyeoljae1Res = await callWithRetry('park-gyeoljae', () => buildGyeoljae1Prompt(date, allRounds, gamdokRes.output, ctx), {
    retryHints: [
      '비교 매트릭스(마크다운 표) + 최종 선정 후보 ID 2~3개 + 오늘 한 건 + 보류 한 줄씩, 페르소나 프로필 1차 형식 엄수.',
      '한감독 KILL 자동 제외, 도메인 침범 자동 보류. ★★★는 PASS + 자본 0~3만원 + 도달 부트스트랩 명확.',
      '비교 매트릭스에 사업명/별점/한감독 등급/메커니즘/도달 1단계/첫 수익/1년 SOM 7개 컬럼 모두 채우기.',
    ],
    mock,
    mockOutput: `## 1차 — 후보 선별 + 비교 매트릭스 (MOCK)\n\n### 통과 후보 비교 매트릭스\n| # | 사업명 | 별점 | 한감독 | 메커니즘 | 도달 1단계 | 첫 수익 | 1년 SOM |\n|---|---|---|---|---|---|---|---|\n| 1 | MOCK 사업 1 | ★★★ | PASS | 좁은 타겟 | 카페 X | 3주차 10만원 | 100명 |\n\n### 최종 선정\n- 후보 1: MOCK 사업 (★★★)\n\n### 오늘 한 건\n**MOCK 사업** (★★★) — 자본 0원, 부트스트랩 가장 구체적`,
    isBankrupt: (o) => !o || o.length < 300,
    geminiOpts: { temperature: 0.3, maxTokens: 16384 },
  });
  await sleep(opts.sleepSec);

  // 6. 박결재 2차 — 풀 사업계획서 작성
  console.log('\n━━━━━━━━━━━━━━━ 박결재 2차 (풀 사업계획서) ━━━━━━━━━━━━━━━');
  const gyeoljae2Res = await callWithRetry('park-gyeoljae', () => buildGyeoljae2Prompt(date, allRounds, gamdokRes.output, gyeoljae1Res.output, ctx), {
    retryHints: [
      '1차에서 선정한 2~3개 후보의 풀 사업계획서를 A~J 10섹션 모두 채워서 작성. 후보당 1.5~2페이지.',
      'A~J 섹션 모두 빈 곳 없게. 부족하면 raw 응답에서 인용. 모르면 "(추정)" 표기.',
      'F. 도달 부트스트랩은 가장 자세히. 1단계(채널 이름)/2단계(전환율)/3단계(자산화) 8~12줄.',
    ],
    mock,
    mockOutput: `## 후보 1: MOCK 사업 (★★★)\n\n### A. 사업 개요\nMOCK 사업계획서 deep 작성 (2차)\n\n### B. 참고 성공 사례\n- MOCK 케이스\n\n### C~J\nMOCK A~J 10섹션 풀 작성`,
    isBankrupt: (o) => !o || o.length < 1500,
    geminiOpts: { temperature: 0.3, maxTokens: 32768 },
  });

  // 7. 최종 리포트 합치기 (1차 매트릭스 + 2차 풀 사업계획서)
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outPath = path.join(REPORTS_DIR, `${date}.md`);
  const rawPath = path.join(REPORTS_DIR, `${date}-raw.md`);

  const finalReport = [
    `🌅 야간 사업계획서 (${date}, ${opts.rounds}라운드)`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📊 1차: 선별 + 비교 매트릭스',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    gyeoljae1Res.output,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📋 2차: 풀 사업계획서 (선정 후보 A~J 10섹션)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    gyeoljae2Res.output,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '📊 6라운드 전체 상세 (이호기심·서사업·구현실 원문 + 한감독 등급): -raw.md',
    '📝 관심 있으면: /done [번호] · 넘기면: /ignore [번호]',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  fs.writeFileSync(outPath, finalReport, 'utf8');
  console.log(`\n📝 최종 사업계획서 저장: ${outPath}`);

  // raw (6라운드 원본 + 한감독 결과)
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
    '---',
    '',
    '## 한감독 더블체크 결과',
    gamdokRes.output,
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

// ========== MOCK 박결재 (1차+2차 합본, 폴백용 — 현재 메인은 분리 호출) ==========
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
    ...completeRounds.slice(0, 2).flatMap((r, i) => [
      `## 후보 ${i + 1}: MOCK Round ${r.number} 사업 (★★★)`,
      '### A. 사업 개요\nMOCK deep 사업 설명',
      '### B. 참고 성공 사례\n- 사업명: MOCK 사업 / 운영자: @mockuser / 플랫폼: Gumroad / 매출: 월 300만원\n- 운영자 출발점: 인스타 5만 팔로워에서 시작 (사용자 0과 격차 큼)\n- 메커니즘: 좁은 타겟 + 즉시 사용성',
      '### C. 시장 규모\n- TAM: 한국 1인 사업자 100만\n- SAM: 스마트스토어 사장 5만\n- SOM: 도달 0 사용자 1년 안에 100명',
      '### D. 경쟁자 분석\n- 경쟁자 1: MOCK A (9,900원, 강점 X, 약점 Y)\n- 사용자 wedge: 1년차 시야 + 과일 도메인',
      '### E. 가격 전략\n- 9,900원 → 검증 후 19,900원',
      '### F. 도달 부트스트랩 (0 → 100명)\n- 1단계 1~2주차: 네이버 카페 셀러팜 50건 댓글\n- 2단계 3~6주차: 무료 PDF 시드 + 후기 5개\n- 3단계 7~12주차: 네이버 블로그 자산화',
      '### G. 단위 경제학\n- 단가 9,900 / 마진 9,400 / CAC 0 / BEP 11건',
      '### H. 실행 로드맵\n- 1주차 ~ 1년차 MOCK',
      '### I. 핵심 위험 + 완화\n- 위험 1 / 완화 1',
      '### J. 첫 수익 시점\n- 3주차 ~10만원',
      '',
    ]),
    '⏸️ **보류** (없음)',
    '',
    '📊 4라운드 전체 상세: /morning',
  ].join('\n');
}
