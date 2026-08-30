(() => {
  const dialog = document.querySelector('#image-lightbox');
  const viewer = dialog?.querySelector('.image-lightbox-image');
  const inner = dialog?.querySelector('.image-lightbox-inner');
  const closeButton = dialog?.querySelector('.image-lightbox-close');
  const article = document.querySelector('#article');
  if (!dialog || !viewer || !inner || !closeButton || !article) return;

  let opener = null;
  const close = () => {
    if (dialog.open) dialog.close();
  };
  const open = image => {
    opener = image;
    viewer.src = image.currentSrc || image.src;
    viewer.alt = image.alt || '';
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
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

  closeButton.addEventListener('click', close);
  inner.addEventListener('click', event => {
    if (event.target === inner) close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    viewer.removeAttribute('src');
    opener?.focus({ preventScroll: true });
    opener = null;
  });

  scan(article);
  new MutationObserver(() => scan(article)).observe(article, { childList: true, subtree: true });
})();
