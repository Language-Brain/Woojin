export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://languagebrain.vercel.app').replace(/\/$/, '');
export const SITE_NAME = '삶과 언어 | 권우진 연구실';
export const SITE_DESCRIPTION = '삶과 언어는 문해, 인지, 한국어 교육(KSL, KFL)을 중심으로 논문, 관련 기사와 연구 원고를 소개하는 권우진의 연구 공간입니다.';

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

const naturalDescription = (value, max = 165) => {
  const text = stripHtml(value).replace(/[#*_`>|~]+/g, ' ').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const sample = text.slice(0, max + 1);
  let cut = Math.max(sample.lastIndexOf('다. '), sample.lastIndexOf('요. '), sample.lastIndexOf('. '), sample.lastIndexOf('。'));
  if (cut >= 95) cut += sample.slice(cut, cut + 3).startsWith('다. ') || sample.slice(cut, cut + 3).startsWith('요. ') ? 2 : 1;
  else cut = sample.lastIndexOf(' ');
  if (cut < 95) cut = max;
  return `${sample.slice(0, cut).trim()}…`;
};

const meaningfulBodyText = (value, post = {}) => {
  const html = String(value || '');
  const metadata = [post.title, post.original_title, post.authors, post.journal, post.source, post.publisher]
    .map(item => stripHtml(item).toLocaleLowerCase('ko-KR')).filter(Boolean);
  const isMetadata = text => {
    const normalized = text.toLocaleLowerCase('ko-KR');
    return metadata.includes(normalized)
      || /^(?:○|출처|자료|저자|게재|발행|doi\b|https?\b|www\.|wiley online library|pubmed)\s*[:：]?/i.test(text)
      || /^\d{4}년.*(?:게재|발행|공개)/.test(text)
      || /^\S+(?:\s+\S+){0,8}\s*\(\d{4}\)[.,]/.test(text)
      || /^[「『].*[」』]$/.test(text)
      || /^[A-Za-z][^.!?]{10,120}$/.test(text)
      || /^[\p{L} .'-]+(?:,\s*[\p{L} .'-]+)+$/u.test(text);
  };
  const blocks = [...html.matchAll(/<(?:p|li|blockquote)\b[^>]*>([\s\S]*?)<\/(?:p|li|blockquote)>/gi)]
    .map(match => stripHtml(match[1]))
    .filter(text => text.length >= 5 && !isMetadata(text));
  if (!blocks.length) return stripHtml(html);
  let text = blocks[0];
  for (let index = 1; text.length < 110 && index < blocks.length; index += 1) text += ` ${blocks[index]}`;
  return text;
};

export const descriptionFor = post => naturalDescription(
  post.seo_description || post.excerpt || meaningfulBodyText(post.content_html, post) || post.subtitle || SITE_DESCRIPTION
);

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
