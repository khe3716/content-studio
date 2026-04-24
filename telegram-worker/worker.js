// 텔레그램 → GitHub Actions 중계 워커
//
// 환경 변수 (Cloudflare Workers 설정에서 추가):
//   TELEGRAM_BOT_TOKEN      - BotFather에서 받은 봇 토큰
//   TELEGRAM_WEBHOOK_SECRET - Telegram webhook 검증용 랜덤 문자열
//   ALLOWED_CHAT_ID         - 명령 허용할 텔레그램 chat_id
//   GITHUB_TOKEN            - repo + workflow 권한 PAT
//   GITHUB_OWNER            - 저장소 소유자 (예: khe3716)
//   GITHUB_REPO             - 저장소 이름 (예: content-studio)
//   GITHUB_WORKFLOW         - 경제블로그 워크플로 파일명 (예: auto-publish.yml)
//
// 블로그별 워크플로 파일 (하드코딩):
//   경제: 환경변수 GITHUB_WORKFLOW 사용
//   과일: auto-publish-fruit.yml

const FRUIT_WORKFLOW = 'auto-publish-fruit.yml';
const NAVER_WORKFLOW = 'naver-convert.yml';
const SEO_WORKFLOW = 'audit-seo.yml';
const INSTA_WORKFLOW = 'auto-publish-insta.yml';
const SCHEDULE_WORKFLOW = 'schedule-drafts.yml';
const BATCH_ECONOMY_WORKFLOW = 'batch-economy.yml';
const NIGHT_RESEARCH_WORKFLOW = 'night-team-research.yml';
const NIGHT_PUSH_WORKFLOW = 'night-team-push.yml';
const FEEDBACK_WORKFLOW = 'feedback-log.yml';
const REPORTS_DIR_NAME = 'reports';

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('telegram-blog-bot OK', { status: 200 });
    }
    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    let update;
    try { update = await request.json(); }
    catch { return new Response('bad request', { status: 400 }); }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) return new Response('ok', { status: 200 });

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (String(chatId) !== String(env.ALLOWED_CHAT_ID)) {
      await sendMessage(env, chatId, '⛔ 권한 없음. 이 봇은 개인 전용입니다.');
      return new Response('ok', { status: 200 });
    }

    try { await handleCommand(env, chatId, text); }
    catch (err) { await sendMessage(env, chatId, `❌ 에러: ${String(err.message || err).slice(0, 500)}`); }

    return new Response('ok', { status: 200 });
  },
};

