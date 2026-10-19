import crypto from 'node:crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhaosgzyvoijgwryybry.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const publicImagePattern = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/post-images\/(.+)$/i;

const serviceHeaders = extra => ({ apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra });
const encodePath = value => String(value).split('/').map(encodeURIComponent).join('/');

export function sharedServiceAvailable() { return Boolean(SERVICE_KEY); }

export function accessCookieValue(token) {
  const signature = crypto.createHmac('sha256', SERVICE_KEY).update(token).digest('base64url');
  return `${crypto.createHash('sha256').update(token).digest('base64url')}.${signature}`;
}

export function setSharedAccessCookie(response, token) {
  response.setHeader('Set-Cookie', `lb_shared_access=${accessCookieValue(token)}; Max-Age=28800; Path=/shared; HttpOnly; Secure; SameSite=Strict`);
}

export function hasSharedAccessCookie(request, token) {
  const raw = String(request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('lb_shared_access='));
  if (!raw || !SERVICE_KEY) return false;
  const supplied = raw.slice(raw.indexOf('=') + 1);
  const expected = accessCookieValue(token);
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function serviceRows(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: serviceHeaders() });
  if (!response.ok) throw new Error(`shared_service_${response.status}`);
  return response.json();
}

async function serviceInsert(table, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: serviceHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`shared_insert_${response.status}`);
  return response.json();
}

function sharedSourceUrls(post) {
  const values = new Set();
  if (publicImagePattern.test(String(post.image_url || ''))) values.add(post.image_url);
  for (const match of String(post.content_html || '').matchAll(/https:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/post-images\/[^\s"'<>]+/gi)) {
    if (publicImagePattern.test(match[0])) values.add(match[0]);
  }
  return [...values];
}

async function assetFor(postId, sourceUrl) {
  const query = `select=id,storage_path,mime_type&post_id=eq.${encodeURIComponent(postId)}&source_url=eq.${encodeURIComponent(sourceUrl)}&limit=1`;
  const existing = await serviceRows('post_shared_assets', query);
  if (existing[0]) return existing[0];
  const source = await fetch(sourceUrl, { redirect: 'error' });
  if (!source.ok) throw new Error('shared_source_image_unavailable');
  const mime = String(source.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) throw new Error('shared_source_image_invalid');
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[mime];
  const storagePath = `${postId}/${crypto.randomUUID()}.${extension}`;
  const bytes = await source.arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('shared_source_image_too_large');
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/shared-post-images/${encodePath(storagePath)}`, {
    method: 'POST', headers: serviceHeaders({ 'Content-Type': mime, 'x-upsert': 'false' }), body: bytes
  });
  if (!upload.ok) throw new Error(`shared_image_upload_${upload.status}`);
  const [created] = await serviceInsert('post_shared_assets', { post_id: postId, source_url: sourceUrl, storage_path: storagePath, mime_type: mime });
  return created;
}

export async function protectSharedImages(post, token) {
  const sourceUrls = sharedSourceUrls(post);
  if (!sourceUrls.length) return post;
  if (!SERVICE_KEY) throw new Error('shared_service_not_configured');
  const replacements = new Map();
  for (const sourceUrl of sourceUrls) {
    const asset = await assetFor(post.id, sourceUrl);
    replacements.set(sourceUrl, `/shared/image?token=${encodeURIComponent(token)}&asset=${encodeURIComponent(asset.id)}`);
  }
  let content = String(post.content_html || '');
  for (const [source, proxy] of replacements) content = content.split(source).join(proxy);
  return { ...post, image_url: replacements.get(post.image_url) || post.image_url, content_html: content };
}

export async function authorizedSharedAsset(token, assetId) {
  if (!SERVICE_KEY) return null;
  const shares = await serviceRows('post_shares', `select=post_id,enabled&token_value=eq.${encodeURIComponent(token)}&limit=1`);
  const share = shares[0];
  if (!share?.enabled) return null;
  const posts = await serviceRows('posts', `select=id,status&id=eq.${encodeURIComponent(share.post_id)}&status=eq.shared&limit=1`);
  if (!posts[0]) return null;
  const assets = await serviceRows('post_shared_assets', `select=id,post_id,storage_path,mime_type&id=eq.${encodeURIComponent(assetId)}&post_id=eq.${encodeURIComponent(share.post_id)}&limit=1`);
  return assets[0] || null;
}

export async function fetchPrivateSharedAsset(path) {
  return fetch(`${SUPABASE_URL}/storage/v1/object/shared-post-images/${encodePath(path)}`, { headers: serviceHeaders() });
}
