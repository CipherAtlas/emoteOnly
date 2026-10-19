// Serialize this function into WebDriver's page context. Never collect chat text.
module.exports = function auditChat() {
  const roots = [...document.querySelectorAll('.chat-scrollable-area__message-container,.seventv-chat-list,.pinned-chat__highlight-card')];
  const rows = '.chat-line__message,.seventv-message,.user-notice-line,[data-test-selector="user-notice-line"],.chat-line__status,.pinned-chat__highlight-card';
  const result = { roots: roots.length, rows: 0, shownRows: 0, hiddenRows: 0, readyGraphics: 0, visibleReadyGraphics: 0, textNodes: 0, visibleTextNodes: 0, visibleUsernames: 0, visibleTimestamps: 0, visibleBadges: 0, visibleNonEmoteGraphics: 0, visiblePseudoLabels: 0, pseudoClasses: [], emptyVisibleRows: 0, leakClasses: [] };
  const elements = new Set();
  const visibleBox = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility === 'visible' && style.display !== 'none' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
  };
  const opaqueText = style => style.color !== 'rgba(0, 0, 0, 0)' && style.color !== 'transparent' && parseFloat(style.fontSize) > 0 && style.visibility === 'visible';
  for (const root of roots) {
    for (const element of [root, ...root.querySelectorAll('*')]) elements.add(element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      result.textNodes++;
      if (!opaqueText(getComputedStyle(node.parentElement))) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) continue;
      if (node.parentElement.hasAttribute("data-eo-name")) { result.visibleUsernames++; continue; }
      if (node.parentElement.hasAttribute("data-eo-time")) { result.visibleTimestamps++; continue; }
      result.visibleTextNodes++;
      if (result.leakClasses.length < 5) result.leakClasses.push({ tag: node.parentElement.tagName, class: String(node.parentElement.className) });
    }
  }
  for (const element of elements) {
    if (element.matches(rows)) {
      result.rows++;
      if (element.dataset.eoRow === 'show') result.shownRows++;
      if (element.dataset.eoRow === 'hide') result.hiddenRows++;
      if (visibleBox(element) && !element.querySelector('[data-eo-graphic]')) result.emptyVisibleRows++;
    }
    if (element.matches('[data-eo-graphic="ready"]')) {
      result.readyGraphics++;
      if (visibleBox(element)) result.visibleReadyGraphics++;
    }
    if (element.matches('[data-eo-badge]') && visibleBox(element)) result.visibleBadges++;
    if (element.matches('img,svg,canvas,video') && visibleBox(element) && !element.closest('[data-eo-graphic],[data-eo-badge]')) result.visibleNonEmoteGraphics++;
    if (visibleBox(element)) for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(element, pseudo);
      if (opaqueText(style) && !['none', 'normal', '""', "''"].includes(style.content)) { result.visiblePseudoLabels++; if (result.pseudoClasses.length < 5) result.pseudoClasses.push({tag:element.tagName,class:String(element.className),pseudo,content:style.content}); }
    }
  }
  return result;
};
