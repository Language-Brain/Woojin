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
  const normalizeTags = value => {
    const seen = new Set();
    return (Array.isArray(value) ? value : String(value || '').split(','))
      .map(tag => String(tag).trim().replace(/^#+\s*/, '').replace(/\s+/g, ' '))
      .filter(tag => { const key = tag.toLocaleLowerCase('ko-KR'); if (!tag || seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, 20);
  };

  let currentUser = null;
  let allPosts = [];
  let categories = [];
  let mediaAssets = [];
  let viewRows = [];
  let videos = [];
  let books = [];
  let guides = [];
  let guideTags = [];
  let pyeongjaeEntries = [];
  let pjPages = [];
  let pjPageIndex = 0;
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
    await Promise.all([loadCategories(), loadPosts(), loadMedia(), loadViews(), loadInquiries(), loadVideos(), loadBooks(), loadGuides(), loadGuideTags(), loadPyeongjae()]);
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
    if (view === 'books') renderBookTable();
    if (view === 'guides') renderGuideTable();
    if (view === 'pyeongjae') renderPyeongjaeTable();
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
    Font.whitelist = ['noto-sans', 'nanum-gothic', 'system-sans'];
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
      tags: normalizeTags($('#post-tags').value),
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

  const safePreviewUrl = value => {
    try {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const url = new URL(raw, location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  };

  function normalizePreviewLinks(root) {
    if (!root) return;
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('a,script,style,code,pre,textarea') && /https?:\/\//i.test(node.nodeValue || '')) nodes.push(node);
    }
    nodes.forEach(node => {
      const text = node.nodeValue || '';
      const expression = /https?:\/\/[^\s<>"']+/gi;
      let match; let last = 0; let changed = false;
      const fragment = document.createDocumentFragment();
      while ((match = expression.exec(text))) {
        let hrefText = match[0]; let trailing = '';
        while (hrefText && '.,!?;:)]}。、'.includes(hrefText.at(-1))) {
          trailing = hrefText.at(-1) + trailing;
          hrefText = hrefText.slice(0, -1);
        }
        const safe = safePreviewUrl(hrefText);
        if (!safe) continue;
        fragment.append(document.createTextNode(text.slice(last, match.index)));
        const link = document.createElement('a');
        link.href = safe.href;
        link.textContent = hrefText;
        fragment.append(link);
        if (trailing) fragment.append(document.createTextNode(trailing));
        last = match.index + match[0].length;
        changed = true;
      }
      if (changed) {
        fragment.append(document.createTextNode(text.slice(last)));
        node.replaceWith(fragment);
      }
    });
    root.querySelectorAll('a').forEach(link => {
      const safe = safePreviewUrl(link.getAttribute('href'));
      if (!safe) {
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.removeAttribute('rel');
        return;
      }
      link.href = safe.origin === location.origin ? safe.pathname + safe.search + safe.hash : safe.href;
      if (safe.origin !== location.origin) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      } else {
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
  }

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
    normalizePreviewLinks($('#preview-content'));
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
    $('#view-summary').innerHTML = totalViews ? `<strong style="font:700 34px var(--sans)">${totalViews}</strong><p>수집된 유효 조회</p>` : '아직 수집된 통계가 없습니다.';
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


  function cleanBookUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      if (!/^https?:$/.test(url.protocol)) return '';
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','mc_cid','mc_eid'].forEach(key => url.searchParams.delete(key));
      return url.href;
    } catch { return ''; }
  }

  function normalizeBookLinks(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'object') return [value];
    if (typeof value === 'string') {
      try { return normalizeBookLinks(JSON.parse(value)); }
      catch { return cleanBookUrl(value) ? [{ label: '외부에서 보기', url: value }] : []; }
    }
    return [];
  }

  function normalizedBookTitle(value) { return String(value || '').toLocaleLowerCase('ko-KR').replace(/[\\s·:：,.'\"“”‘’()\\[\\]{}_-]+/g, ''); }
  function similarBookTitles(value, ignoredId = '') {
    const target = normalizedBookTitle(value);
    if (target.length < 2) return [];
    return books.filter(book => book.id !== ignoredId && book.status !== 'trashed').filter(book => {
      const candidate = normalizedBookTitle(book.title);
      return candidate === target || (Math.min(candidate.length, target.length) >= 5 && (candidate.includes(target) || target.includes(candidate)));
    });
  }

  function setBookCoverPreview(url, label = '') {
    const preview = $('#book-cover-preview');
    preview.replaceChildren();
    if (url) { const image = document.createElement('img'); image.src = url; image.alt = '선택한 책 표지 미리보기'; preview.append(image); }
    else preview.innerHTML = '<span>표지 없음</span>';
    $('#book-cover-name').textContent = label || (url ? '등록된 표지' : '선택된 파일 없음');
  }

  function addBookLinkRow(link = {}) {
    const row = document.createElement('div'); row.className = 'book-link-row';
    row.innerHTML = '<input data-book-link-label maxlength="80" placeholder="연결처 이름 (예: 교보문고에서 보기)"><input data-book-link-url type="url" maxlength="1000" placeholder="https://..."><button class="button ghost small" data-remove-book-link type="button">삭제</button>';
    row.querySelector('[data-book-link-label]').value = link.label || '';
    row.querySelector('[data-book-link-url]').value = link.url || '';
    $('#book-links-editor').append(row);
  }

  function resetBookForm() {
    $('#book-form').reset(); $('#book-id').value = ''; $('#book-cover-url').value = ''; $('#book-order').value = '0';
    $('#book-form-title').textContent = '새 책'; $('#book-links-editor').replaceChildren(); addBookLinkRow(); setBookCoverPreview('');
    $('#book-duplicate-warning').hidden = true; $('#book-message').textContent = '';
  }

  function openBookForm(book = null) {
    resetBookForm();
    if (book) {
      $('#book-id').value = book.id; $('#book-title').value = book.title || ''; $('#book-author').value = book.author || '';
      $('#book-description').value = book.description || ''; $('#book-cover-url').value = book.cover_url || ''; $('#book-status').value = book.status === 'published' ? 'published' : 'draft';
      $('#book-order').value = book.display_order ?? 0; $('#book-pinned').checked = !!book.is_pinned; $('#book-publisher').value = book.publisher || '';
      $('#book-year').value = book.publication_year || ''; $('#book-isbn').value = book.isbn || ''; $('#book-note').value = book.admin_note || '';
      const storedLinks = normalizeBookLinks(book.links);
      $('#book-links-editor').replaceChildren(); (storedLinks.length ? storedLinks : [{}]).forEach(addBookLinkRow);
      setBookCoverPreview(book.cover_url, '등록된 표지'); $('#book-form-title').textContent = '책 수정';
    }
    $('#book-form').classList.remove('hidden'); $('#book-title').focus(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function collectBookLinks() {
    const links = $$('.book-link-row').map(row => ({ label: row.querySelector('[data-book-link-label]').value.trim(), url: cleanBookUrl(row.querySelector('[data-book-link-url]').value) })).filter(link => link.label || link.url);
    if (links.some(link => !link.label || !link.url)) throw new Error('각 외부 링크의 연결처 이름과 올바른 http 또는 https 주소를 모두 입력해 주세요.');
    return links;
  }

  function renderBookPreview(book) {
    const content = $('#book-preview-content'); content.replaceChildren();
    const image = document.createElement('img'); image.src = book.cover_url || ($('#book-cover-preview img')?.src || ''); image.alt = `${book.title} 책 표지`;
    const copy = document.createElement('div'), title = document.createElement('h2'), author = document.createElement('p'), description = document.createElement('p');
    title.textContent = book.title || '제목 없음'; author.textContent = book.author || '저자 없음'; description.textContent = book.description || '';
    copy.append(title, author, description); const safeLinks = normalizeBookLinks(book.links).map(link => ({ label: String(link?.label || '외부에서 보기'), url: cleanBookUrl(link?.url) })).filter(link => link.url);
    if (safeLinks.length) { const nav = document.createElement('nav'); safeLinks.forEach(link => { const a = document.createElement('a'); a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = link.label; nav.append(a); }); copy.append(nav); }
    content.append(image, copy); $('#book-preview-dialog').showModal();
  }

  function renderBookTable() {
    const search = $('#book-search').value.trim().toLocaleLowerCase('ko-KR'), status = $('#book-filter-status').value;
    const rows = books.filter(book => (!search || book.title.toLocaleLowerCase('ko-KR').includes(search)) && (status === 'all' || status === 'active' ? status !== 'active' || book.status !== 'trashed' : book.status === status));
    $('#book-empty').classList.toggle('hidden', rows.length > 0);
    $('#book-table-body').innerHTML = rows.map(book => `<tr data-book-id="${book.id}"><td><img class="book-list-cover" src="${escapeText(book.cover_url || '')}" alt=""></td><td><strong class="book-list-title">${escapeText(book.title)}<small>${escapeText(book.author)}</small></strong>${book.is_pinned ? '<span class="badge published">전면 고정</span>' : ''}</td><td>${formatDate(book.created_at)}</td><td><span class="badge ${book.status}">${statusLabels[book.status]}</span></td><td><div class="book-order-controls"><button class="button ghost small" data-book-action="up" title="앞으로">↑</button><b>${book.display_order ?? 0}</b><button class="button ghost small" data-book-action="down" title="뒤로">↓</button></div></td><td><div class="book-actions"><button class="button ghost small" data-book-action="preview">미리보기</button><button class="button secondary small" data-book-action="edit">수정</button>${book.status === 'trashed' ? '<button class="button secondary small" data-book-action="restore">복구</button>' : '<button class="button ghost small" data-book-action="toggle">'+(book.status === 'published' ? '비공개' : '공개')+'</button><button class="button danger small" data-book-action="trash">휴지통</button>'}</div></td></tr>`).join('');
  }

  async function loadBooks() {
    const { data, error } = await db.from('books').select('*').order('is_pinned', { ascending: false }).order('display_order').order('created_at', { ascending: false });
    if (error) { console.error('책 목록 조회 실패', error.message); books = []; } else books = data || [];
    renderBookTable();
  }


  $('#new-book').addEventListener('click', () => openBookForm());
  $('#book-cancel').addEventListener('click', () => $('#book-form').classList.add('hidden'));
  $('#add-book-link').addEventListener('click', () => addBookLinkRow());
  $('#book-links-editor').addEventListener('click', event => { if (event.target.matches('[data-remove-book-link]')) event.target.closest('.book-link-row').remove(); });
  $('#book-title').addEventListener('input', () => { $('#book-duplicate-warning').hidden = similarBookTitles($('#book-title').value, $('#book-id').value).length === 0; });
  $('#book-cover').addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; try { validateImage(file); setBookCoverPreview(URL.createObjectURL(file), file.name); } catch (error) { event.target.value = ''; showToast(error.message, true); } });
  $('#book-search').addEventListener('input', renderBookTable); $('#book-filter-status').addEventListener('change', renderBookTable);
  $('#close-book-preview').addEventListener('click', () => $('#book-preview-dialog').close());
  $('#book-preview-dialog').addEventListener('click', event => { if (event.target === $('#book-preview-dialog')) $('#book-preview-dialog').close(); });
  $('#book-form-preview').addEventListener('click', () => { try { renderBookPreview({ title: $('#book-title').value.trim(), author: $('#book-author').value.trim(), description: $('#book-description').value.trim(), cover_url: $('#book-cover-url').value, links: collectBookLinks() }); } catch (error) { showToast(error.message, true); } });

  $('#book-form').addEventListener('submit', async event => {
    event.preventDefault(); const message = $('#book-message'), button = event.submitter; message.textContent = '';
    const id = $('#book-id').value, title = $('#book-title').value.trim(), author = $('#book-author').value.trim(), file = $('#book-cover').files[0];
    if (!title || !author) return message.textContent = '책 제목과 저자를 입력해 주세요.';
    if (!file && !$('#book-cover-url').value) return message.textContent = '직접 업로드할 책 표지를 선택해 주세요.';
    const duplicates = similarBookTitles(title, id);
    const exactDuplicate = duplicates.find(book => normalizedBookTitle(book.title) === normalizedBookTitle(title) && normalizedBookTitle(book.author) === normalizedBookTitle(author));
    if (!id && exactDuplicate) return message.textContent = '같은 제목과 저자의 책이 이미 저장되어 있어 중복 저장하지 않았습니다. 아래 목록에서 기존 책의 수정 버튼을 이용해 주세요.';
    if (duplicates.length && !confirm(`“${duplicates[0].title}”과 제목이 비슷합니다. 개정판·동명 도서가 맞다면 확인을 눌러 저장해 주세요.`)) return;
    let links; try { links = collectBookLinks(); } catch (error) { return message.textContent = error.message; }
    button.disabled = true; message.textContent = '책 정보를 저장하고 있습니다.';
    try {
      let coverUrl = $('#book-cover-url').value;
      if (file) { const uploaded = await uploadImage(file, `${title} 책 표지`); coverUrl = uploaded.publicUrl; }
      const payload = { title, author, description: $('#book-description').value.trim(), cover_url: coverUrl, links, status: $('#book-status').value, is_pinned: $('#book-pinned').checked, display_order: Number($('#book-order').value) || 0, publisher: $('#book-publisher').value.trim() || null, publication_year: Number($('#book-year').value) || null, isbn: $('#book-isbn').value.trim() || null, admin_note: $('#book-note').value.trim() || null, deleted_at: null };
      const result = id ? await db.from('books').update(payload).eq('id', id) : await db.from('books').insert({ ...payload, created_by: currentUser.id });
      if (result.error) throw result.error;
      $('#book-form').classList.add('hidden'); await Promise.all([loadBooks(), loadMedia()]); showToast('책 정보를 저장했습니다.');
    } catch (error) { message.textContent = `저장하지 못했습니다: ${error.message}`; } finally { button.disabled = false; }
  });

  $('#book-table-body').addEventListener('click', async event => {
    const action = event.target.dataset.bookAction; if (!action) return; const id = event.target.closest('[data-book-id]').dataset.bookId, book = books.find(item => item.id === id); if (!book) return;
    if (action === 'edit') return openBookForm(book); if (action === 'preview') return renderBookPreview(book);
    if (action === 'trash' && !confirm(`“${book.title}”을 책 휴지통으로 옮길까요? 나중에 복구할 수 있습니다.`)) return;
    let changes;
    if (action === 'trash') changes = { status: 'trashed', deleted_at: new Date().toISOString(), is_pinned: false };
    if (action === 'restore') changes = { status: 'draft', deleted_at: null };
    if (action === 'toggle') changes = { status: book.status === 'published' ? 'draft' : 'published', deleted_at: null };
    if (action === 'up' || action === 'down') {
      const active = books.filter(item => item.status !== 'trashed'); const index = active.findIndex(item => item.id === id), neighbor = active[index + (action === 'up' ? -1 : 1)]; if (!neighbor) return;
      const firstOrder = Number(book.display_order) || 0, secondOrder = Number(neighbor.display_order) || 0;
      const [{ error: firstError }, { error: secondError }] = await Promise.all([db.from('books').update({ display_order: secondOrder }).eq('id', book.id), db.from('books').update({ display_order: firstOrder }).eq('id', neighbor.id)]);
      if (firstError || secondError) return showToast((firstError || secondError).message, true); await loadBooks(); return showToast('진열 순서를 바꿨습니다.');
    }
    if (!changes) return; const { error } = await db.from('books').update(changes).eq('id', id); if (error) showToast(error.message, true); else { await loadBooks(); showToast('책 상태를 변경했습니다.'); }
  });


  function addGuideLinkRow(link={}){const row=document.createElement('div');row.className='book-link-row';row.innerHTML='<input data-guide-link-label maxlength="80" placeholder="연결처 이름"><input data-guide-link-url type="url" maxlength="1000" placeholder="https://..."><button class="button ghost small" data-remove-guide-link type="button">삭제</button>';row.querySelector('[data-guide-link-label]').value=link.label||'';row.querySelector('[data-guide-link-url]').value=link.url||'';$('#guide-links-editor').append(row)}
  function guideLinks(){return $$('#guide-links-editor .book-link-row [data-guide-link-label]').map(input=>{const row=input.closest('.book-link-row'),label=input.value.trim(),url=cleanBookUrl(row.querySelector('[data-guide-link-url]').value);if((label||row.querySelector('[data-guide-link-url]').value)&&(!label||!url))throw new Error('외부 링크의 이름과 올바른 주소를 함께 입력해 주세요.');return label&&url?{label,url}:null}).filter(Boolean)}
  function resetGuideForm(){ $('#guide-form').reset();$('#guide-id').value='';$('#guide-form-title').textContent='새 자료';$('#guide-links-editor').replaceChildren();addGuideLinkRow();$('#guide-message').textContent='';}
  function openGuideForm(row=null){resetGuideForm();if(row){$('#guide-id').value=row.id;$('#guide-title').value=row.title||'';$('#guide-description').value=row.description||'';$('#guide-course').value=row.course_name||'';$('#guide-institution').value=row.institution_name||'';$('#guide-tags').value=(row.tags||[]).join(', ');$('#guide-body').value=row.body||'';$('#guide-youtube').value=row.youtube_url||'';$('#guide-visibility').value=row.visibility||'private';$('#guide-links-editor').replaceChildren();(Array.isArray(row.external_links)&&row.external_links.length?row.external_links:[{}]).forEach(addGuideLinkRow);$('#guide-form-title').textContent='자료 수정'}$('#guide-form').classList.remove('hidden');$('#guide-title').focus();window.scrollTo({top:0,behavior:'smooth'})}
  function guideUrl(row){return '/guide?id='+encodeURIComponent(row.id)+(row.visibility==='unlisted'?'&token='+encodeURIComponent(row.access_token):'')}
  function previewGuide(row){const out=$('#guide-preview-content');out.replaceChildren();const h=document.createElement('h1'),meta=document.createElement('p'),desc=document.createElement('p'),body=document.createElement('div');h.textContent=row.title||'제목 없음';meta.textContent=(row.tags||[]).map(t=>'#'+t).join(' ');desc.textContent=row.description||'';body.style.whiteSpace='pre-wrap';body.style.lineHeight='1.8';body.textContent=row.body||'';out.append(h,meta,desc,body);$('#guide-preview-dialog').showModal()}
  function renderGuideTags(){ $('#guide-tag-admin').replaceChildren(...guideTags.map(tag=>{const chip=document.createElement('span');chip.className='guide-tag-chip';chip.append(document.createTextNode('#'+tag.name+' · '+tag.display_order));const edit=document.createElement('button');edit.type='button';edit.dataset.guideTagEdit=tag.id;edit.textContent='수정';const remove=document.createElement('button');remove.type='button';remove.dataset.guideTagDelete=tag.id;remove.textContent='×';remove.title='태그 삭제';chip.append(edit,remove);return chip}))}
  function renderGuideTable(){const term=$('#guide-admin-search').value.trim().toLocaleLowerCase('ko-KR'),filter=$('#guide-admin-filter').value,sort=$('#guide-admin-sort').value;let rows=guides.filter(row=>(!term||[row.title,row.course_name,row.institution_name,...(row.tags||[])].join(' ').toLocaleLowerCase('ko-KR').includes(term))&&(filter==='all'||filter==='active'?filter!=='active'||row.status!=='trashed':filter==='trashed'?row.status==='trashed':row.status!=='trashed'&&row.visibility===filter));rows.sort((a,b)=>sort==='oldest'?new Date(a.created_at)-new Date(b.created_at):sort==='views'?Number(b.view_count)-Number(a.view_count):new Date(b.updated_at)-new Date(a.updated_at));$('#guide-empty').classList.toggle('hidden',!!rows.length);$('#guide-table-body').innerHTML=rows.map(row=>`<tr data-guide-id="${row.id}"><td><strong class="guide-row-title">${escapeText(row.title)}<small>${escapeText([row.institution_name,row.course_name,(row.tags||[]).map(t=>'#'+t).join(' ')].filter(Boolean).join(' · '))}</small></strong></td><td><span class="badge ${row.status==='trashed'?'trashed':row.visibility==='public'?'published':'draft'}">${row.status==='trashed'?'휴지통':({public:'공개',unlisted:'링크 전용',private:'비공개'})[row.visibility]}</span></td><td>${formatDate(row.updated_at)}</td><td>${Number(row.view_count||0).toLocaleString()}</td><td><div class="guide-actions"><button class="button ghost small" data-guide-action="preview">미리보기</button><button class="button secondary small" data-guide-action="edit">수정</button>${row.status==='trashed'?'<button class="button secondary small" data-guide-action="restore">복구</button><button class="button danger small" data-guide-action="delete">영구 삭제</button>':'<button class="button ghost small" data-guide-action="open">주소 열기</button><button class="button danger small" data-guide-action="trash">휴지통</button>'}</div></td></tr>`).join('')}
  async function loadGuides(){const{data,error}=await db.from('guides').select('*').order('updated_at',{ascending:false});guides=error?[]:(data||[]);renderGuideTable()}
  async function loadGuideTags(){const{data,error}=await db.from('guide_tags').select('*').order('display_order');guideTags=error?[]:(data||[]);renderGuideTags()}
  $('#new-guide').addEventListener('click',()=>openGuideForm());$('#guide-cancel').addEventListener('click',()=>$('#guide-form').classList.add('hidden'));$('#add-guide-link').addEventListener('click',()=>addGuideLinkRow());$('#guide-links-editor').addEventListener('click',e=>{if(e.target.matches('[data-remove-guide-link]'))e.target.closest('.book-link-row').remove()});$('#close-guide-preview').addEventListener('click',()=>$('#guide-preview-dialog').close());$('#guide-preview').addEventListener('click',()=>{try{previewGuide({title:$('#guide-title').value,description:$('#guide-description').value,body:$('#guide-body').value,tags:normalizeTags($('#guide-tags').value)})}catch(e){showToast(e.message,true)}});['#guide-admin-search','#guide-admin-filter','#guide-admin-sort'].forEach(selector=>$(selector).addEventListener(selector.includes('search')?'input':'change',renderGuideTable));
  $('#guide-form').addEventListener('submit',async e=>{e.preventDefault();const message=$('#guide-message'),id=$('#guide-id').value;let links;try{links=guideLinks()}catch(error){return message.textContent=error.message}const youtube=$('#guide-youtube').value.trim();if(youtube&&!cleanBookUrl(youtube))return message.textContent='올바른 YouTube 주소를 입력해 주세요.';const payload={title:$('#guide-title').value.trim(),description:$('#guide-description').value.trim(),body:$('#guide-body').value,course_name:$('#guide-course').value.trim(),institution_name:$('#guide-institution').value.trim(),tags:normalizeTags($('#guide-tags').value),external_links:links,youtube_url:youtube||null,visibility:$('#guide-visibility').value,status:'active',deleted_at:null};if(!payload.title||!payload.body)return message.textContent='제목과 본문을 입력해 주세요.';e.submitter.disabled=true;const result=id?await db.from('guides').update(payload).eq('id',id):await db.from('guides').insert({...payload,created_by:currentUser.id});e.submitter.disabled=false;if(result.error)return message.textContent=result.error.message;$('#guide-form').classList.add('hidden');await loadGuides();showToast('자료를 저장했습니다.')});
  $('#guide-table-body').addEventListener('click',async e=>{const action=e.target.dataset.guideAction;if(!action)return;const row=guides.find(x=>x.id===e.target.closest('[data-guide-id]').dataset.guideId);if(!row)return;if(action==='edit')return openGuideForm(row);if(action==='preview')return previewGuide(row);if(action==='open')return window.open(guideUrl(row),'_blank','noopener');if(action==='trash'&&!confirm(`“${row.title}”을 휴지통으로 옮길까요?`))return;if(action==='delete'&&!confirm(`“${row.title}”을 영구 삭제합니다. 복구할 수 없습니다. 계속할까요?`))return;let result;if(action==='trash')result=await db.from('guides').update({status:'trashed',deleted_at:new Date().toISOString()}).eq('id',row.id);if(action==='restore')result=await db.from('guides').update({status:'active',visibility:'private',deleted_at:null}).eq('id',row.id);if(action==='delete')result=await db.from('guides').delete().eq('id',row.id);if(result?.error)showToast(result.error.message,true);else{await loadGuides();showToast('자료 상태를 변경했습니다.')}});
  $('#guide-tag-form').addEventListener('submit',async e=>{e.preventDefault();const name=$('#guide-tag-name').value.trim().replace(/^#/,'');if(!name)return;const{error}=await db.from('guide_tags').insert({name,display_order:Number($('#guide-tag-order').value)||0});if(error)showToast(error.message,true);else{$('#guide-tag-name').value='';await loadGuideTags()}});
  $('#guide-tag-admin').addEventListener('click',async e=>{const editId=e.target.dataset.guideTagEdit,deleteId=e.target.dataset.guideTagDelete;if(editId){const row=guideTags.find(x=>x.id===editId),name=prompt('태그 이름',row.name),order=prompt('표시 순서',row.display_order);if(name===null||order===null)return;const{error}=await db.from('guide_tags').update({name:name.trim().replace(/^#/,''),display_order:Number(order)||0}).eq('id',editId);if(error)showToast(error.message,true);else await loadGuideTags();return}if(!deleteId||!confirm('이 홈 태그를 삭제할까요? 기존 자료의 태그는 유지됩니다.'))return;const{error}=await db.from('guide_tags').delete().eq('id',deleteId);if(error)showToast(error.message,true);else await loadGuideTags()});

  const pjBlankPage=(page=1)=>({page,side:'front',genre:$('#pj-genre')?.value||'기타',work_title:'',marker:'',original_reading:'',literal_translation:'',interpretive_translation:'',notes:''});
  function pjSyncPage(){const box=$('#pj-page-editor');if(!box||!pjPages[pjPageIndex])return;box.querySelectorAll('[data-pj-field]').forEach(el=>pjPages[pjPageIndex][el.dataset.pjField]=el.value)}
  function pjRenderPage(){const page=pjPages[pjPageIndex]||pjBlankPage(Number($('#pj-start').value)||1);$('#pj-page-tabs').innerHTML=pjPages.map((p,i)=>`<button class="pj-page-tab ${i===pjPageIndex?'active':''}" type="button" data-pj-page="${i}">${escapeText(p.page||i+1)}쪽</button>`).join('');$('#pj-page-editor').innerHTML=`<div class="pj-page-meta"><label>쪽<input data-pj-field="page" type="number" min="1" value="${escapeText(page.page)}"></label><label>면<select data-pj-field="side"><option value="front" ${page.side==='front'?'selected':''}>앞면</option><option value="back" ${page.side==='back'?'selected':''}>뒷면</option></select></label><label>종류<select data-pj-field="genre">${['시','편지','잡저','기문','축문','제문','묘지명','행장','기타'].map(x=>`<option ${x===page.genre?'selected':''}>${x}</option>`).join('')}</select></label><label>작품명<input data-pj-field="work_title" value="${escapeText(page.work_title)}"></label><label>이어짐·판독 표식<input data-pj-field="marker" value="${escapeText(page.marker)}" placeholder="앞 글에서 이어짐, 판독 불확실"></label></div><label>1. 원문과 음독<textarea data-pj-field="original_reading"></textarea></label><label>2. 현대어 직역<textarea data-pj-field="literal_translation"></textarea></label><label>3. 현대어 의역<textarea data-pj-field="interpretive_translation"></textarea></label><label>4. 참고<textarea data-pj-field="notes"></textarea></label>`;box.querySelectorAll('[data-pj-field]').forEach(el=>{if(el.tagName==='TEXTAREA')el.value=page[el.dataset.pjField]||''})}
  function pjReset(){ $('#pyeongjae-form').reset();$('#pj-id').value='';$('#pj-form-title').textContent='새 번역 묶음';$('#pj-start').value=1;$('#pj-end').value=5;pjPages=[pjBlankPage(1),pjBlankPage(2),pjBlankPage(3),pjBlankPage(4),pjBlankPage(5)];pjPageIndex=0;$('#pj-message').textContent='';pjRenderPage() }
  function pjOpen(row=null){pjReset();if(row){$('#pj-id').value=row.id;$('#pj-form-title').textContent='번역 묶음 수정';for(const [id,key] of [['pj-book','book_no'],['pj-volume','volume_no'],['pj-start','start_page'],['pj-end','end_page'],['pj-side','side'],['pj-genre','genre'],['pj-review','review_status'],['pj-order','source_order'],['pj-title','title'],['pj-work-title','work_title'],['pj-summary','summary']])$('#'+id).value=row[key]??'';$('#pj-people').value=(row.people||[]).join(', ');$('#pj-places').value=(row.places||[]).join(', ');$('#pj-tags').value=(row.tags||[]).join(', ');$('#pj-references').value=(Array.isArray(row.reference_links)?row.reference_links:[]).map(x=>`${x.label||''} | ${x.url||''}`).join('\n');pjPages=Array.isArray(row.pages)&&row.pages.length?structuredClone(row.pages):[pjBlankPage(row.start_page)];pjPageIndex=0;pjRenderPage()}$('#pyeongjae-form').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
  function pjReferences(){return $('#pj-references').value.split(/\r?\n/).map(line=>{const [label,...rest]=line.split('|'),url=rest.join('|').trim();if(!line.trim())return null;const safe=cleanBookUrl(url);if(!label.trim()||!safe)throw new Error('관련 문헌 링크는 “이름 | https://주소” 형식으로 입력해 주세요.');return{label:label.trim(),url:safe}}).filter(Boolean)}
  function pjPayload(status){pjSyncPage();const start=Number($('#pj-start').value),end=Number($('#pj-end').value);if(!start||!end||end<start||end>start+4)throw new Error('한 묶음은 시작 쪽부터 최대 다섯 쪽까지 지정해 주세요.');const title=$('#pj-title').value.trim();if(!title)throw new Error('대표 제목을 입력해 주세요.');if(status==='published'&&!pjPages.some(p=>p.original_reading||p.literal_translation||p.interpretive_translation||p.notes))throw new Error('공개하려면 번역 본문을 한 부분 이상 입력해 주세요.');return{book_no:Number($('#pj-book').value),volume_no:Number($('#pj-volume').value),start_page:start,end_page:end,side:$('#pj-side').value,genre:$('#pj-genre').value,work_title:$('#pj-work-title').value.trim(),title,summary:$('#pj-summary').value.trim(),people:normalizeTags($('#pj-people').value),places:normalizeTags($('#pj-places').value),tags:normalizeTags($('#pj-tags').value),pages:pjPages,reference_links:pjReferences(),review_status:$('#pj-review').value,status,source_order:Number($('#pj-order').value)||0,deleted_at:null,published_at:status==='published'?(pyeongjaeEntries.find(x=>x.id===$('#pj-id').value)?.published_at||new Date().toISOString()):null}}
  function pjParsePaste(){const raw=$('#pj-paste').value;if(!raw.trim())return showToast('정리본을 먼저 붙여넣어 주세요.',true);const header=raw.match(/■\s*권\s*(\d+)[_\s]*(\d+)쪽\s*\((앞|뒤|뒷)\)/);const section=(n,next)=>{const re=new RegExp(`${n}\\.\\s*[^\\n]*\\n([\\s\\S]*?)(?=\\n${next}\\.|$)`);return raw.match(re)?.[1]?.trim()||''};const page=pjBlankPage(Number(header?.[2]||$('#pj-start').value||1));page.side=/뒤|뒷/.test(header?.[3]||'')?'back':'front';page.original_reading=section(1,2);page.literal_translation=section(2,3);page.interpretive_translation=section(3,4);page.notes=raw.match(/4\.\s*[^\n]*\n([\s\S]*)/)?.[1]?.trim()||'';if(header){$('#pj-volume').value=header[1];$('#pj-start').value=header[2];$('#pj-end').value=header[2]}pjPages=[page];pjPageIndex=0;pjRenderPage();showToast('영역을 나누었습니다. 저장 전에 내용을 확인해 주세요.')}
  function pjDuplicateWarning(){const id=$('#pj-id').value,volume=Number($('#pj-volume').value),start=Number($('#pj-start').value),end=Number($('#pj-end').value),side=$('#pj-side').value,duplicate=pyeongjaeEntries.find(r=>r.id!==id&&r.status!=='trashed'&&r.volume_no===volume&&r.start_page===start&&r.end_page===end&&r.side===side);$('#pj-message').textContent=duplicate?'안내: 같은 권·쪽수·면의 묶음이 이미 있습니다. 기존 자료를 수정하거나 범위를 확인해 주세요.':''}
  function renderPyeongjaeTable(){const term=$('#pj-search').value.trim().toLocaleLowerCase('ko-KR'),filter=$('#pj-filter').value,sort=$('#pj-sort').value;let rows=pyeongjaeEntries.filter(r=>(filter==='all'||filter==='active'?filter!=='active'||r.status!=='trashed':r.status===filter)&&(!term||[r.title,r.work_title,...(r.people||[]),...(r.places||[]),...(r.tags||[])].join(' ').toLocaleLowerCase('ko-KR').includes(term)));rows.sort((a,b)=>sort==='updated'?new Date(b.updated_at)-new Date(a.updated_at):sort==='views'?Number(b.view_count)-Number(a.view_count):(a.volume_no-b.volume_no)||(a.source_order-b.source_order)||(a.start_page-b.start_page));$('#pj-empty').classList.toggle('hidden',!!rows.length);$('#pj-table').innerHTML=rows.map(r=>`<tr data-pj-id="${r.id}"><td><strong>제${r.book_no}책 · 권${r.volume_no}<br>${r.start_page}–${r.end_page}쪽</strong></td><td><strong class="pj-admin-title">${escapeText(r.genre)} · ${escapeText(r.title)}<small>${escapeText([...(r.people||[]),...(r.tags||[])].join(' · '))}</small></strong></td><td>${escapeText(r.review_status)}</td><td><span class="badge ${r.status==='published'?'published':r.status==='trashed'?'trashed':'draft'}">${statusLabels[r.status]||r.status}</span></td><td>${formatDate(r.updated_at)}<br><small>조회 ${Number(r.view_count||0).toLocaleString()}</small></td><td><div class="guide-actions">${r.status!=='trashed'?'<button class="button secondary small" data-pj-action="edit">수정</button><button class="button ghost small" data-pj-action="open">보기</button><button class="button danger small" data-pj-action="trash">휴지통</button>':'<button class="button secondary small" data-pj-action="restore">복원</button><button class="button danger small" data-pj-action="delete">완전 삭제</button>'}</div></td></tr>`).join('')}
  async function loadPyeongjae(){const{data,error}=await db.from('pyeongjae_entries').select('*').order('volume_no').order('source_order').order('start_page');pyeongjaeEntries=error?[]:(data||[]);if($('#pj-table'))renderPyeongjaeTable()}
  $('#new-pyeongjae').addEventListener('click',()=>pjOpen());$('#pj-cancel').addEventListener('click',()=>$('#pyeongjae-form').classList.add('hidden'));$('#pj-add-page').addEventListener('click',()=>{pjSyncPage();if(pjPages.length>=5)return showToast('공개 묶음은 최대 다섯 쪽입니다.',true);pjPages.push(pjBlankPage((Number(pjPages.at(-1)?.page)||Number($('#pj-start').value)||0)+1));pjPageIndex=pjPages.length-1;$('#pj-end').value=pjPages.at(-1).page;pjRenderPage()});$('#pj-page-tabs').addEventListener('click',e=>{const i=e.target.dataset.pjPage;if(i===undefined)return;pjSyncPage();pjPageIndex=Number(i);pjRenderPage()});$('#pj-parse').addEventListener('click',pjParsePaste);['#pj-volume','#pj-start','#pj-end','#pj-side'].forEach(sel=>$(sel).addEventListener('change',pjDuplicateWarning));['#pj-search','#pj-filter','#pj-sort'].forEach(sel=>$(sel).addEventListener(sel.includes('search')?'input':'change',renderPyeongjaeTable));
  $('#pyeongjae-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter||e.currentTarget.querySelector('[data-status="draft"]'),status=button.dataset.status||'draft',id=$('#pj-id').value,message=$('#pj-message');let payload;try{payload=pjPayload(status)}catch(err){message.textContent=err.message;return}button.disabled=true;const result=id?await db.from('pyeongjae_entries').update(payload).eq('id',id):await db.from('pyeongjae_entries').insert({...payload,created_by:currentUser.id});button.disabled=false;if(result.error){message.textContent=/unique/i.test(result.error.message)?'같은 권·쪽수·면의 묶음이 이미 있습니다. 기존 자료를 확인해 주세요.':result.error.message;return}$('#pyeongjae-form').classList.add('hidden');await loadPyeongjae();showToast(status==='published'?'공개 자료를 저장했습니다.':'임시저장했습니다.')});
  $('#pj-preview').addEventListener('click',()=>{try{const row=pjPayload('draft'),out=$('#guide-preview-content');out.replaceChildren();const h=document.createElement('h1'),m=document.createElement('p'),b=document.createElement('div');h.textContent=row.title;m.textContent=`『평재문집』 권${row.volume_no} ${row.start_page}–${row.end_page}쪽 · ${row.genre}`;b.style.whiteSpace='pre-wrap';b.style.lineHeight='1.7';b.textContent=row.pages.map(p=>`■ ${p.page}쪽(${p.side==='front'?'앞':'뒤'})\n\n1. 원문과 음독\n${p.original_reading}\n\n2. 현대어 직역\n${p.literal_translation}\n\n3. 현대어 의역\n${p.interpretive_translation}\n\n4. 참고\n${p.notes}`).join('\n\n');out.append(h,m,b);$('#guide-preview-dialog').showModal()}catch(err){showToast(err.message,true)}});
  $('#pj-table').addEventListener('click',async e=>{const action=e.target.dataset.pjAction;if(!action)return;const row=pyeongjaeEntries.find(x=>x.id===e.target.closest('[data-pj-id]').dataset.pjId);if(!row)return;if(action==='edit')return pjOpen(row);if(action==='open')return window.open('/pyeongjae-entry?id='+encodeURIComponent(row.id),'_blank','noopener');if(action==='trash'&&!confirm(`“${row.title}”을 휴지통으로 옮길까요?`))return;if(action==='delete'&&!confirm(`“${row.title}”을 완전히 삭제합니다. 복원할 수 없습니다. 계속할까요?`))return;let result;if(action==='trash')result=await db.from('pyeongjae_entries').update({status:'trashed',deleted_at:new Date().toISOString()}).eq('id',row.id);if(action==='restore')result=await db.from('pyeongjae_entries').update({status:'draft',deleted_at:null}).eq('id',row.id);if(action==='delete')result=await db.from('pyeongjae_entries').delete().eq('id',row.id);if(result?.error)showToast(result.error.message,true);else{await loadPyeongjae();showToast('자료 상태를 변경했습니다.')}});
  resetCategory();
  initialize();
})();
