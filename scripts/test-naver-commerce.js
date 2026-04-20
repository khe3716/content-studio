// 네이버 커머스 API 연결 테스트
// 달콤살랑 스마트스토어 상품 목록 가져오기

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// .env 파일에서 먼저 로드 (로컬), 없으면 process.env (CI)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}

const CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID;
const CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ NAVER_COMMERCE_CLIENT_ID / SECRET 환경변수 없음');
  process.exit(1);
}

async function getAccessToken() {
  const timestamp = Date.now();
  const password = `${CLIENT_ID}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, CLIENT_SECRET);
  const signature = Buffer.from(hashed).toString('base64');

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    timestamp: String(timestamp),
    client_secret_sign: signature,
    grant_type: 'client_credentials',
    type: 'SELF',
  });

  const res = await fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) {
    console.error('❌ 토큰 발급 실패:', data);
    process.exit(1);
  }
  console.log('✅ 토큰 발급 성공 (만료:', data.expires_in, '초)');
  return data.access_token;
}

async function listProducts(token) {
  const res = await fetch(
    'https://api.commerce.naver.com/external/v1/products/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchKeywordType: 'SELLER_CODE',
        productStatusTypes: ['SALE'],
        page: 1,
        size: 50,
        orderType: 'NO',
      }),
    }
  );
  return await res.json();
}

(async () => {
  const token = await getAccessToken();
  const products = await listProducts(token);
  const fs = require('fs');
  console.log('\n=== 전체 상품 목록 ===\n');
  const items = [];
  if (products.contents && products.contents.length) {
    products.contents.forEach((c, i) => {
      const p = c.channelProducts?.[0] || c;
      const item = {
        no: p.channelProductNo || p.originProductNo,
        name: p.name,
        status: p.statusType,
        price: p.salePrice,
        discounted: p.discountedPrice,
        stock: p.stockQuantity,
        category: p.wholeCategoryName,
        tags: (p.sellerTags || []).map(t => t.text),
        image: p.representativeImage?.url,
      };
      items.push(item);
      const price = item.discounted?.toLocaleString() || item.price?.toLocaleString();
      console.log(`${i + 1}. [${item.status}] ${item.name}`);
      console.log(`    ${price}원 | 재고 ${item.stock} | ${item.category}`);
      console.log(`    태그: ${item.tags.slice(0, 5).join(', ')}`);
      console.log('');
    });
    fs.writeFileSync('fruit-blog/products.json', JSON.stringify(items, null, 2), 'utf8');
    console.log(`총 ${products.totalElements}개 상품 → fruit-blog/products.json 저장`);
  } else {
    console.log('응답:', JSON.stringify(products, null, 2).slice(0, 1000));
  }
})();
