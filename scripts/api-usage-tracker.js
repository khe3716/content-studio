// Gemini API 사용량 추적 + 텔레그램 알림 + 한도 도달 시 자동 차단
//
// 사용법: callGemini 직전에 await incrementAndCheck() 호출

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const USAGE_DIR = path.join(REPO_ROOT, 'tmp', 'api-usage');
fs.mkdirSync(USAGE_DIR, { recursive: true });

// Gemini 2.5 Flash 무료 한도 (일 1,500회)
const FREE_LIMIT_FLASH = 1500;
// 알림 임계값 (한 번씩만 알림, 같은 임계값 중복 안 함)
const ALERT_THRESHOLDS = [0.5, 0.8, 0.95];

function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getUsageFile() {
  return path.join(USAGE_DIR, `${todayKST()}.json`);
}

function getUsage() {
  const f = getUsageFile();
  if (!fs.existsSync(f)) return { gemini_flash: 0, alerted: [] };
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return { gemini_flash: 0, alerted: [] };
  }
}

function saveUsage(usage) {
  fs.writeFileSync(getUsageFile(), JSON.stringify(usage, null, 2));
}

async function sendTelegramAlert(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // 알림 실패해도 무시 (메인 작업 막지 않음)
  }
}

// 호출 직전 카운터 ++ + 임계값 알림 + 100% 초과 시 차단
async function incrementAndCheck(modelKey = 'gemini_flash') {
  const usage = getUsage();
  usage[modelKey] = (usage[modelKey] || 0) + 1;
  if (!usage.alerted) usage.alerted = [];

  const ratio = usage[modelKey] / FREE_LIMIT_FLASH;

  // 임계값 도달 시 한 번씩만 알림
  for (const threshold of ALERT_THRESHOLDS) {
    if (ratio >= threshold && !usage.alerted.includes(threshold)) {
      usage.alerted.push(threshold);
      const pct = Math.round(threshold * 100);
      const remaining = FREE_LIMIT_FLASH - usage[modelKey];
      await sendTelegramAlert(
        `⚠️ Gemini Flash 사용량 ${pct}% 도달\n` +
        `오늘 ${usage[modelKey]} / ${FREE_LIMIT_FLASH}\n` +
        `잔여 ${remaining}회\n` +
        `자정(KST) 리셋`
      );
    }
  }

  saveUsage(usage);

  // 100% 초과 시 차단 (유료 전환 방지)
  if (usage[modelKey] >= FREE_LIMIT_FLASH) {
    await sendTelegramAlert(
      `🚨 Gemini Flash 한도 ${FREE_LIMIT_FLASH}회 도달!\n` +
      `이후 호출은 자동 차단됩니다 (유료 전환 방지)\n` +
      `자정(KST) 자동 리셋`
    );
    throw new Error(
      `Gemini Flash 무료 한도(${FREE_LIMIT_FLASH}/일) 초과 — 호출 차단. 자정 KST 리셋.`
    );
  }
}

module.exports = { incrementAndCheck, getUsage, FREE_LIMIT_FLASH };
