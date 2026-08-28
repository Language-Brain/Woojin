(() => {
  const PAGE_SIZE = 20;
  const topButton = document.querySelector('#new-pyeongjae');
  const bottomButton = document.querySelector('#new-pyeongjae-bottom');
  const table = document.querySelector('#pj-table');
  const tableWrap = table?.closest('.table-wrap');
  const filterBar = document.querySelector('#pj-book-filter')?.closest('.filter-bar');
  if (!table || !tableWrap || !filterBar) return;

  if (topButton && bottomButton) bottomButton.addEventListener('click', () => topButton.click());

  const tabs = document.createElement('div');
  tabs.id = 'pj-admin-book-tabs';
  tabs.className = 'pj-admin-book-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '평재문집 책 선택');
  tabs.innerHTML = '<button class="active" data-pj-book="all" type="button">전체</button><button data-pj-book="1" type="button">제1책</button><button data-pj-book="2" type="button">제2책</button><button data-pj-book="3" type="button">제3책</button>';
  filterBar.before(tabs);

  const pagebar = document.createElement('div');
  pagebar.className = 'pj-admin-pagebar';
  pagebar.innerHTML = '<span id="pj-admin-page-state">1쪽</span><nav id="pj-admin-pagination" class="pj-admin-pagination" aria-label="관리자 평재문집 페이지"></nav>';
  tableWrap.after(pagebar);

  const bookFilter = document.querySelector('#pj-book-filter');
  const pagination = pagebar.querySelector('#pj-admin-pagination');
  const pageState = pagebar.querySelector('#pj-admin-page-state');
  const config = window.LANGUAGE_BRAIN_CONFIG;
  const client = config?.supabaseUrl && config?.supabasePublishableKey && window.supabase
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
  const faceOrder = value => value === 'back' ? 1 : 0;
  const compare = (a, b) => Number(a.book_no) - Number(b.book_no)
    || Number(a.sheet_no ?? a.start_page) - Number(b.sheet_no ?? b.start_page)
    || faceOrder(a.side) - faceOrder(b.side);
  let ordinals = new Map();
  let currentPage = 1;
  let decorating = false;

  function buttons(totalPages) {
    const values = [];
    if (currentPage > 1) values.push(['이전', currentPage - 1]);
    for (let number = 1; number <= totalPages; number += 1) {
      if (totalPages <= 5 || number === 1 || number === totalPages || Math.abs(number - currentPage) <= 1) {
        values.push([String(number), number]);
      }
    }
    if (currentPage < totalPages) values.push(['다음', currentPage + 1]);
    pagination.innerHTML = values.map(([label, value]) => `<button class="${value === currentPage ? 'active' : ''}" data-page="${value}" type="button">${label}</button>`).join('');
  }

  function decorate() {
    if (decorating) return;
    decorating = true;
    const rows = [...table.querySelectorAll('tr[data-pj-id]')];
    rows.forEach(row => {
      let cell = row.querySelector('.pj-sequence');
      if (!cell) {
        cell = document.createElement('td');
        cell.className = 'pj-sequence';
        cell.title = '전체 공개 자료 순차 번호';
        row.prepend(cell);
      }
      cell.textContent = ordinals.get(row.dataset.pjId) ?? '—';
    });
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    rows.forEach((row, index) => { row.hidden = index < (currentPage - 1) * PAGE_SIZE || index >= currentPage * PAGE_SIZE; });
    pageState.textContent = `${currentPage}/${totalPages}쪽 · 현재 결과 ${rows.length}건`;
    buttons(totalPages);
    decorating = false;
  }

  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-pj-book]');
    if (!button) return;
    tabs.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
    bookFilter.value = button.dataset.pjBook;
    currentPage = 1;
    bookFilter.dispatchEvent(new Event('change', { bubbles: true }));
  });
  bookFilter.addEventListener('change', () => {
    tabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.pjBook === bookFilter.value));
    currentPage = 1;
    queueMicrotask(decorate);
  });
  pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    currentPage = Number(button.dataset.page);
    decorate();
    filterBar.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  ['#pj-search', '#pj-genre-filter', '#pj-review-filter', '#pj-filter', '#pj-sort'].forEach(selector => {
    document.querySelector(selector)?.addEventListener(selector === '#pj-search' ? 'input' : 'change', () => {
      currentPage = 1;
      queueMicrotask(decorate);
    });
  });
  new MutationObserver(decorate).observe(table, { childList: true });
  if (client) client.from('pyeongjae_entries').select('id,book_no,sheet_no,start_page,side')
    .eq('status', 'published').then(({ data }) => {
      ordinals = new Map((data || []).sort(compare).map((row, index) => [row.id, index + 1]));
      decorate();
    }).catch(() => decorate());
  else decorate();
})();
