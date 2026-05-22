// 한국어 토픽 → 영어 검색어 매핑 (Pexels/Pixabay용)
// 사용 예:
//   const { toQuery } = require('./topic-keywords');
//   toQuery('사과 고르는 법', 'fruit') // → 'apple'
//   toQuery('5월 고금리 예금 TOP5', 'economy') // → 'savings deposit'

// 과일 블로그용
const FRUIT = {
  '사과': 'apple',
  '배': 'pear',
  '복숭아': 'peach',
  '자두': 'plum',
  '체리': 'cherry',
  '딸기': 'strawberry',
  '산딸기': 'raspberry',
  '복분자': 'raspberry',
  '블루베리': 'blueberry',
  '블랙베리': 'blackberry',
  '포도': 'grape',
  '샤인머스캣': 'green grape',
  '거봉': 'grape',
  '수박': 'watermelon',
  '멜론': 'melon',
  '메론': 'melon',
  '참외': 'korean melon',
  '망고': 'mango',
  '바나나': 'banana',
  '파인애플': 'pineapple',
  '키위': 'kiwi',
  '오렌지': 'orange',
  '귤': 'tangerine',
  '한라봉': 'tangerine',
  '레몬': 'lemon',
  '라임': 'lime',
  '석류': 'pomegranate',
  '감': 'persimmon',
  '대추': 'jujube',
  '무화과': 'fig',
  '아보카도': 'avocado',
  '용과': 'dragonfruit',
  '두리안': 'durian',
  '망고스틴': 'mangosteen',
  '구아바': 'guava',
  '리치': 'lychee',
  '코코넛': 'coconut',
  '토마토': 'tomato',
  '방울토마토': 'cherry tomato',
};

// 경제 블로그용 (꿀팁)
const ECONOMY = {
  '적금': 'savings account',
  '예금': 'bank deposit',
  '정기예금': 'fixed deposit',
  '자유적금': 'savings',
  '파킹통장': 'savings account',
  '청년도약계좌': 'youth savings',
  'ISA': 'investment',
  '주식': 'stocks',
  '펀드': 'mutual fund',
  '연금': 'pension',
  '보험': 'insurance',
  '대출': 'loan',
  '신용카드': 'credit card',
  '체크카드': 'debit card',
  '환율': 'currency exchange',
  '달러': 'us dollar',
  '엔화': 'japanese yen',
  '금리': 'interest rate',
  '금융': 'finance',
  '은행': 'bank',
  '경제': 'economy',
  '재테크': 'finance planning',
  '투자': 'investment',
  '부동산': 'real estate',
  '아파트': 'apartment',
  '전세': 'home',
  '월세': 'home rent',
  '청약': 'home subscription',
  '세금': 'tax',
  '연말정산': 'tax return',
  '비상금': 'emergency fund',
  '목돈': 'big money',
  '저축': 'saving money',
};

// 재테크 (월급쟁이)
const FINANCE = {
  '월급': 'salary',
  '직장인': 'office worker',
  '사회초년생': 'young worker',
  '20대': 'young adults',
  '30대': 'adults work',
  '신혼': 'newlyweds',
  '재테크': 'finance planning',
  '월급관리': 'budget planning',
  '가계부': 'budget book',
  '통장쪼개기': 'budget envelope',
  '비상금': 'emergency fund',
  '목돈만들기': 'saving money',
  '짠테크': 'frugal living',
  '절약': 'saving',
  '소비': 'spending',
  // 경제 키워드도 다 포함
  ...ECONOMY,
};

const KEYWORD_MAPS = {
  fruit: FRUIT,
  economy: ECONOMY,
  finance: FINANCE,
};

// 메인: 한국어 텍스트에서 영어 검색어 추출
// text: 토픽 제목 또는 prompt
// blog: 'fruit' | 'economy' | 'finance'
// 반환: 영어 검색어 문자열 (못 찾으면 fallback에서 추출 시도)
function toQuery(text, blog = 'fruit') {
  if (!text || typeof text !== 'string') return null;
  const map = KEYWORD_MAPS[blog] || FRUIT;

  // 1순위: 정확한 매핑 매칭
  const matched = [];
  for (const [kr, en] of Object.entries(map)) {
    if (text.includes(kr)) matched.push(en);
  }
  if (matched.length > 0) {
    // 첫 2개 매칭만 사용 (너무 많으면 검색 망함)
    return matched.slice(0, 2).join(' ');
  }

  // 2순위: 영어 단어가 이미 있으면 추출
  const englishWords = text.match(/[a-zA-Z]{4,}/g);
  if (englishWords && englishWords.length > 0) {
    // 흔한 잡어 제외
    const stopwords = new Set([
      'photograph', 'photography', 'photo', 'image', 'quality', 'natural',
      'light', 'professional', 'shot', 'background', 'foreground', 'with',
      'from', 'this', 'that', 'food', 'fresh', 'close', 'high', 'soft',
      'wooden', 'table', 'overhead', 'composition', 'minimalist', 'clean',
    ]);
    const meaningful = englishWords
      .map(w => w.toLowerCase())
      .filter(w => !stopwords.has(w));
    if (meaningful.length > 0) return meaningful.slice(0, 2).join(' ');
  }

  // 3순위: 블로그별 기본 키워드
  const defaults = {
    fruit: 'fresh fruit',
    economy: 'finance money',
    finance: 'money savings',
  };
  return defaults[blog] || 'photo';
}

module.exports = { toQuery, FRUIT, ECONOMY, FINANCE };
