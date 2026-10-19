/* Recognize emotes and author badge icons by renderer contracts, never their labels. */
(() => {
  "use strict";
  const lists = ".chat-scrollable-area__message-container, .seventv-chat-list, .pinned-chat__highlight-card";
  const notices = ".user-notice-line, [data-test-selector='user-notice-line']";
  const rows = `.chat-line__message, .seventv-message, ${notices}, .chat-line__status, .pinned-chat__highlight-card`;
  const excluded = [
    ".chat-line__message--badges", ".chat-badge", ".ffz-badge", ".bttv-chat-badge",
    ".bttv-chat-badge-container", ".seventv-chat-user-badge-list", ".seventv-chat-badge", ".seventv-badge",
    ".chat-author__display-name", ".chat-line__username-container", ".chat-line__message--timestamp",
    "[data-a-target='chat-message-username']", "[data-a-target='chat-message-mention']",
    ".seventv-chat-user", ".reply-line", ".ffz--fix-reply-line",
    "[data-a-target='chat-message-reply-parent-message']", "[data-test-selector='chat-message-reply-context']",
    "[role='tooltip']", ".tw-tooltip", ".ffz-alt-text"
  ].join(",");

  const providers = [
    { name: "7tv", graphic: "img.seventv-chat-emote, svg.seventv-chat-emote, img.seventv-emote, img.seventv-emoji, svg.seventv-emoji", unit: ".seventv-emote-box, .emote-token, .seventv-emote-container" },
    { name: "bttv", graphic: "img.bttv-emote-image", unit: ".bttv-emote" },
    { name: "ffz", graphic: "img.ffz-emote, img.ffz-emoji, div.chat-line__message--emote", unit: ".modified-emote" },
    { name: "twitch", graphic: "img.chat-line__message--emote", unit: "[data-test-selector='emote-button'], .modified-emote" }
  ];
  const graphicSelector = providers.map(provider => provider.graphic).join(",");

  function messageFor(element) {
    const nearest = element.closest(rows);
    return nearest?.closest(notices) || nearest;
  }

  function detect(row) {
    const seven = row.matches(".seventv-message");
    const body = seven ? row.querySelector(".seventv-chat-message-body") :
      row.querySelector(".pinned-chat__message, span.message") || row.querySelector(".chat-line__message") || row;
    if (!body) return [];
    const units = new Map();
    for (const graphic of body.querySelectorAll(graphicSelector)) {
      if (graphic.closest(excluded) || messageFor(graphic) !== row) continue;
      if (graphic.tagName === "IMG" && (!graphic.getAttribute("src") && !graphic.getAttribute("srcset") ||
          graphic.complete && !graphic.naturalWidth)) continue;
      if (graphic.tagName === "DIV") {
        const background = graphic.style.backgroundImage || getComputedStyle(graphic).backgroundImage;
        if (!background || background === "none") continue;
      }
      const provider = providers.find(candidate => graphic.matches(candidate.graphic));
      const wrapper = graphic.closest(provider.unit);
      const unit = wrapper && body.contains(wrapper) ? wrapper : graphic;
      if (!units.has(unit)) units.set(unit, []);
      units.get(unit).push(graphic);
    }
    return Array.from(units, ([element, graphics]) => ({ element, graphics }));
  }

  function identity(row) {
    // Notice headers and reply previews are separate from the message author.
    const message = row.matches(notices) ? row.querySelector(".chat-line__message, .seventv-message") : row;
    if (!message) return [];
    const context = ".reply-line, .ffz--fix-reply-line, [data-a-target='chat-message-reply-parent-message'], [data-test-selector='chat-message-reply-context'], [data-a-target='chat-message-mention'], .message, [data-a-target='chat-line-message-body'], .seventv-chat-message-body, [role='tooltip'], .tw-tooltip, .ffz-il-tooltip";
    const items = [];
    const names = new Set();
    for (const author of message.querySelectorAll(".chat-author__display-name, .chat-author__intl-login, [data-a-target='chat-message-username'], .seventv-chat-user-username")) {
      if (author.closest(context) || messageFor(author) !== row) continue;
      // Mark only actual name text, never an entire author block with badges/tooltips.
      for (const element of [author, ...author.querySelectorAll("span")]) {
        if (!element.closest("[role='tooltip'], .tw-tooltip, .ffz-il-tooltip") &&
            [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) names.add(element);
      }
    }
    for (const element of names) items.push({ element, kind: "name" });
    for (const element of message.querySelectorAll("img.chat-badge, .ffz-badge[data-badge], .seventv-chat-badge img")) {
      if (element.closest(context) || messageFor(element) !== row) continue;
      if (element.tagName === "IMG" && (!element.getAttribute("src") && !element.getAttribute("srcset") || !element.naturalWidth)) continue;
      items.push({ element, kind: "badge" });
    }
    for (const element of message.querySelectorAll(".chat-line__message--timestamp, .chat-line__timestamp, .seventv-chat-message-timestamp")) {
      if (!element.closest(context) && messageFor(element) === row) items.push({ element, kind: "time" });
    }
    return items;
  }

  globalThis.EmoteOnlyAdapters = Object.freeze({ lists, rows, messageFor, detect, identity });
})();
