import { SITE_URL, escapeHtml, supabaseRows } from './_seo.js';

const safeUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
};

export default async function handler(request, response) {
  const rawId = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const id = String(rawId || '');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(400).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>잘못된 동영상 주소</title><p>동영상 주소가 올바르지 않습니다.</p>');
  }
  try {
    const [video] = await supabaseRows('videos', `select=*&id=eq.${encodeURIComponent(id)}&status=eq.published&limit=1`);
    if (!video) {
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return response.status(404).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>동영상을 찾을 수 없습니다</title><p>공개된 동영상을 찾을 수 없습니다.</p>');
    }
    const canonical = `${SITE_URL}/video?id=${encodeURIComponent(video.id)}`;
    const description = String(video.description || '삶과 언어의 공개 동영상 자료입니다.').replace(/\s+/g, ' ').trim();
    const youtubeId = /^[A-Za-z0-9_-]{6,20}$/.test(String(video.youtube_id || '')) ? String(video.youtube_id) : '';
    const youtubeUrl = safeUrl(video.youtube_url);
    const image = youtubeId ? `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg` : `${SITE_URL}/og-image.webp`;
    const published = video.published_at ? new Date(`${video.published_at}T00:00:00`).toLocaleDateString('ko-KR') : '';
    const related = /^[0-9a-f-]{36}$/i.test(String(video.related_post_id || '')) ? `<a href="/article?id=${encodeURIComponent(video.related_post_id)}">관련 글 읽기 →</a>` : '';
    const youtubeLink = youtubeUrl ? `<a class="primary" href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a>` : '';
    const schema = {'@context':'https://schema.org','@type':'VideoObject',name:video.title,description,thumbnailUrl:[image],uploadDate:video.published_at || undefined,embedUrl:youtubeId ? `https://www.youtube-nocookie.com/embed/${youtubeId}` : undefined,url:canonical,publisher:{'@type':'Organization',name:'삶과 언어',url:`${SITE_URL}/`}};
    const player = youtubeId ? `<div class="player"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}" title="${escapeHtml(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : '';
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(video.title)} | 삶과 언어</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="video.other"><meta property="og:site_name" content="삶과 언어"><meta property="og:title" content="${escapeHtml(video.title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script><link rel="stylesheet" href="/archive/archive.css"><style>.video-page{max-width:980px;padding:50px 0 80px}.video-nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:28px}.video-nav a{color:var(--navy);font-weight:800}.video-page h1{font:700 clamp(34px,5vw,58px)/1.25 var(--sans);letter-spacing:-.05em;margin:12px 0}.video-meta{color:var(--muted)}.player{position:relative;width:100%;aspect-ratio:16/9;background:#101722;margin:30px 0}.player iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.video-copy{font-size:18px;line-height:1.9}.video-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:32px}.video-actions a{padding:11px 17px;border:1px solid var(--navy);color:var(--navy);font-weight:800;text-decoration:none}.video-actions .primary{background:var(--navy);color:#fff}</style></head><body><header class="site-header"><div class="wrap header-inner"><a class="brand" href="/">삶과 언어</a><nav><a href="/videos">동영상 자료실</a></nav></div></header><main id="main" class="wrap video-page"><nav class="video-nav" aria-label="돌아가기"><a href="/videos">← 동영상 목록으로 돌아가기</a><a href="/">홈으로 돌아가기</a></nav><p class="eyebrow">${escapeHtml(video.category || 'VIDEO')}</p><h1>${escapeHtml(video.title)}</h1><p class="video-meta">${escapeHtml(published)}</p>${player}<p class="video-copy">${escapeHtml(description)}</p><div class="video-actions">${youtubeLink}${related}<a href="/videos">동영상 목록</a><a href="/">홈으로</a></div></main></body></html>`;
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    return response.status(200).send(html
      .replace('</head>', '<link rel="stylesheet" href="/customer/read-aloud.css?v=20261004-9"><script>addEventListener("load",()=>{if(document.querySelector("script[data-read-aloud]"))return;const s=document.createElement("script");s.src="/customer/read-aloud.js?v=20261004-9";s.dataset.readAloud="true";document.body.append(s)},{once:true})</script></head>'));
  } catch {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(503).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>동영상을 불러올 수 없습니다</title><p>잠시 후 다시 시도해 주세요.</p>');
  }
}
