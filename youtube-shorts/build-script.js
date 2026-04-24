// Generate a human-readable .md script for an episode.
// Usage: node youtube-shorts/build-script.js <episodeId>
//   episodeId defaults to most recent episode

const fs = require('fs');
const path = require('path');

const EPISODES_DIR = path.join(__dirname, 'episodes');
const SCRIPTS_DIR = path.join(__dirname, 'scripts');
const IMAGES_BASE = path.join(__dirname, 'images');

function pickEpisode(arg) {
  if (arg) {
    const p = path.join(EPISODES_DIR, `${arg}.json`);
    if (fs.existsSync(p)) return p;
    throw new Error(`Episode not found: ${arg}`);
  }
  const files = fs
    .readdirSync(EPISODES_DIR)
    .filter((f) => f.startsWith('ep_') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error('No episodes found');
  return path.join(EPISODES_DIR, files[0]);
}

function buildScript(episode) {
  const totalSec = episode.scenes.reduce((sum, s) => sum + s.duration, 0);
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec - m * 60);
  const durationStr = m > 0 ? `${m}분 ${s}초` : `${s}초`;

  const charactersByScene = episode.scenes.map((sc) => sc.characters.join(', ') || 'none');

  let md = '';
  md += `# ${episode.video.title}\n\n`;
  md += `**에피소드 ID**: ${episode.id}\n`;
  md += `**총 분량**: ${durationStr} (${totalSec}초, ${episode.scenes.length}씬)\n`;
  md += `**훅**: ${episode.video.hook}\n\n`;

  md += `## 📌 출처\n\n`;
  md += `- **사이트**: ${episode.source.platform === 'natepann' ? '네이트판' : episode.source.platform}\n`;
  md += `- **글 제목**: ${episode.source.originalTitle}\n`;
  md += `- **글 링크**: ${episode.source.url}\n`;
  md += `- **위치**: ${episode.source.popularity || '본문'}\n`;
  md += `- **원본 텍스트**:\n  > ${episode.source.originalText.replace(/\n/g, '\n  > ')}\n\n`;
  md += `> ⚠️ 원본은 위 글의 **댓글** 중 하나입니다. 링크를 누르면 글 본문이 보이고, 진짜 썰은 댓글에 있어요.\n\n`;

  md += `## 🎯 영상 메타데이터\n\n`;
  md += `- **제목**: ${episode.video.title}\n`;
  md += `- **설명**:\n  ${episode.video.description}\n`;
  md += `- **태그**: ${episode.video.tags.join(', ')}\n\n`;

  md += `## 🎬 씬별 대본\n\n`;
  md += `| # | 시간 | 인물 | 자막 | 내레이션 (TTS) |\n`;
  md += `|---|------|------|------|---------------|\n`;

  let cumulative = 0;
  for (const sc of episode.scenes) {
    const start = cumulative.toFixed(1);
    cumulative += sc.duration;
    const end = cumulative.toFixed(1);
    const subtitle = sc.subtitle.replace(/\n/g, '<br>');
    const narration = sc.narration.replace(/\n/g, ' ');
    md += `| ${sc.n} | ${start}~${end}s (${sc.duration}초) | ${charactersByScene[sc.n - 1]} | ${subtitle} | ${narration} |\n`;
  }

  md += `\n## 🎨 씬별 이미지 프롬프트\n\n`;
  for (const sc of episode.scenes) {
    md += `### Scene ${sc.n} (${sc.duration}초)\n`;
    md += `**자막**: ${sc.subtitle.replace(/\n/g, ' / ')}\n\n`;
    md += `**프롬프트**:\n\`\`\`\n${sc.imagePrompt}\n\`\`\`\n\n`;
    md += `**이미지**: \`images/${episode.id}/scene_${String(sc.n).padStart(2, '0')}.png\`\n\n`;
    md += `---\n\n`;
  }

  md += `## 🎙️ TTS 전용 (전체 내레이션 한 번에)\n\n`;
  md += `\`\`\`\n`;
  for (const sc of episode.scenes) {
    md += `[Scene ${sc.n}] ${sc.narration}\n`;
  }
  md += `\`\`\`\n`;

  return md;
}

