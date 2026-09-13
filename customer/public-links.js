(() => {
  'use strict';
  const selector = '[data-public-linkify]';
  const excluded = 'a,script,style,code,pre,textarea';
  const trailingCharacters = '.,!?;:)]}。、，。！？；：」』》〉”’\"\'';
  const safeUrl = value => {
    try {
      const url = new URL(String(value || '').trim(), location.origin);
      return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  };
  function normalizeAnchor(anchor) {
    const url = safeUrl(anchor.getAttribute('href'));
    if (!url) {
      anchor.removeAttribute('href');
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
      return;
    }
    const external = url.origin !== location.origin;
    anchor.href = external ? url.href : `${url.pathname}${url.search}${url.hash}`;
    if (external) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    } else {
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    }
  }
  function linkifyTextNode(node) {
    const text = node.nodeValue || '';
    const expression = /https?:\/\/[^\s<>"']+/gi;
    const fragment = document.createDocumentFragment();
    let match;
    let last = 0;
    let changed = false;
    while ((match = expression.exec(text))) {
      let visible = match[0];
      let trailing = '';
      while (visible && trailingCharacters.includes(visible.at(-1))) {
        trailing = visible.at(-1) + trailing;
        visible = visible.slice(0, -1);
      }
      const url = safeUrl(visible);
      if (!url) continue;
      fragment.append(document.createTextNode(text.slice(last, match.index)));
      const anchor = document.createElement('a');
      anchor.href = url.href;
      anchor.textContent = visible;
      normalizeAnchor(anchor);
      fragment.append(anchor);
      if (trailing) fragment.append(document.createTextNode(trailing));
      last = match.index + match[0].length;
      changed = true;
    }
    if (!changed) return;
    fragment.append(document.createTextNode(text.slice(last)));
    node.replaceWith(fragment);
  }
  function enhance(root = document) {
    const containers = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(selector)) containers.push(root);
    const ancestor = root.nodeType === Node.ELEMENT_NODE ? root.closest?.(selector) : null;
    if (ancestor) containers.push(ancestor);
    root.querySelectorAll?.(selector).forEach(element => containers.push(element));
    containers.forEach(container => {
      container.querySelectorAll('a').forEach(normalizeAnchor);
      const nodes = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentElement?.closest(excluded) && /https?:\/\//i.test(node.nodeValue || '')) nodes.push(node);
      }
      nodes.forEach(linkifyTextNode);
    });
  }
  window.LanguageBrainPublicLinks = { enhance };
  enhance(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();
