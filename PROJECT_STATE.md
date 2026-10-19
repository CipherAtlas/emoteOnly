# EmoteOnly project state

Updated 2026-10-19. Version 1.0.2.

- Scope: Firefox desktop MV3 Twitch filter showing emotes with usernames and subscriber/Founder badges; one persisted global toggle, ON by default, no runtime dependencies/network logic.
- Fixed from live testing: current native subscription-notice data selector, pinned card text/attribution, and current 7TV 1.10.x emote/overlay compositions. Recognized transcript roots now hide unfamiliar content by default.
- Verified: 17 Node tests, 10 Firefox 158 fixture groups, 6 real live-browser groups. 181 incoming message-row instances across native, BTTV, FFZ, 7TV and all three add-ons together had zero sampled message-text leaks, other graphics or generated labels; usernames and subscriber badges remained visible. OFF restored text; ON restored filtering. Pinned, full-channel and actual theatre layout checks passed. GIF playback verified through distinct rendered pixel frames.
- Evidence: artifacts/firefox-live.json records provider versions, package hashes, runtime source hashes and per-mode counts; screenshots and fixture JSON are alongside it. Final ZIP payload matches source byte-for-byte. Automated browser sessions were disposable/headless and posted no chat messages. Also loaded the temporary extension in the user’s visible Firefox, opened a Twitch stream, and verified names/sub badges/emotes visually.
- Deliverable: artifacts/emoteonly-1.0.2.zip (unsigned). Install/signing steps in README.md. No remote repository, publishing or signing.
- Remaining: signed-install restart, 20-minute comparative CPU/memory/scrolling profiling, and rare live-composition sampling. Finite samples do not certify every future renderer update. Source whitespace can retain wider mixed-message gaps; unfamiliar notices may reserve invisible layout space; unknown containers are outside support.

- Latest policy: text-only rows disappear completely, including names/badges. Identity never keeps a row alive without emotes. Other badge roles, announcements, timestamps and replies remain hidden. Native label fallback currently recognizes standard English subscriber/Founder labels; unknown labels fail closed.
- Performance: repeated OFF/ON 15-second windows in an isolated Firefox with all three providers. Real chat: 52.0% / 50.1% of one core OFF/ON; controlled ~58 messages/sec: 50.4% / 49.1%. Timer p95 5–6 ms. Synthetic RSS peaks declined across both toggles; no long-session leak claim. Full method/evidence in docs/VERIFICATION.md and artifacts/firefox-performance.json.
