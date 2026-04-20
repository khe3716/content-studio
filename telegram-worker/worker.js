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
      '🍎 <b>과일블로그</b>\n' +
      '<b>/fruit</b> - 다음 주제 발행\n\n' +
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
    await sendMessage(env, chatId, '🍎 과일블로그 발행 시작!\n3-4분 후 결과 알림 도착합니다.');
    return;
  }

  await sendMessage(env, chatId, '❓ 모르는 명령어. /help 쳐보세요.');
}

async function triggerWorkflow(env, workflow, { day, dry_run }) {
  const inputs = {};
  if (day) inputs.day = String(day);
  if (dry_run) inputs.dry_run = dry_run;

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
