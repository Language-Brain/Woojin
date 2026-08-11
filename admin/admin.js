(() => {
  'use strict';

  const fallback = {
    supabaseUrl: 'https://vhaosgzyvoijgwryybry.supabase.co',
    supabasePublishableKey: 'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa',
    siteUrl: 'https://languagebrain.vercel.app'
  };
  const config = window.LANGUAGE_BRAIN_CONFIG?.supabaseUrl ? window.LANGUAGE_BRAIN_CONFIG : fallback;
  const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const today = () => new Date().toISOString().slice(0, 10);
  const formatDate = value => value ? new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const escapeText = value => { const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML; };
  const typeLabels = { paper: '해외 연구 소개', works: '글과 해설', news: '언어와 뇌 뉴스', notice: '공지', other: '기타' };
  const statusLabels = { published: '공개', draft: '비공개·임시', trashed: '휴지통' };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxFileSize = 8 * 1024 * 1024;

  let currentUser = null;
  let allPosts = [];
  let categories = [];
  let mediaAssets = [];
  let viewRows = [];
  let currentPost = null;
  let featuredFile = null;
  let quill = null;
  let dirty = false;
  let saving = false;
  let autosaveTimer = null;
  let visiblePostLimit = 20;
  let toastTimer = null;

  function showToast(message, error = false) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function setSaveState(message, tone = '') {
    ['#save-state', '#mobile-save-state'].forEach(selector => {
      const el = $(selector);
      el.textContent = message;
      el.className = `save-state ${tone}`.trim();
    });
  }

  function showLogin(message = '') {
    $('#login-view').classList.remove('hidden');
    $('#admin-app').classList.add('hidden');
    $('#login-status').textContent = message;
  }

  async function requireAdmin(user) {
    if (!user) return false;
    const { data, error } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    return !error && data?.role === 'admin';
  }

  async function initialize() {
    if (!window.Quill || !window.DOMPurify) {
      showLogin('편집 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
      return;
    }
    initEditor();
    const { data: { session } } = await db.auth.getSession();
    if (session && await requireAdmin(session.user)) {
      currentUser = session.user;
      await showAdmin();
    } else {
      if (session) await db.auth.signOut();
      showLogin();
    }
  }

  async function showAdmin() {
    $('#login-view').classList.add('hidden');
    $('#admin-app').classList.remove('hidden');
    $('#account-email').textContent = currentUser.email;
    await Promise.all([loadCategories(), loadPosts(), loadMedia(), loadViews(), loadInquiries()]);
    renderDashboard();
    navigate('dashboard');
  }

  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const status = $('#login-status');
    button.disabled = true;
    status.textContent = '관리자 권한을 확인하고 있습니다.';
    const { data, error } = await db.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
    if (error || !await requireAdmin(data.user)) {
      if (data.user) await db.auth.signOut();
      status.textContent = '관리자 이메일 또는 비밀번호를 확인해 주세요.';
    } else {
      currentUser = data.user;
      await showAdmin();
    }
    button.disabled = false;
  });

  $('#logout').addEventListener('click', async () => {
    if (dirty && !confirm('저장하지 않은 변경 내용이 있습니다. 그래도 로그아웃할까요?')) return;
    await db.auth.signOut();
    currentUser = null;
    dirty = false;
    showLogin('안전하게 로그아웃했습니다.');
  });

  function navigate(view) {
    $$('.view').forEach(section => section.classList.toggle('active-view', section.dataset.viewSection === view));
    $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $('#sidebar').classList.remove('open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    if (view === 'editor' && !currentPost) resetEditor();
    if (view === 'posts') renderPostTable();
    if (view === 'categories') renderCategories();
    if (view === 'media') renderMedia();
    if (view === 'stats') renderStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => {
    if (dirty && button.dataset.view !== 'editor' && !confirm('저장하지 않은 변경 내용이 있습니다. 다른 화면으로 이동할까요?')) return;
    navigate(button.dataset.view);
  }));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  $$('[data-open-editor]').forEach(button => button.addEventListener('click', () => { resetEditor(); navigate('editor'); }));
  $('#menu-toggle').addEventListener('click', () => {
    const open = $('#sidebar').classList.toggle('open');
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
  });

  function initEditor() {
    const BaseImage = Quill.import('formats/image');
    class AccessibleImage extends BaseImage {
      static create(value) {
        const normalized = typeof value === 'string' ? { url: value, alt: '' } : value;
        const node = super.create(normalized.url);
        node.setAttribute('src', normalized.url);
        node.setAttribute('alt', normalized.alt || '');
        return node;
      }
      static value(node) { return { url: node.getAttribute('src'), alt: node.getAttribute('alt') || '' }; }
    }
    Quill.register(AccessibleImage, true);
    quill = new Quill('#editor', {
      theme: 'snow',
      placeholder: '연구 자료와 원고를 이곳에 편안하게 작성하세요.',
      modules: {
        toolbar: {
          container: '#toolbar',
          handlers: { image: () => $('#inline-image-input').click(), undo: () => quill.history.undo(), redo: () => quill.history.redo() }
        },
        history: { delay: 900, maxStack: 200, userOnly: true }
      }
    });
    quill.on('text-change', (_delta, _old, source) => { if (source === 'user') markDirty(); });
  }

  function markDirty() {
    dirty = true;
    setSaveState('저장되지 않은 변경', 'saving');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => savePost('autosave'), 3500);
  }

  $('#post-form').addEventListener('input', event => {
    if (event.target.id !== 'post-image') markDirty();
  });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

  function validateImage(file) {
    if (!allowedTypes.includes(file.type)) throw new Error('JPG, PNG, WebP, GIF 이미지만 올릴 수 있습니다.');
    if (file.size > maxFileSize) throw new Error('이미지는 8MB 이하로 올려 주세요.');
  }

  async function uploadImage(file, altText = '') {
    validateImage(file);
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type];
    const path = `${currentUser.id}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from('post-images').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    const publicUrl = db.storage.from('post-images').getPublicUrl(path).data.publicUrl;
    const { error: metaError } = await db.from('media_assets').insert({ path, file_name: file.name, public_url: publicUrl, alt_text: altText, mime_type: file.type, size_bytes: file.size, created_by: currentUser.id });
    if (metaError) console.warn('이미지 메타데이터 저장 실패', metaError.message);
    return { publicUrl, path };
  }

  $('#inline-image-input').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const alt = prompt('이미지를 설명하는 대체 텍스트를 입력해 주세요.', '') ?? '';
    setSaveState('본문 이미지 업로드 중', 'saving');
    try {
      const { publicUrl } = await uploadImage(file, alt.trim());
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', { url: publicUrl, alt: alt.trim() }, 'user');
      quill.setSelection(range.index + 1, 0);
      await loadMedia();
      showToast('본문 이미지를 삽입했습니다.');
    } catch (error) { showToast(error.message, true); setSaveState('이미지 업로드 실패', 'error'); }
    event.target.value = '';
  });

  $('#post-image').addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      validateImage(file);
      featuredFile = file;
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = '선택한 대표 이미지 미리보기';
      $('#featured-preview').replaceChildren(img);
      markDirty();
    } catch (error) { event.target.value = ''; showToast(error.message, true); }
  });

  function setFeaturedPreview(url, alt = '') {
    const box = $('#featured-preview');
    if (!url) { box.innerHTML = '<span>등록된 이미지가 없습니다.</span>'; return; }
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || '대표 이미지';
    box.replaceChildren(img);
  }

  function collectWorking() {
    return {
      type: $('#post-type').value,
      category: $('#post-category').value,
      title: $('#post-title').value.trim(),
      subtitle: $('#post-subtitle').value.trim(),
      excerpt: $('#post-excerpt').value.trim(),
      content_html: quill.root.innerHTML === '<p><br></p>' ? '' : quill.root.innerHTML,
      academic_info: $('#post-academic').value.trim(),
      source: $('#post-source').value.trim(),
      link_url: $('#post-link').value.trim(),
      image_url: $('#post-image-url').value,
      image_alt: $('#post-image-alt').value.trim(),
      tags: $('#post-tags').value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
      published_at: $('#post-date').value || today()
    };
  }

  function canonicalPayload(working, status) {
    return { ...working, status, ref_no: $('#post-ref').value.trim(), working_content: working, created_by: currentUser.id };
  }

  async function savePost(mode = 'draft') {
    if (saving) return;
    let working = collectWorking();
    if (!working.title) {
      if (mode !== 'autosave') showToast('제목을 입력해 주세요.', true);
      return;
    }
    saving = true;
    setSaveState(mode === 'autosave' ? '자동 저장 중…' : '저장 중…', 'saving');
    try {
      if (featuredFile) {
        const uploaded = await uploadImage(featuredFile, working.image_alt);
        working.image_url = uploaded.publicUrl;
        $('#post-image-url').value = uploaded.publicUrl;
        featuredFile = null;
        $('#post-image').value = '';
      }
      let id = $('#post-id').value;
      let result;
      if (!$('#post-ref').value.trim()) $('#post-ref').value = String(Date.now()).slice(-10);
      if (id) {
        const existing = allPosts.find(post => post.id === id) || currentPost;
        if (existing?.status === 'published' && mode !== 'publish') {
          result = await db.from('posts').update({ working_content: working }).eq('id', id).select().single();
        } else {
          result = await db.from('posts').update(canonicalPayload(working, mode === 'publish' ? 'published' : 'draft')).eq('id', id).select().single();
        }
      } else {
        result = await db.from('posts').insert(canonicalPayload(working, mode === 'publish' ? 'published' : 'draft')).select().single();
        id = result.data?.id;
      }
      if (result.error) throw result.error;
      $('#post-id').value = id;
      currentPost = result.data;
      dirty = false;
      await Promise.all([loadPosts(), loadMedia()]);
      const savedAt = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      setSaveState(`${savedAt} 저장 완료`, 'saved');
      updateEditorStatus(result.data);
      if (mode === 'publish') showToast('공개했습니다. 홈페이지에서 확인할 수 있습니다.');
      else if (mode !== 'autosave') showToast(result.data.status === 'published' ? '편집 초안을 저장했습니다. 공개본은 유지됩니다.' : '임시 저장했습니다.');
    } catch (error) {
      setSaveState('저장 실패', 'error');
      if (mode !== 'autosave') showToast(`저장하지 못했습니다: ${error.message}`, true);
    } finally { saving = false; }
  }

  $('#save-draft').addEventListener('click', () => savePost('draft'));
  $('#publish-post').addEventListener('click', () => savePost('publish'));
  $('#unpublish-post').addEventListener('click', async () => {
    const id = $('#post-id').value;
    if (!id || !confirm('이 글을 비공개로 전환할까요? 공개 홈페이지에서는 즉시 숨겨집니다.')) return;
    const { error } = await db.from('posts').update({ status: 'draft' }).eq('id', id);
    if (error) return showToast(error.message, true);
    dirty = false;
    await loadPosts();
    openEditor(id);
    showToast('비공개로 전환했습니다.');
  });

  function resetEditor() {
    currentPost = null;
    featuredFile = null;
    $('#post-form').reset();
    $('#post-id').value = '';
    $('#post-image-url').value = '';
    $('#post-date').value = today();
    $('#post-type').value = 'works';
    $('#post-category').value = '';
    quill?.setContents([]);
    setFeaturedPreview('');
    $('#editor-mode').textContent = '새 글';
    $('#current-status').textContent = '새 글';
    $('#post-timestamps').textContent = '아직 저장되지 않았습니다.';
    $('#unpublish-post').classList.add('hidden');
    dirty = false;
    setSaveState('저장 준비');
  }

  function workingFromPost(post) {
    const draft = post.working_content && Object.keys(post.working_content).length ? post.working_content : {};
    return {
      type: draft.type ?? post.type,
      category: draft.category ?? post.category,
      title: draft.title ?? post.title,
      subtitle: draft.subtitle ?? post.subtitle ?? '',
      excerpt: draft.excerpt ?? post.excerpt,
      content_html: draft.content_html ?? post.content_html ?? '',
      academic_info: draft.academic_info ?? post.academic_info,
      source: draft.source ?? post.source,
      link_url: draft.link_url ?? post.link_url,
      image_url: draft.image_url ?? post.image_url,
      image_alt: draft.image_alt ?? post.image_alt ?? '',
      tags: draft.tags ?? post.tags ?? [],
      published_at: draft.published_at ?? post.published_at
    };
  }

  function openEditor(id) {
    const post = allPosts.find(row => row.id === id);
    if (!post) return;
    currentPost = post;
    featuredFile = null;
    const working = workingFromPost(post);
    $('#post-id').value = post.id;
    $('#post-type').value = working.type;
    $('#post-category').value = working.category || '';
    $('#post-title').value = working.title;
    $('#post-subtitle').value = working.subtitle;
    $('#post-excerpt').value = working.excerpt;
    $('#post-academic').value = working.academic_info;
    $('#post-source').value = working.source;
    $('#post-link').value = working.link_url;
    $('#post-image-url').value = working.image_url;
    $('#post-image-alt').value = working.image_alt;
    $('#post-tags').value = (working.tags || []).join(', ');
    $('#post-date').value = working.published_at || today();
    $('#post-ref').value = post.ref_no;
    quill.clipboard.dangerouslyPasteHTML(DOMPurify.sanitize(working.content_html || ''));
    setFeaturedPreview(working.image_url, working.image_alt);
    $('#editor-mode').textContent = '글 수정';
    dirty = false;
    setSaveState('저장됨', 'saved');
    updateEditorStatus(post);
    navigate('editor');
  }

  function updateEditorStatus(post) {
    $('#current-status').textContent = statusLabels[post.status] || post.status;
    $('#post-timestamps').textContent = `작성 ${formatDate(post.created_at)} · 수정 ${formatDate(post.updated_at)}`;
    $('#unpublish-post').classList.toggle('hidden', post.status !== 'published');
    $('#publish-post').textContent = post.status === 'published' ? '수정 내용 공개' : '공개하기';
  }

  $('#editor-cancel').addEventListener('click', () => {
    if (dirty && !confirm('저장하지 않은 변경 내용이 있습니다. 글 목록으로 이동할까요?')) return;
    navigate('posts');
  });

  function renderPreview() {
    const working = collectWorking();
    $('#preview-content').innerHTML = `${working.image_url ? `<img class="preview-hero" src="${escapeText(working.image_url)}" alt="${escapeText(working.image_alt)}">` : ''}<p class="eyebrow">${escapeText(typeLabels[working.type])}${working.category ? ` · ${escapeText(working.category)}` : ''}</p><h1>${escapeText(working.title || '제목 없는 글')}</h1>${working.subtitle ? `<p class="preview-subtitle">${escapeText(working.subtitle)}</p>` : ''}${working.excerpt ? `<p class="preview-excerpt">${escapeText(working.excerpt)}</p>` : ''}<div class="preview-body">${DOMPurify.sanitize(working.content_html || '<p>본문이 아직 없습니다.</p>')}</div>`;
    $('#preview-dialog').showModal();
  }
  $('#preview-post').addEventListener('click', renderPreview);
  $('#close-preview').addEventListener('click', () => $('#preview-dialog').close());

  async function loadPosts() {
    const { data, error } = await db.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) { showToast(`글을 불러오지 못했습니다: ${error.message}`, true); return; }
    allPosts = data || [];
    renderPostTable();
    renderDashboard();
  }

  function filteredPosts() {
    const search = $('#post-search').value.trim().toLowerCase();
    const type = $('#filter-type').value;
    const category = $('#filter-category').value;
    const status = $('#filter-status').value;
    const sort = $('#post-sort').value;
    const rows = allPosts.filter(post => {
      if (search && !`${post.title} ${post.excerpt}`.toLowerCase().includes(search)) return false;
      if (type !== 'all' && post.type !== type) return false;
      if (category !== 'all' && post.category !== category) return false;
      if (status === 'active' && post.status === 'trashed') return false;
      if (!['all', 'active'].includes(status) && post.status !== status) return false;
      return true;
    });
    rows.sort((a, b) => sort === 'created-asc' ? new Date(a.created_at) - new Date(b.created_at) : sort === 'published-desc' ? String(b.published_at).localeCompare(String(a.published_at)) : new Date(b.updated_at) - new Date(a.updated_at));
    return rows;
  }

  function renderPostTable() {
    if (!$('#post-table-body')) return;
    const rows = filteredPosts();
    $('#post-count').textContent = allPosts.length ? allPosts.length : '';
    const visible = rows.slice(0, visiblePostLimit);
    $('#post-table-body').innerHTML = visible.map(post => `<tr><td><button class="post-title-button" data-action="edit" data-id="${post.id}" type="button">${escapeText(post.title)}</button><span class="post-subline">${escapeText(post.ref_no)} · ${escapeText((post.tags || []).join(', '))}</span></td><td>${escapeText(typeLabels[post.type] || post.type)}<span class="post-subline">${escapeText(post.category || '카테고리 없음')}</span></td><td><span class="status-badge status-${post.status}">${escapeText(statusLabels[post.status] || post.status)}</span></td><td>${escapeText(post.published_at || '-')}</td><td>${escapeText(formatDate(post.updated_at))}</td><td><span class="thumb-state">${post.image_url ? `<img src="${escapeText(post.image_url)}" alt="">` : '없음'}</span></td><td><div class="row-actions">${post.status === 'trashed' ? `<button class="button small secondary" data-action="restore" data-id="${post.id}" type="button">복구</button>` : `<button class="button small ghost" data-action="edit" data-id="${post.id}" type="button">수정</button><button class="button small ghost" data-action="preview-live" data-id="${post.id}" type="button">미리보기</button>${post.status === 'published' ? `<button class="button small secondary" data-action="unpublish" data-id="${post.id}" type="button">비공개</button>` : `<button class="button small secondary" data-action="publish" data-id="${post.id}" type="button">공개</button>`}<button class="button small danger" data-action="trash" data-id="${post.id}" type="button">휴지통</button>`}</div></td></tr>`).join('');
    $('#post-empty').classList.toggle('hidden', rows.length > 0);
    $('#load-more-posts').classList.toggle('hidden', rows.length <= visiblePostLimit);
  }

  ['#post-search', '#filter-type', '#filter-category', '#filter-status', '#post-sort'].forEach(selector => $(selector).addEventListener('input', () => { visiblePostLimit = 20; renderPostTable(); }));
  $('#load-more-posts').addEventListener('click', () => { visiblePostLimit += 20; renderPostTable(); });
  $('#post-table-body').addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'edit') return openEditor(id);
    if (action === 'preview-live') {
      const post = allPosts.find(row => row.id === id);
      if (post?.status === 'published') return window.open(`/article?id=${encodeURIComponent(id)}`, '_blank', 'noopener');
      openEditor(id);
      return setTimeout(renderPreview, 80);
    }
    if (action === 'trash' && !confirm('이 글을 휴지통으로 옮길까요? 나중에 복구할 수 있습니다.')) return;
    if (action === 'unpublish' && !confirm('이 글을 비공개로 전환할까요?')) return;
    let changes = null;
    if (action === 'trash') changes = { status: 'trashed', deleted_at: new Date().toISOString() };
    if (action === 'restore') changes = { status: 'draft', deleted_at: null };
    if (action === 'unpublish') changes = { status: 'draft' };
    if (action === 'publish') changes = { status: 'published', published_at: today() };
    if (!changes) return;
    const { error } = await db.from('posts').update(changes).eq('id', id);
    if (error) showToast(error.message, true); else { await loadPosts(); showToast(action === 'trash' ? '휴지통으로 옮겼습니다.' : '상태를 변경했습니다.'); }
  });

  function renderDashboard() {
    if (!$('#summary-cards')) return;
    const active = allPosts.filter(post => post.status !== 'trashed');
    const cards = [
      ['전체 글', active.length, '휴지통 제외'],
      ['공개 글', active.filter(post => post.status === 'published').length, '방문자에게 보임'],
      ['비공개·임시', active.filter(post => post.status === 'draft').length, '관리자만 확인'],
      ['휴지통', allPosts.filter(post => post.status === 'trashed').length, '복구 가능']
    ];
    $('#summary-cards').innerHTML = cards.map(([label, value, note]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
    renderCompact('#recent-updated', [...active].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5));
    renderCompact('#recent-published', active.filter(post => post.status === 'published').sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 5));
    const counts = categories.map(category => ({ name: category.name, count: active.filter(post => post.category === category.name).length }));
    const max = Math.max(1, ...counts.map(row => row.count));
    $('#category-summary').innerHTML = counts.length ? counts.map(row => `<div class="bar-row"><span>${escapeText(row.name)}</span><div class="bar-track"><i style="width:${row.count / max * 100}%"></i></div><strong>${row.count}</strong></div>`).join('') : '<div class="empty-state small">카테고리가 없습니다.</div>';
    const totalViews = viewRows.length;
    $('#view-summary').innerHTML = totalViews ? `<strong style="font:700 34px var(--serif)">${totalViews}</strong><p>수집된 유효 조회</p>` : '아직 수집된 통계가 없습니다.';
  }

  function renderCompact(selector, rows) {
    $(selector).innerHTML = rows.length ? rows.map(post => `<div class="compact-item"><button data-edit-post="${post.id}" type="button">${escapeText(post.title)}</button><span>${escapeText(formatDate(post.updated_at))}</span></div>`).join('') : '<div class="empty-state small">표시할 글이 없습니다.</div>';
    $$(`${selector} [data-edit-post]`).forEach(button => button.addEventListener('click', () => openEditor(button.dataset.editPost)));
  }

  async function loadCategories() {
    const { data, error } = await db.from('categories').select('*').order('sort_order');
    if (error) { console.warn(error.message); return; }
    categories = data || [];
    const options = categories.map(row => `<option value="${escapeText(row.name)}">${escapeText(row.name)}</option>`).join('');
    $('#post-category').innerHTML = `<option value="">카테고리 없음</option>${options}`;
    $('#filter-category').innerHTML = `<option value="all">모든 카테고리</option>${options}`;
    renderCategories();
    renderDashboard();
  }

  function renderCategories() {
    $('#category-list').innerHTML = categories.length ? categories.map(row => { const count = allPosts.filter(post => post.category === row.name && post.status !== 'trashed').length; return `<article class="category-card"><span class="category-order">${row.sort_order}</span><div><h3>${escapeText(row.name)} ${row.is_visible ? '' : '<span class="status-badge status-draft">숨김</span>'}</h3><p>${escapeText(row.description || '설명 없음')}</p><span class="category-meta">연결된 글 ${count}개</span></div><button class="button small ghost" data-category-edit="${row.id}" type="button">수정</button></article>`; }).join('') : '<div class="empty-state">카테고리가 없습니다.</div>';
    $$('[data-category-edit]').forEach(button => button.addEventListener('click', () => fillCategory(button.dataset.categoryEdit)));
  }

  function fillCategory(id) {
    const row = categories.find(item => item.id === id);
    if (!row) return;
    $('#category-id').value = row.id;
    $('#category-name').value = row.name;
    $('#category-description').value = row.description;
    $('#category-order').value = row.sort_order;
    $('#category-visible').checked = row.is_visible;
    $('#category-form-title').textContent = '카테고리 수정';
  }

  function resetCategory() {
    $('#category-form').reset();
    $('#category-id').value = '';
    $('#category-visible').checked = true;
    $('#category-order').value = categories.length ? Math.max(...categories.map(row => row.sort_order)) + 10 : 10;
    $('#category-form-title').textContent = '새 카테고리';
    $('#category-message').textContent = '';
  }
  $('#category-reset').addEventListener('click', resetCategory);
  $('#category-form').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#category-id').value;
    const name = $('#category-name').value.trim();
    const existing = categories.find(row => row.id === id);
    const linkedCount = existing ? allPosts.filter(post => post.category === existing.name).length : 0;
    if (existing && existing.name !== name && linkedCount && !confirm(`이 카테고리에 글 ${linkedCount}개가 연결되어 있습니다. 글의 기존 카테고리 이름은 유지됩니다. 이름만 변경할까요?`)) return;
    const slugBase = name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
    const payload = { name, slug: existing?.slug || slugBase || `category-${Date.now()}`, description: $('#category-description').value.trim(), sort_order: Number($('#category-order').value) || 0, is_visible: $('#category-visible').checked };
    const result = id ? await db.from('categories').update(payload).eq('id', id) : await db.from('categories').insert(payload);
    $('#category-message').textContent = result.error ? `저장하지 못했습니다: ${result.error.message}` : '저장했습니다.';
    if (!result.error) { await loadCategories(); resetCategory(); showToast('카테고리를 저장했습니다.'); }
  });

  async function loadMedia() {
    const { data, error } = await db.from('media_assets').select('*').order('created_at', { ascending: false });
    if (error) { console.warn(error.message); return; }
    mediaAssets = data || [];
    renderMedia();
  }

  function renderMedia() {
    const search = $('#media-search').value.trim().toLowerCase();
    const rows = mediaAssets.filter(item => !search || `${item.file_name} ${item.alt_text}`.toLowerCase().includes(search));
    $('#media-count').textContent = `${rows.length}개 이미지`;
    $('#media-grid').innerHTML = rows.map(item => `<article class="media-card"><div class="media-image"><img src="${escapeText(item.public_url)}" alt="${escapeText(item.alt_text || '')}" loading="lazy"></div><div class="media-info"><strong title="${escapeText(item.file_name)}">${escapeText(item.file_name)}</strong><p>${escapeText(item.alt_text || '대체 텍스트 없음')}</p><p>${Math.round(item.size_bytes / 1024)}KB · ${escapeText(formatDate(item.created_at))}</p><button class="button small ghost" data-copy-url="${escapeText(item.public_url)}" type="button">주소 복사</button></div></article>`).join('');
    $('#media-empty').classList.toggle('hidden', rows.length > 0);
    $$('[data-copy-url]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copyUrl); showToast('이미지 주소를 복사했습니다.'); }));
  }
  $('#media-search').addEventListener('input', renderMedia);
  $('#media-upload').addEventListener('change', async event => {
    const files = [...event.target.files];
    if (!files.length) return;
    for (const file of files) {
      try { await uploadImage(file, ''); showToast(`${file.name} 업로드 완료`); }
      catch (error) { showToast(`${file.name}: ${error.message}`, true); }
    }
    event.target.value = '';
    await loadMedia();
  });

  async function loadViews() {
    const { data, error } = await db.from('post_views').select('post_id,viewed_on,created_at');
    if (error) { viewRows = []; return; }
    viewRows = data || [];
    renderStats();
    renderDashboard();
  }

  function renderStats() {
    const todayValue = today();
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    const seven = weekAgo.toISOString().slice(0, 10);
    const cards = [['오늘 조회수', viewRows.filter(row => row.viewed_on === todayValue).length], ['최근 7일', viewRows.filter(row => row.viewed_on >= seven).length], ['누적 조회수', viewRows.length], ['조회된 글', new Set(viewRows.map(row => row.post_id)).size]];
    $('#stats-cards').innerHTML = cards.map(([label, value]) => `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${value ? '실제 수집값' : '아직 수집된 통계 없음'}</small></article>`).join('');
    const counts = viewRows.reduce((map, row) => map.set(row.post_id, (map.get(row.post_id) || 0) + 1), new Map());
    const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    $('#popular-posts').innerHTML = popular.length ? popular.map(([id, count]) => { const post = allPosts.find(row => row.id === id); return `<div class="compact-item"><button data-edit-post="${id}" type="button">${escapeText(post?.title || '삭제된 글')}</button><span>${count}회</span></div>`; }).join('') : '<div class="empty-state small">아직 수집된 통계가 없습니다.</div>';
    $$('#popular-posts [data-edit-post]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.editPost)));
  }

  async function loadInquiries() {
    const { data, error } = await db.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) { $('#inquiry-list').innerHTML = `<div class="empty-state">질문을 불러오지 못했습니다: ${escapeText(error.message)}</div>`; return; }
    $('#inquiry-list').innerHTML = data?.length ? data.map(item => `<article class="inquiry" data-id="${item.id}"><div class="inquiry-top"><div><h3>${escapeText(item.question)}</h3><time>${escapeText(formatDate(item.created_at))}</time></div><span class="status-badge ${item.status === 'new' ? 'status-draft' : 'status-published'}">${escapeText(item.status)}</span></div><textarea aria-label="답변 내용" placeholder="답변을 작성해 주세요.">${escapeText(item.admin_reply)}</textarea><div class="inquiry-actions"><label><input type="checkbox" ${item.is_public ? 'checked' : ''}> 공개 홈페이지에 답변 표시</label><button class="button primary small" type="button" data-inquiry-save>답변 저장</button><button class="button secondary small" type="button" data-inquiry-archive>보관</button><span class="form-status"></span></div></article>`).join('') : '<div class="empty-state">아직 접수된 질문이 없습니다.</div>';
  }
  $('#refresh-inquiries').addEventListener('click', loadInquiries);
  $('#inquiry-list').addEventListener('click', async event => {
    const card = event.target.closest('.inquiry');
    if (!card) return;
    const message = card.querySelector('.form-status');
    if (event.target.hasAttribute('data-inquiry-save')) {
      const reply = card.querySelector('textarea').value.trim();
      const isPublic = card.querySelector('input[type="checkbox"]').checked;
      const { error } = await db.from('inquiries').update({ admin_reply: reply, is_public: isPublic, status: reply ? 'replied' : 'reviewing', replied_at: reply ? new Date().toISOString() : null }).eq('id', card.dataset.id);
      message.textContent = error ? '저장하지 못했습니다.' : '답변을 저장했습니다.';
      if (!error) loadInquiries();
    }
    if (event.target.hasAttribute('data-inquiry-archive')) { await db.from('inquiries').update({ status: 'archived', is_public: false }).eq('id', card.dataset.id); loadInquiries(); }
  });

  resetCategory();
  initialize();
})();
