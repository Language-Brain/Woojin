(() => {
  const dialog = document.querySelector('#image-lightbox');
  const viewer = dialog?.querySelector('.image-lightbox-image');
  const inner = dialog?.querySelector('.image-lightbox-inner');
  const closeButton = dialog?.querySelector('.image-lightbox-close');
  const article = document.querySelector('#article');
  if (!dialog || !viewer || !inner || !closeButton || !article) return;

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;
  const DRAG_THRESHOLD = 8;
  const pointers = new Map();
  const state = { scale: 1, x: 0, y: 0 };
  let opener = null;
  let pinch = null;
  let drag = null;
  let backdropGesture = null;
  let savedScrollY = 0;
  let savedBodyStyle = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const viewportCenter = () => {
    const rect = inner.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };
  const bounds = scale => ({
    x: Math.max(0, (viewer.offsetWidth * scale - inner.clientWidth) / 2),
    y: Math.max(0, (viewer.offsetHeight * scale - inner.clientHeight) / 2)
  });
  const constrain = () => {
    if (state.scale <= MIN_SCALE + 0.001) {
      state.scale = MIN_SCALE;
      state.x = 0;
      state.y = 0;
      return;
    }
    const limit = bounds(state.scale);
    state.x = clamp(state.x, -limit.x, limit.x);
    state.y = clamp(state.y, -limit.y, limit.y);
  };
  const render = () => {
    constrain();
    viewer.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
    viewer.classList.toggle('is-pannable', state.scale > MIN_SCALE + 0.001);
  };
  const resetView = () => {
    pointers.clear();
    pinch = null;
    drag = null;
    state.scale = MIN_SCALE;
    state.x = 0;
    state.y = 0;
    viewer.classList.remove('is-dragging');
    render();
  };
  const lockDocument = () => {
    savedScrollY = window.scrollY;
    savedBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow
    };
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  };
  const unlockDocument = () => {
    if (!savedBodyStyle) return;
    Object.assign(document.body.style, savedBodyStyle);
    window.scrollTo(0, savedScrollY);
    savedBodyStyle = null;
  };
  const close = () => {
    if (dialog.open) dialog.close();
  };
  const open = image => {
    opener = image;
    resetView();
    viewer.src = image.currentSrc || image.src;
    viewer.alt = image.alt || '';
    lockDocument();
    dialog.showModal();
    requestAnimationFrame(() => {
      resetView();
      closeButton.focus({ preventScroll: true });
    });
  };
  const enable = image => {
    if (image.dataset.lightboxReady === 'true') return;
    if (image.naturalWidth < 120 && image.naturalHeight < 120) return;
    image.dataset.lightboxReady = 'true';
    image.classList.add('article-zoomable');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${image.alt ? `${image.alt} · ` : ''}이미지 크게 보기`);
    image.addEventListener('click', () => open(image));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(image);
      }
    });
  };
  const scan = root => {
    root.querySelectorAll?.('.article-body img').forEach(image => {
      if (image.complete) enable(image);
      else image.addEventListener('load', () => enable(image), { once: true });
    });
  };
  const startPinch = () => {
    const [a, b] = [...pointers.values()].slice(0, 2);
    if (!a || !b) return;
    const center = viewportCenter();
    const middle = midpoint(a, b);
    pinch = {
      distance: Math.max(1, distance(a, b)),
      scale: state.scale,
      localX: (middle.x - center.x - state.x) / state.scale,
      localY: (middle.y - center.y - state.y) / state.scale
    };
    viewer.classList.add('is-dragging');
  };
  const continueWithSinglePointer = () => {
    const remaining = [...pointers.values()][0];
    pinch = null;
    if (!remaining) {
      drag = null;
      viewer.classList.remove('is-dragging');
      return;
    }
    drag = { pointerX: remaining.x, pointerY: remaining.y, x: state.x, y: state.y };
  };

  viewer.addEventListener('pointerdown', event => {
    if (!dialog.open) return;
    event.preventDefault();
    viewer.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { pointerX: event.clientX, pointerY: event.clientY, x: state.x, y: state.y };
      if (state.scale > MIN_SCALE) viewer.classList.add('is-dragging');
    } else if (pointers.size === 2) startPinch();
  });
  viewer.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()].slice(0, 2);
      if (!pinch) startPinch();
      const nextScale = clamp(pinch.scale * distance(a, b) / pinch.distance, MIN_SCALE, MAX_SCALE);
      const middle = midpoint(a, b);
      const center = viewportCenter();
      state.scale = nextScale;
      state.x = middle.x - center.x - pinch.localX * nextScale;
      state.y = middle.y - center.y - pinch.localY * nextScale;
      render();
      return;
    }
    if (state.scale > MIN_SCALE && drag) {
      state.x = drag.x + event.clientX - drag.pointerX;
      state.y = drag.y + event.clientY - drag.pointerY;
      viewer.classList.add('is-dragging');
      render();
    }
  });
  const endPointer = event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { viewer.releasePointerCapture?.(event.pointerId); } catch {}
    continueWithSinglePointer();
    render();
  };
  viewer.addEventListener('pointerup', endPointer);
  viewer.addEventListener('pointercancel', endPointer);
  viewer.addEventListener('lostpointercapture', event => {
    if (pointers.has(event.pointerId)) {
      pointers.delete(event.pointerId);
      continueWithSinglePointer();
    }
  });

  inner.addEventListener('pointerdown', event => {
    if (event.target !== inner || backdropGesture) return;
    backdropGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    inner.setPointerCapture?.(event.pointerId);
  });
  inner.addEventListener('pointermove', event => {
    if (backdropGesture?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - backdropGesture.x, event.clientY - backdropGesture.y) >= DRAG_THRESHOLD) backdropGesture.moved = true;
  });
  const endBackdropPointer = event => {
    if (backdropGesture?.id !== event.pointerId) return;
    const shouldClose = !backdropGesture.moved && event.target === inner;
    backdropGesture = null;
    try { inner.releasePointerCapture?.(event.pointerId); } catch {}
    if (shouldClose) close();
  };
  inner.addEventListener('pointerup', endBackdropPointer);
  inner.addEventListener('pointercancel', () => { backdropGesture = null; });

  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    resetView();
    viewer.removeAttribute('src');
    unlockDocument();
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  viewer.addEventListener('load', () => {
    if (dialog.open) resetView();
  });
  const handleViewportChange = () => {
    if (dialog.open) render();
  };
  window.addEventListener('resize', handleViewportChange);
  window.visualViewport?.addEventListener('resize', handleViewportChange);

  scan(article);
  new MutationObserver(() => scan(article)).observe(article, { childList: true, subtree: true });
})();
