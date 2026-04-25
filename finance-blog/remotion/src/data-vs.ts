// VS 패턴 데이터 — A vs B 비교 토픽 (Day 2 외 향후 토픽 재사용)

export type VsOption = {
  name: string;       // 한국어 (파킹통장)
  label: string;      // ENG 라벨 (PARKING)
  emoji: string;
};

export type VsRound = {
  index: number;
  metric: string;      // "금리" / "출금" 등
  metricEng: string;   // "RATE" / "FREEDOM"
  aValue: string;
  bValue: string;
  winner: 'A' | 'B';
  note?: string;
};

export type VsData = {
  slug: string;
  optionA: VsOption;
  optionB: VsOption;
  rounds: VsRound[];
  verdict: {
    aFor: string;   // "비상금"
    bFor: string;   // "목돈 모으기"
  };
};

export const DAY02_VS: VsData = {
  slug: 'day-02-parking-account-vs-savings',
  optionA: { name: '파킹통장', label: 'PARKING', emoji: '🅰️' },
  optionB: { name: '자유적금', label: 'SAVINGS', emoji: '🅱️' },
  rounds: [
    { index: 1, metric: '금리',     metricEng: 'RATE',      aValue: '연 3.30%', bValue: '연 4.50%',     winner: 'B' },
    { index: 2, metric: '출금 자유', metricEng: 'FREEDOM',   aValue: '언제든 OK', bValue: '중도 페널티', winner: 'A' },
    { index: 3, metric: '한도',     metricEng: 'LIMIT',     aValue: '대부분 무제한', bValue: '월 30~100만', winner: 'A' },
    { index: 4, metric: '우대조건', metricEng: 'CONDITION', aValue: '거의 없음', bValue: '까다로움',     winner: 'A' },
  ],
  verdict: {
    aFor: '비상금',
    bFor: '목돈 모으기',
  },
};
