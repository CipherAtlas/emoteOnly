# EmoteOnly project state

Updated 2026-10-19. Version 1.0.1.

- Scope: Firefox desktop MV3 emotes-only Twitch display filter; one persisted global toggle, ON by default, no runtime dependencies/network logic.
- Fixed from live testing: current native subscription-notice data selector, pinned card text/attribution, and current 7TV 1.10.x emote/overlay compositions. Recognized transcript roots now hide unfamiliar content by default.
- Verified: 16 Node tests, 10 Firefox 158 fixture groups, 6 real live-browser groups. 294 incoming message-row instances across native, BTTV, FFZ, 7TV and all three add-ons together had zero sampled text leaks, visible badges or generated labels. OFF restored text; ON restored filtering. Pinned, full-channel and actual theatre layout checks passed. GIF playback verified through distinct rendered pixel frames.
- Evidence: artifacts/firefox-live.json records provider versions, package hashes, runtime source hashes and per-mode counts; screenshots and fixture JSON are alongside it. Final ZIP payload matches source byte-for-byte. All browser sessions were disposable/headless and posted no chat messages.
- Deliverable: artifacts/emoteonly-1.0.1.zip (unsigned). Install/signing steps in README.md. No remote repository, publishing or signing.
- Remaining: signed-install restart, 20-minute comparative CPU/memory/scrolling profiling, and rare live-composition sampling. Finite samples do not certify every future renderer update. Source whitespace can retain wider mixed-message gaps; unfamiliar notices may reserve invisible layout space; unknown containers are outside support.
