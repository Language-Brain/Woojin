const baseUrl = (process.env.SITE_URL || 'https://languagebrain.vercel.app').replace(/\/$/, '');

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  check(response.ok, `${url} 응답 실패: HTTP ${response.status}`);
  return response.json();
}

const configResponse = await fetch(`${baseUrl}/api/config`);
check(configResponse.ok, `환경설정 응답 실패: HTTP ${configResponse.status}`);
const configSource = await configResponse.text();
const match = configSource.match(/window\.LANGUAGE_BRAIN_CONFIG=(\{.*\});/);
check(match, '공개 환경설정 형식을 확인할 수 없습니다.');
const config = JSON.parse(match[1]);
check(config.supabaseUrl?.startsWith('https://'), 'Supabase URL이 설정되지 않았습니다.');
check(config.supabasePublishableKey?.startsWith('sb_publishable_'), 'Supabase 공개 키가 설정되지 않았습니다.');
check(!/service_role|sb_secret/i.test(configSource), '비밀키가 공개 환경설정에 포함되어 있습니다.');

const headers = {
  apikey: config.supabasePublishableKey,
  Authorization: `Bearer ${config.supabasePublishableKey}`
};
const rest = `${config.supabaseUrl}/rest/v1`;
const [published, drafts, videos] = await Promise.all([
  getJson(`${rest}/posts?select=id,type,status&status=eq.published`, { headers }),
  getJson(`${rest}/posts?select=id,status&status=eq.draft`, { headers }),
  getJson(`${rest}/videos?select=id,title,status,youtube_id,youtube_url&status=eq.published`, { headers })
]);
check(Array.isArray(published), '공개 글 응답 형식이 올바르지 않습니다.');
check(drafts.length === 0, '비로그인 요청에서 임시저장 글이 노출됩니다.');
check(videos.every(video => /^[A-Za-z0-9_-]{11}$/.test(video.youtube_id)), '잘못된 공개 동영상 ID가 있습니다.');

for (const path of ['/customer', '/papers', '/news', '/works', '/videos', '/admin']) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'follow' });
  check(response.ok, `${path} 화면 응답 실패: HTTP ${response.status}`);
}

console.log(JSON.stringify({
  site: baseUrl,
  publishedPosts: published.length,
  publicDrafts: drafts.length,
  publishedVideos: videos.length,
  result: 'PASS'
}, null, 2));
