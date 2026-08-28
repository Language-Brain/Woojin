(() => {
  const topButton = document.querySelector('#new-pyeongjae');
  const bottomButton = document.querySelector('#new-pyeongjae-bottom');
  if (topButton && bottomButton) bottomButton.addEventListener('click', () => topButton.click());
  const table = document.querySelector('#pj-table');
  const config = window.LANGUAGE_BRAIN_CONFIG;
  if (!table || !config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase) return;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const faceOrder = value => value === 'back' ? 1 : 0;
  const compare = (a, b) => Number(a.book_no) - Number(b.book_no)
    || Number(a.sheet_no ?? a.start_page) - Number(b.sheet_no ?? b.start_page)
    || faceOrder(a.side) - faceOrder(b.side);
  let ordinals = new Map();
  let decorating = false;
  const decorate = () => {
    if (decorating) return;
    decorating = true;
    table.querySelectorAll('tr[data-pj-id]').forEach(row => {
      let cell = row.querySelector('.pj-sequence');
      if (!cell) {
        cell = document.createElement('td');
        cell.className = 'pj-sequence';
        cell.title = '전체 공개 자료 순차 번호';
        row.prepend(cell);
      }
      cell.textContent = ordinals.get(row.dataset.pjId) ?? '—';
    });
    decorating = false;
  };
  new MutationObserver(decorate).observe(table, { childList: true });
  client.from('pyeongjae_entries').select('id,book_no,sheet_no,start_page,side')
    .eq('status', 'published').then(({ data }) => {
      ordinals = new Map((data || []).sort(compare).map((row, index) => [row.id, index + 1]));
      decorate();
    });
})();
