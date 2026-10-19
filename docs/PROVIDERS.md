# Renderer contracts

Inspected 2026-10-18 against official upstream source; refreshed 2026-10-19 against actual Firefox/Twitch DOM and the current official AMO packages. Twitch does not publish a stable chat DOM API. Its current selectors are corroborated by these providers, rather than claimed to be a permanent Twitch contract.

| Renderer | Message/list | Graphics and composition |
| --- | --- | --- |
| Native Twitch | `.chat-line__message` within `.chat-scrollable-area__message-container` | `img.chat-line__message--emote`; retain `[data-test-selector="emote-button"]` when present. Text fragments are not necessarily a complete message body. |
| FFZ | Native list/row; actual body `span.message` | `.ffz-emote`, `.ffz-emoji`, native emote IMG, or `div.chat-line__message--emote` with a background image; retain `.modified-emote`. `.ffz-tooltip` is an emote trigger, not tooltip content. Hide `.ffz-alt-text` without removing its node. |
| BTTV | Native chat or inside 7TV's message body | `img.bttv-emote-image` within `div.bttv-emote`. Overlay wrappers remain siblings: `.bttv-emote + .bttv-emote-overlay` depends on negative margins. No injected spacer elements; composition gaps skip the base when the next unit is an overlay. |
| 7TV stable 3.1.x replacement chat | `.seventv-message` within `.seventv-chat-list`; body `.seventv-chat-message-body` | `.seventv-chat-emote` IMG/SVG; `.seventv-emote-box` is the grid composition boundary. Overlays use `.zero-width-emote`. Base images can load lazily. |
| 7TV-new 1.10.x | Uses native Twitch message/list structure | `img.seventv-emote` / `img.seventv-emoji`; preserve `.seventv-emote-container` (also `.modified-emote` for effects). Layers use `.seventv-emote-zw`, not the legacy `.zero-width-emote`. |

Live Twitch currently uses `[data-test-selector="user-notice-line"]` for native subscription notices; the older `.user-notice-line` class also remains supported. Native pinned cards use `.pinned-chat__highlight-card` with `.pinned-chat__message` as the body. Both their message and attribution text must be filtered.

Known native status rows and subscription notice wrappers are also filtered. For a notice containing a nested chat message, the outer notice is the logical row; its notification header is hidden while its message's emotes remain.

The separate 7TV-new native-renderer contract was checked in [Mozilla's official 7TV 1.10.4 package](https://addons.mozilla.org/firefox/downloads/file/5094924/7tv_new-1.10.4.xpi), specifically `site.js` and `content-scripts/content.css`, then checked with the installed add-on in a disposable Firefox profile. Its SHA-256 is `8cc4bb68c035f96328f37439a6e90a5c05aced1b2c85a8fbbf606fa879ec9d76`. The 3.x replacement-renderer GitHub source alone does not describe the 7TV-new DOM.

## Pinned source evidence

- [7TV native selectors](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/site/twitch.tv/index.ts#L6-L25), [message list](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/site/twitch.tv/modules/chat/ChatList.vue), [message body](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/app/chat/UserMessage.vue), [emote/layer renderer](https://github.com/SevenTV/Extension/blob/69eaa09a6bf556af58f95c349b4fc169299ef201/src/app/chat/Emote.vue).
- [BTTV native fragments and 7TV integration](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/chat/index.js), [emote renderer](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/emotes/emote.jsx), [zero-width overlay CSS](https://github.com/night/betterttv/blob/1a616214cfebbc9dd9dfaf3f3d205f91f99f2e2f/src/modules/emotes/style.css).
- [FFZ message/notice renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/0648abbb13a69c36933cc082439b53f991232357/src/sites/twitch-twilight/modules/chat/line.js), [emote/background/modifier renderer](https://github.com/FrankerFaceZ/FrankerFaceZ/blob/0648abbb13a69c36933cc082439b53f991232357/src/modules/chat/tokenizers.jsx#L1410-L1491).

Source inspection informed fixtures and adapters. The live report records the exact installed provider versions and the extent of current runtime evidence. Provider catalog/download APIs are deliberately unused. New renderer support should add narrow selectors, exclusions and a representative fixture before broadening detection.

## Optional metadata in 1.1.0

Only rows with recognized emotes retain identity. Names use `.chat-author__display-name`, `.chat-author__intl-login`, `[data-a-target="chat-message-username"]`, or legacy `.seventv-chat-user-username`; only their actual text leaves are revealed. Message-body mentions, reply previews, tooltips and notice headers are excluded. Native/BTTV/current 7TV retain Twitch's author contract.

Author badge icons are recognized by renderer elements: native `img.chat-badge`, FFZ `.ffz-badge[data-badge]`, and legacy 7TV `.seventv-chat-badge img`. Labels are not parsed, so subscriber, moderator, VIP, custom and localized badges remain visible. Badges inside message-body mentions, reply previews and tooltip content stay hidden. Badge detection is separate from emote detection: badges cannot keep a text-only message visible. The original legacy 7TV source and the user's installed 3.1.25 DOM were inspected for the badge wrapper/IMG contract.

Timestamps use `.chat-line__message--timestamp`, `.chat-line__timestamp`, or stable 7TV’s `.seventv-chat-message-timestamp`, subject to the same reply/body exclusions. Each metadata kind has its own persisted boolean. A row still requires a recognized emote. Providers must generate the timestamp first (Twitch’s Timestamp For New Messages setting); EmoteOnly does not infer dates from message IDs or create receipt-time substitutes.
