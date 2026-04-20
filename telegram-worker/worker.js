// 텔레그램 → GitHub Actions 중계 워커
//
// 환경 변수 (Cloudflare Workers 설정에서 추가):
//   TELEGRAM_BOT_TOKEN      - BotFather에서 받은 봇 토큰
//   TELEGRAM_WEBHOOK_SECRET - Telegram webhook 검증용 랜덤 문자열
//   ALLOWED_CHAT_ID         - 명령 허용할 텔레그램 chat_id
//   GITHUB_TOKEN            - repo + workflow 권한 PAT
//   GITHUB_OWNER            - 저장소 소유자 (예: khe3716)
//   GITHUB_REPO             - 저장소 이름 (예: content-studio)
//   GITHUB_WORKFLOW         - 워크플로 파일명 (예: auto-publish.yml)

export default {
  async fetch(request, env) {
    if (request.method === 'GET') {
      return new Response('telegram-blog-bot OK', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    // 1. 웹훅 시크릿 검증
    const secret = request.headers.get('x-telegram-bot-api-secret-token');
    if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    // 2. 업데이트 파싱
    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const msg = update.message || update.edited_message;
    if (!msg || !msg.text) {
      return new Response('ok', { status: 200 });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // 3. 화이트리스트 검증
    if (String(chatId) !== String(env.ALLOWED_CHAT_ID)) {
      await sendMessage(env, chatId, '⛔ 권한 없음. 이 봇은 개인 전용입니다.');
      return new Response('ok', { status: 200 });
    }

    // 4. 명령어 처리
    try {
      await handleCommand(env, chatId, text);
    } catch (err) {
      await sendMessage(env, chatId, `❌ 에러: ${String(err.message || err).slice(0, 500)}`);
    }

    return new Response('ok', { status: 200 });
  },
};

async function handleCommand(env, chatId, text) {
  if (text === '/start' || text === '/help') {
    await sendMessage(env, chatId,
      '🤖 <b>경제블로그 명령어</b>\n\n' +
      '<b>/publish</b> - 다음 주제 발행\n' +
      '<b>/status</b> - 최근 실행 3건 상태\n' +
      '<b>/help</b> - 이 도움말'
    );
    return;
  }

  if (text === '/status') {
    const runs = await githubFetch(env, `/actions/runs?per_page=3`);
    const lines = (runs.workflow_runs || []).slice(0, 3).map(r => {
      let icon = '🔄';
      if (r.status === 'completed') {
        icon = r.conclusion === 'success' ? '✅' : '❌';
      }
      const date = new Date(r.created_at).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      const trigger = r.event === 'workflow_dispatch' ? '수동' : '자동';
      return `${icon} ${date} (${trigger})`;
    });
    await sendMessage(env, chatId,
      '<b>최근 실행 3건</b>\n\n' + (lines.join('\n') || '기록 없음')
    );
    return;
  }

  if (text === '/publish') {
    await triggerWorkflow(env, { dry_run: 'false' });
    await sendMessage(env, chatId, '🚀 다음 주제 발행 시작!\n1-2분 후 결과 알림 도착합니다.');
    return;
  }

  await sendMessage(env, chatId, '❓ 모르는 명령어. /help 쳐보세요.');
}

async function triggerWorkflow(env, { day, dry_run }) {
  const inputs = {};
  if (day) inputs.day = String(day);
  if (dry_run) inputs.dry_run = dry_run;

  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.GITHUB_WORKFLOW}/dispatches`;
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
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}
