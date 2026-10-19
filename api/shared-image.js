import { authorizedSharedAsset, fetchPrivateSharedAsset, hasSharedAccessCookie } from './_shared.js';

const tokenPattern = /^[A-Za-z0-9_-]{40,64}$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') return response.status(405).end();
  const token = String(Array.isArray(request.query?.token) ? request.query.token[0] : request.query?.token || '');
  const assetId = String(Array.isArray(request.query?.asset) ? request.query.asset[0] : request.query?.asset || '');
  if (!tokenPattern.test(token) || !uuidPattern.test(assetId) || !hasSharedAccessCookie(request, token)) return response.status(404).end();
  try {
    const asset = await authorizedSharedAsset(token, assetId);
    if (!asset) return response.status(410).end();
    const source = await fetchPrivateSharedAsset(asset.storage_path);
    if (!source.ok) return response.status(404).end();
    response.setHeader('Content-Type', asset.mime_type);
    return response.status(200).send(Buffer.from(await source.arrayBuffer()));
  } catch {
    return response.status(503).end();
  }
}
