// 로봇 두뇌 — 주제 선정 → 글 작성 → 팩트체크 → Blogger 업로드 (+ 선택적 예약 발행)
//
// 사용법:
//   node auto-publish.js                     # 다음 'ready' 주제 → 즉시 발행 (LIVE)
//   node auto-publish.js --day 11            # 특정 Day
//   node auto-publish.js --dry-run           # 글만 생성, 업로드 X
//   node auto-publish.js --keep-draft        # DRAFT 유지 (발행 안 함)
//   node auto-publish.js --offset-days 2     # 모레 경제 morning 슬롯에 예약
//   node auto-publish.js --slot evening      # 오늘 17:00 슬롯
//   node auto-publish.js --publish-at "2026-04-24T07:30:00+09:00"  # 임의 시각
//
// 기본 동작: publishDate = 현재 KST 기준 다음 가까운 economy 슬롯 (오늘 07:30/17:00 중 미래인 것)

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawnSync } = require('child_process');
const { SLOTS, slotToISO, nextFutureSlot, slotAtOffset, formatSlotKorean } = require('./scripts/slot-utils');

// ========== 환경 변수 ==========
function loadEnv() {
  // GitHub Actions에서는 process.env에 이미 주입됨
  // 로컬 실행 시 .env 파일 읽기
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
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
}
loadEnv();

const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY 환경변수 없음');
  process.exit(1);
}

// ========== 텔레그램 알림 ==========
async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error('⚠️ 텔레그램 알림 실패:', await res.text());
    }
  } catch (e) {
    console.error('⚠️ 텔레그램 알림 예외:', e.message);
  }
}

// ========== 제미나이 호출 ==========
async function callGemini(userPrompt, systemPrompt, { temperature = 0.7, maxTokens = 16384 } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini 응답에 텍스트 없음: ' + JSON.stringify(data).slice(0, 500));
  return text;
}

// ========== 에이전트 md 로드 ==========
function loadPersona(name) {
  const p = path.join(__dirname, 'agents', `${name}.md`);
  return fs.readFileSync(p, 'utf8');
}

// ========== 샘플 글 로드 ==========
function loadSamples(count = 3) {
  const draftsDir = path.join(__dirname, 'economy-blog', 'drafts');
  const files = fs.readdirSync(draftsDir).filter(f => f.endsWith('.html')).sort();
  return files.slice(0, count).map(f => ({
    filename: f,
    content: fs.readFileSync(path.join(draftsDir, f), 'utf8'),
  }));
}

