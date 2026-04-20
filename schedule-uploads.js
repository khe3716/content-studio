// Day 6~10 순차 업로드 (1시간 간격)
// 백그라운드 실행용

const { spawn } = require('child_process');
const path = require('path');

const UPLOADS = [
  {
    dayId: 'day-06',
    emoji: 'dollar-banknote',
    postTitle: '원금이란? 원리금과 차이 쉽게 정리',
    thumbTitle: '원금·원리금',
    sub1: '차이를 쉽게',
    sub2: '정리해드려요!',
    htmlPath: 'economy-blog/drafts/day-06-wongeum-worliguem.html',
    labels: '경제기초,원금,원리금,대출,재테크입문',
  },
  {
    dayId: 'day-07',
    emoji: 'chart-increasing',
    postTitle: '이자율과 수익률 차이 — 헷갈리지 않는 법',
    thumbTitle: '이자율·수익률',
    sub1: '헷갈리지 않는',
    sub2: '구분법!',
    htmlPath: 'economy-blog/drafts/day-07-ijayul-suikryul.html',
    labels: '경제기초,이자율,수익률,투자기초,경제용어',
  },
  {
    dayId: 'day-08',
    emoji: 'balance-scale',
    postTitle: '금리란? 기준금리와 대출금리 차이 쉽게 설명',
    thumbTitle: '금리란?',
    sub1: '기준금리·대출금리',
    sub2: '차이 정리!',
    htmlPath: 'economy-blog/drafts/day-08-geumri.html',
    labels: '경제기초,금리,기준금리,대출,재테크입문',
  },
  {
    dayId: 'day-09',
    emoji: 'chart-decreasing',
    postTitle: '기준금리가 내 대출이자에 미치는 영향 (+ 실제 계산 예시)',
    thumbTitle: '기준금리→대출',
    sub1: '내 지갑에 주는',
    sub2: '실제 영향!',
    htmlPath: 'economy-blog/drafts/day-09-gijungeumri-daechul.html',
    labels: '경제기초,기준금리,대출이자,주담대,재테크',
  },
  {
    dayId: 'day-10',
    emoji: 'money-with-wings',
    postTitle: '인플레이션이란? 내 돈 가치가 줄어드는 이유',
    thumbTitle: '인플레이션',
    sub1: '내 돈 가치가',
    sub2: '줄어드는 이유!',
    htmlPath: 'economy-blog/drafts/day-10-inflation.html',
    labels: '경제기초,인플레이션,물가,재테크,경제현상',
  },
];

// 1시간 = 3,600,000 ms
// Day 5 방금 올렸다고 가정 → Day 6는 ~40분 후 (1시간 간격 맞추기)
const FIRST_DELAY_MS = 40 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runUpload(job) {
  return new Promise((resolve, reject) => {
    const args = [
      'publish-draft.js',
      job.dayId,
      job.emoji,
      job.postTitle,
      job.thumbTitle,
      job.sub1,
      job.sub2,
      job.htmlPath,
      job.labels,
    ];
    const proc = spawn('node', args, { cwd: __dirname, stdio: 'inherit' });
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

(async () => {
  const start = new Date();
  console.log(`\n⏰ 스케줄 시작: ${start.toLocaleString('ko-KR')}`);
  console.log(`📋 총 ${UPLOADS.length}개 업로드 예정\n`);

  UPLOADS.forEach((job, i) => {
    const when = new Date(start.getTime() + FIRST_DELAY_MS + i * INTERVAL_MS);
    console.log(`  ${i + 1}. ${job.dayId} (${job.postTitle.slice(0, 20)}...) → ${when.toLocaleTimeString('ko-KR')}`);
  });
  console.log('');

  // 첫 대기
  console.log(`💤 ${FIRST_DELAY_MS / 60000}분 대기 중...`);
  await sleep(FIRST_DELAY_MS);

  for (let i = 0; i < UPLOADS.length; i++) {
    const job = UPLOADS[i];
    console.log(`\n========================================`);
    console.log(`📤 ${job.dayId} 업로드 시작 (${new Date().toLocaleTimeString('ko-KR')})`);
    console.log(`========================================`);

    try {
      await runUpload(job);
      console.log(`\n✅ ${job.dayId} 완료`);
    } catch (err) {
      console.error(`\n❌ ${job.dayId} 실패:`, err.message);
    }

    if (i < UPLOADS.length - 1) {
      const nextWhen = new Date(Date.now() + INTERVAL_MS);
      console.log(`\n💤 다음 업로드까지 대기 (다음: ${nextWhen.toLocaleTimeString('ko-KR')})`);
      await sleep(INTERVAL_MS);
    }
  }

  console.log(`\n🎉 모든 업로드 완료! (${new Date().toLocaleString('ko-KR')})`);
})();
