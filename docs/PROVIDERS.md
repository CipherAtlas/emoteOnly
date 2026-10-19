# Renderer contracts

Inspected 2026-10-18 against official upstream source; refreshed 2026-10-19 against actual Firefox/Twitch DOM and the current official AMO packages. Twitch does not publish a stable chat DOM API. Its current selectors are corroborated by these providers, rather than claimed to be a permanent Twitch contract.

| Renderer | Message/list | Graphics and composition |
| --- | --- | --- |
| Native Twitch | `.chat-line__message` within `.chat-scrollable-area__message-container` | `img.chat-line__message--emote`; retain `[data-test-selector="emote-button"]` when present. Text fragments are not necessarily a complete message body. |
| FFZ | Native list/row; actual body `span.message` | `.ffz-emote`, `.ffz-emoji`, native emote IMG, or `div.chat-line__message--emote` with a background image; retain `.modified-emote`. `.ffz-tooltip` is an emote trigger, not tooltip content. Hide `.ffz-alt-text` without removing its node. |
| BTTV | Native chat or inside 7TV's message body | `img.bttv-emote-image` within `div.bttv-emote`. Overlay wrappers remain siblings: `.bttv-emote + .bttv-emote-overlay` depends on negative margins. No injected spacer elements or universal gaps. |
| 7TV legacy | `.seventv-message` within `.seventv-chat-list`; body `.seventv-chat-message-body` | `.seventv-chat-emote` IMG/SVG; `.seventv-emote-box` is the grid composition boundary. Overlays use `.zero-width-emote`. Base images can load lazily. |
| 7TV 1.10.x | Uses native Twitch message/list structure | `img.seventv-emote` / `img.seventv-emoji`; preserve `.seventv-emote-container` (also `.modified-emote` for effects). Layers use `.seventv-emote-zw`, not the legacy `.zero-width-emote`. |

Live Twitch currently uses `[data-test-selector="user-notice-line"]` for native subscription notices; the older `.user-notice-line` class also remains supported. Native pinned cards use `.pinned-chat__highlight-card` with `.pinned-chat__message` as the body. Both their message and attribution text must be filtered.

Known native status rows and subscription notice wrappers are also filtered. For a notice containing a nested chat message, the outer notice is the logical row; its notification header is hidden while its message's emotes remain.

The current 7TV contract was checked in [Mozilla's official 7TV 1.10.4 package](https://addons.mozilla.org/firefox/downloads/file/5094924/7tv_new-1.10.4.xpi), specifically `site.js` and `content-scripts/content.css`, then checked with the installed add-on in a disposable Firefox profile. Its SHA-256 is `8cc4bb68c035f96328f37439a6e90a5c05aced1b2c85a8fbbf606fa879ec9d76`. The older GitHub source alone does not describe this release's DOM.

## Pinned source evidence

- [7TV native selectors](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/site/twitch.tv/index.ts#L6-L25), [message list](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/site/twitch.tv/modules/chat/ChatList.vue), [message body](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/app/chat/UserMessage.vue), [emote/layer renderer](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/app/chat/Emote.vue).
- [BTTV native fragments and 7TV integration](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/chat/index.js), [emote renderer](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/emotes/emote.jsx), [zero-width overlay CSS](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/emotes/style.css).
- [FFZ message/notice renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/0648abbb13a69c36933cc082439b53f991232357/src/sites/twitch-twilight/modules/chat/line.js), [emote/background/modifier renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/0648abbb13a69c36933cc082439b53f991232357/src/modules/chat/tokenizers.jsx#L1410-L1491).

Source inspection informed fixtures and adapters. The live report records the exact installed provider versions and the extent of current runtime evidence. Provider catalog/download APIs are deliberately unused. New renderer support should add narrow selectors, exclusions and a representative fixture before broadening detection.
