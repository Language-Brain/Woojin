import articleTemplate from './article-template.js';
import { SITE_DESCRIPTION, SITE_URL, descriptionFor, escapeHtml, publicArticleUrl, supabaseRows } from './_seo.js';

const TYPE_LABELS = { paper: '해외 연구 소개', news: '언어와 뇌 뉴스', works: '글과 해설' };

function safeContent(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

function normalizedTags(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map(tag => String(tag || '').trim().replace(/^#+\s*/, '')).filter(tag => {
    const key = tag.toLocaleLowerCase('ko-KR');
    if (!tag || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function shareMarkup() {
  return '<div class="share-area"><button class="share-button" type="button" aria-label="공유하기"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"></path></svg><span>공유하기</span></button><p class="share-status" role="status" aria-live="polite"></p><a class="share-fallback" hidden>주소 직접 열기</a></div>';
}

function secondImageFromContent(content) {
  const match = String(content || '').match(/<!--languagebrain-image-2:([^>]*)-->/);
  if (!match) return { url: '', alt: '' };
  try {
    const image = JSON.parse(decodeURIComponent(match[1]));
    return { url: String(image.url || ''), alt: String(image.alt || '') };
  } catch { return { url: '', alt: '' }; }
}

function articleImages(post) {
  const second = secondImageFromContent(post.content_html);
  return [
    { url: post.image_url, alt: post.image_alt || post.title },
    { url: second.url, alt: second.alt || post.title }
  ].filter(image => image.url);
}
function recommendedIdsFromContent(content) {
  const match = String(content || '').match(/<!--languagebrain-recommendations:([^>]*)-->/);
  if (!match) return [];
  try { return JSON.parse(decodeURIComponent(match[1])).filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5); }
  catch { return []; }
}

function renderRecommendations(rows) {
  if (!rows?.length) return '';
  return `<section class="recommendations" aria-labelledby="recommendations-heading"><h2 id="recommendations-heading">함께 읽으면 좋은 글</h2><ul>${rows.map(row => `<li><a href="${publicArticleUrl(row.id)}">${escapeHtml(row.title)}</a></li>`).join('')}</ul></section>`;
}
function renderArticle(post) {
  const type = TYPE_LABELS[post.type] || '연구 글';
  const body = post.content_html ? safeContent(post.content_html) : `<p>${escapeHtml(post.excerpt || '본문을 준비하고 있습니다.')}</p>`;
  const cleanTags = normalizedTags(post.tags);
  const tags = cleanTags.length ? `<div class="tags">${cleanTags.map(tag => `<a class="tag" href="/search?q=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join('')}</div>` : '';
  const images = articleImages(post);
  const gallery = images.length ? `<div class="hero-gallery ${images.length === 2 ? 'double' : 'single'}">${images.map(image => `<img class="hero" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" draggable="false">`).join('')}</div>` : '';
  const copyright = '<p class="copyright-notice">© 언어와 뇌. 무단 복제 및 재배포를 금합니다.</p>';
  const recommendations = renderRecommendations(post.recommendedPosts);
  return `<header class="article-head protected-content"><div class="wrap"><p class="eyebrow">${escapeHtml(type)}${post.category ? ` · ${escapeHtml(post.category)}` : ''}</p><h1>${escapeHtml(post.title)}</h1>${post.subtitle ? `<p class="subtitle">${escapeHtml(post.subtitle)}</p>` : ''}${post.excerpt ? `<p class="excerpt">${escapeHtml(post.excerpt)}</p>` : ''}<div class="meta"><time datetime="${escapeHtml(post.article_date || post.published_at || '')}">${escapeHtml(post.article_date || post.published_at || '')}</time><span>최근 수정 ${escapeHtml(new Date(post.updated_at).toLocaleDateString('ko-KR'))}</span></div>${gallery}</div></header><article class="wrap article-body protected-content">${body}${tags}${copyright}${recommendations}${shareMarkup()}</article>`;
}

export default async function handler(request, response) {
  const rawId = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const id = String(rawId || '');
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(400).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>잘못된 글 주소</title><p>글 주소가 올바르지 않습니다.</p>');
  }
  try {
    const [post] = await supabaseRows('posts', `select=*&id=eq.${encodeURIComponent(id)}&status=eq.published&type=in.(paper,news,works)&limit=1`);
    if (!post) {
      response.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return response.status(404).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>글을 찾을 수 없습니다</title><p>비공개 상태이거나 존재하지 않는 글입니다.</p>');
    }
    const recommendationIds = recommendedIdsFromContent(post.content_html);
    let recommendedPosts = [];
    if (recommendationIds.length) {
      const rows = await supabaseRows('posts', `select=id,title,status&id=in.(${recommendationIds.join(',')})&status=eq.published`);
      const byId = new Map(rows.map(row => [row.id, row]));
      recommendedPosts = recommendationIds.map(id => byId.get(id)).filter(Boolean);
    }
    post.recommendedPosts = recommendedPosts;
    let html = articleTemplate;
    const canonical = publicArticleUrl(post.id);
    const description = descriptionFor(post);
    const image = post.image_url || `${SITE_URL}/og-image.webp`;
    const seoTags = normalizedTags(post.tags);
    const schema = {
      '@context': 'https://schema.org',
      '@type': post.type === 'paper' ? 'Article' : 'BlogPosting',
      headline: post.title,
      description,
      url: canonical,
      mainEntityOfPage: canonical,
      inLanguage: 'ko-KR',
      datePublished: post.published_at || undefined,
      dateModified: post.updated_at || post.published_at || undefined,
      keywords: seoTags.length ? seoTags : undefined,
      author: { '@type': 'Person', name: '권우진', url: `${SITE_URL}/#about` },
      publisher: { '@type': 'Organization', name: '언어와 뇌 | 권우진 연구실', url: `${SITE_URL}/` },
      image: image ? [image] : undefined
    };
    const articleTags = seoTags.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('');
    const head = `<link rel="canonical" href="${escapeHtml(canonical)}"><meta name="robots" content="index, follow, max-image-preview:large"><meta property="og:type" content="article"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="언어와 뇌"><meta property="og:title" content="${escapeHtml(post.title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}">${articleTags}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(post.title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(post.title)} | 언어와 뇌</title>`)
      .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`)
      .replace('</head>', `${head}</head>`)
      .replace(/<main id="article">[\s\S]*?<\/main>/i, `<main id="article">${renderArticle(post)}</main>`)
      .replaceAll('href="/customer"', 'href="/"');
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
    return response.status(200).send(html);
  } catch {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return response.status(503).send('<!doctype html><html lang="ko"><meta charset="utf-8"><title>글을 불러올 수 없습니다</title><p>잠시 후 다시 시도해 주세요.</p>');
  }
}
