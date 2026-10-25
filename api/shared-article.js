import crypto from 'node:crypto';
import articleTemplate from './article-template.js';
import { renderArticle } from './article.js';
import { escapeHtml, supabaseRpc } from './_seo.js';
import { authorizedSharedPost, hasSharedAccessCookie, protectSharedImages, setSharedAccessCookie } from './_shared.js';

const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/;

function clientKey(request, token) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const agent = String(request.headers['user-agent'] || '').slice(0, 180);
  return crypto.createHash('sha256').update(`${forwarded}|${agent}|${token}`).digest('hex');
}

function passwordFrom(request) {
  if (request.method !== 'POST') return '';
  if (request.body && typeof request.body === 'object') return String(request.body.password || '');
  return new URLSearchParams(String(request.body || '')).get('password') || '';
}

function messagePage(title, message, status = 404) {
  return { status, html: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)} | 리터러시 톡톡</title><style>body{margin:0;background:#fbfaf7;color:#172033;font-family:"Nanum Gothic","Malgun Gothic",sans-serif}.shared-state{width:min(620px,calc(100% - 40px));margin:12vh auto;padding:38px;background:#fff;border:1px solid #dce0e4}.shared-state h1{font-size:25px}.shared-state p{color:#68717d;line-height:1.8}.shared-state input{width:100%;padding:11px;border:1px solid #c8cdd3}.shared-state button{margin-top:12px;padding:10px 18px;border:0;background:#173e70;color:#fff;font-weight:700}</style></head><body><main class="shared-state"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>` };
}

function passwordPage(token, error = '') {
  const notice = error ? `<p role="alert">${escapeHtml(error)}</p>` : '<p>공유자가 설정한 접근 암호를 입력해 주세요.</p>';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>공유 문서 암호 입력 | 리터러시 톡톡</title><style>body{margin:0;background:#fbfaf7;color:#172033;font-family:"Nanum Gothic","Malgun Gothic",sans-serif}.shared-state{width:min(520px,calc(100% - 40px));margin:12vh auto;padding:38px;background:#fff;border:1px solid #dce0e4}.shared-state h1{font-size:25px}.shared-state p{color:#68717d;line-height:1.8}.shared-state input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #c8cdd3}.shared-state button{margin-top:12px;padding:10px 18px;border:0;background:#173e70;color:#fff;font-weight:700}</style></head><body><main class="shared-state"><h1>링크로 공유된 문서입니다.</h1>${notice}<form method="post" action="/shared/article?token=${encodeURIComponent(token)}"><label for="shared-password">접근 암호</label><input id="shared-password" name="password" type="password" autocomplete="current-password" minlength="6" maxlength="128" required><button type="submit">문서 열기</button></form></main></body></html>`;
}

function renderShared(post) {
  let html = articleTemplate;
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(post.title)} | 공유 문서 · 리터러시 톡톡</title>`)
    .replace(/<meta name="description"[^>]*>/i, '<meta name="description" content="링크로 공유된 문서입니다.">')
    .replace('</head>', '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><style>.shared-document-notice{display:inline-block;margin:0 0 14px;padding:5px 9px;background:#f0f3e3;color:#465124;font-size:12px;font-weight:700}.article-body .ql-size-small{font-size:max(.8em,14px);line-height:1.75}@media print{.shared-document-notice{display:none}}</style><link rel="stylesheet" href="/customer/article-lightbox.css?v=20260831-3"><link rel="stylesheet" href="/customer/reader-text-size.css?v=20260909-3"><link rel="stylesheet" href="/customer/read-aloud.css?v=20261013-15"></head>')
    .replace(/<main id="article">[\s\S]*?<\/main>/i, `<main id="article">${renderArticle({ ...post, recommendedPosts: [] }, { shared: true })}</main>`)
    .replace('      load();', "      if(!document.querySelector('#article [data-server-rendered]'))load();")
    .replace('</body>', '<dialog id="image-lightbox" class="image-lightbox" aria-label="확대 이미지"><div class="image-lightbox-inner"><button class="image-lightbox-close" type="button" aria-label="확대 이미지 닫기">×</button><img class="image-lightbox-image" alt=""></div></dialog><script src="/customer/public-links.js?v=20260914-1"></script><script src="/customer/article-lightbox.js?v=20260831-3"></script><script src="/customer/reader-text-size.js?v=20260909-2"></script><script src="/customer/read-aloud.js?v=20261015-16"></script></body>')
    .replaceAll('href="/customer"', 'href="/"');
  return html;
}

export default async function handler(request, response) {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "frame-ancestors 'self'");

  if (!['GET', 'POST'].includes(request.method)) return response.status(405).send('Method Not Allowed');
  const rawToken = Array.isArray(request.query?.token) ? request.query.token[0] : request.query?.token;
  const token = String(rawToken || '');
  if (!tokenPattern.test(token)) {
    const page = messagePage('공유 문서를 찾을 수 없습니다', '공유 주소가 올바르지 않습니다.');
    return response.status(page.status).send(page.html);
  }

  try {
    if (hasSharedAccessCookie(request, token)) {
      const continuedPost = await authorizedSharedPost(token);
      if (continuedPost) {
        const protectedPost = await protectSharedImages(continuedPost, token);
        return response.status(200).send(renderShared(protectedPost));
      }
    }
    const result = await supabaseRpc('resolve_shared_post', {
      supplied_token: token,
      supplied_password: passwordFrom(request),
      supplied_client_key: clientKey(request, token)
    });
    if (result?.code === 'ok' && result.post) {
      setSharedAccessCookie(response, token);
      const protectedPost = await protectSharedImages(result.post, token);
      return response.status(200).send(renderShared(protectedPost));
    }
    if (result?.code === 'password_required') return response.status(200).send(passwordPage(token));
    if (result?.code === 'wrong_password') return response.status(401).send(passwordPage(token, '암호가 올바르지 않습니다. 다시 확인해 주세요.'));
    if (result?.code === 'rate_limited') {
      response.setHeader('Retry-After', '900');
      const page = messagePage('잠시 후 다시 시도해 주세요', '암호 입력 횟수가 많아 15분 동안 문서 열기가 제한되었습니다.', 429);
      return response.status(page.status).send(page.html);
    }
    if (result?.code === 'stopped') {
      const page = messagePage('공유 종료', '공유가 종료된 문서입니다.', 410);
      return response.status(page.status).send(page.html);
    }
    const page = messagePage('공유 문서를 찾을 수 없습니다', '공유 주소가 올바르지 않거나 더 이상 사용할 수 없습니다.');
    return response.status(page.status).send(page.html);
  } catch {
    const page = messagePage('문서를 열 수 없습니다', '잠시 후 다시 시도해 주세요.', 503);
    return response.status(page.status).send(page.html);
  }
}
