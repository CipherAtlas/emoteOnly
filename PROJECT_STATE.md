# EmoteOnly project state

Updated 2026-10-19. Working release: 1.1.0.

## Current behavior

- Firefox desktop MV3 Twitch filter. Text-only rows disappear completely. Emote rows show recognized rendered emotes plus optional usernames, author badge icons and chat timestamps.
- The toolbar opens a compact dark popup with four accessible switches: EmoteOnly, Usernames, Badges and Timestamps. All default ON, preferences persist locally and apply to every open Twitch tab. OFF restores original markup/styles and keeps display preferences.
- Badges use renderer contracts rather than English subscriber labels: subscriber, moderator, VIP, custom and localized badges are supported. Badge/time/name metadata never keeps a text-only row alive.
- Timestamps must exist in Twitch/provider DOM. The user's Twitch “Timestamp For New Messages” preference was off; enabled it and verified timestamp filtering in their Firefox. No invented receipt-time substitutes.
- Fixed collapsed badge/name spacing (3px/6px gaps). Hidden words/spaces collapse and separate emote compositions receive a measured space; BTTV base/overlay pairs stay joined. Native/BTTV/FFZ/7TV image nodes and animations remain intact.
- No new dependency, host permission or network logic. The event page updates the ON/OFF badge; shared settings and popup scripts use browser.storage.local.

## Verification and current work

- 23 Node tests and 11 Firefox 158 fixture groups passed; lint had zero errors/warnings/notices. Coverage includes metadata preferences, cross-tab updates, startup storage races, exact OFF restoration, gap geometry, mixed-word gap collapse, animation pixel changes, wide/zero-width layers, late/lazy images, 1000-row burst and SPA mounts.
- Actual user's Firefox: 1.1.0 temporary extension loaded, full-size popup visually verified, subscriber/moderator icons and timestamps visible, badge/timestamp switches change live chat immediately. The final keyboard-focus fix and label-only popup (no subtext/footer) were reloaded and visually verified. Refresh Twitch once after the final add-on reload before the last interactive check.
- Final live chat-runtime recheck: combined providers, jinnytty, 60 seconds, 3 incoming rows/1 peak BTTV emote/2 author badges, zero sampled leaks; OFF restored 11 text nodes. All five chat-runtime hashes match final source. Popup-only text cleanup afterward passed all 23 tests/11 browser groups. Inconclusive native/stable-7TV samples remain explicitly inconclusive. Final ZIP matches source byte-for-byte; SHA-256 20210a85014eb6b331a50112c177e787987ceaf7dd294ffe4fa4dac530378b08. Reports/screenshots are ignored under artifacts/.
- Verification complete. Commit/push the coherent 1.1.0 source/docs under existing publication authorization, submit the final 1.1.0 ZIP to Mozilla and update the existing review watch to the new version. Intermediate 1.0.3 was never uploaded.

## Publishing

- Public MIT source repository: https://github.com/CipherAtlas/emoteOnly ; origin/main. User authorized public repository creation/push and Mozilla publication.
- Mozilla 1.0.2 was submitted and last verified Awaiting Review, not publicly available: https://addons.mozilla.org/en-US/developers/addon/emoteonly/versions/6594427 . No signed XPI downloaded. Historical uploaded ZIP SHA-256: dcef7d981bd4175066f8e4a4d83f721966f8be781054d70340c08a31852ccfb1.
- Manage: https://addons.mozilla.org/en-US/developers/addon/emoteonly/edit ; public product URL after approval: https://addons.mozilla.org/en-US/firefox/addon/emoteonly/ . Desktop Firefox 142+, Appearance, MIT, no data collection. Listing copy in docs/MOZILLA_LISTING.md.
- Existing hourly thread heartbeat: watch-emoteonly-mozilla-review. Update this watch after a new submission; do not create a duplicate. Stay quiet unchanged and notify only approval/publication, rejection/reviewer request or required user action.
- Listing media: original SVG face, 128px PNG icon and two unedited anonymous-profile 1.0.2 live screenshots under docs/listing/. Do not publish screenshots of the user's logged-in browser/tabs.

## Limits and historical evidence

- Historical 1.0.2: 17 Node tests, 10 Firefox fixtures, 6 live-browser groups, 181 incoming row instances with zero sampled ordinary text leaks. Supported native notices/pinned cards and separate 7TV-new 1.10.x native-renderer compositions. Stable 7TV 3.1.x uses replacement chat.
- Historical short CPU comparison (1.0.2, Apple M4/16GB): OFF/ON 52.0%/50.1% of one core for live chat; 50.4%/49.1% for ~58 rows/sec; timer p95 5–6ms. Not rerun for 1.1.0; not a long-session performance guarantee.
- Remaining broader acceptance: signed-install restart, long-session CPU/memory/scrolling profiling and rare live compositions. Unknown containers/replay/shadow DOM are outside scope. Finite samples do not certify future renderer changes; unfamiliar notices may reserve invisible layout space.
