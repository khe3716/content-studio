// Day 12~21 경제 블로그 10편 순차 생성 + 미래 슬롯 예약
//
// 슬롯 매핑:
//   Day 12 → 04/24 07:30    Day 13 → 04/24 17:00
//   Day 14 → 04/25 07:30    Day 15 → 04/25 17:00
//   Day 16 → 04/26 07:30    Day 17 → 04/26 17:00
//   Day 18 → 04/27 07:30    Day 19 → 04/27 17:00
//   Day 20 → 04/28 07:30    Day 21 → 04/28 17:00
//
// 사용법:
//   node scripts/batch-schedule-economy.js
//   node scripts/batch-schedule-economy.js --start-day 12 --count 10 --start-offset 1
//   node scripts/batch-schedule-economy.js --quiet   # 개별 텔레그램 알림 off (요약만)

const path = require('path');
const { spawnSync } = require('child_process');
const { SLOTS, slotToISO, formatSlotKorean } = require('./slot-utils');

function loadEnv() {
  const fs = require('fs');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  });
}
loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { startDay: 12, count: 10, startOffset: 1, startSlot: 'morning', quiet: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-day') out.startDay = parseInt(args[++i], 10);
    else if (args[i] === '--count') out.count = parseInt(args[++i], 10);
    else if (args[i] === '--start-offset') out.startOffset = parseInt(args[++i], 10);
    else if (args[i] === '--start-slot') out.startSlot = args[++i];
    else if (args[i] === '--quiet') out.quiet = true;
  }
  return out;
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch {}
}

async function main() {
  const args = parseArgs();
  const { startDay, count, startOffset, startSlot, quiet } = args;

  // economy = 2 slots/day (morning, evening)
  // startSlot='evening'이면 첫 날은 evening부터 (morning 스킵)
  const slots = [];
  let offset = startOffset;
  let slotIdx = startSlot === 'evening' ? 1 : 0;
  while (slots.length < count) {
    const s = SLOTS.economy[slotIdx];
    slots.push({ iso: slotToISO(s, offset), slot: s.name, offsetDays: offset });
    slotIdx++;
    if (slotIdx >= SLOTS.economy.length) {
      slotIdx = 0;
      offset++;
    }
  }

  console.log(`\n🎯 배치 예약: Day ${startDay}~${startDay + count - 1} (${count}편)\n`);
  console.log('배정 계획:');
  for (let i = 0; i < count; i++) {
    console.log(`  Day ${startDay + i} → ${formatSlotKorean(slots[i].iso)}`);
  }
  console.log('');

  // 자식 프로세스에 전달할 환경변수 (quiet면 텔레그램 제거)
  const childEnv = { ...process.env };
  if (quiet) {
    delete childEnv.TELEGRAM_BOT_TOKEN;
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    const day = startDay + i;
    const publishAt = slots[i].iso;
    console.log(`\n========== [${i + 1}/${count}] Day ${day} → ${formatSlotKorean(publishAt)} ==========\n`);

    const start = Date.now();
    const r = spawnSync(
      'node',
      ['auto-publish.js', '--day', String(day), '--publish-at', publishAt],
      { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: childEnv }
    );
    const elapsed = Math.round((Date.now() - start) / 1000);

    const ok = r.status === 0;
    results.push({ day, publishAt, ok, elapsed });
    console.log(`\n${ok ? '✅' : '❌'} Day ${day} ${ok ? '완료' : '실패'} (${elapsed}초)`);

    if (!ok) {
      console.error(`❌ Day ${day} 실패 — 배치 중단`);
      break;
    }
  }

  const okCount = results.filter(r => r.ok).length;
  const failCount = results.length - okCount;

  console.log(`\n\n🎉 배치 완료: 성공 ${okCount} / 실패 ${failCount}`);

  const lines = results.map(r => {
    const icon = r.ok ? '✅' : '❌';
    return `${icon} Day ${r.day} → ${formatSlotKorean(r.publishAt)} (${r.elapsed}s)`;
  });
  await notifyTelegram(
    `💰 <b>경제 블로그 배치 예약 완료</b>\n\n` +
    `Day ${startDay}~${startDay + results.length - 1} (${results.length}편)\n` +
    `성공 ${okCount} / 실패 ${failCount}\n\n` +
    lines.join('\n')
  );

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ 배치 실패:', err);
  process.exit(1);
});
