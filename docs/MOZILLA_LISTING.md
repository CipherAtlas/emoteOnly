# Mozilla listing copy

Name: EmoteOnly

Summary: Keep the emotes. Quiet the words. Choose usernames, badges and timestamps from a simple Twitch chat settings popup.

## Description

Keep the emotes. Quiet the words.

EmoteOnly filters Twitch live chat so you can enjoy the reactions without reading every message.

- Messages with emotes keep their rendered emotes and your choice of usernames, badges and timestamps. Subscriber, moderator, VIP, custom and localized badge icons are supported.
- Text-only messages disappear completely, including their usernames and badges.
- Ordinary message text, reply labels and subscription notice headers stay hidden.
- Click the toolbar icon for a simple popup with four switches: EmoteOnly, Usernames, Badges and Timestamps. Changes apply instantly across open Twitch tabs. Switch EmoteOnly off to restore normal chat.
- Supports native Twitch emotes and supported 7TV, BetterTTV and FrankerFaceZ renderers. Install those providers separately to render their emotes.
- Supports live channel pages, popout chat, theatre mode and native pinned-message cards.

Animated, wide and zero-width emotes keep their original rendering. Plain Unicode emoji and unresolved emote codes remain hidden. Badge icons are identified by the chat renderer rather than English labels, so custom and translated badges remain visible. Renderer updates may require an extension update.

Timestamps must be enabled in Twitch or your chat provider first. EmoteOnly displays their existing message times.

EmoteOnly stores four display preferences locally. It collects no chat content, browsing history or analytics, and its JavaScript makes no network requests. Twitch and your other emote extensions continue to load their own resources.

Firefox desktop 142 or newer. Click OFF whenever you want to read or use the full original messages.

## Listing metadata

- License: MIT
- Homepage: https://github.com/CipherAtlas/emoteOnly
- Support: https://github.com/CipherAtlas/emoteOnly/issues
- Category: Appearance
- Tags: chat, streaming, twitch
- Distribution: public listing on addons.mozilla.org
- Data collection: none

## Reviewer notes

The uploaded ZIP contains readable JavaScript/CSS, the manifest, an SVG icon and the MIT license. There is no minification, compilation or generated runtime code, and no runtime dependency. The build only archives the extension directory using web-ext. No account login is required to test the filter on public Twitch streams. Use a live channel with incoming emote messages, open the toolbar popup and use its switches to compare ON/OFF and metadata visibility, and optionally install the official provider add-ons. Provider add-ons are not bundled.

Validation and finite live/browser/performance evidence: https://github.com/CipherAtlas/emoteOnly/blob/main/docs/VERIFICATION.md

## Latest submission: 1.1.0

Submitted on 2026-10-19. Mozilla validated the final 11KB ZIP with zero errors or warnings and confirmed **Version Submitted**. The refreshed listing says **Awaiting Review**, not publicly available. Summary and description now describe the four popup switches, optional timestamps and all author badge icons.

- Version: https://addons.mozilla.org/en-US/developers/addon/emoteonly/versions/6596437
- Final ZIP SHA-256: 20210a85014eb6b331a50112c177e787987ceaf7dd294ffe4fa4dac530378b08
- Source commit: 1aae66b
- No transformed-source upload needed. Existing MIT, desktop-only distribution, icon and media retained.
- Existing hourly review watch updated to 1.1.0 while preserving its existing PAUSED state.

## Historical submission: 1.0.2

Submitted version 1.0.2 on 2026-10-19. Mozilla server validation reported no errors or warnings, and the final page confirmed Version Submitted. Status: Awaiting Review; not publicly available yet.

- Product page (public after approval): https://addons.mozilla.org/en-US/firefox/addon/emoteonly/
- Manage listing: https://addons.mozilla.org/en-US/developers/addon/emoteonly/edit
- Submitted version: https://addons.mozilla.org/en-US/developers/addon/emoteonly/versions/6594427
- Uploaded archive SHA-256: dcef7d981bd4175066f8e4a4d83f721966f8be781054d70340c08a31852ccfb1

## Listing media

- `listing/icon.png`: 128 × 128 PNG rendered from the original `extension/icons/face.svg` using `rsvg-convert -w 128 -h 128 extension/icons/face.svg -o docs/listing/icon.png`.
- `listing/chat-7tv.png`: unedited real Firefox screenshot from the 1.0.2 live 7TV test. Caption: EmoteOnly with 7TV: usernames, subscriber badges and rendered emotes stay visible while message text is hidden.
- `listing/chat-filtered.png`: unedited real Firefox screenshot from the 1.0.2 combined-provider live test. Caption: EmoteOnly ON in live Twitch chat: text-only messages disappear; emote messages keep their author and subscriber badge.

These screenshots show anonymous test profiles and public incoming Twitch chat. They contain no user browser tabs or account session. Icon and both captioned screenshots were saved successfully in Mozilla's Images editor.
