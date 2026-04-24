// Fetch romantic/sweet stories from Reddit public JSON API
// No auth needed for read-only public posts

const SUBREDDITS = [
  { name: 'MadeMeSmile', timeframe: 'week', limit: 30 },
  { name: 'wholesomestories', timeframe: 'week', limit: 25 },
  { name: 'love', timeframe: 'month', limit: 25 },
  { name: 'relationship_advice', timeframe: 'week', limit: 25 },
  { name: 'CasualConversation', timeframe: 'week', limit: 20 },
];

const USER_AGENT = 'web:dalkomssul-shorts:1.0 (by /u/automation_bot)';

async function fetchSubreddit({ name, timeframe, limit }) {
  const url = `https://www.reddit.com/r/${name}/top.json?t=${timeframe}&limit=${limit}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Reddit ${name} fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data.children.map((c) => c.data);
}

function normalizePost(post, subreddit) {
  return {
    id: post.id,
    subreddit,
    title: post.title,
    body: post.selftext || '',
    author: post.author,
    score: post.score,
    numComments: post.num_comments,
    createdUtc: post.created_utc,
    url: `https://www.reddit.com${post.permalink}`,
    over18: post.over_18,
    spoiler: post.spoiler,
    locked: post.locked,
  };
}

function basicFilter(post) {
  if (post.over18 || post.spoiler || post.locked) return false;
  if (!post.body || post.body.length < 200) return false; // too short, no story
  if (post.body.length > 6000) return false; // too long, hard to adapt
  if (post.body.includes('[removed]') || post.body.includes('[deleted]')) return false;
  return true;
}

async function fetchAllCandidates() {
  const all = [];
  for (const sub of SUBREDDITS) {
    try {
      console.log(`[fetch] r/${sub.name}...`);
      const posts = await fetchSubreddit(sub);
      const normalized = posts
        .map((p) => normalizePost(p, sub.name))
        .filter(basicFilter);
      console.log(`  -> ${normalized.length} candidates after filter`);
      all.push(...normalized);
      await new Promise((r) => setTimeout(r, 1500)); // rate limit politeness
    } catch (err) {
      console.error(`  [error] r/${sub.name}: ${err.message}`);
    }
  }
  return all;
}

module.exports = { fetchAllCandidates, SUBREDDITS };

if (require.main === module) {
  fetchAllCandidates().then((posts) => {
    console.log(`\nTotal: ${posts.length} candidates`);
    console.log('Sample:', JSON.stringify(posts[0], null, 2).slice(0, 500));
  });
}
