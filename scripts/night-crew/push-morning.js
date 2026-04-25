// 야간 리서치 팀 — 아침 08:00 텔레그램 푸시
//
// 동작:
//   1. reports/YYYY-MM-DD.md (박결재 최종 브리핑) 읽기
//   2. 마크다운 → 텔레그램 HTML 변환
//   3. 텔레그램 봇으로 발송
//
// 주의: 박결재 출력이 이미 텔레그램용으로 재포장된 상태이므로,
//       이 스크립트는 요약/재작성하지 않고 **그대로 전달**함.
//
// 사용법:
//   node scripts/night-crew/push-morning.js              # 오늘 날짜
//   node scripts/night-crew/push-morning.js --date 2026-04-25
//   node scripts/night-crew/push-morning.js --sample     # reports/SAMPLE.md
//   node scripts/night-crew/push-morning.js --dry-run    # 텔레그램 발송 없이 stdout
//   node scripts/night-crew/push-morning.js --pdf <path> # PDF 첨부 (없으면 reports/<date>.pdf 자동 감지)
//   node scripts/night-crew/push-morning.js --no-pdf     # PDF 자동 발송 끄기

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');

// ========== .env 로더 ==========
function loadEnv() {
  const envPath = path.join(REPO_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  });
}
loadEnv();

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { date: null, sample: false, dryRun: false, pdfPath: null, noPdf: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--sample') out.sample = true;
    else if (args[i] === '--dry-run') out.dryRun = true;
    else if (args[i] === '--no-pdf') out.noPdf = true;
    else if (args[i] === '--date' && args[i + 1]) { out.date = args[i + 1]; i += 1; }
    else if (args[i] === '--pdf' && args[i + 1]) { out.pdfPath = args[i + 1]; i += 1; }
  }
  return out;
}

function todayKST() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 박결재 출력(마크다운) → 텔레그램 HTML 경량 변환
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mdToTelegram(md) {
  // 1) 코드 블록 먼저 분리 (내부는 이스케이프만)
  //    박결재 출력에는 보통 코드 블록 없지만 안전하게 처리
  const segments = [];
  const codeRegex = /```[\s\S]*?```/g;
  let lastIdx = 0;
  let match;
  while ((match = codeRegex.exec(md)) !== null) {
    if (match.index > lastIdx) segments.push({ type: 'text', body: md.slice(lastIdx, match.index) });
    segments.push({ type: 'code', body: match[0].replace(/^```.*?\n?/, '').replace(/```$/, '') });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < md.length) segments.push({ type: 'text', body: md.slice(lastIdx) });

  return segments.map(seg => {
    if (seg.type === 'code') {
      return `<pre>${escapeHtml(seg.body)}</pre>`;
    }
    let out = escapeHtml(seg.body);
    // **bold** → <b>
    out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // 헤더 #/## → <b>
    out = out.replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>');
    // bullet 통일
    out = out.replace(/^[-*]\s+/gm, '• ');
    return out;
  }).join('');
}

// ========== 텔레그램 발송 ==========
async function sendTelegram(text, { dryRun = false } = {}) {
  if (dryRun) {
    console.log('--- DRY RUN (텔레그램 미발송) ---');
    console.log(text);
    console.log('--- END ---');
    return { ok: true, dry_run: true };
  }
  // 야간 전용 봇 우선, 없으면 기존 봇 fallback
  const token = process.env.TELEGRAM_BOT_TOKEN_NIGHT || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('❌ TELEGRAM_BOT_TOKEN(_NIGHT) / TELEGRAM_CHAT_ID(_NIGHT) 환경변수 없음');
    process.exit(1);
  }
  const usingNight = !!process.env.TELEGRAM_BOT_TOKEN_NIGHT;
  console.log(`📤 발송 봇: ${usingNight ? '야간 전용 (night)' : '기존 공용'}`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('❌ 텔레그램 API 오류:', JSON.stringify(data));
    process.exit(1);
  }
  console.log(`✅ 텔레그램 발송 완료 (message_id: ${data.result.message_id})`);
  return data;
}

// ========== 텔레그램 PDF 첨부 발송 ==========
async function sendTelegramDocument(filePath, caption, { dryRun = false } = {}) {
  if (dryRun) {
    console.log(`--- DRY RUN sendDocument: ${filePath} ---`);
    return { ok: true, dry_run: true };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN_NIGHT || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_NIGHT || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('❌ 텔레그램 토큰/chat_id 없음 (PDF 발송 스킵)');
    return { ok: false };
  }
  if (!fs.existsSync(filePath)) {
    console.error(`⚠️  PDF 파일 없음: ${filePath} (스킵)`);
    return { ok: false };
  }
  const buffer = fs.readFileSync(filePath);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
  }
  form.append('document', blob, path.basename(filePath));
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) {
    console.error('❌ 텔레그램 sendDocument 오류:', JSON.stringify(data));
    return { ok: false };
  }
  console.log(`✅ PDF 발송 완료 (${path.basename(filePath)}, ${(buffer.length / 1024).toFixed(0)}KB)`);
  return data;
}

// ========== 메인 ==========
(async () => {
  const opts = parseArgs();
  const dateKey = opts.sample ? 'SAMPLE' : (opts.date || todayKST());

  const reportPath = path.join(REPORTS_DIR, `${dateKey}.md`);
  if (!fs.existsSync(reportPath)) {
    const text =
      `🌅 <b>야간 브리핑 (${escapeHtml(dateKey)})</b>\n\n` +
      `오늘 리포트 없음 — 야간 리서치 팀 아직 돌지 않았거나 실패했어요.\n\n` +
      `<i>상태 확인: /status · 수동 재시도: /night-research</i>`;
    await sendTelegram(text, { dryRun: opts.dryRun });
    return;
  }

  const reportMd = fs.readFileSync(reportPath, 'utf8');
  let html = mdToTelegram(reportMd);

  // 텔레그램 4096자 한도
  if (html.length > 4000) {
    html = html.slice(0, 3850) + '\n\n━━━━━━━━━━━━━━━\n📎 <b>풀 사업계획서는 첨부 PDF 참조</b> (이어진 부분: 도달 부트스트랩·단위 경제학·로드맵)';
  }

  await sendTelegram(html, { dryRun: opts.dryRun });

  // PDF 첨부 발송 (있으면)
  if (!opts.noPdf) {
    const pdfPath = opts.pdfPath || path.join(REPORTS_DIR, `${dateKey}.pdf`);
    if (fs.existsSync(pdfPath)) {
      const caption = `📎 <b>야간 리서치 풀 레포트 (${escapeHtml(dateKey)})</b>\n핸드폰에서 클릭하면 디자인된 풀 버전 열림`;
      await sendTelegramDocument(pdfPath, caption, { dryRun: opts.dryRun });
    } else {
      console.log(`ℹ️  PDF 첨부 없음 (${pdfPath} 미존재)`);
    }
  }
})().catch(err => {
  console.error('❌ push-morning 실패:', err);
  process.exit(1);
});
