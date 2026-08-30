(() => {
  'use strict';
  const SUPABASE_URL = 'https://vhaosgzyvoijgwryybry.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa';
  const PAGE_SIZE = 20;
  const list = document.querySelector('#list');
  const query = document.querySelector('#query');
  const params = new URLSearchParams(location.search);
  let rows = [];
  let book = ['1', '2', '3'].includes(params.get('book')) ? params.get('book') : '';
  let genre = params.get('genre') || '';
  let page = 1;
  query.value = params.get('q') || '';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const plainPage = value => [value?.original_reading, value?.literal_translation, value?.interpretive_translation, value?.notes].join(' ');
  const faceOrder = value => value === 'back' ? 1 : 0;
  const priorityRank = row => String(row?.title || '').trimStart().startsWith('○') ? 0 : String(row?.title || '').trimStart().startsWith('#') ? 1 : 2;
  const isPriority = row => priorityRank(row) < 2;
  const createdTime = row => Date.parse(row?.created_at || row?.published_at || row?.updated_at || '') || 0;
  const compare = (a, b) => priorityRank(a) - priorityRank(b)
    || (isPriority(a) && isPriority(b) ? createdTime(a) - createdTime(b) : 0)
    || Number(a.book_no) - Number(b.book_no)
    || Number(a.sheet_no ?? a.start_page) - Number(b.sheet_no ?? b.start_page)
    || faceOrder(a.side) - faceOrder(b.side);

  async function fetchRows() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pyeongjae_entries?select=*&status=eq.published&limit=1000`, {
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}`, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`평재문집 요청 실패 (${response.status})`);
    return response.json();
  }

  function updateUrl() {
    const next = new URL(location.href);
    query.value.trim() ? next.searchParams.set('q', query.value.trim()) : next.searchParams.delete('q');
    book ? next.searchParams.set('book', book) : next.searchParams.delete('book');
    genre ? next.searchParams.set('genre', genre) : next.searchParams.delete('genre');
    history.replaceState({ book, genre, q: query.value.trim() }, '', next);
  }

  function pagination(total) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, pages);
    document.querySelector('#page-state').textContent = `${page}/${pages}쪽 · 전체 ${total}건`;
    const values = [];
    if (page > 1) values.push(['이전', page - 1]);
    for (let number = 1; number <= pages; number += 1) {
      if (pages <= 5 || number === 1 || number === pages || Math.abs(number - page) <= 1) values.push([String(number), number]);
    }
    if (page < pages) values.push(['다음', page + 1]);
    document.querySelector('#pagination').innerHTML = values.map(([label, value]) => `<button class="${value === page ? 'active' : ''}" data-page="${value}" type="button">${label}</button>`).join('');
  }

  function render() {
    updateUrl();
    const needle = query.value.trim().toLocaleLowerCase('ko-KR');
    const ordered = [...rows].sort(compare);
    const ordinals = new Map(ordered.filter(row => !isPriority(row)).map((row, index) => [row.id, index + 1]));
    const found = ordered.filter(row => (!book || String(row.book_no) === book)
      && (!genre || row.genre === genre)
      && (!needle || [row.title, row.genre, row.volume_no, row.sheet_no, ...(Array.isArray(row.tags) ? row.tags : []), ...(Array.isArray(row.pages) ? row.pages.map(plainPage) : [])].join(' ').toLocaleLowerCase('ko-KR').includes(needle)));
    pagination(found.length);
    const shown = found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    document.querySelector('#count').textContent = `검색 결과 ${found.length}건`;
    list.innerHTML = shown.length ? shown.map(row => { const number = ordinals.get(row.id); return `<a class="entry-row face-row${number ? '' : ' priority-row'}" href="/pyeongjae-entry?id=${encodeURIComponent(row.id)}">${number ? `<span class="face-number" aria-label="전체 평재문집 순차 번호 ${number}">${number}</span>` : ''}<strong class="face-title">${esc(row.title)}</strong><span class="face-meta">${row.volume_no ? `권${row.volume_no}` : '권차 미확인'} · ${esc(row.genre || '종류 미확인')} · 조회 ${Number(row.view_count || 0).toLocaleString()}</span></a>` }).join('') : '<p class="empty">조건에 맞는 공개 자료가 없습니다.</p>';
  }

  function resetRender() { page = 1; render(); }
  function showError(error) {
    console.error('평재문집 목록 초기화 실패', error);
    document.querySelector('#count').textContent = '자료를 불러오지 못했습니다.';
    document.querySelector('#page-state').textContent = '';
    list.innerHTML = '<div class="route-error" role="alert"><strong>평재문집 목록을 불러오지 못했습니다.</strong><p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p><div><button id="retry-pyeongjae" type="button">다시 시도</button><a href="/">홈으로</a></div></div>';
    document.querySelector('#retry-pyeongjae')?.addEventListener('click', load, { once: true });
  }
  async function load() {
    list.innerHTML = '<p class="empty">자료를 불러오고 있습니다.</p>';
    try { rows = await fetchRows(); render(); } catch (error) { showError(error); }
  }

  document.querySelectorAll('[data-book]').forEach(button => {
    button.classList.toggle('active', button.dataset.book === book);
    button.addEventListener('click', () => {
      book = button.dataset.book;
      document.querySelectorAll('[data-book]').forEach(item => item.classList.toggle('active', item === button));
      resetRender();
    });
  });
  document.querySelectorAll('[data-genre]').forEach(button => {
    button.classList.toggle('active', button.dataset.genre === genre);
    button.addEventListener('click', () => {
      genre = button.dataset.genre;
      document.querySelectorAll('[data-genre]').forEach(item => item.classList.toggle('active', item === button));
      resetRender();
    });
  });
  document.querySelector('#pagination').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    page = Number(button.dataset.page);
    render();
    document.querySelector('.result-head').scrollIntoView({ behavior: 'smooth' });
  });
  query.addEventListener('input', resetRender);
  document.querySelector('#intro-toggle').addEventListener('click', event => {
    const more = document.querySelector('#intro-more');
    const open = more.hidden;
    more.hidden = !open;
    event.currentTarget.textContent = open ? '소개 접기' : '소개 더 보기';
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  addEventListener('pageshow', event => { if (event.persisted) render(); });
  load();
})();