function buildPlainText(episode) {
  const totalSec = episode.scenes.reduce((sum, s) => sum + s.duration, 0);
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec - m * 60);
  const durationStr = m > 0 ? `${m}분 ${s}초` : `${s}초`;
  const sty = episode.episodeStyle || {};

  const line = (n = 60) => '─'.repeat(n);
  const dline = (n = 60) => '═'.repeat(n);

  let t = '';
  t += `${dline()}\r\n`;
  t += `  ${episode.video.title}\r\n`;
  t += `${dline()}\r\n\r\n`;

  t += `[기본 정보]\r\n`;
  t += `  - 에피소드 ID : ${episode.id}\r\n`;
  t += `  - 총 분량     : ${durationStr} (${totalSec}초, ${episode.scenes.length}씬)\r\n`;
  t += `  - 훅          : ${episode.video.hook}\r\n\r\n`;

  t += `[출처]\r\n`;
  t += `  - 사이트   : ${episode.source.platform === 'natepann' ? '네이트판' : episode.source.platform}\r\n`;
  t += `  - 글 제목  : ${episode.source.originalTitle}\r\n`;
  t += `  - 위치     : ${episode.source.popularity || '본문'}\r\n`;
  t += `  - 링크     : ${episode.source.url}\r\n`;
  t += `  - 원본 텍스트:\r\n`;
  t += `    "${episode.source.originalText}"\r\n`;
  t += `  ※ 원본은 위 글의 댓글에 있습니다.\r\n\r\n`;

  t += `[캐릭터 스타일 — 이 에피소드 전체 통일]\r\n`;
  t += `  - 계절       : ${sty.season || '-'}\r\n`;
  t += `  - 여주 헤어  : ${sty.heroineHair || '-'}\r\n`;
  t += `  - 여주 외출복: ${sty.heroineOutfit || '-'}\r\n`;
  t += `  - 여주 실내복: ${sty.heroineHomeOutfit || '-'}\r\n`;
  t += `  - 선배 헤어  : ${sty.seonbaeHair || '-'}\r\n`;
  t += `  - 선배 의상  : ${sty.seonbaeOutfit || '-'}\r\n`;
  t += `  - 무드       : ${sty.moodPalette || '-'}\r\n\r\n`;

  t += `[유튜브 메타데이터]\r\n`;
  t += `  - 제목 : ${episode.video.title}\r\n`;
  t += `  - 설명 : ${episode.video.description}\r\n`;
  t += `  - 태그 : ${episode.video.tags.join(', ')}\r\n\r\n`;

  t += `${dline()}\r\n`;
  t += `  씬별 대본\r\n`;
  t += `${dline()}\r\n\r\n`;

  let cumulative = 0;
  for (const sc of episode.scenes) {
    const start = cumulative.toFixed(1);
    cumulative += sc.duration;
    const end = cumulative.toFixed(1);
    const chars = sc.characters.join(', ') || 'none';
    t += `${line()}\r\n`;
    t += `[Scene ${sc.n}]  ${start}~${end}초 (${sc.duration}초)  /  인물: ${chars}  /  배경: ${sc.setting}\r\n`;
    t += `${line()}\r\n`;
    t += `자막:\r\n`;
    t += `  ${sc.subtitle.replace(/\n/g, '\r\n  ')}\r\n\r\n`;
    t += `내레이션 (TTS):\r\n`;
    t += `  ${sc.narration}\r\n\r\n`;
    t += `이미지 파일:\r\n`;
    t += `  scene_${String(sc.n).padStart(2, '0')}.png\r\n\r\n`;
  }

  t += `${dline()}\r\n`;
  t += `  TTS 전용 (전체 내레이션)\r\n`;
  t += `${dline()}\r\n\r\n`;
  for (const sc of episode.scenes) {
    t += `[${sc.n}] ${sc.narration}\r\n`;
  }
  t += `\r\n`;

  return t;
}

function main() {
  const epPath = pickEpisode(process.argv[2]);
  const episode = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const md = buildScript(episode);
  const txt = buildPlainText(episode);

  if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  const mdPath = path.join(SCRIPTS_DIR, `${episode.id}.md`);
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`✓ MD saved: ${mdPath}`);

  // .txt also goes inside the images folder for easy review
  const imagesDir = path.join(IMAGES_BASE, episode.id);
  if (fs.existsSync(imagesDir)) {
    const txtPath = path.join(imagesDir, `대본.txt`);
    fs.writeFileSync(txtPath, '﻿' + txt, 'utf8'); // BOM for notepad UTF-8
    console.log(`✓ TXT saved: ${txtPath}`);
  }

  return mdPath;
}

if (require.main === module) main();
module.exports = { buildScript };
