// 금융감독원 금융상품한눈에 OpenAPI로 예적금·대출 실데이터 수집
// 사용법: node scripts/finance-team/fetch-rates.js [savings|deposit|all]
// 출력: finance-blog/rates/YYYY-MM-DD-{type}.json
//
// 환경변수: FSS_FINLIFE_API_KEY
// 호출 한도: 일일 10,000건

const fs = require('fs');
const path = require('path');
const { REPO_ROOT, todayKST, ensureDir, writeJSON, sleep } = require('./lib');

const API_KEY = process.env.FSS_FINLIFE_API_KEY;
if (!API_KEY) {
  console.error('❌ FSS_FINLIFE_API_KEY 미설정');
  process.exit(1);
}

const RATES_DIR = path.join(REPO_ROOT, 'finance-blog', 'rates');

// 금융권 그룹 코드
const FIN_GROUPS = {
  bank: '020000',         // 은행 (시중은행 + 인터넷은행)
  savingbank: '030300',   // 저축은행
  // creditunion: '030200', // 신협 (적금은 저축은행만으로 충분, 추가 시 활성화)
};

// API 엔드포인트
const ENDPOINTS = {
  savings: 'savingProductsSearch.json',         // 적금
  deposit: 'depositProductsSearch.json',        // 정기예금
  // creditLoan: 'creditLoanProductsSearch.json',
  // mortgageLoan: 'mortgageLoanProductsSearch.json',
  // rentHouseLoan: 'rentHouseLoanProductsSearch.json',
};

