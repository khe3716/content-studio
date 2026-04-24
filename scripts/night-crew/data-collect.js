// 야간 리서치 컨텍스트 수집
//   - 이호기심: 중복 회피용 "사용자 현재 도메인" 전달
//   - 서사업: 기존 자산(스마트스토어·블로그·인스타) 활용 제안 근거
//   - 구현실: 1인 운영 현실 감각 (사용자가 이미 운영 중인 채널 수)

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

// 사용자 현재 사업 스냅샷
function collectNightContext() {
  const products = safeReadJson(path.join(REPO_ROOT, 'fruit-blog', 'products.json'));

  const productCategories = Array.isArray(products)
    ? [...new Set(products.map(p => (p.category || '').split('>').pop()).filter(Boolean))]
    : [];

  const productCount = Array.isArray(products) ? products.length : 0;

  // 현재 활성 채널 목록 (낮 자동화가 이미 돌리는 것들)
  const activeChannels = [
    { name: '경제블로그 (Blogger)', daily_load: '2편 자동 발행 (07:30, 17:00)' },
    { name: '과일블로그 (Blogger)', daily_load: '1편 자동 발행 (18:00)' },
    { name: '네이버 블로그', daily_load: '반자동 (수동 복붙)' },
    { name: '스마트스토어 (달콤살랑)', daily_load: `상품 ${productCount}개 운영` },
    { name: '쿠팡 Wing', daily_load: 'API 자동 등록' },
    { name: '인스타그램', daily_load: '카드뉴스 준비 단계' },
  ];

  // 야간 팀이 중복 피해야 할 도메인 (낮 팀 영역)
  const exclude_domains = [
    '과일 직접 (산딸기·멜론·블루베리·딸기·참외 등 박과일 낮 영역)',
    '경제 기초 (복리·금리·예적금 등 김하나 낮 영역)',
    '스마트스토어 과일 직접 판매 (이미 운영 중)',
  ];

  return {
    collected_at: new Date().toISOString(),
    product_count: productCount,
    product_categories: productCategories,
    active_channels: activeChannels,
    exclude_domains: exclude_domains,
    user_profile: {
      type: '1인 사장',
      occupation: '스마트스토어(달콤살랑) 과일 판매자',
      is_developer: false,
      available_time_per_week: '10~20시간 (본업 + 기존 블로그·스토어 유지하며)',
      capital_ceiling_krw: 100000,
      skill_level: '비개발자, 노코드/간단 튜토리얼 수준 허용',
    },
  };
}

// 라운드별 주제 중복 회피용 누적 기록
// - 같은 밤에 여러 라운드가 다른 주제를 탐색하게 함
// - 휘발성: 밤마다 리셋
class RoundMemory {
  constructor() {
    this.topics = []; // 모든 라운드에서 언급된 주제 누적
  }
  add(topics) {
    if (!Array.isArray(topics)) return;
    for (const t of topics) {
      if (t && !this.topics.includes(t)) this.topics.push(t);
    }
  }
  snapshot() {
    return [...this.topics];
  }
}

module.exports = {
  collectNightContext,
  RoundMemory,
};
