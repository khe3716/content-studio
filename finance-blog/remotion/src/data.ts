export type Bank = {
  rank: number;
  bank: string;
  product: string;
  rate: string;
  baseRate: string;
  limit: string;
  condition: string;
};

export const SAVINGS_TOP10: Bank[] = [
  { rank: 1,  bank: '토스뱅크',  product: '자유적금',           rate: '5.50', baseRate: '4.50', limit: '월 100만원', condition: '첫거래·자동이체' },
  { rank: 2,  bank: '케이뱅크',  product: '코드K 자유적금',      rate: '5.20', baseRate: '4.20', limit: '월 30만원',  condition: '미션·자동이체' },
  { rank: 3,  bank: '카카오뱅크', product: '자유적금',           rate: '5.00', baseRate: '4.00', limit: '월 30만원',  condition: '26주 챌린지' },
  { rank: 4,  bank: '신한은행',  product: '쏠편한 정기적금',     rate: '4.80', baseRate: '3.85', limit: '월 100만원', condition: 'SOL·자동이체' },
  { rank: 5,  bank: '우리은행',  product: '우리원적금',          rate: '4.65', baseRate: '3.70', limit: '월 50만원',  condition: 'WON·카드실적' },
  { rank: 6,  bank: '국민은행',  product: 'KB스타정기적금',      rate: '4.50', baseRate: '3.60', limit: '월 100만원', condition: 'KB Pay·급여' },
  { rank: 7,  bank: '농협',      product: '채움적금',            rate: '4.40', baseRate: '3.50', limit: '월 50만원',  condition: 'NH카드·자동이체' },
  { rank: 8,  bank: '하나은행',  product: '급여하나 월복리',     rate: '4.30', baseRate: '3.40', limit: '월 100만원', condition: '급여이체' },
  { rank: 9,  bank: 'iM뱅크',    product: '더쿠폰적금',          rate: '4.20', baseRate: '3.30', limit: '월 50만원',  condition: '첫거래·급여' },
  { rank: 10, bank: 'SC제일',    product: 'e그린세이브',         rate: '4.10', baseRate: '3.20', limit: '월 30만원',  condition: '친환경·자동이체' },
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
