(() => {
  'use strict';
  const config = window.LANGUAGE_BRAIN_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase) return;
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) return;

  function visitor() {
    let value = '';
    try { value = localStorage.getItem('language-brain-visitor') || ''; } catch {}
    if (value) return value;
    value = globalThis.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem('language-brain-visitor', value); } catch {}
    return value;
  }

  async function recordArticle() {
    const { error } = await db.rpc('record_post_view', { target_post: id, visitor: visitor() });
    if (error) console.warn('조회수를 기록하지 못했습니다.', error.message);
  }

  async function recordGuide() {
    const token = params.get('token') || null;
    const { data: counted, error } = await db.rpc('increment_guide_view', { p_guide_id: id, p_token: token, p_viewer: visitor() });
    if (error) return console.warn('조회수를 기록하지 못했습니다.', error.message);
    if (!counted) return;
    const { data } = await db.from('guides').select('view_count').eq('id', id).maybeSingle();
    const meta = document.querySelector('.document-head .meta');
    if (meta && data) meta.textContent = meta.textContent.replace(/조회\s+[\d,]+/, `조회 ${Number(data.view_count || 0).toLocaleString()}`);
  }

  async function recordPyeongjae() {
    let value = '';
    try { value = localStorage.getItem('pj-viewer') || ''; } catch {}
    if (!value) {
      value = visitor();
      try { localStorage.setItem('pj-viewer', value); } catch {}
    }
    const { error } = await db.rpc('increment_pyeongjae_view', { p_entry_id: id, p_viewer: value });
    if (error) console.warn('조회수를 기록하지 못했습니다.', error.message);
  }

  if (location.pathname === '/guide') recordGuide().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
  if (location.pathname === '/article') recordArticle().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
  if (location.pathname === '/pyeongjae-entry') recordPyeongjae().catch(error => console.warn('조회수를 기록하지 못했습니다.', error));
})();
