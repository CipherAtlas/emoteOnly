/* Only recognized renderer contracts qualify; image URLs and alt text are not heuristics. */
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

  globalThis.EmoteOnlyAdapters = Object.freeze({ lists, rows, messageFor, detect });
})();