// ========== API 호출 (페이징 자동) ==========
async function fetchProducts(endpoint, topFinGrpNo) {
  const all = { baseList: [], optionList: [] };
  let pageNo = 1;
  let maxPage = 1;

  do {
    const url = `https://finlife.fss.or.kr/finlifeapi/${endpoint}` +
      `?auth=${API_KEY}` +
      `&topFinGrpNo=${topFinGrpNo}` +
      `&pageNo=${pageNo}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    const result = json.result;
    if (!result) throw new Error('result 누락');
    if (result.err_cd !== '000') {
      throw new Error(`API 에러 ${result.err_cd}: ${result.err_msg}`);
    }

    all.baseList.push(...(result.baseList || []));
    all.optionList.push(...(result.optionList || []));
    maxPage = result.max_page_no || 1;
    pageNo += 1;
    await sleep(120); // rate limit 보호
  } while (pageNo <= maxPage);

  return all;
}

// ========== 상품 + 금리 옵션 결합 ==========
// optionList는 같은 fin_prdt_cd에 대해 여러 개 (12개월/24개월/36개월 + 단리/복리 + 정액/자유)
// 우리는 각 상품의 12개월 정액·단리 기준 최고금리만 우선 추출
function joinProducts({ baseList, optionList }) {
  const optionByProduct = {};
  for (const o of optionList) {
    const key = `${o.fin_co_no}::${o.fin_prdt_cd}`;
    if (!optionByProduct[key]) optionByProduct[key] = [];
    optionByProduct[key].push(o);
  }

  return baseList.map(b => {
    const key = `${b.fin_co_no}::${b.fin_prdt_cd}`;
    const opts = optionByProduct[key] || [];

    // 12개월·정액·단리 옵션 우선 (가장 일반적인 표준)
    const std = opts.find(o => o.save_trm === '12' && o.rsrv_type === 'S' && o.intr_rate_type === 'S')
      || opts.find(o => o.save_trm === '12')
      || opts[0]
      || {};

    // 모든 만기 + 적립 방식별 최고금리도 같이 수집
    const ratesByTerm = {};
    for (const o of opts) {
      const k = `${o.save_trm}m_${o.rsrv_type}_${o.intr_rate_type}`;
      ratesByTerm[k] = {
        term: parseInt(o.save_trm, 10),
        type: o.rsrv_type_nm + '/' + o.intr_rate_type_nm,
        base: o.intr_rate,
        max: o.intr_rate2,
      };
    }

    return {
      bank: b.kor_co_nm,
      product: b.fin_prdt_nm,
      finCoNo: b.fin_co_no,
      finPrdtCd: b.fin_prdt_cd,
      joinWay: b.join_way,
      joinMember: b.join_member,
      maxLimit: b.max_limit,
      special: (b.spcl_cnd || '').replace(/\n+/g, ' / ').slice(0, 600),
      etcNote: (b.etc_note || '').replace(/\n+/g, ' / ').slice(0, 400),
      mtrtInt: (b.mtrt_int || '').replace(/\n+/g, ' / ').slice(0, 400),
      dclsStartDay: b.dcls_strt_day,
      // 표준 (12개월·정액·단리)
      base12m: std.intr_rate ?? null,
      max12m: std.intr_rate2 ?? null,
      // 만기·적립별 전체
      ratesByTerm,
    };
  });
}

// ========== 메인 ==========
async function fetchAllSavings() {
  const all = [];

  console.log('📡 1금융권(은행) 적금 호출 중...');
  const bankSavings = await fetchProducts(ENDPOINTS.savings, FIN_GROUPS.bank);
  all.push(...joinProducts(bankSavings).map(p => ({ ...p, finGroup: 'bank' })));
  console.log(`   ✓ ${bankSavings.baseList.length}개`);

  console.log('📡 저축은행 적금 호출 중...');
  const savingbankSavings = await fetchProducts(ENDPOINTS.savings, FIN_GROUPS.savingbank);
  all.push(...joinProducts(savingbankSavings).map(p => ({ ...p, finGroup: 'savingbank' })));
  console.log(`   ✓ ${savingbankSavings.baseList.length}개`);

  return all;
}

async function fetchAllDeposit() {
  const all = [];

  console.log('📡 1금융권(은행) 정기예금 호출 중...');
  const bank = await fetchProducts(ENDPOINTS.deposit, FIN_GROUPS.bank);
  all.push(...joinProducts(bank).map(p => ({ ...p, finGroup: 'bank' })));
  console.log(`   ✓ ${bank.baseList.length}개`);

  console.log('📡 저축은행 정기예금 호출 중...');
  const sb = await fetchProducts(ENDPOINTS.deposit, FIN_GROUPS.savingbank);
  all.push(...joinProducts(sb).map(p => ({ ...p, finGroup: 'savingbank' })));
  console.log(`   ✓ ${sb.baseList.length}개`);

  return all;
}

(async () => {
  const arg = process.argv[2] || 'savings';
  const today = todayKST();
  ensureDir(RATES_DIR);

  if (arg === 'savings' || arg === 'all') {
    const products = await fetchAllSavings();
    // max12m 기준 정렬
    products.sort((a, b) => (b.max12m || 0) - (a.max12m || 0));
    const out = path.join(RATES_DIR, `${today}-savings.json`);
    writeJSON(out, {
      generatedAt: new Date().toISOString(),
      type: 'savings',
      asOfPublishDate: products[0]?.dclsStartDay || null,
      total: products.length,
      products,
    });
    console.log(`\n✓ ${path.relative(REPO_ROOT, out)} (${products.length}개 상품)`);
    console.log(`📊 12개월 정액·단리 최고금리 TOP 10:`);
    products.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.bank} / ${p.product} — 기본 ${p.base12m}% / 최고 ${p.max12m}% (${p.finGroup})`);
    });
  }

  if (arg === 'deposit' || arg === 'all') {
    const products = await fetchAllDeposit();
    products.sort((a, b) => (b.max12m || 0) - (a.max12m || 0));
    const out = path.join(RATES_DIR, `${today}-deposit.json`);
    writeJSON(out, {
      generatedAt: new Date().toISOString(),
      type: 'deposit',
      asOfPublishDate: products[0]?.dclsStartDay || null,
      total: products.length,
      products,
    });
    console.log(`\n✓ ${path.relative(REPO_ROOT, out)} (${products.length}개 상품)`);
  }
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
