// Guide 패턴 데이터 — 자격·체크리스트·단계 설명 토픽

export type GuideItem = {
  index: number;
  label: string;     // 메타 라벨 (나이, 소득 등)
  text: string;      // 메인 텍스트 (만 19~34세)
  detail?: string;   // 부가 설명
  icon?: string;     // 이모지
};

export type GuideData = {
  slug: string;
  title: string;
  hookTitle: string;       // 첫 줄 (큰 글씨 1)
  hookSubtitle: string;    // 두 번째 줄 (큰 글씨 2 — 강조)
  hookHashtag: string;     // 상단 라벨
  items: GuideItem[];      // 보통 5개
  benefitTitle: string;
  benefitDetail: string;
  warning: string;
  ctaTopline: string;      // 윗줄
  ctaBottom: string;       // 아랫줄
};

export const DAY03_GUIDE: GuideData = {
  slug: 'day-03-cheong-do-account-guide',
  title: '청년도약계좌',
  hookTitle: '청년이면 무조건',
  hookSubtitle: '청년도약계좌',
  hookHashtag: 'GUIDE · NO. 03',
  items: [
    { index: 1, label: '나이',     text: '만 19~34세',     detail: '병역기간 추가 인정', icon: '🎂' },
    { index: 2, label: '총급여',   text: '7,500만원 이하',                              icon: '💼' },
    { index: 3, label: '가구소득', text: '중위 250% 이하', detail: '1인 약 624만원/월',  icon: '🏠' },
    { index: 4, label: '금융소득', text: '종합과세 비대상',                              icon: '📊' },
    { index: 5, label: '중복',     text: '한 은행에서만',                                icon: '🔒' },
  ],
  benefitTitle: '핵심 혜택',
  benefitDetail: '정부 매월 최대 4.2만원 + 이자 비과세',
  warning: '5년 못 채우면 혜택 회수',
  ctaTopline: '시뮬레이션은',
  ctaBottom: '블로그에서',
};
