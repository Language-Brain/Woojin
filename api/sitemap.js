import { SITE_URL, publicArticleUrl, supabaseRows, xmlEscape } from './_seo.js';

export default async function handler(request, response) {
  try {
    const [posts, videos, guides, pyeongjae] = await Promise.all([
      supabaseRows('posts', 'select=id,type,updated_at,published_at&status=eq.published&type=in.(paper,news,works)&order=updated_at.desc'),
      supabaseRows('videos', 'select=id,updated_at,published_at&status=eq.published&order=updated_at.desc'),
      supabaseRows('guides', 'select=id,updated_at&status=eq.active&visibility=eq.public&order=updated_at.desc'),
      supabaseRows('pyeongjae_entries', 'select=id,updated_at&status=eq.published&order=updated_at.desc')
    ]);
    const latest = rows => rows.map(row => row.updated_at || row.published_at).filter(Boolean).sort().at(-1);
    const fixed = [
      { path: '/', lastmod: latest([...posts, ...videos, ...guides, ...pyeongjae]) },
      { path: '/papers', lastmod: latest(posts.filter(post => post.type === 'paper')) },
      { path: '/news', lastmod: latest(posts.filter(post => post.type === 'news')) },
      { path: '/works', lastmod: latest(posts.filter(post => post.type === 'works')) },
      { path: '/videos', lastmod: latest(videos) },
      { path: '/search', lastmod: latest(posts) },
      { path: '/guides', lastmod: latest(guides) },
      { path: '/pyeongjae', lastmod: latest(pyeongjae) }
    ].map(entry => ({ loc: `${SITE_URL}${entry.path}`, lastmod: entry.lastmod }));
    const entries = [
      ...fixed,
      ...posts.map(post => ({ loc: publicArticleUrl(post.id), lastmod: post.updated_at || post.published_at })),
      ...videos.map(video => ({ loc: `${SITE_URL}/video?id=${encodeURIComponent(video.id)}`, lastmod: video.updated_at || video.published_at })),
      ...guides.map(guide => ({ loc: `${SITE_URL}/guide?id=${encodeURIComponent(guide.id)}`, lastmod: guide.updated_at })),
      ...pyeongjae.map(entry => ({ loc: `${SITE_URL}/pyeongjae-entry?id=${encodeURIComponent(entry.id)}`, lastmod: entry.updated_at }))
    ];
    const unique = [...new Map(entries.map(entry => [entry.loc, entry])).values()];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(entry => `  <url><loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(new Date(entry.lastmod).toISOString())}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
    response.setHeader('Content-Type', 'application/xml; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    response.status(200).send(xml);
  } catch {
    response.status(503).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Sitemap temporarily unavailable');
  }
}
