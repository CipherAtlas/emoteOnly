# Mozilla listing copy

Name: EmoteOnly

Summary: Keep Twitch chat to emotes, usernames and subscriber badges. Hide ordinary message text with one click.

## Description

Keep the emotes. Quiet the words.

EmoteOnly filters Twitch live chat so you can enjoy the reactions without reading every message.

- Messages with emotes keep their username, subscriber or Founder badge, and rendered emotes.
- Text-only messages disappear completely, including their usernames and badges.
- Ordinary message text, timestamps, other badges, reply labels and subscription notice headers stay hidden.
- Click the toolbar icon to restore normal chat instantly. The setting stays in sync across open Twitch tabs.
- Supports native Twitch emotes and supported 7TV, BetterTTV and FrankerFaceZ renderers. Install those providers separately to render their emotes.
- Supports live channel pages, popout chat, theatre mode and native pinned-message cards.

Animated, wide and zero-width emotes keep their original rendering. Plain Unicode emoji and unresolved emote codes remain hidden. Subscriber badge detection uses provider role metadata or standard English Twitch labels; unrecognized labels stay hidden. Renderer updates may require an extension update.

EmoteOnly stores one ON/OFF preference locally. It collects no chat content, browsing history or analytics, and its JavaScript makes no network requests. Twitch and your other emote extensions continue to load their own resources.

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

The uploaded ZIP contains readable JavaScript/CSS, the manifest, an SVG icon and the MIT license. There is no minification, compilation or generated runtime code, and no runtime dependency. The build only archives the extension directory using web-ext. No account login is required to test the filter on public Twitch streams. Use a live channel with incoming emote messages, click the toolbar icon to compare ON/OFF, and optionally install the official provider add-ons. Provider add-ons are not bundled.

Validation and finite live/browser/performance evidence: https://github.com/CipherAtlas/emoteOnly/blob/main/docs/VERIFICATION.md

## Submission record

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
