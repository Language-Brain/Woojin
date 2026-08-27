(() => {
  'use strict';

  const fallback = {
    supabaseUrl: 'https://vhaosgzyvoijgwryybry.supabase.co',
    supabasePublishableKey: 'sb_publishable_Obv4RYPtgwB71vZ4vOM0iA_jxPfeuZa',
    siteUrl: 'https://languagebrain.vercel.app'
  };
  const recoveryRequested = /(?:[?#&]type=recovery)/.test(location.href);
  const config = window.LANGUAGE_BRAIN_CONFIG?.supabaseUrl && window.LANGUAGE_BRAIN_CONFIG?.supabasePublishableKey ? window.LANGUAGE_BRAIN_CONFIG : fallback;
  const db = window.supabase?.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const today = () => new Date().toISOString().slice(0, 10);
  const formatDate = value => value ? new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const escapeText = value => { const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML; };
  const typeLabels = { paper: '논문·연구 소개', news: '뉴스·기사 소개', works: '강의·저서·연구 원고 또는 칼럼', notice: '공지', other: '기타' };
  const statusLabels = { published: '공개', draft: '비공개·임시', trashed: '휴지통' };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxFileSize = 8 * 1024 * 1024;

  let currentUser = null;
  let allPosts = [];
  let categories = [];
  let mediaAssets = [];
  let viewRows = [];
  let videos = [];
  let currentPost = null;
  let featuredFile = null;
  let featuredFile2 = null;
  let quill = null;
  let dirty = false;
  let saving = false;
  let autosaveTimer = null;
  let visiblePostLimit = 20;
  let toastTimer = null;
  let passwordRecoveryMode = recoveryRequested;

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
    $('#login-form').classList.remove('hidden');
    $('#password-reset-form').classList.add('hidden');
    $('#admin-app').classList.add('hidden');
    $('#login-status').textContent = message;
  }

  function showPasswordReset() {
    passwordRecoveryMode = true;
    $('#login-view').classList.remove('hidden');
    $('#login-form').classList.add('hidden');
    $('#password-reset-form').classList.remove('hidden');
    $('#admin-app').classList.add('hidden');
    $('#new-password').focus();
  }

  async function requireAdmin(user) {
    if (!user) return false;
    const { data, error } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    return !error && data?.role === 'admin';
  }

  async function initialize() {
    if (!db) {
      showLogin('온라인 저장소 설정을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
      $('#login-form').querySelector('button[type="submit"]').disabled = true;
      return;
    }
    if (!window.Quill || !window.DOMPurify) {
      showLogin('편집 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
      return;
    }
    initEditor();
    const { data: { session } } = await db.auth.getSession();
    if (session && passwordRecoveryMode) {
      currentUser = session.user;
      showPasswordReset();
      return;
    }
    if (session && await requireAdmin(session.user)) {
      currentUser = session.user;
      await showAdmin();
    } else {
      if (session) await db.auth.signOut();
      showLogin();
    }
  }

  db?.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showPasswordReset();
    if (event === 'SIGNED_OUT' && currentUser) {
      currentUser = null;
      dirty = false;
      showLogin('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.');
    }
  });

  async function showAdmin() {
    $('#login-view').classList.add('hidden');
    $('#admin-app').classList.remove('hidden');
    $('#account-email').textContent = currentUser.email;
    await Promise.all([loadCategories(), loadPosts(), loadMedia(), loadViews(), loadInquiries(), loadVideos()]);
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

  $('#forgot-password').addEventListener('click', async () => {
    const email = $('#login-email').value.trim();
    const status = $('#login-status');
    if (!email) {
      status.textContent = '관리자 이메일을 먼저 입력해 주세요.';
      return;
    }
    const button = $('#forgot-password');
    button.disabled = true;
    status.textContent = '비밀번호 재설정 메일을 보내고 있습니다.';
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
    const redirectTo = isLocal ? `${location.origin}/admin/` : `${config.siteUrl}/admin`;
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    if (error?.message?.toLowerCase().includes('rate limit')) {
      status.textContent = '보안을 위한 메일 발송 한도에 도달했습니다. 약 한 시간 후 한 번만 다시 시도해 주세요.';
    } else {
      status.textContent = error
        ? `메일을 보내지 못했습니다: ${error.message}`
        : '재설정 메일을 보냈습니다. 메일함에서 가장 최근 링크를 눌러 주세요.';
    }
    button.disabled = false;
  });

  $('#password-reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('#new-password').value;
    const confirmation = $('#new-password-confirm').value;
    const status = $('#password-reset-status');
    if (password.length < 8) {
      status.textContent = '새 비밀번호는 8자 이상으로 정해 주세요.';
      return;
    }
    if (password !== confirmation) {
      status.textContent = '두 비밀번호가 서로 다릅니다.';
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = '새 비밀번호를 안전하게 저장하고 있습니다.';
    const { data, error } = await db.auth.updateUser({ password });
    if (error) {
      status.textContent = `비밀번호를 변경하지 못했습니다: ${error.message}`;
      button.disabled = false;
      return;
    }
    passwordRecoveryMode = false;
    currentUser = data.user;
    if (!await requireAdmin(currentUser)) {
      await db.auth.signOut();
      showLogin('관리자 권한을 확인하지 못했습니다.');
      return;
    }
    await showAdmin();
    showToast('새 비밀번호가 저장되었습니다.');
    button.disabled = false;
  });

  $('#open-password-change').addEventListener('click', () => {
    $('#account-new-password').value = '';
    $('#account-new-password-confirm').value = '';
    $('#account-password-status').textContent = '';
    $('#password-change-dialog').showModal();
    $('#account-new-password').focus();
  });

  $('#close-password-change').addEventListener('click', () => $('#password-change-dialog').close());

  $('#password-change-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('#account-new-password').value;
    const confirmation = $('#account-new-password-confirm').value;
    const status = $('#account-password-status');
    if (password.length < 8) {
      status.textContent = '새 비밀번호는 8자 이상으로 정해 주세요.';
      return;
    }
    if (password !== confirmation) {
      status.textContent = '두 비밀번호가 서로 다릅니다.';
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = '새 비밀번호를 안전하게 저장하고 있습니다.';
    const { error } = await db.auth.updateUser({ password });
    if (error) {
      status.textContent = `비밀번호를 변경하지 못했습니다: ${error.message}`;
      button.disabled = false;
      return;
    }
    $('#password-change-dialog').close();
    showToast('새 비밀번호가 저장되었습니다.');
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
    $$('.nav-item').forEach(button => {
      const selectedType = view === 'posts' ? $('#filter-type')?.value : '';
      const active = button.dataset.view === view && (view !== 'posts' || (button.dataset.postType || 'all') === selectedType);
      button.classList.toggle('active', active);
    });
    $('#sidebar').classList.remove('open');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
    if (view === 'editor' && !currentPost) resetEditor();
    if (view === 'posts') renderPostTable();
    if (view === 'categories') renderCategories();
    if (view === 'media') renderMedia();
    if (view === 'stats') renderStats();
    if (view === 'videos') renderVideos();
    if (view === 'posts') $('#post-management-title').textContent = ({ paper: '논문 관리', news: '뉴스 관리', works: '연구 원고 관리' })[$('#filter-type').value] || '글 관리';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.nav-item').forEach(button => button.addEventListener('click', () => {
    if (dirty && button.dataset.view !== 'editor' && !confirm('저장하지 않은 변경 내용이 있습니다. 다른 화면으로 이동할까요?')) return;
    if (button.dataset.postType) $('#filter-type').value = button.dataset.postType;
    else if (button.dataset.view === 'posts') $('#filter-type').value = 'all';
    navigate(button.dataset.view);
  }));
  $$('[data-go]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.go)));
  $$('[data-open-editor]').forEach(button => button.addEventListener('click', () => { resetEditor(); navigate('editor'); }));
  $('#menu-toggle').addEventListener('click', () => {
    const open = $('#sidebar').classList.toggle('open');
    $('#menu-toggle').setAttribute('aria-expanded', String(open));
  });

  function initEditor() {
    const Font = Quill.import('formats/font');
    Font.whitelist = ['noto-sans', 'nanum-gothic', 'nanum-myeongjo', 'noto-serif', 'system-sans', 'system-serif'];
    Quill.register(Font, true);
    const Size = Quill.import('attributors/class/size');
    Size.whitelist = ['body', 'large', 'xlarge'];
    Quill.register(Size, true);
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
    [['.ql-header', '문단 형식'], ['.ql-size', '글자 크기'], ['.ql-font', '서체']].forEach(([selector, label]) => {
      const picker = document.querySelector('#toolbar ' + selector);
      const pickerLabel = picker?.querySelector('.ql-picker-label');
      if (picker) picker.setAttribute('aria-label', label);
      if (pickerLabel) { pickerLabel.title = label; pickerLabel.setAttribute('aria-label', label); }
    });
    function updateColorIndicators(format = {}) {
      const color = format.color || '#172033';
      const background = format.background || '#ffffff';
      const colorLabel = document.querySelector('.ql-color .ql-picker-label');
      const backgroundLabel = document.querySelector('.ql-background .ql-picker-label');
      if (colorLabel) { colorLabel.style.backgroundColor = color; colorLabel.style.borderColor = '#8f98a4'; colorLabel.title = `글자색: ${color}`; }
      if (backgroundLabel) { backgroundLabel.style.background = `linear-gradient(135deg, ${background} 0 70%, #fff 70%)`; backgroundLabel.style.borderColor = '#8f98a4'; backgroundLabel.title = `강조색: ${background}`; }
    }
    quill.on('text-change', (_delta, _old, source) => {
      if (source === 'user') markDirty();
      if (quill.hasFocus()) updateColorIndicators(quill.getFormat());
    });
    quill.on('selection-change', range => {
      if (range) updateColorIndicators(quill.getFormat(range));
    });
    updateColorIndicators({});
  }

  function markDirty() {
    dirty = true;
    setSaveState('저장되지 않은 변경', 'saving');
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => savePost('autosave'), 3500);
  }

  $('#post-form').addEventListener('input', event => {
    if (!['post-image', 'post-image-2', 'recommendation-search', 'recommendation-candidate'].includes(event.target.id)) markDirty();
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
    if (metaError) {
      console.error('이미지 메타데이터 저장 실패', metaError.message);
      const { error: cleanupError } = await db.storage.from('post-images').remove([path]);
      if (cleanupError) console.error('미완료 이미지 정리 실패', cleanupError.message);
      throw new Error('이미지 정보까지 저장하지 못했습니다. 다시 시도해 주세요.');
    }
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

  function setFeaturedPreview(slot, url, alt = '', fileName = '') {
    const suffix = slot === 2 ? '-2' : '';
    const box = $(`#featured-preview${suffix}`);
    const name = $(`#post-image-name${suffix}`);
    if (!url) {
      box.innerHTML = '<span>등록된 이미지가 없습니다.</span>';
      name.textContent = fileName || '선택된 파일 없음';
      return;
    }
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || `이미지 ${slot}`;
    box.replaceChildren(img);
    name.textContent = fileName || '등록된 이미지';
  }

  function bindFeaturedImage(slot) {
    const suffix = slot === 2 ? '-2' : '';
    const input = $(`#post-image${suffix}`);
    input.addEventListener('change', event => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        validateImage(file);
        if (slot === 2) featuredFile2 = file;
        else featuredFile = file;
        setFeaturedPreview(slot, URL.createObjectURL(file), `선택한 이미지 ${slot} 미리보기`, file.name);
        markDirty();
      } catch (error) { event.target.value = ''; showToast(error.message, true); }
    });
    $(`#clear-post-image${suffix}`).addEventListener('click', () => {
      if (slot === 2) featuredFile2 = null;
      else featuredFile = null;
      input.value = '';
      $(`#post-image-url${suffix}`).value = '';
      $(`#post-image-alt${suffix}`).value = '';
      setFeaturedPreview(slot, '');
      markDirty();
    });
  }

  bindFeaturedImage(1);
  bindFeaturedImage(2);

  function cleanExternalUrl(value, label = '주소') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let url;
    try { url = new URL(raw); } catch { throw new Error(`${label} 형식을 확인해 주세요.`); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${label}는 http 또는 https 주소만 사용할 수 있습니다.`);
    [...url.searchParams.keys()].forEach(key => {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    });
    return url.toString();
  }

  function normalizeDoiUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const id = raw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
    if (/^10\.\d{4,9}\/[\S]+$/i.test(id)) return `https://doi.org/${id}`;
    throw new Error('DOI 주소는 10.1000/... 또는 https://doi.org/10.1000/... 형식으로 입력해 주세요.');
  }

  function updateResearchFields() {
    const isPaper = $('#post-type').value === 'paper';
    $('#paper-simple-fields').classList.toggle('hidden', !isPaper);
    $('#legacy-research-fields').classList.toggle('hidden', isPaper);
    $('#research-fields-title').textContent = isPaper ? '논문 정보' : '자료실 상세 정보';
    $('#post-date-label').textContent = isPaper ? '홈페이지 공개일' : '작성·공개일';
    $('#post-date-help').textContent = isPaper ? '논문 발표 연도가 아니라 이 홈페이지에 공개할 날짜입니다.' : '홈페이지에 표시할 날짜입니다.';
  }

  function nextRefNo(rows) {
    const refs = rows.map(post => String(post.ref_no || '')).filter(ref => /^\d+$/.test(ref));
    const width = Math.max(4, ...refs.map(ref => ref.length));
    const next = refs.reduce((max, ref) => { const value = BigInt(ref); return value > max ? value : max; }, 0n) + 1n;
    return String(next).padStart(width, '0');
  }

  async function resolveRefNo(type, preferred = '', currentId = '') {
    const { data, error } = await db.from('posts').select('id,ref_no').eq('type', type);
    if (error) throw error;
    const otherRows = (data || []).filter(post => post.id !== currentId);
    const candidate = String(preferred || '').trim();
    if (candidate && !otherRows.some(post => String(post.ref_no) === candidate)) return candidate;
    return nextRefNo(otherRows);
  }

  function selectedRecommendationIds() {
    return $$('#recommendation-list [data-recommendation-id]').map(item => item.dataset.recommendationId);
  }

  function renderRecommendationCandidates() {
    const selected = new Set(selectedRecommendationIds());
    const search = $('#recommendation-search').value.trim().toLowerCase();
    const currentId = $('#post-id').value;
    const candidates = allPosts
      .filter(post => post.status === 'published' && post.id !== currentId && !selected.has(post.id))
      .filter(post => !search || post.title.toLowerCase().includes(search))
      .sort((a, b) => String(b.published_at || b.updated_at).localeCompare(String(a.published_at || a.updated_at)));
    $('#recommendation-candidate').innerHTML = '<option value="">공개 글을 선택하세요</option>' + candidates.map(post => `<option value="${post.id}">${escapeText(post.title)}</option>`).join('');
  }

  function renderRecommendations(ids = []) {
    const unique = [...new Set((ids || []).filter(Boolean))].slice(0, 5);
    const list = $('#recommendation-list');
    list.innerHTML = unique.length ? unique.map((id, index) => {
      const post = allPosts.find(item => item.id === id);
      const title = post?.title || '삭제되었거나 찾을 수 없는 글';
      return `<li data-recommendation-id="${escapeText(id)}"><span>${escapeText(title)}</span><div><button type="button" data-recommendation-action="up" aria-label="위로 이동" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-recommendation-action="down" aria-label="아래로 이동" ${index === unique.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-recommendation-action="remove" aria-label="추천에서 삭제">삭제</button></div></li>`;
    }).join('') : '<li class="recommendation-empty">선택한 추천 글이 없습니다.</li>';
    $('#recommendation-count').textContent = `${unique.length}/5`;
    renderRecommendationCandidates();
  }

  $('#recommendation-search').addEventListener('input', renderRecommendationCandidates);
  $('#add-recommendation').addEventListener('click', () => {
    const id = $('#recommendation-candidate').value;
    if (!id) return;
    const ids = selectedRecommendationIds();
    if (ids.length >= 5 || ids.includes(id)) return;
    renderRecommendations([...ids, id]);
    markDirty();
  });
  $('#recommendation-list').addEventListener('click', event => {
    const button = event.target.closest('[data-recommendation-action]');
    const item = event.target.closest('[data-recommendation-id]');
    if (!button || !item) return;
    const ids = selectedRecommendationIds();
    const index = ids.indexOf(item.dataset.recommendationId);
    if (button.dataset.recommendationAction === 'remove') ids.splice(index, 1);
    if (button.dataset.recommendationAction === 'up' && index > 0) [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    if (button.dataset.recommendationAction === 'down' && index < ids.length - 1) [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
    renderRecommendations(ids);
    markDirty();
  });
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
      image_url_2: $('#post-image-url-2').value,
      image_alt_2: $('#post-image-alt-2').value.trim(),
      recommended_posts: selectedRecommendationIds(),
      tags: $('#post-tags').value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 20),
      published_at: $('#post-date').value || today(),
      home_featured: $('#post-home-featured').checked,
      home_order: Number($('#post-home-order').value) || 0,
      content_subtype: $('#post-subtype').value,
      original_title: $('#post-original-title').value.trim(),
      authors: $('#post-authors').value.trim(),
      publication_year: Number($('#post-publication-year').value) || null,
      journal: $('#post-journal').value.trim(),
      bibliographic_info: $('#post-bibliographic').value.trim(),
      doi: $('#post-doi').value.trim(),
      research_method: $('#post-method').value.trim(),
      key_results: $('#post-results').value.trim(),
      importance: $('#post-importance').value.trim(),
      publisher: $('#post-publisher').value.trim(),
      article_date: $('#post-article-date').value || null,
      citation: $('#post-citation').value.trim(),
      doi_url: normalizeDoiUrl($('#post-doi-url').value),
      full_text_url: cleanExternalUrl($('#post-full-text-url').value, '논문 전문 주소')
    };
  }

  const secondImagePattern = /<!--languagebrain-image-2:([^>]*)-->/;

  function secondImageFromContent(content) {
    const match = String(content || '').match(secondImagePattern);
    if (!match) return { url: '', alt: '' };
    try {
      const image = JSON.parse(decodeURIComponent(match[1]));
      return { url: String(image.url || ''), alt: String(image.alt || '') };
    } catch { return { url: '', alt: '' }; }
  }

  function contentWithSecondImage(content, url, alt) {
    const clean = String(content || '').replace(secondImagePattern, '');
    if (!url) return clean;
    const encoded = encodeURIComponent(JSON.stringify({ url, alt: alt || '' }));
    return `<!--languagebrain-image-2:${encoded}-->${clean}`;
  }
  const recommendationPattern = /<!--languagebrain-recommendations:([^>]*)-->/;

  function recommendationsFromContent(content) {
    const match = String(content || '').match(recommendationPattern);
    if (!match) return [];
    try { return JSON.parse(decodeURIComponent(match[1])).filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5); }
    catch { return []; }
  }

  function contentWithRecommendations(content, ids) {
    const clean = String(content || '').replace(recommendationPattern, '');
    const safeIds = [...new Set(ids || [])].filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 5);
    if (!safeIds.length) return clean;
    return `<!--languagebrain-recommendations:${encodeURIComponent(JSON.stringify(safeIds))}-->${clean}`;
  }

  function buildCanonicalPayload(working, status, refNo, createdBy) {
    const { image_url_2, image_alt_2, recommended_posts, ...canonical } = working;
    canonical.content_html = contentWithSecondImage(canonical.content_html, image_url_2, image_alt_2);
    canonical.content_html = contentWithRecommendations(canonical.content_html, recommended_posts);
    return { ...canonical, type: canonical.type || 'other', status, ref_no: refNo, working_content: working, created_by: createdBy };
  }

  function canonicalPayload(working, status) {
    return buildCanonicalPayload(working, status, $('#post-ref').value.trim(), currentUser.id);
  }

  async function savePost(mode = 'draft') {
    if (saving) return;
    let working;
    try { working = collectWorking(); }
    catch (error) { if (mode !== 'autosave') showToast(error.message, true); setSaveState('입력 확인 필요', 'error'); return; }
    if (!working.title) {
      if (mode !== 'autosave') showToast('제목을 입력해 주세요.', true);
      return;
    }
    if (mode === 'publish' && !working.type) {
      showToast('글이 게시될 위치를 결정하려면 글 종류를 선택해 주세요.', true);
      setSaveState('글 종류 선택 필요', 'error');
      $('#post-type').focus();
      return;
    }
    saving = true;
    ['#save-draft', '#publish-post'].forEach(selector => { const button = $(selector); if (button) button.disabled = true; });
    setSaveState(mode === 'autosave' ? '자동 저장 중…' : '저장 중…', 'saving');
    try {
      const pendingImages = [
        { slot: 1, file: featuredFile, alt: working.image_alt },
        { slot: 2, file: featuredFile2, alt: working.image_alt_2 }
      ];
      const uploadedByFingerprint = new Map();
      for (const pending of pendingImages) {
        if (!pending.file) continue;
        const fingerprint = [pending.file.name, pending.file.size, pending.file.type, pending.file.lastModified].join(':');
        const uploaded = uploadedByFingerprint.get(fingerprint) || await uploadImage(pending.file, pending.alt);
        uploadedByFingerprint.set(fingerprint, uploaded);
        const key = pending.slot === 2 ? 'image_url_2' : 'image_url';
        const suffix = pending.slot === 2 ? '-2' : '';
        working[key] = uploaded.publicUrl;
        $(`#post-image-url${suffix}`).value = uploaded.publicUrl;
        if (pending.slot === 2) featuredFile2 = null;
        else featuredFile = null;
        $(`#post-image${suffix}`).value = '';
        setFeaturedPreview(pending.slot, uploaded.publicUrl, pending.alt);
      }
      let id = $('#post-id').value;
      const existing = id ? (allPosts.find(post => post.id === id) || currentPost) : null;
      const canonicalWrite = !(id && existing?.status === 'published' && mode !== 'publish');
      if (canonicalWrite) {
        const storageType = working.type || 'other';
        $('#post-ref').value = await resolveRefNo(storageType, $('#post-ref').value, id);
      }
      const writePost = async () => {
        if (id) {
          if (existing?.status === 'published' && mode !== 'publish') {
            return db.from('posts').update({ working_content: working }).eq('id', id).select().single();
          }
          return db.from('posts').update(canonicalPayload(working, mode === 'publish' ? 'published' : 'draft')).eq('id', id).select().single();
        }
        return db.from('posts').insert(canonicalPayload(working, mode === 'publish' ? 'published' : 'draft')).select().single();
      };
      let result = await writePost();
      if (result.error?.code === '23505' && canonicalWrite) {
        $('#post-ref').value = await resolveRefNo(working.type || 'other', '', id);
        result = await writePost();
      }
      if (result.error) throw result.error;
      id = result.data?.id || id;
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
      if (mode !== 'autosave') showToast(error?.code === '23505' ? '자료 번호가 겹쳐 저장하지 못했습니다. 잠시 후 다시 저장해 주세요. 편집 내용은 그대로 유지됩니다.' : `저장하지 못했습니다: ${error.message}`, true);
    } finally {
      saving = false;
      ['#save-draft', '#publish-post'].forEach(selector => { const button = $(selector); if (button) button.disabled = false; });
    }
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
    featuredFile2 = null;
    $('#post-form').reset();
    $('#post-id').value = '';
    $('#post-image-url').value = '';
    $('#post-image-url-2').value = '';
    $('#post-date').value = today();
    $('#post-type').value = '';
    $('#post-category').value = '';
    $('#post-home-featured').checked = true;
    $('#post-home-order').value = '0';
    quill?.setContents([]);
    setFeaturedPreview(1, '');
    setFeaturedPreview(2, '');
    renderRecommendations([]);
    $('#editor-mode').textContent = '새 글';
    $('#current-status').textContent = '새 글';
    $('#post-timestamps').textContent = '아직 저장되지 않았습니다.';
    $('#unpublish-post').classList.add('hidden');
    updateResearchFields();
    dirty = false;
    setSaveState('저장 준비');
  }

  function workingFromPost(post) {
    const draft = post.working_content && Object.keys(post.working_content).length ? post.working_content : {};
    const publishedSecondImage = secondImageFromContent(post.content_html);
    const publishedRecommendations = recommendationsFromContent(post.content_html);
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
      image_url_2: draft.image_url_2 ?? publishedSecondImage.url,
      image_alt_2: draft.image_alt_2 ?? publishedSecondImage.alt,
      recommended_posts: draft.recommended_posts ?? publishedRecommendations,
      tags: draft.tags ?? post.tags ?? [],
      published_at: draft.published_at ?? post.published_at,
      home_featured: draft.home_featured ?? post.home_featured ?? true,
      home_order: draft.home_order ?? post.home_order ?? 0,
      content_subtype: draft.content_subtype ?? post.content_subtype ?? '',
      original_title: draft.original_title ?? post.original_title ?? '',
      authors: draft.authors ?? post.authors ?? '',
      publication_year: draft.publication_year ?? post.publication_year ?? '',
      journal: draft.journal ?? post.journal ?? '',
      bibliographic_info: draft.bibliographic_info ?? post.bibliographic_info ?? '',
      doi: draft.doi ?? post.doi ?? '',
      research_method: draft.research_method ?? post.research_method ?? '',
      key_results: draft.key_results ?? post.key_results ?? '',
      importance: draft.importance ?? post.importance ?? '',
      publisher: draft.publisher ?? post.publisher ?? '',
      article_date: draft.article_date ?? post.article_date ?? '',
      citation: draft.citation ?? post.citation ?? '',
      doi_url: draft.doi_url ?? post.doi_url ?? (post.type === 'paper' ? post.doi ?? '' : ''),
      full_text_url: draft.full_text_url ?? post.full_text_url ?? (post.type === 'paper' ? post.link_url ?? '' : '')
    };
  }

  function openEditor(id) {
    const post = allPosts.find(row => row.id === id);
    if (!post) return;
    currentPost = post;
    featuredFile = null;
    featuredFile2 = null;
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
    $('#post-image-url-2').value = working.image_url_2;
    $('#post-image-alt-2').value = working.image_alt_2;
    $('#post-tags').value = (working.tags || []).join(', ');
    $('#post-date').value = working.published_at || today();
    $('#post-home-featured').checked = working.home_featured;
    $('#post-home-order').value = working.home_order;
    $('#post-subtype').value = working.content_subtype;
    $('#post-original-title').value = working.original_title;
    $('#post-authors').value = working.authors;
    $('#post-publication-year').value = working.publication_year;
    $('#post-journal').value = working.journal;
    $('#post-bibliographic').value = working.bibliographic_info;
    $('#post-doi').value = working.doi;
    $('#post-method').value = working.research_method;
    $('#post-results').value = working.key_results;
    $('#post-importance').value = working.importance;
    $('#post-publisher').value = working.publisher;
    $('#post-article-date').value = working.article_date;
    $('#post-citation').value = working.citation;
    $('#post-doi-url').value = working.doi_url;
    $('#post-full-text-url').value = working.full_text_url;
    $('#post-ref').value = post.ref_no;
    quill.clipboard.dangerouslyPasteHTML(DOMPurify.sanitize(working.content_html || ''));
    setFeaturedPreview(1, working.image_url, working.image_alt);
    setFeaturedPreview(2, working.image_url_2, working.image_alt_2);
    renderRecommendations(working.recommended_posts);
    $('#editor-mode').textContent = '글 수정';
    dirty = false;
    setSaveState('저장됨', 'saved');
    updateEditorStatus(post);
    updateResearchFields();
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
    let working;
    try { working = collectWorking(); } catch (error) { showToast(error.message, true); return; }
    const citationPreview = working.type === 'paper' && (working.citation || working.doi_url || working.full_text_url) ? `<section class="source-box"><h2>[논문 정보]</h2>${working.citation ? `<p>${escapeText(working.citation)}</p>` : ''}<p>${working.doi_url ? `<a href="${escapeText(working.doi_url)}" target="_blank" rel="noopener noreferrer">DOI</a>` : ''}${working.doi_url && working.full_text_url ? ' · ' : ''}${working.full_text_url ? `<a href="${escapeText(working.full_text_url)}" target="_blank" rel="noopener noreferrer">논문 전문</a>` : ''}</p></section>` : '';
    const previewImages = [[working.image_url, working.image_alt], [working.image_url_2, working.image_alt_2]].filter(([url]) => url);
    const previewGallery = previewImages.length ? `<div class="preview-image-gallery ${previewImages.length === 2 ? 'double' : 'single'}">${previewImages.map(([url, alt]) => `<img src="${escapeText(url)}" alt="${escapeText(alt)}">`).join('')}</div>` : '';
    const recommendedPreviewRows = working.recommended_posts.map(id => allPosts.find(post => post.id === id)).filter(post => post?.status === 'published');
    const recommendationPreview = recommendedPreviewRows.length ? `<section class="preview-recommendations"><h2>함께 읽으면 좋은 글</h2><ul>${recommendedPreviewRows.map(post => `<li>${escapeText(post.title)}</li>`).join('')}</ul></section>` : '';
    $('#preview-content').innerHTML = `${previewGallery}<p class="eyebrow">${escapeText(typeLabels[working.type])}${working.category ? ` · ${escapeText(working.category)}` : ''}</p><h1>${escapeText(working.title || '제목 없는 글')}</h1>${working.subtitle ? `<p class="preview-subtitle">${escapeText(working.subtitle)}</p>` : ''}${working.excerpt ? `<p class="preview-excerpt">${escapeText(working.excerpt)}</p>` : ''}<div class="preview-body">${DOMPurify.sanitize(working.content_html || '<p>본문이 아직 없습니다.</p>')}</div>${recommendationPreview}`;
    $('#preview-content').insertAdjacentHTML('beforeend', citationPreview);
    $('#preview-dialog').showModal();
  }
  $('#preview-post').addEventListener('click', renderPreview);
  $('#post-type').addEventListener('change', updateResearchFields);
  $('#close-preview').addEventListener('click', () => $('#preview-dialog').close());

  async function loadPosts() {
    const { data, error } = await db.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) { showToast(`글을 불러오지 못했습니다: ${error.message}`, true); return; }
    allPosts = data || [];
    renderRecommendationCandidates();
    const related=$('#video-related-post');
    if(related) related.innerHTML='<option value="">연결 안 함</option>'+allPosts.filter(post=>post.status!=='trashed').map(post=>`<option value="${post.id}">${escapeText(post.title)}</option>`).join('');
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
    const selectedType=$('#filter-type').value;
    $('#post-management-title').textContent=$('#filter-status').value==='trashed'?'휴지통':(({paper:'논문 관리',news:'뉴스 관리',works:'연구 원고 관리'})[selectedType]||'글 관리');
    $$('.nav-item[data-view="posts"]').forEach(button=>button.classList.toggle('active',(button.dataset.postType||'all')===selectedType));
    const rows = filteredPosts();
    $('#post-count').textContent = rows.length ? (rows.length + '건') : '';
    const visible = rows.slice(0, visiblePostLimit);
    $('#post-table-body').innerHTML = visible.map(post => `<tr><td><button class="post-title-button" data-action="edit" data-id="${post.id}" type="button">${escapeText(post.title)}</button><span class="post-subline">${escapeText(post.ref_no)} · ${escapeText((post.tags || []).join(', '))}${post.home_featured ? ' · 홈 표시' : ''}</span></td><td>${escapeText(typeLabels[post.type] || post.type)}<span class="post-subline">${escapeText(post.category || '카테고리 없음')}</span></td><td><span class="status-badge status-${post.status}">${escapeText(statusLabels[post.status] || post.status)}</span>${post.status === 'trashed' ? `<span class="post-subline">이전 상태: ${post.working_content?._pre_trash_status === 'published' ? '공개' : post.working_content?._pre_trash_status === 'draft' ? '비공개·임시' : '기록 없음'}</span>` : ''}</td><td>${escapeText(post.published_at || '-')}</td><td>${escapeText(formatDate(post.status === 'trashed' ? post.deleted_at : post.updated_at))}</td><td><span class="thumb-state">${post.image_url ? `<img src="${escapeText(post.image_url)}" alt="">` : '없음'}</span></td><td><div class="row-actions">${post.status === 'trashed' ? `<button class="button small ghost" data-action="preview-trash" data-id="${post.id}" type="button">미리보기</button><button class="button small secondary" data-action="restore" data-id="${post.id}" type="button">복구</button><button class="button small danger" data-action="delete-permanently" data-id="${post.id}" type="button">영구 삭제</button>` : `<button class="button small ghost" data-action="edit" data-id="${post.id}" type="button">수정</button><button class="button small ghost" data-action="preview-live" data-id="${post.id}" type="button">미리보기</button>${post.status === 'published' ? `<button class="button small secondary" data-action="unpublish" data-id="${post.id}" type="button">비공개</button><button class="button small secondary" data-action="toggle-home" data-id="${post.id}" type="button">${post.home_featured ? '홈에서 내리기' : '홈에 표시'}</button>` : `<button class="button small secondary" data-action="publish" data-id="${post.id}" type="button">공개</button>`}<button class="button small danger" data-action="trash" data-id="${post.id}" type="button">휴지통</button>`}</div></td></tr>`).join('');
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
    if (action === 'preview-live' || action === 'preview-trash') {
      const post = allPosts.find(row => row.id === id);
      if (action === 'preview-live' && post?.status === 'published') return window.open(`/article?id=${encodeURIComponent(id)}`, '_blank', 'noopener');
      openEditor(id);
      return setTimeout(renderPreview, 80);
    }
    if (action === 'delete-permanently') {
      const post = allPosts.find(item => item.id === id);
      if (!confirm('「' + (post?.title || '이 글') + '」을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
      const { error } = await db.from('posts').delete().eq('id', id).eq('status', 'trashed');
      if (error) showToast(error.message, true); else { await loadPosts(); showToast('글을 영구 삭제했습니다.'); }
      return;
    }
    if (action === 'trash' && !confirm('이 글을 휴지통으로 옮길까요? 나중에 복구할 수 있습니다.')) return;
    if (action === 'unpublish' && !confirm('이 글을 비공개로 전환할까요?')) return;
    let changes = null;
    if (action === 'trash') { const post = allPosts.find(item => item.id === id); const workingContent = post?.working_content && typeof post.working_content === 'object' ? { ...post.working_content } : {}; workingContent._pre_trash_status = post?.status || 'draft'; changes = { status: 'trashed', deleted_at: new Date().toISOString(), working_content: workingContent }; }
    if (action === 'restore') { const post = allPosts.find(item => item.id === id); const workingContent = post?.working_content && typeof post.working_content === 'object' ? { ...post.working_content } : {}; const restoredStatus = workingContent._pre_trash_status === 'published' ? 'published' : 'draft'; delete workingContent._pre_trash_status; changes = { status: restoredStatus, deleted_at: null, working_content: workingContent }; }
    if (action === 'unpublish') changes = { status: 'draft' };
    if (action === 'publish') {
      const post = allPosts.find(item => item.id === id);
      // 공개 글을 편집 초안으로 저장한 뒤 목록에서 다시 공개하는 경우에도
      // 이전 공개본이 아니라 최신 working_content를 정식 공개 열에 반영합니다.
      const working = workingFromPost(post);
      changes = buildCanonicalPayload(working, 'published', post.ref_no, post.created_by || currentUser.id);
      changes.published_at = working.published_at || post.published_at || today();
    }
    if (action === 'toggle-home') changes = { home_featured: !allPosts.find(post => post.id === id)?.home_featured };
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
      ['휴지통', allPosts.filter(post => post.status === 'trashed').length, '눌러서 확인·복구', 'trash']
    ];
    $('#summary-cards').innerHTML = cards.map(([label, value, note, action]) => action ? `<button class="summary-card summary-card-button" data-dashboard-action="${action}" type="button"><span>${label}</span><strong>${value}</strong><small>${note}</small></button>` : `<article class="summary-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
    renderCompact('#recent-updated', [...active].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5));
    renderCompact('#recent-published', active.filter(post => post.status === 'published').sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 5));
    const counts = categories.map(category => ({ name: category.name, count: active.filter(post => post.category === category.name).length }));
    const max = Math.max(1, ...counts.map(row => row.count));
    $('#category-summary').innerHTML = counts.length ? counts.map(row => `<div class="bar-row"><span>${escapeText(row.name)}</span><div class="bar-track"><i style="width:${row.count / max * 100}%"></i></div><strong>${row.count}</strong></div>`).join('') : '<div class="empty-state small">카테고리가 없습니다.</div>';
    const totalViews = viewRows.length;
    $('#view-summary').innerHTML = totalViews ? `<strong style="font:700 34px var(--serif)">${totalViews}</strong><p>수집된 유효 조회</p>` : '아직 수집된 통계가 없습니다.';
  }

  $('#summary-cards').addEventListener('click', event => {
    const button = event.target.closest('[data-dashboard-action="trash"]');
    if (!button) return;
    $('#post-search').value = ''; $('#filter-type').value = 'all'; $('#filter-category').value = 'all'; $('#filter-status').value = 'trashed'; visiblePostLimit = 20; navigate('posts'); renderPostTable();
  });

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

  const inquiryKindLabels = { lecture: '강의 문의', question: '질문 제안' };
  const inquiryEmailLabels = { sent: '발송 성공', failed: '발송 실패', pending: '발송 대기', suppressed: '스팸 발송 안 함', not_requested: '발송 대상 아님' };

  async function loadInquiries() {
    const { data, error } = await db.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) { $('#inquiry-list').innerHTML = `<div class="empty-state">문의를 불러오지 못했습니다: ${escapeText(error.message)}</div>`; return; }
    $('#inquiry-list').innerHTML = data?.length ? data.map(item => {
      const spam = item.status === 'spam';
      const replyAllowed = item.kind !== 'lecture' && !spam;
      return `<article class="inquiry ${spam ? 'inquiry-spam' : ''} ${item.is_read ? '' : 'inquiry-unread'}" data-id="${escapeText(item.id)}"><div class="inquiry-top"><div><p class="inquiry-flags"><span class="status-badge ${spam ? 'status-spam' : 'status-published'}">${spam ? '스팸 의심' : '정상'}</span><span class="status-badge status-kind">${escapeText(inquiryKindLabels[item.kind] || '질문 제안')}</span><span class="status-badge ${item.email_status === 'failed' ? 'status-spam' : 'status-draft'}">${escapeText(inquiryEmailLabels[item.email_status] || item.email_status || '기록 없음')}</span><span class="status-badge ${item.is_read ? 'status-published' : 'status-draft'}">${item.is_read ? '읽음' : '미확인'}</span></p><h3>${escapeText(item.subject || item.question.slice(0, 80))}</h3><time>${escapeText(formatDate(item.created_at))}</time></div></div><dl class="inquiry-details"><div><dt>작성자</dt><dd>${escapeText(item.name || '익명')}</dd></div><div><dt>이메일</dt><dd>${escapeText(item.email || '-')}</dd></div><div><dt>연락처</dt><dd>${escapeText(item.phone || '-')}</dd></div>${item.spam_reason ? `<div><dt>판정 사유</dt><dd>${escapeText(item.spam_reason)}</dd></div>` : ''}${item.email_error ? `<div><dt>발송 오류</dt><dd>${escapeText(item.email_error)}</dd></div>` : ''}</dl><pre class="inquiry-message">${escapeText(item.question)}</pre>${replyAllowed ? `<textarea aria-label="답변 내용" placeholder="답변을 작성해 주세요.">${escapeText(item.admin_reply)}</textarea>` : ''}<div class="inquiry-actions">${replyAllowed ? `<label><input type="checkbox" ${item.is_public ? 'checked' : ''}> 공개 홈페이지에 답변 표시</label><button class="button primary small" type="button" data-inquiry-save>답변 저장</button>` : ''}${item.is_read ? '' : '<button class="button secondary small" type="button" data-inquiry-read>읽음 표시</button>'}<button class="button secondary small" type="button" data-inquiry-archive>보관</button><span class="form-status"></span></div></article>`;
    }).join('') : '<div class="empty-state">아직 접수된 문의가 없습니다.</div>';
  }
  $('#refresh-inquiries').addEventListener('click', loadInquiries);
  $('#inquiry-list').addEventListener('click', async event => {
    const card = event.target.closest('.inquiry');
    if (!card) return;
    const message = card.querySelector('.form-status');
    if (event.target.hasAttribute('data-inquiry-read')) {
      const { error } = await db.from('inquiries').update({ is_read: true }).eq('id', card.dataset.id);
      if (error) message.textContent = '읽음 상태를 저장하지 못했습니다.'; else loadInquiries();
    }
    if (event.target.hasAttribute('data-inquiry-save')) {
      const reply = card.querySelector('textarea').value.trim();
      const isPublic = card.querySelector('input[type="checkbox"]').checked;
      const { error } = await db.from('inquiries').update({ admin_reply: reply, is_public: isPublic, is_read: true, status: reply ? 'replied' : 'reviewing', replied_at: reply ? new Date().toISOString() : null }).eq('id', card.dataset.id);
      message.textContent = error ? '저장하지 못했습니다.' : '답변을 저장했습니다.';
      if (!error) loadInquiries();
    }
    if (event.target.hasAttribute('data-inquiry-archive')) { await db.from('inquiries').update({ status: 'archived', is_public: false, is_read: true }).eq('id', card.dataset.id); loadInquiries(); }
  });
  function extractYouTubeId(value) {
    try {
      const url = new URL(value.trim());
      const host = url.hostname.replace(/^www\./, '');
      let id = '';
      if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      if (['youtube.com', 'm.youtube.com'].includes(host)) {
        id = url.searchParams.get('v') || '';
        if (!id) {
          const parts = url.pathname.split('/').filter(Boolean);
          if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
        }
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id) && !/^VIDEO_ID_/i.test(id) ? id : '';
    } catch { return ''; }
  }

  function updateVideoPreview() {
    const id = extractYouTubeId($('#video-url').value);
    const state = $('#video-url-state');
    if (!id) {
      state.textContent = $('#video-url').value ? '올바른 YouTube 또는 Shorts 주소를 입력해 주세요.' : '주소를 입력하면 영상 ID와 썸네일을 확인합니다.';
      state.classList.toggle('invalid-url', Boolean($('#video-url').value));
      $('#video-preview').innerHTML = '<span>미리보기 없음</span>';
      return '';
    }
    state.textContent = `확인된 영상 ID: ${id}`;
    state.classList.remove('invalid-url');
    const image = $('#video-custom-image').value.trim() || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    $('#video-preview').innerHTML = `<img src="${escapeText(image)}" alt="등록할 동영상 썸네일">`;
    return id;
  }

  async function loadVideos() {
    const { data, error } = await db.from('videos').select('*').order('home_order').order('updated_at', { ascending: false });
    if (error) {
      videos = [];
      if ($('#video-list')) $('#video-list').innerHTML = `<div class="empty-state">동영상 테이블을 불러오지 못했습니다. 마이그레이션 적용 상태를 확인해 주세요.</div>`;
      return;
    }
    videos = data || [];
    renderVideos();
  }

  function resetVideoForm() {
    $('#video-form').reset();
    $('#video-id').value = '';
    $('#video-date').value = today();
    $('#video-order').value = '0';
    $('#video-form-title').textContent = '새 동영상';
    $('#video-message').textContent = '';
    $('#video-preview').innerHTML = '<span>미리보기 없음</span>';
    $('#video-url-state').textContent = '주소를 입력하면 영상 ID와 썸네일을 확인합니다.';
    $('#video-url-state').classList.remove('invalid-url');
  }

  function openVideoForm(row = null) {
    resetVideoForm();
    $('#video-form').classList.remove('hidden');
    if (!row) return $('#video-title').focus();
    $('#video-id').value = row.id;
    $('#video-title').value = row.title;
    $('#video-description').value = row.description;
    $('#video-url').value = row.youtube_url;
    $('#video-category').value = row.category;
    $('#video-date').value = row.published_at || today();
    $('#video-related-post').value = row.related_post_id || '';
    $('#video-order').value = row.home_order || 0;
    $('#video-custom-image').value = row.custom_image_url || '';
    $('#video-published').checked = row.status === 'published';
    $('#video-home').checked = row.home_featured;
    $('#video-form-title').textContent = '동영상 수정';
    updateVideoPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function filteredVideos() {
    const q = $('#video-search').value.trim().toLowerCase();
    const status = $('#video-filter-status').value;
    return videos.filter(row => (!q || `${row.title} ${row.description}`.toLowerCase().includes(q)) && (status === 'all' || status === 'active' && row.status !== 'trashed' || row.status === status));
  }

  function renderVideos() {
    if (!$('#video-list')) return;
    const rows = filteredVideos();
    $('#video-list').innerHTML = rows.map(row => {
      const image = row.custom_image_url || row.thumbnail_url || (row.youtube_id ? `https://i.ytimg.com/vi/${row.youtube_id}/hqdefault.jpg` : '');
      return `<article class="video-admin-card" data-video-id="${row.id}">${image ? `<img src="${escapeText(image)}" alt="">` : '<div class="thumb-state">없음</div>'}<div><h3>${escapeText(row.title)}${row.home_featured ? '<span class="home-badge">홈</span>' : ''}</h3><p>${escapeText(row.youtube_url || 'YouTube 주소 미등록')}</p><p>${escapeText(row.category || '주제 없음')} · 순서 ${row.home_order} · ${escapeText(row.published_at || '')}</p><span class="status-badge status-${row.status}">${escapeText(statusLabels[row.status] || row.status)}</span></div><div class="row-actions">${row.status === 'trashed' ? `<button class="button small secondary" data-video-action="restore" type="button">복구</button>` : `<button class="button small ghost" data-video-action="edit" type="button">수정</button><button class="button small ghost" data-video-action="preview" type="button">미리보기</button><button class="button small secondary" data-video-action="toggle-publish" type="button">${row.status === 'published' ? '비공개' : '공개'}</button><button class="button small secondary" data-video-action="toggle-home" type="button">${row.home_featured ? '홈에서 내리기' : '홈에 표시'}</button><button class="button small danger" data-video-action="trash" type="button">휴지통</button>`}</div></article>`;
    }).join('');
    $('#video-empty').classList.toggle('hidden', rows.length > 0);
  }

  $('#new-video').addEventListener('click', () => openVideoForm());
  $('#video-cancel').addEventListener('click', () => $('#video-form').classList.add('hidden'));
  $('#video-url').addEventListener('input', updateVideoPreview);
  $('#video-custom-image').addEventListener('input', updateVideoPreview);
  $('#video-search').addEventListener('input', renderVideos);
  $('#video-filter-status').addEventListener('input', renderVideos);
  $('#video-form').addEventListener('submit', async event => {
    event.preventDefault();
    const youtubeId = updateVideoPreview();
    const message = $('#video-message');
    if (!youtubeId) return message.textContent = '유효한 YouTube 주소가 필요합니다.';
    const currentId = $('#video-id').value;
    const wantsHome = $('#video-home').checked;
    const wantsPublished = $('#video-published').checked;
    if (wantsHome && !wantsPublished) return message.textContent = '홈 화면 표시는 공개 동영상에서만 선택할 수 있습니다.';
    const featuredCount = videos.filter(row => row.status === 'published' && row.home_featured && row.id !== currentId).length;
    if (wantsHome && featuredCount >= 8) return message.textContent = '홈 화면에는 최대 8개만 표시할 수 있습니다. 기존 영상 하나를 먼저 홈에서 내려 주세요.';
    const payload = { title: $('#video-title').value.trim(), description: $('#video-description').value.trim(), youtube_url: $('#video-url').value.trim(), youtube_id: youtubeId, thumbnail_url: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`, custom_image_url: $('#video-custom-image').value.trim(), category: $('#video-category').value.trim(), related_post_id: $('#video-related-post').value || null, status: wantsPublished ? 'published' : 'draft', home_featured: wantsHome, home_order: Number($('#video-order').value) || 0, published_at: $('#video-date').value || today(), created_by: currentUser.id };
    const result = currentId ? await db.from('videos').update(payload).eq('id', currentId) : await db.from('videos').insert(payload);
    if (result.error) return message.textContent = `저장하지 못했습니다: ${result.error.message}`;
    $('#video-form').classList.add('hidden');
    await loadVideos();
    showToast('동영상 정보를 저장했습니다.');
  });

  $('#video-list').addEventListener('click', async event => {
    const action = event.target.dataset.videoAction;
    if (!action) return;
    const id = event.target.closest('[data-video-id]').dataset.videoId;
    const row = videos.find(item => item.id === id);
    if (!row) return;
    if (action === 'edit') return openVideoForm(row);
    if (action === 'preview') return window.open(row.status === 'published' ? `/video?id=${encodeURIComponent(id)}` : row.youtube_url, '_blank', 'noopener');
    if (action === 'trash' && !confirm('이 동영상을 휴지통으로 옮길까요? 나중에 복구할 수 있습니다.')) return;
    let changes;
    if (action === 'restore') changes = { status: 'draft', deleted_at: null, home_featured: false };
    if (action === 'trash') changes = { status: 'trashed', deleted_at: new Date().toISOString(), home_featured: false };
    if (action === 'toggle-publish') changes = row.status === 'published' ? { status: 'draft', home_featured: false } : { status: 'published' };
    if (action === 'toggle-home') {
      if (row.status !== 'published') return showToast('먼저 동영상을 공개해 주세요.', true);
      if (!row.home_featured && videos.filter(item => item.status === 'published' && item.home_featured).length >= 8) return showToast('홈 화면에는 최대 8개만 표시할 수 있습니다.', true);
      changes = { home_featured: !row.home_featured };
    }
    const { error } = await db.from('videos').update(changes).eq('id', id);
    if (error) showToast(error.message, true); else { await loadVideos(); showToast('동영상 상태를 변경했습니다.'); }
  });

  resetCategory();
  initialize();
})();
