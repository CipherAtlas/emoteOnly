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
- Distribution: public listing on addons.mozilla.org
- Data collection: none

## Reviewer notes

The uploaded ZIP contains readable JavaScript/CSS, the manifest, an SVG icon and the MIT license. There is no minification, compilation or generated runtime code, and no runtime dependency. The build only archives the extension directory using web-ext. No account login is required to test the filter on public Twitch streams. Use a live channel with incoming emote messages, click the toolbar icon to compare ON/OFF, and optionally install the official provider add-ons. Provider add-ons are not bundled.

Validation and finite live/browser/performance evidence: https://github.com/CipherAtlas/emoteOnly/blob/main/docs/VERIFICATION.md
