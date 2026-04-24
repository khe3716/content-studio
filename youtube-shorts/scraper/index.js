// Orchestrator: fetch -> rank -> adapt -> save episode.json
// Usage: node youtube-shorts/scraper/index.js

const fs = require('fs');
const path = require('path');
const { fetchAllCandidates } = require('./fetch-reddit');
const { rankAndPick, adaptToKorean } = require('./adapt-story');

const ROOT = path.join(__dirname, '..');
const EPISODES_DIR = path.join(ROOT, 'episodes');
const SEEN_FILE = path.join(ROOT, 'seen.json');

function loadSeen() {
  if (!fs.existsSync(SEEN_FILE)) return { ids: [] };
  return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

function todayId() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  // count today's existing episodes
  if (!fs.existsSync(EPISODES_DIR)) fs.mkdirSync(EPISODES_DIR, { recursive: true });
  const todays = fs.readdirSync(EPISODES_DIR).filter((f) => f.startsWith(`ep_${ymd}_`));
  const n = String(todays.length + 1).padStart(3, '0');
  return `ep_${ymd}_${n}`;
}

async function run() {
  console.log('═══ Step 1: Fetch Reddit candidates ═══');
  const candidates = await fetchAllCandidates();
  if (candidates.length === 0) throw new Error('No candidates fetched');

  console.log(`\n═══ Step 2: Rank & pick best ═══`);
  const seen = loadSeen();
  const seenSet = new Set(seen.ids);
  const { picked, reason, runnerUps } = await rankAndPick(candidates, seenSet);
  console.log(`✓ Picked: r/${picked.subreddit} - "${picked.title}"`);
  console.log(`  ID: ${picked.id}, score: ${picked.score}`);
  console.log(`  Reason: ${reason}`);

  console.log(`\n═══ Step 3: Adapt to Korean script ═══`);
  const adapted = await adaptToKorean(picked);
  console.log(`✓ Title: ${adapted.video.title}`);
  console.log(`  Scenes: ${adapted.scenes.length}`);

  const id = todayId();
  const episode = {
    id,
    createdAt: new Date().toISOString(),
    source: {
      platform: 'reddit',
      subreddit: picked.subreddit,
      url: picked.url,
      author: picked.author,
      originalTitle: picked.title,
      score: picked.score,
      fetchedAt: new Date().toISOString(),
    },
    pickReason: reason,
    runnerUps,
    characters: [
      { key: '여주', role: 'narrator', ref: 'references/여주.png' },
      { key: '선배', role: 'love_interest', ref: 'references/남주.png' },
    ],
    ...adapted,
  };

  const outPath = path.join(EPISODES_DIR, `${id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(episode, null, 2));
  console.log(`\n✓ Saved: ${outPath}`);

  // mark seen
  seen.ids.push(picked.id);
  if (seen.ids.length > 1000) seen.ids = seen.ids.slice(-1000);
  saveSeen(seen);

  return episode;
}

if (require.main === module) {
  run().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
  });
}

module.exports = { run };
