(() => {
  'use strict';
  const SUPABASE_URL = 'https://vhaosgzyvoijgwryybry.supabase.co';
  const PUBLIC_KEY = 'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa';
  const params = new URLSearchParams(location.search);
  const input = document.querySelector('#q');
  const list = document.querySelector('#result-list');
  const count = document.querySelector('#result-count');
  const validScopes = new Set(['all', 'pyeongjae', 'other']);
  let scope = validScopes.has(params.get('scope')) ? params.get('scope') : 'all';
  input.value = params.get('q') || '';

  const safe = value => String(value || '').replace(/[,%()]/g, ' ').trim().slice(0, 100);
  const date = value => value ? new Date(value).toLocaleDateString('ko-KR') : '-';
  const faceOrder = value => value === 'back' ? 1 : 0;
  const compare = (a, b) => Number(a.book_no) - Number(b.book_no)
    || Number(a.sheet_no ?? a.start_page) - Number(b.sheet_no ?? b.start_page)
    || faceOrder(a.side) - faceOrder(b.side);
  const needle = () => safe(input.value).toLocaleLowerCase('ko-KR');
  const match = haystack => !needle() || String(haystack || '').toLocaleLowerCase('ko-KR').includes(needle());

  async function rest(table, query) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}`, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`${table} 요청 실패 (${response.status})`);
    return response.json();
  }

  function item({ href, title, description, tags, meta, number }) {
    const link = document.createElement('a');
    link.className = 'result';
    link.href = href;
    const heading = document.createElement('h3');
    const text = document.createElement('p');
    const info = document.createElement('span');
    const tagBox = document.createElement('div');
    if (number) {
      const sequence = document.createElement('b');
      sequence.className = 'result-sequence';
      sequence.textContent = number;
      heading.append(sequence);
    }
    heading.append(document.createTextNode(title));
    text.textContent = description || '';
    info.textContent = meta;
    tagBox.className = 'tags';
    (Array.isArray(tags) ? tags : []).forEach(value => {
      const tag = document.createElement('i');
      tag.textContent = '#' + value;
      tagBox.append(tag);
    });
    link.append(heading);
    if (description) link.append(text);
    if (tagBox.childElementCount) link.append(tagBox);
    link.append(info);
    return link;
  }

  async function loadTags() {
    try {
      const rows = await rest('guide_tags', 'select=name&is_visible=eq.true&order=display_order.asc&limit=12');
      document.querySelector('#tag-list').replaceChildren(...rows.map(row => {
        const link = document.createElement('a');
        link.href = '/guides?q=' + encodeURIComponent(row.name);
        link.textContent = '#' + row.name;
        return link;
      }));
    } catch (error) {
      console.warn('자료 태그를 불러오지 못했습니다.', error);
    }
  }

  async function other() {
    const rows = await rest('guides', 'select=id,title,description,body,course_name,institution_name,tags,updated_at,view_count&status=eq.active&visibility=eq.public&order=updated_at.desc&limit=300');
    return rows.filter(row => match([row.title, row.description, row.body, row.course_name, row.institution_name, ...(Array.isArray(row.tags) ? row.tags : [])].join(' ')))
      .map(row => item({ href: '/guide?id=' + encodeURIComponent(row.id), title: row.title, description: row.description, tags: row.tags, meta: '기타 자료 · ' + date(row.updated_at) + ' · 조회 ' + Number(row.view_count || 0).toLocaleString() }));
  }

  async function pyeongjae() {
    const rows = await rest('pyeongjae_entries', 'select=id,book_no,sheet_no,start_page,side,title,work_title,summary,people,places,tags,pages,volume_no,genre,view_count&status=eq.published&limit=1000');
    const sorted = rows.sort(compare);
    const ordinals = new Map(sorted.map((row, index) => [row.id, index + 1]));
    return sorted.filter(row => match([row.title, row.work_title, row.summary, ...(Array.isArray(row.people) ? row.people : []), ...(Array.isArray(row.places) ? row.places : []), ...(Array.isArray(row.tags) ? row.tags : []), JSON.stringify(row.pages || [])].join(' ')))
      .map(row => item({ href: '/pyeongjae-entry?id=' + encodeURIComponent(row.id), title: row.title, description: '', tags: [], number: ordinals.get(row.id), meta: `${row.volume_no ? `권${row.volume_no}` : '권차 미확인'} · ${row.genre || '종류 미확인'} · 조회 ${Number(row.view_count || 0).toLocaleString()}` }));
  }

  function setUrl() {
    const next = new URL(location.href);
    input.value.trim() ? next.searchParams.set('q', input.value.trim()) : next.searchParams.delete('q');
    scope === 'all' ? next.searchParams.delete('scope') : next.searchParams.set('scope', scope);
    history.replaceState({ scope, q: input.value.trim() }, '', next);
  }

  function showError(error) {
    console.error('자료 안내 화면 초기화 실패', error);
    count.textContent = '';
    list.innerHTML = '<div class="route-error" role="alert"><strong>자료를 불러오지 못했습니다.</strong><p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p><div><button id="retry-guides" type="button">다시 시도</button><a href="/">홈으로</a></div></div>';
    document.querySelector('#retry-guides')?.addEventListener('click', search, { once: true });
  }

  async function search() {
    setUrl();
    list.innerHTML = '<p class="empty">찾고 있습니다.</p>';
    count.textContent = '';
    try {
      const groups = await Promise.all([scope !== 'pyeongjae' ? other() : [], scope !== 'other' ? pyeongjae() : []]);
      const rows = groups.flat();
      count.textContent = rows.length + '건';
      list.replaceChildren(...(rows.length ? rows : [Object.assign(document.createElement('p'), { className: 'empty', textContent: '조건에 맞는 공개 자료가 없습니다.' })]));
    } catch (error) {
      showError(error);
    }
  }

  document.querySelectorAll('[data-scope]').forEach(button => {
    button.classList.toggle('active', button.dataset.scope === scope);
    button.addEventListener('click', () => {
      scope = button.dataset.scope;
      document.querySelectorAll('[data-scope]').forEach(item => item.classList.toggle('active', item === button));
      search();
    });
  });
  document.querySelector('#guide-search').addEventListener('submit', event => { event.preventDefault(); search(); });
  addEventListener('pageshow', event => { if (event.persisted) search(); });
  loadTags();
  search();
})();