async function handleCommand(env, chatId, text) {
  if (text === '/start' || text === '/help') {
    await sendMessage(env, chatId,
      '🤖 <b>블로그 명령어</b>\n\n' +
      '💰 <b>경제블로그</b>\n' +
      '<b>/publish</b> - 다음 주제 발행\n\n' +
      '🍎 <b>과일블로그 (Blogger)</b>\n' +
      '<b>/fruit</b> - 다음 주제 발행\n\n' +
      '📝 <b>네이버 블로그 변환</b>\n' +
      '<b>/naver</b> - 최근 과일블로그 글을 네이버용 HTML로 변환\n' +
      '<b>/naver 3</b> - 특정 Day (예: 3)\n\n' +
      '🛒 <b>스마트스토어</b>\n' +
      '<b>/seo</b> - 상품 SEO 진단 리포트 (21개 전부)\n\n' +
      '📸 <b>인스타 카드뉴스</b>\n' +
      '<b>/insta</b> - 다음 주제로 카드뉴스 5장 생성\n' +
      '<b>/insta 3</b> - 특정 Day\n\n' +
      '📅 <b>예약 발행 배정</b>\n' +
      '<b>/schedule economy</b> - 경제 DRAFT 전부 오늘부터 07:30+17:00 슬롯에 순차\n' +
      '<b>/schedule fruit</b> - 과일 DRAFT 전부 오늘부터 18:00 슬롯에 순차\n' +
      '<b>/schedule fruit 1</b> - 내일(offset=1)부터\n' +
      '<b>/schedule fruit 0 3</b> - 오늘부터, 최대 3편\n\n' +
      '🚀 <b>경제 배치 예약 생성</b>\n' +
      '<b>/batch 12 10</b> - Day 12부터 10편 새로 만들어 04/24부터 10 슬롯 예약\n' +
      '<b>/batch 12 10 1</b> - 내일(offset=1)부터 시작 (기본)\n\n' +
      '🌙 <b>야간 리서치 팀</b>\n' +
      '<b>/morning</b> - 오늘 브리핑 다시 보기\n' +
      '<b>/night-research</b> - 야간 팀 즉시 실행 (4라운드)\n' +
      '<b>/done 2</b> - 후보 2번 실행 예정으로 기록\n' +
      '<b>/ignore 3</b> - 후보 3번 넘김으로 기록\n\n' +
      '📊 <b>공통</b>\n' +
      '<b>/status</b> - 경제 최근 실행 3건\n' +
      '<b>/fruitstatus</b> - 과일 최근 실행 3건\n' +
      '<b>/help</b> - 이 도움말'
    );
    return;
  }

  if (text === '/status' || text === '/fruitstatus') {
    const workflow = text === '/fruitstatus' ? FRUIT_WORKFLOW : env.GITHUB_WORKFLOW;
    const label = text === '/fruitstatus' ? '🍎 과일블로그' : '💰 경제블로그';
    const runs = await githubFetch(env, `/actions/workflows/${workflow}/runs?per_page=3`);
    const lines = (runs.workflow_runs || []).slice(0, 3).map(r => {
      let icon = '🔄';
      if (r.status === 'completed') icon = r.conclusion === 'success' ? '✅' : '❌';
      const date = new Date(r.created_at).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      const trigger = r.event === 'workflow_dispatch' ? '수동' : '자동';
      return `${icon} ${date} (${trigger})`;
    });
    await sendMessage(env, chatId, `<b>${label} 최근 실행 3건</b>\n\n` + (lines.join('\n') || '기록 없음'));
    return;
  }

  if (text === '/publish') {
    await triggerWorkflow(env, env.GITHUB_WORKFLOW, { dry_run: 'false' });
    await sendMessage(env, chatId, '💰 경제블로그 발행 시작!\n1-2분 후 결과 알림 도착합니다.');
    return;
  }

  if (text === '/fruit') {
    await triggerWorkflow(env, FRUIT_WORKFLOW, { dry_run: 'false' });
    await sendMessage(env, chatId, '🍎 과일블로그 발행 시작!\n3-4분 후 결과 알림 도착합니다.\n(네이버용 HTML도 함께 자동 생성됩니다)');
    return;
  }

  if (text === '/naver' || text.startsWith('/naver ')) {
    const parts = text.split(/\s+/);
    const day = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : '';
    await triggerWorkflow(env, NAVER_WORKFLOW, { day });
    await sendMessage(env, chatId,
      `📝 네이버 블로그 변환 시작${day ? ` (Day ${day})` : ''}!\n1분 후 복사 안내 도착합니다.`
    );
    return;
  }

  if (text === '/seo') {
    await triggerWorkflow(env, SEO_WORKFLOW, {});
    await sendMessage(env, chatId,
      '🛒 스마트스토어 SEO 진단 시작!\n1-2분 후 21개 상품 리포트 도착합니다.'
    );
    return;
  }

  if (text === '/insta' || text.startsWith('/insta ')) {
    const parts = text.split(/\s+/);
    const day = parts[1] && /^\d+$/.test(parts[1]) ? parts[1] : '';
    await triggerWorkflow(env, INSTA_WORKFLOW, { day });
    await sendMessage(env, chatId,
      `📸 인스타 카드뉴스 생성 시작${day ? ` (Day ${day})` : ''}!\n2-3분 후 이미지 5장 + 캡션 도착합니다.`
    );
    return;
  }

  if (text.startsWith('/batch')) {
    // /batch <startDay> <count> [startOffset]
    const parts = text.split(/\s+/);
    const startDay = parts[1];
    const count = parts[2];
    const startOffset = parts[3] || '1';
    if (!startDay || !count || !/^\d+$/.test(startDay) || !/^\d+$/.test(count)) {
      await sendMessage(env, chatId, '❌ 사용법: <code>/batch 12 10</code> (Day 12부터 10편)\n또는 <code>/batch 12 10 1</code> (내일부터)');
      return;
    }
    await triggerWorkflowRaw(env, BATCH_ECONOMY_WORKFLOW, {
      start_day: startDay,
      count,
      start_offset: startOffset,
    });
    await sendMessage(env, chatId,
      `🚀 💰 경제 배치 예약 시작!\n` +
      `Day ${startDay}부터 ${count}편, 오프셋 +${startOffset}일\n` +
      `20~30분 후 완료 알림 도착.`
    );
    return;
  }

  if (text.startsWith('/schedule')) {
    // /schedule <economy|fruit> [startOffset] [limit]
    const parts = text.split(/\s+/);
    const blog = parts[1];
    const startOffset = parts[2] && /^\d+$/.test(parts[2]) ? parts[2] : '0';
    const limit = parts[3] && /^\d+$/.test(parts[3]) ? parts[3] : '';
    if (!['economy', 'fruit'].includes(blog)) {
      await sendMessage(env, chatId, '❌ 사용법: <code>/schedule economy</code> 또는 <code>/schedule fruit</code>\n선택 예: <code>/schedule fruit 1 3</code> (내일부터, 최대 3편)');
      return;
    }
    const inputs = { blog, start_offset: startOffset, dry_run: 'false' };
    if (limit) inputs.limit = limit;
    await triggerWorkflowRaw(env, SCHEDULE_WORKFLOW, inputs);
    const blogLabel = blog === 'fruit' ? '🍎 과일' : '💰 경제';
    await sendMessage(env, chatId,
      `📅 ${blogLabel} DRAFT 예약 배정 시작!\n` +
      `시작 오프셋: +${startOffset}일${limit ? ` / 최대 ${limit}편` : ''}\n` +
      `1~2분 후 배정 결과 도착합니다.`
    );
    return;
  }

  if (text === '/morning') {
    const todayStr = todayKST();
    const report = await tryFetchReport(env, todayStr);
    if (!report) {
      await sendMessage(env, chatId,
        `📭 오늘(${todayStr}) 브리핑 없음.\n` +
        `야간 팀이 아직 돌지 않았거나 실패했을 수 있어요.\n\n` +
        `즉시 실행: /night-research`
      );
      return;
    }
    await sendMessage(env, chatId, clampTelegram(mdToTelegramLite(report)));
    return;
  }

  if (text === '/night-research') {
    await triggerWorkflowRaw(env, NIGHT_RESEARCH_WORKFLOW, {});
    await sendMessage(env, chatId,
      '🌙 야간 리서치 즉시 실행!\n' +
      '10~30분 후 리포트 생성 + 텔레그램 알림.\n' +
      '(이호기심 → 서사업 → 구현실 × 4라운드 → 박결재)'
    );
    return;
  }

  if (text.startsWith('/done') || text.startsWith('/ignore')) {
    const parts = text.split(/\s+/);
    const cmd = parts[0];
    const index = parts[1];
    const action = cmd === '/done' ? 'done' : 'ignore';
    if (!index || !/^\d+$/.test(index)) {
      await sendMessage(env, chatId,
        `❌ 사용법: <code>${cmd} 2</code> (후보 번호)\n` +
        `예: /done 1 · /ignore 3`
      );
      return;
    }
    await triggerWorkflowRaw(env, FEEDBACK_WORKFLOW, { action, index, date: '' });
    const icon = action === 'done' ? '✅' : '⏭️';
    await sendMessage(env, chatId,
      `${icon} 후보 ${index}번 ${action === 'done' ? '실행 예정' : '넘김'}으로 기록 중...`
    );
    return;
  }

  await sendMessage(env, chatId, '❓ 모르는 명령어. /help 쳐보세요.');
}

