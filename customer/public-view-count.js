(() => {
  'use strict';
  const config = window.LANGUAGE_BRAIN_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase) return;
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) return;

  const pageKey = `${location.pathname}:${id}`;
  const recordedPages = globalThis.__languageBrainRecordedPageViews ||= new Set();
  if (recordedPages.has(pageKey)) return;
  recordedPages.add(pageKey);

  async function recordArticle() {
    const { error } = await db.rpc('record_post_view', { target_post: id, visitor: 'public-page-open' });
    if (error) console.warn('조회수를 기록하지 못했습니다.', error.message);
  }

  async function recordGuide() {
    const token = params.get('token') || null;
    const { data: counted, error } = await db.rpc('increment_guide_view', { p_guide_id: id, p_token: token, p_viewer: 'public-page-open' });
    if (error) return console.warn('조회수를 기록하지 못했습니다.', error.message);
    if (!counted) return;
    const { data } = await db.from('guides').select('view_count').eq('id', id).maybeSingle();
    const meta = document.querySelector('.document-head .meta');
    if (meta && data) meta.textContent = meta.textContent.replace(/조회\s+[\d,]+/, `조회 ${Number(data.view_count || 0).toLocaleString()}`);
  }

  async function recordPyeongjae() {
    const { error } = await db.rpc('increment_pyeongjae_view', { p_entry_id: id, p_viewer: 'public-page-open' });
    if (error) console.warn('조회수를 기록하지 못했습니다.', error.message);
  }

  if (location.pathname === '/guide') recordGuide().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
  if (location.pathname === '/article') recordArticle().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
  if (location.pathname === '/pyeongjae-entry') recordPyeongjae().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
})();