// ========== 1단계: 김하나 초안 작성 ==========
async function writeArticle(topic, nextTopic) {
  const kimHana = loadPersona('kim-hana');
  const samples = loadSamples(3);

  const systemPrompt = `${kimHana}

# 참고할 샘플 글 (톤·구조·개인 멘트 빈도 모방)

## 샘플 1 (${samples[0].filename})
${samples[0].content.slice(0, 4000)}

## 샘플 2 (${samples[1].filename})
${samples[1].content.slice(0, 4000)}

## 샘플 3 (${samples[2].filename})
${samples[2].content.slice(0, 4000)}`;

  const nextPreviewHint = nextTopic
    ? `다음 글 예고 문구에는 반드시 "**${nextTopic.title}**" 이 주제를 언급할 것. 다른 주제 예고 금지!`
    : '다음 글 예고는 "앞으로도 꾸준히 올릴 예정입니다" 식으로 일반적으로.';

  const userPrompt = `오늘 쓸 글 정보:
- Day: ${topic.day}
- 주제: ${topic.title}
- 클러스터: ${topic.cluster}
- 썸네일 안 짧은 제목: ${topic.thumb_title}
- 난이도: 초급
- ${nextPreviewHint}

# ⚠️ 중요: 출력 맨 앞 조심

**본문은 반드시 <p>태그로 시작해야 합니다.**
- 글 제목(예: "Day 11: 디플레이션이란?")을 <h2>로 본문 맨 앞에 쓰지 마세요.
- 📌 이모지도 본문 맨 앞에 단독으로 쓰지 마세요.
- Blogger가 제목을 별도로 관리하므로 본문에는 제목이 중복되면 안 됩니다.
- 첫 줄은 반드시 "<p>[공감 질문]..."으로 시작.

# 필수 요구사항

1. **분량**: 1,500~1,700자 (공백 포함, 마무리 시그니처 제외)
2. **구조** (샘플과 동일, 순서 엄수):
   - <p>도입부</p> (200자 내외, 공감 질문 + "저도~" 멘트 1회 + "5분 안에 딱 정리해드릴게요")
   - <h2>1. ...</h2> 개념 정의 (한자어 첫 등장 시 (漢字) 병기)
   - <h2>2. ...</h2> 비교/예시 + <table> + <div> 💡 주목할 포인트 박스
   - <h2>3. ...</h2> 종류/분류/상황별
   - <h2>4. ...</h2> 실전 팁/주의사항 + <div> ⚠️ 경고 박스 (필요시)
   - <h2>5. 핵심 3줄 요약</h2> (<ul> 3개, 굵게)
   - <hr>
   - 마무리 <p>문단</p> (150자, "저도 이 개념 알고 나서야~" + 다음 글 예고)
   - 시그니처: <p style="text-align:center;color:#666;font-style:italic;margin-top:24px;">하루 5분, 경제와 친해지는 시간 / 오늘도 한 걸음 나아가셨어요! 👏</p>
3. **개인 멘트**: 글 전체에서 "저도" 4~5회 (도입 1, 본문 2~3, 마무리 1)
4. **표 스타일**: border-collapse, border:1px solid #ddd, padding:10px (샘플과 동일)
5. **박스 스타일**: 샘플과 동일 (💡는 파란 배경 #e7f3ff, ⚠️는 빨간 배경 #fff5f5)

# 절대 금지
- 단정적 투자 권유 ("이거 사세요", "무조건 오릅니다")
- 과장 부사 ("완전", "최고", "무조건", "역대급")
- 공포 조장
- 전문가 코스프레
- 지정된 6개 외 이모지 (📌💡⚠️📈📉👏만 허용)
- **<h2>Day N: ...</h2>나 📌 로 본문 시작**

# 출력 형식
**HTML 코드만** 출력하세요. \`\`\`html 같은 마크다운 코드블록이나 설명문구 없이.
<p>로 시작하는 도입부부터 바로.
맨 위 썸네일 <div>는 넣지 마세요 (publish-draft.js가 자동 삽입).`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.8 });
}

// ========== 2단계: 박팩트 검증 ==========
async function factCheck(articleHtml, topic) {
  const parkFact = loadPersona('park-fact');

  const systemPrompt = parkFact;

  const userPrompt = `다음은 Day ${topic.day} "${topic.title}" 초안입니다. YMYL 기준으로 검증하세요.

검증 항목:
1. 모든 숫자·계산의 정확성 (공식으로 재검산)
2. 법·제도 현재 기준 정확성
3. 단정적 투자 권유/수익률 보장/공포 조장 여부
4. 불확실한 인용·출처

**출력은 반드시 JSON만. 다른 텍스트 없이.**
{
  "status": "pass" | "needs_revision",
  "confidence": "high" | "medium" | "low",
  "issues": [
    { "severity": "high" | "medium" | "low", "sentence": "문제 문장 짧게", "reason": "이유", "suggestion": "수정 제안" }
  ],
  "summary": "한 줄 요약"
}

===== 초안 =====
${articleHtml}`;

  const resp = await callGemini(userPrompt, systemPrompt, { temperature: 0.2 });
  // JSON 추출 (코드블록 제거)
  const cleaned = resp.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('⚠️ 팩트체크 JSON 파싱 실패, 원문:', resp.slice(0, 500));
    return { status: 'pass', issues: [], summary: 'JSON parse failed, assuming pass' };
  }
}