// ========== 오늘 날짜 (KST) ==========
function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ========== Reports 파일 가져오기 ==========
async function tryFetchReport(env, dateStr) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${REPORTS_DIR_NAME}/${dateStr}.md`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'telegram-blog-bot',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || !data.content) return null;
  try {
    const bin = atob(data.content.replace(/\n/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return null; }
}

function mdToTelegramLite(md) {
  let out = String(md || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  out = out.replace(/^#{1,3}\s+(.+)$/gm, '<b>$1</b>');
  out = out.replace(/^[-*]\s+/gm, '• ');
  return out;
}

function clampTelegram(text) {
  return text.length > 4000 ? text.slice(0, 3950) + '\n...(생략)' : text;
}

async function triggerWorkflow(env, workflow, { day, dry_run }) {
  const inputs = {};
  if (day) inputs.day = String(day);
  if (dry_run) inputs.dry_run = dry_run;
  return triggerWorkflowRaw(env, workflow, inputs);
}

async function triggerWorkflowRaw(env, workflow, inputs) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'telegram-blog-bot',
    },
    body: JSON.stringify({ ref: 'main', inputs }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 300)}`);
  }
}

async function githubFetch(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'telegram-blog-bot',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function sendMessage(env, chatId, text) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
    }),
  });
}
