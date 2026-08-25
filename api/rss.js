import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, descriptionFor, publicArticleUrl, supabaseRows, xmlEscape } from './_seo.js';

export default async function handler(request, response) {
  try {
    const posts = await supabaseRows('posts', 'select=id,title,excerpt,subtitle,content_html,published_at,updated_at&status=eq.published&type=in.(paper,news,works)&order=published_at.desc&limit=50');
    const items = posts.map(post => {
      const url = publicArticleUrl(post.id);
      const date = post.published_at || post.updated_at;
      const fullContent = String(post.content_html || `<p>${xmlEscape(descriptionFor(post))}</p>`).replaceAll(']]>', ']]&gt;');
      return `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(url)}</link><guid isPermaLink="true">${xmlEscape(url)}</guid><description>${xmlEscape(descriptionFor(post))}</description><content:encoded><![CDATA[${fullContent}]]></content:encoded>${date ? `<pubDate>${new Date(date).toUTCString()}</pubDate>` : ''}</item>`;
    }).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>${xmlEscape(SITE_NAME)}</title><link>${xmlEscape(SITE_URL)}/</link><description>${xmlEscape(SITE_DESCRIPTION)}</description><language>ko</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${xmlEscape(SITE_URL)}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
    response.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    response.status(200).send(xml);
  } catch {
    response.status(503).setHeader('Content-Type', 'text/plain; charset=utf-8').send('RSS temporarily unavailable');
  }
}