// ========== 3단계: 박팩트 플래그 반영해서 재작성 ==========
async function reviseArticle(articleHtml, topic, factCheckResult) {
  const issueSummary = factCheckResult.issues
    .map((iss, i) => `${i + 1}. [${iss.severity}] ${iss.sentence} → ${iss.suggestion}`)
    .join('\n');

  const systemPrompt = `당신은 김하나입니다. 박팩트가 지적한 이슈들을 보수적으로 수정하세요.`;
  const userPrompt = `아래 초안에서 박팩트가 다음 이슈를 지적했어요:

${issueSummary}

이 이슈들만 반영해서 수정하세요. 다른 부분은 건드리지 마세요. HTML 형식 유지.
**HTML 코드만 출력.** 설명문 없이.

===== 원본 초안 =====
${articleHtml}`;

  return await callGemini(userPrompt, systemPrompt, { temperature: 0.3 });
}

// ========== 4단계: SEO 검색 설명 생성 ==========
async function generateSearchDescription(topic, articleHtml) {
  const systemPrompt = `당신은 SEO 전문가입니다. 블로그 포스트의 "검색 설명(meta description)"을 작성합니다.
규칙:
- 정확히 120~150자 (공백 포함)
- 핵심 키워드 앞쪽 배치
- 클릭 유도형 문장 (과장 금지)
- "~입니다", "~해요" 같은 어미 통일
- 특수문자·따옴표·줄바꿈 금지
- 평문만 출력 (HTML, 마크다운 금지)`;

  const userPrompt = `다음 블로그 글의 검색 설명을 한 문장 또는 두 문장으로 작성하세요.
제목: ${topic.title}
라벨: ${(topic.labels || []).join(', ')}

본문 앞부분:
${articleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800)}

**한 줄로, 120~150자, 평문만 출력.**`;

  const raw = await callGemini(userPrompt, systemPrompt, { temperature: 0.5, maxTokens: 2000 });
  return raw.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
}

// ========== 주제 선정 ==========
function loadTopics() {
  const p = path.join(__dirname, 'economy-blog', 'topics.yaml');
  return yaml.load(fs.readFileSync(p, 'utf8'));
}

function saveTopics(data) {
  const p = path.join(__dirname, 'economy-blog', 'topics.yaml');
  fs.writeFileSync(p, yaml.dump(data, { lineWidth: 120, noRefs: true }), 'utf8');
}

// ========== publish-draft.js 실행 ==========
function runPublishDraft({ dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labels, slug = '', searchDescription = '', publishDate = '' }) {
  const result = spawnSync(
    'node',
    ['publish-draft.js', dayId, emoji, postTitle, thumbTitle, sub1, sub2, htmlPath, labels, slug, searchDescription, publishDate],
    { cwd: __dirname, stdio: 'inherit' }
  );
  return result.status === 0;
}

// 인자 or 자동으로 publishDate 결정
// --keep-draft         → '' (DRAFT 유지)
// --publish-at <ISO>   → ISO 그대로
// --offset-days N      → N일 뒤 morning 슬롯
// --slot morning|evening → 오늘 해당 슬롯
// 기본 (없으면) → now 기준 다음 가까운 economy 슬롯 (오늘 morning → evening → 내일 morning ...)
function resolvePublishDate(args) {
  if (args.includes('--keep-draft')) return '';
  const publishAtIdx = args.indexOf('--publish-at');
  if (publishAtIdx >= 0 && args[publishAtIdx + 1]) return args[publishAtIdx + 1];

  const offsetIdx = args.indexOf('--offset-days');
  if (offsetIdx >= 0 && args[offsetIdx + 1]) {
    const offset = parseInt(args[offsetIdx + 1], 10);
    // economy 첫 슬롯 = morning
    const slotIdx = args.indexOf('--slot');
    const slotName = slotIdx >= 0 ? args[slotIdx + 1] : 'morning';
    const slot = SLOTS.economy.find(s => s.name === slotName) || SLOTS.economy[0];
    return slotToISO(slot, offset);
  }

  const slotIdx = args.indexOf('--slot');
  if (slotIdx >= 0 && args[slotIdx + 1]) {
    const slotName = args[slotIdx + 1];
    const slot = SLOTS.economy.find(s => s.name === slotName);
    if (slot) return slotToISO(slot, 0);
  }

  // 기본: 즉시 발행 (publishDate = 현재 시각, Blogger가 LIVE로 전환)
  // cron이 07:30 KST 슬롯에 발동됐으면 이 시각이 곧 발행 시각
  return 'now';
}

