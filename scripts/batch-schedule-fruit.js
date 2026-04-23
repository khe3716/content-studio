// Day N1~N2 과일 블로그 편들을 순차 생성 + 18:00 슬롯에 예약
//
// 사용법:
//   node scripts/batch-schedule-fruit.js --start-day 5 --count 9 --start-offset 2
//   node scripts/batch-schedule-fruit.js --quiet   # 개별 텔레그램 알림 off
//
// 슬롯: 하루 1편, 18:00 KST

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
  const out = { startDay: 5, count: 9, startOffset: 2, quiet: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-day') out.startDay = parseInt(args[++i], 10);
    else if (args[i] === '--count') out.count = parseInt(args[++i], 10);
    else if (args[i] === '--start-offset') out.startOffset = parseInt(args[++i], 10);
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
  const { startDay, count, startOffset, quiet } = args;

  // fruit: 하루 1슬롯 (18:00)
  const slots = [];
  for (let offset = startOffset; slots.length < count; offset++) {
    slots.push({ iso: slotToISO(SLOTS.fruit[0], offset), offsetDays: offset });
  }

  console.log(`\n🍎 배치 예약: Day ${startDay}~${startDay + count - 1} (${count}편)\n`);
  console.log('배정 계획:');
  for (let i = 0; i < count; i++) {
    console.log(`  Day ${startDay + i} → ${formatSlotKorean(slots[i].iso)}`);
  }
  console.log('');

  const childEnv = { ...process.env };
  if (quiet) delete childEnv.TELEGRAM_BOT_TOKEN;

  const results = [];
  for (let i = 0; i < count; i++) {
    const day = startDay + i;
    const publishAt = slots[i].iso;
    console.log(`\n========== [${i + 1}/${count}] Day ${day} → ${formatSlotKorean(publishAt)} ==========\n`);

    const start = Date.now();
    const r = spawnSync(
      'node',
      ['auto-publish-fruit.js', '--day', String(day), '--publish-at', publishAt],
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
    `🍎 <b>과일 블로그 배치 예약 완료</b>\n\n` +
    `Day ${startDay}~${startDay + results.length - 1} (${results.length}편)\n` +
    `성공 ${okCount} / 실패 ${failCount}\n\n` +
    lines.join('\n')
  );

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
