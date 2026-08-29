export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://languagebrain.vercel.app').replace(/\/$/, '');
export const SITE_NAME = '삶과 언어 | 권우진 연구실';
export const SITE_DESCRIPTION = '언어와 인지, 문해교육, 읽기와 쓰기, 뇌와 삶의 관계를 탐구하고 논문·뉴스·연구 원고를 소개하는 권우진의 연구 공간입니다.';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhaosgzyvoijgwryybry.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa';

export const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const stripHtml = value => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ').trim();

export const descriptionFor = post => {
  const text = stripHtml(post.excerpt || post.subtitle || post.content_html || '');
  return (text || SITE_DESCRIPTION).slice(0, 170);
};

export const publicArticleUrl = id => `${SITE_URL}/article?id=${encodeURIComponent(id)}`;

export async function supabaseRows(table, query) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return response.json();
}

export function xmlEscape(value) {
  return escapeHtml(value).replaceAll('&#39;', '&apos;');
}