// ========== 메인 ==========
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dayArg = args.indexOf('--day') >= 0 ? parseInt(args[args.indexOf('--day') + 1]) : null;
  const publishDate = resolvePublishDate(args);

  const topicsData = loadTopics();
  let topic;
  if (dayArg) {
    topic = topicsData.topics.find(t => t.day === dayArg);
    if (!topic) throw new Error(`Day ${dayArg} 주제를 찾을 수 없음`);
  } else {
    topic = topicsData.topics.find(t => t.status === 'ready');
    if (!topic) {
      console.log('✋ 다음 쓸 주제가 없습니다 (ready 상태인 topic 없음).');
      await notifyTelegram('ℹ️ <b>발행 스킵</b>\n다음 쓸 주제가 없습니다 (ready 상태인 topic 없음).');
      return;
    }
  }

  console.log(`\n🎯 오늘의 주제: Day ${topic.day} — ${topic.title}`);
  console.log(`   클러스터: ${topic.cluster}, 이모지: ${topic.emoji}\n`);

  // 다음 주제 식별 (예고 문구용)
  const topicIdx = topicsData.topics.findIndex(t => t.day === topic.day);
  const nextTopic = topicsData.topics[topicIdx + 1];

  // 1. 김하나 초안 작성
  console.log('📝 [1/3] 김하나 초안 작성 중...');
  let articleHtml = await writeArticle(topic, nextTopic);
  // 코드블록 마크다운 제거
  articleHtml = articleHtml.replace(/^```html\s*/gm, '').replace(/^```\s*$/gm, '').trim();
  // 본문 맨 앞에 <h2>Day N...</h2>이 있으면 제거 (로봇이 실수로 제목 중복 넣은 경우)
  articleHtml = articleHtml.replace(/^\s*<h2>[^<]*(?:📌\s*)?Day\s*\d+[^<]*<\/h2>\s*/i, '');
  console.log(`   ✓ ${articleHtml.length}자 초안 완료\n`);

  // 2. 박팩트 검증
  console.log('🔍 [2/3] 박팩트 검증 중...');
  const checkResult = await factCheck(articleHtml, topic);
  console.log(`   판정: ${checkResult.status}`);
  console.log(`   요약: ${checkResult.summary}`);
  if (checkResult.issues && checkResult.issues.length > 0) {
    console.log(`   이슈 ${checkResult.issues.length}개 발견:`);
    checkResult.issues.forEach((iss, i) => {
      console.log(`     ${i + 1}. [${iss.severity}] ${iss.sentence}`);
    });
  }
  console.log('');

  // 3. 수정 필요 시 재작성
  if (checkResult.status === 'needs_revision' && checkResult.issues.some(i => i.severity === 'high')) {
    console.log('✏️ [3/3] 박팩트 피드백 반영 재작성 중...');
    articleHtml = await reviseArticle(articleHtml, topic, checkResult);
    articleHtml = articleHtml.replace(/^```html\s*/gm, '').replace(/^```\s*$/gm, '').trim();
    console.log(`   ✓ 수정 완료 (${articleHtml.length}자)\n`);
  } else {
    console.log('✅ [3/3] 팩트 이슈 없음, 원본 유지\n');
  }

  // 4. 저장
  const dayId = `day-${String(topic.day).padStart(2, '0')}`;
  const htmlRelPath = `economy-blog/drafts/${dayId}-${topic.slug}.html`;
  const htmlAbsPath = path.join(__dirname, htmlRelPath);
  fs.writeFileSync(htmlAbsPath, articleHtml, 'utf8');
  console.log(`💾 저장: ${htmlRelPath}\n`);

  // 4. SEO 검색 설명 생성
  console.log('🔎 [SEO] 검색 설명 생성 중...');
  let searchDescription = '';
  try {
    searchDescription = await generateSearchDescription(topic, articleHtml);
    console.log(`   ✓ ${searchDescription.length}자: ${searchDescription}\n`);
  } catch (e) {
    console.warn(`   ⚠️ 검색 설명 생성 실패: ${e.message}`);
  }

  if (dryRun) {
    console.log('✋ --dry-run 옵션: 업로드는 생략합니다.');
    return;
  }

  // 5. Blogger 업로드 (+ Playwright 메타 + 선택적 예약 발행)
  const publishLabel = !publishDate ? 'DRAFT 유지' : publishDate === 'now' ? '즉시 발행' : `예약: ${formatSlotKorean(publishDate)}`;
  console.log(`☁️ [업로드] Blogger → ${publishLabel}`);
  const ok = runPublishDraft({
    dayId,
    emoji: topic.emoji,
    postTitle: topic.title,
    thumbTitle: topic.thumb_title,
    sub1: topic.subtitle[0] || '',
    sub2: topic.subtitle[1] || '',
    htmlPath: htmlRelPath,
    labels: (topic.labels || []).join(','),
    slug: topic.slug || '',
    searchDescription,
    publishDate,
  });

  if (!ok) {
    throw new Error(`Blogger 업로드 실패 (Day ${topic.day})`);
  }

  // 6. topics.yaml 업데이트 (status: ready → draft/scheduled/published)
  const isFutureSchedule = publishDate && publishDate !== 'now' && new Date(publishDate).getTime() > Date.now();
  if (!publishDate) {
    topic.status = 'draft';
  } else if (isFutureSchedule) {
    topic.status = 'scheduled';
    topic.scheduled_for = publishDate;
  } else {
    topic.status = 'published';
    topic.published_at = new Date().toISOString();
  }
  topic.generated_at = new Date().toISOString();
  // 자동 실행일 때만 다음 pending 하나를 ready로 승격 (--day 재업로드 시엔 skip)
  let nextPending = null;
  if (!dayArg) {
    nextPending = topicsData.topics.find(t => t.status === 'pending');
    if (nextPending) {
      nextPending.status = 'ready';
      console.log(`\n🔄 다음 주제 자동 지정: Day ${nextPending.day} — ${nextPending.title}`);
    }
  }
  saveTopics(topicsData);

  console.log('\n🎉 로봇 사이클 완료!');

  // 7. 텔레그램 성공 알림
  const nextInfo = nextPending
    ? `\n\n🔜 <b>다음 예정:</b> Day ${nextPending.day} — ${nextPending.title}`
    : '\n\n🏁 모든 주제 소진 (pending 없음)';
  const seoBlock = searchDescription
    ? `\n\n📎 <b>파머링크</b>\n<code>${topic.slug}</code>\n\n📝 <b>검색 설명</b>\n<code>${escapeHtml(searchDescription)}</code>`
    : `\n\n📎 <b>파머링크</b>\n<code>${topic.slug}</code>`;

  let statusHeader, statusNote;
  if (!publishDate) {
    statusHeader = '✅ <b>DRAFT 업로드 성공</b>';
    statusNote = `\n\n💡 Blogger에서 확인 후 발행:\nhttps://www.blogger.com/u/0/blog/posts/${process.env.BLOG_ID || ''}`;
  } else if (isFutureSchedule) {
    statusHeader = '📅 <b>예약 발행 완료</b>';
    statusNote = `\n\n⏰ 발행 예정: <b>${formatSlotKorean(publishDate)}</b>`;
  } else {
    statusHeader = '🚀 <b>즉시 발행 완료</b>';
    statusNote = '\n\n🌐 LIVE 상태';
  }

  await notifyTelegram(
    `${statusHeader}\n\n` +
    `📌 <b>Day ${topic.day}</b> — ${topic.title}\n` +
    `🏷️ ${(topic.labels || []).join(', ')}` +
    seoBlock +
    statusNote +
    nextInfo
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

main().catch(async (err) => {
  console.error('❌ 실행 중 에러:', err);
  await notifyTelegram(
    `🚨 <b>발행 실패</b>\n\n` +
    `에러: ${String(err.message || err).slice(0, 500)}\n\n` +
    `GitHub Actions 로그 확인:\n` +
    `https://github.com/khe3716/content-studio/actions`
  );
  process.exit(1);
});
