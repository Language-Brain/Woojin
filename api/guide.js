import { SITE_URL, descriptionFor, escapeHtml, supabaseRows, supabaseRpc } from './_seo.js';

const safeUrl = value => {
  try {
    const url = new URL(String(value || '').trim(), SITE_URL);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
};

function safeRichHtml(value) {
  const source = String(value || '');
  if (!/<\/?[a-z][\s\S]*>/i.test(source)) {
    return source.split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
  }
  const allowed = new Set(['p','br','div','strong','b','u','em','i','span','a','ol','ul','li']);
  return source
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]+>/g, tag => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match) return '';
      const closing = Boolean(match[1]), name = match[2].toLowerCase();
      if (!allowed.has(name)) return '';
      if (closing) return `</${name}>`;
      if (name === 'br') return '<br>';
      if (name === 'a') {
        const href = safeUrl(tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]);
        if (!href) return '';
        const external = new URL(href).origin !== SITE_URL;
        return `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
      }
      if (name === 'span') {
        const color = tag.match(/\bstyle\s*=\s*["'][^"']*color\s*:\s*(#[0-9a-f]{3,8}|rgb\([^)]*\)|[a-z]+)[^"']*["']/i)?.[1];
        return color ? `<span style="color:${escapeHtml(color)}">` : '<span>';
      }
      return `<${name}>`;
    });
}

const formatDate = value => value ? new Date(value).toLocaleDateString('ko-KR') : '-';
const youtubeId = value => {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1).split('/')[0];
    if (url.hostname.includes('youtube.com')) return url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
  } catch {}
  return '';
};

export default async function handler(request, response) {
  const id = String(Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id || '');
  const token = String(Array.isArray(request.query?.token) ? request.query.token[0] : request.query?.token || '');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(400).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>잘못된 자료 주소</title><p>자료 주소가 올바르지 않습니다.</p>');
  }
  try {
    let row;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      [row] = await supabaseRpc('get_unlisted_guide', { p_id: id, p_token: token });
    } else {
      [row] = await supabaseRows('guides', `select=*&id=eq.${encodeURIComponent(id)}&status=eq.active&visibility=eq.public&limit=1`);
    }
    if (!row) {
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return response.status(404).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>자료를 찾을 수 없습니다</title><p>공개되지 않았거나 존재하지 않는 자료입니다.</p>');
    }

    const isPublic = row.visibility === 'public';
    const canonical = `${SITE_URL}/guide?id=${encodeURIComponent(row.id)}`;
    const description = descriptionFor({ title: row.title, excerpt: row.description, content_html: row.body });
    const tags = Array.isArray(row.tags) ? row.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [];
    const schema = {
      '@context': 'https://schema.org', '@type': 'Article', headline: row.title, description,
      url: canonical, mainEntityOfPage: canonical, inLanguage: 'ko-KR',
      datePublished: row.created_at, dateModified: row.updated_at || row.created_at,
      keywords: tags.length ? tags : undefined,
      author: { '@type': 'Person', name: '권우진', url: `${SITE_URL}/#about` },
      publisher: { '@type': 'Organization', name: '리터러시 톡톡', alternateName: '삶과 언어 · 권우진 연구실', url: `${SITE_URL}/` }
    };
    const body = safeRichHtml(row.body) || '<p>본문을 준비하고 있습니다.</p>';
    const tagMarkup = tags.map(tag => `<a href="/guides?q=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('');
    const links = (Array.isArray(row.external_links) ? row.external_links : []).map(item => {
      const url = safeUrl(item?.url);
      return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label || url)}</a>` : '';
    }).join('');
    const yid = youtubeId(row.youtube_url);
    const video = yid ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(yid)}" title="관련 YouTube 영상" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : '';
    const robots = isPublic ? 'index,follow,max-image-preview:large' : 'noindex,nofollow';
    if (!isPublic) response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(row.title)} | 리터러시 톡톡</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="article"><meta property="og:site_name" content="리터러시 톡톡"><meta property="og:title" content="${escapeHtml(row.title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(row.title)}"><meta name="twitter:description" content="${escapeHtml(description)}">${tags.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('')}<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script><link rel="stylesheet" href="/guides/guides.css"><link rel="stylesheet" href="/customer/bilingual-titles.css?v=20261010-1"><link rel="stylesheet" href="/customer/reader-text-size.css?v=20260909-3"><link rel="stylesheet" href="/customer/read-aloud.css?v=20261013-15"><style>.document{padding:48px 0 80px}.document-head{display:block;width:100%;height:auto;border-bottom:1px solid var(--line);padding:0 0 24px;background:transparent}.document-kicker{margin:0;color:var(--navy);font-size:12px;font-weight:800;letter-spacing:.1em}.document-head h1{width:100%;max-width:none;font-size:36px;line-height:1.38;margin:8px 0 12px;word-break:keep-all;overflow-wrap:break-word}.document-head .meta{margin:0 0 10px}.document-head .tags{margin:0 0 14px}.document-head .summary{margin:0}.summary{font-size:17px;color:#505860;line-height:1.7}.meta{font-size:12px;color:var(--muted)}.document-body{font-size:17px;line-height:1.95;white-space:normal;padding:34px 0;word-break:keep-all;overflow-wrap:anywhere}.document-body p{margin:0 0 1em}.document-body ol,.document-body ul{margin:.7em 0 1.1em;padding-left:1.75em}.document-body a,.reference-links a{color:#135c9e;text-decoration:underline;text-underline-offset:3px}.reference-links{border-top:1px solid var(--line);padding-top:22px}.reference-links a{display:block;margin:9px 0}.video-frame{aspect-ratio:16/9;width:min(720px,100%);margin:25px auto}.video-frame iframe{width:100%;height:100%;border:0}.document-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:30px}.document-actions .share{margin-top:0}.share{border:1px solid #b9c2ca;background:#fff;color:var(--navy);padding:11px 17px;cursor:pointer;font:inherit;text-decoration:none}.share-status{font-size:13px;color:var(--muted);margin-left:8px}@media(max-width:620px){.document{padding-top:32px}.document-head h1{font-size:27px}.document-body{font-size:16px}}</style><script>(()=>{let requested=false;const load=()=>{if(window.LanguageBrainReadAloud){window.LanguageBrainReadAloud.initialize();return}if(requested)return;requested=true;const s=document.createElement('script');s.src='/customer/read-aloud.js?v=20261013-15';s.onload=()=>window.LanguageBrainReadAloud?.initialize();document.body.append(s)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();addEventListener('pageshow',load)})()</script></head><body><header class="site-header"><a href="/">리터러시 톡톡</a><nav><a href="/guides">자료 검색</a><a href="/">홈</a></nav></header><main><article id="document" class="document" data-public-linkify><header class="document-head"><p class="document-kicker">보조 자료실</p><h1>${escapeHtml(row.title)}</h1><p class="meta">작성 ${formatDate(row.created_at)} · 수정 ${formatDate(row.updated_at)} · 조회 ${Number(row.view_count || 0).toLocaleString()}</p><div class="tags">${tagMarkup}</div>${row.description ? `<p class="summary">${escapeHtml(row.description)}</p>` : ''}</header><div class="document-body reader-text-content" style="--reader-body-size:17px">${body}</div>${video}${links ? `<nav class="reference-links"><strong>관련 링크</strong>${links}</nav>` : ''}<div class="document-actions"><button class="share" type="button" aria-label="공유하기">공유하기</button><a class="share" href="/guides" data-list-return data-list-fallback="/guides">목록 보기</a><span class="share-status" aria-live="polite"></span></div></article></main><script src="/api/config"></script><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script><script>const share=document.querySelector('button.share'),status=document.querySelector('.share-status');share.addEventListener('click',async()=>{const data={title:${JSON.stringify(row.title).replace(/</g, '\\u003c')},text:${JSON.stringify(description).replace(/</g, '\\u003c')},url:location.href};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(location.href);status.textContent='링크가 복사되었습니다';setTimeout(()=>status.textContent='',2500)}}catch(error){if(error.name!=='AbortError')status.textContent=location.href}})</script><script src="/customer/list-return.js?v=20261013-1"></script><script src="/customer/public-links.js?v=20260914-1"></script><script src="/customer/reader-text-size.js?v=20260909-2"></script><script src="/customer/public-view-count.js?v=20260917-2"></script></body></html>`;
    response.setHeader('Cache-Control', isPublic ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600' : 'private, no-store');
    return response.status(200).send(html);
  } catch {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(503).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>자료를 불러올 수 없습니다</title><p>잠시 후 다시 시도해 주세요.</p>');
  }
}
