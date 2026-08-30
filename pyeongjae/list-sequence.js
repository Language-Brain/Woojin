(() => {
  const config = window.LANGUAGE_BRAIN_CONFIG;
  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !window.supabase) return;
  const client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const faceOrder = value => value === 'back' ? 1 : 0;
  const priorityRank = row => String(row?.title || '').trimStart().startsWith('○') ? 0 : String(row?.title || '').trimStart().startsWith('#') ? 1 : 2;
  const isPriority = row => priorityRank(row) < 2;
  const createdTime = row => Date.parse(row?.created_at || row?.published_at || row?.updated_at || '') || 0;
  const compare = (a, b) => priorityRank(a) - priorityRank(b)
    || (isPriority(a) && isPriority(b) ? createdTime(a) - createdTime(b) : 0)
    || Number(a.book_no) - Number(b.book_no)
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
  client.from('pyeongjae_entries').select('id,book_no,sheet_no,start_page,side,title,created_at,published_at,updated_at')
    .eq('status', 'published').then(({ data }) => {
      ordinals = new Map((data || []).sort(compare).filter(row => !isPriority(row)).map((row, index) => [row.id, index + 1]));
      decorate();
    });
})();
