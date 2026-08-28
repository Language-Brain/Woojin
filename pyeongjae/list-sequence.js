(() => {
  const config = window.LANGUAGE_BRAIN_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase) return;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const faceOrder = value => value === 'back' ? 1 : 0;
  const compare = (a, b) => Number(a.book_no) - Number(b.book_no)
    || Number(a.sheet_no ?? a.start_page) - Number(b.sheet_no ?? b.start_page)
    || faceOrder(a.side) - faceOrder(b.side);
  let ordinals = new Map();
  let decorating = false;
  const idFrom = link => {
    try { return new URL(link.href, location.origin).searchParams.get('id'); } catch { return null; }
  };
  const decorate = () => {
    if (decorating) return;
    decorating = true;
    document.querySelectorAll('a[href*="/pyeongjae-entry?id="]').forEach(link => {
      const number = ordinals.get(idFrom(link));
      if (!number) return;
      if (link.classList.contains('face-row')) {
        let badge = link.querySelector('.face-number');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'face-number';
          link.prepend(badge);
        }
        badge.textContent = number;
        badge.setAttribute('aria-label', `전체 평재문집 순차 번호 ${number}`);
      } else {
        const title = link.querySelector('h2, h3, strong');
        if (title && !title.dataset.pjSequence) {
          title.textContent = `${number} — ${title.textContent}`;
          title.dataset.pjSequence = String(number);
        }
      }
    });
    decorating = false;
  };
  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  client.from('pyeongjae_entries').select('id,book_no,sheet_no,start_page,side')
    .eq('status', 'published').then(({ data }) => {
      ordinals = new Map((data || []).sort(compare).map((row, index) => [row.id, index + 1]));
      decorate();
    });
})();
