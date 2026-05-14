export type Bank = {
  rank: number;
  bank: string;
  product: string;
  rate: string;
  baseRate: string;
  limit: string;
  condition: string;
};

// 검증 출처: 금융감독원 금융상품한눈에 OpenAPI (2026-04-20 공시)
// 한도(limit)는 공시에 없음 → "공시 기준" 또는 "은행 문의"
export const SAVINGS_TOP10: Bank[] = [
  { rank: 1,  bank: '경남은행',     product: '오면우대! 정기적금',       rate: '7.00', baseRate: '1.90', limit: '정액적립식', condition: '자동이체·마케팅' },
  { rank: 2,  bank: '토스뱅크',     product: '굴비 적금',              rate: '4.30', baseRate: '1.80', limit: '자유적립식', condition: '만기 해지' },
  { rank: 3,  bank: '수협은행',     product: '해양플라스틱Zero!적금',   rate: '4.15', baseRate: '3.65', limit: '자유적립식', condition: '자동이체·첫거래' },
  { rank: 4,  bank: '수협은행',     product: '헤이(Hey)적금',          rate: '4.10', baseRate: '3.20', limit: '자유적립식', condition: '자동이체·첫거래' },
  { rank: 5,  bank: '수협은행',     product: '해양플라스틱Zero!적금',   rate: '4.00', baseRate: '3.50', limit: '정액적립식', condition: '자동이체·첫거래' },
  { rank: 6,  bank: '경남은행',     product: 'BNK더조은자유적금',      rate: '3.80', baseRate: '3.10', limit: '공시 기준',  condition: '자동이체·오픈뱅킹' },
  { rank: 7,  bank: '토스뱅크',     product: '키워봐요 적금',          rate: '3.80', baseRate: '1.80', limit: '공시 기준',  condition: '자동이체' },
  { rank: 8,  bank: '신한은행',     product: '신한 알.쏠 적금',         rate: '3.75', baseRate: '2.45', limit: '공시 기준',  condition: '마케팅·오픈뱅킹' },
  { rank: 9,  bank: '광주은행',     product: '해피라이프_여행스케치',   rate: '3.70', baseRate: '2.50', limit: '공시 기준',  condition: '카드실적' },
  { rank: 10, bank: '수협은행',     product: '헤이(Hey)적금',          rate: '3.70', baseRate: '2.80', limit: '정액적립식', condition: '자동이체·첫거래' },
];

export const TOP5 = SAVINGS_TOP10.slice(0, 5);

// v2: Toss-inspired light editorial palette
export const COLORS = {
  bg: '#FAFAFA',           // off-white background
  bgAlt: '#F1F3F8',        // very light blue-gray panel
  bgDark: '#0B1B3D',       // deep navy (1위 강조 scene 전용)
  primary: '#1B64DA',      // Toss blue
  primarySoft: '#E5EEFB',  // Toss blue 5%
  accent: '#FFB800',       // gold
  data: '#00C896',         // mint (금리·수익 데이터)
  dataSoft: '#E0F7F0',
  text: '#0B1B3D',         // 짙은 네이비 본문
  textInverse: '#FFFFFF',
  muted: '#6B7280',        // 보조 텍스트
  line: '#E5E7EB',         // 그리드·구분선
};

export const FONT_FAMILY = '"Pretendard", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", sans-serif';
