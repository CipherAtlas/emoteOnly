# Verification

## Verified 2026-10-19, version 1.0.1

- All **16 Node tests** passed.
- All **10 Firefox 158.0 fixture groups** passed.
- All **6 live Firefox groups** passed: native, BTTV, FFZ, current 7TV, all three provider add-ons installed together, and real pinned/full-channel/theatre layouts.
- Mozilla lint returned zero errors, warnings or notices. `web-ext build` produced `artifacts/emoteonly-1.0.1.zip`; its payload was compared byte-for-byte with source. Runtime SHA-256 hashes in the live report match the final packaged source.

All browser checks used disposable headless profiles. No normal user profile, login or outgoing chat messages were used. Public chat was read through the actual Twitch web application; the live suite did not inject synthetic messages.

## Actual incoming live chat

Channel: `jinnytty`. Each provider configuration was sampled for 45 seconds at roughly 500 ms intervals. Installed official releases: bttv 7.7.28, ffz 4.80.4.0, 7tv 1.10.4. The harness checks their downloaded packages against Mozilla's published SHA-256 values.

| Configuration | New DOM message rows observed | Peak visible emote graphics | Visible text leaks | Result |
| --- | ---: | ---: | ---: | --- |
| native | 85 | 14 | 0 | Passed |
| bttv | 69 | 24 | 0 | Passed |
| ffz | 23 | 8 | 0 | Passed |
| 7tv | 84 | 53 | 0 | Passed |
| combined | 33 | 8 | 0 | Passed |

Across these configurations, **294 new message-row instances** were observed with zero sampled visible text leaks. The audit scans every text node inside supported transcript and pinned-message roots, including unfamiliar notice structures; it does not limit itself to known message selectors. It also checks for visible badges, avatars and generated labels. Each configuration toggles the actual toolbar OFF, verifies that original text returns and markers are removed, then toggles ON and verifies that only emote graphics remain visible.

The separate live layout group confirmed a real pinned text card collapses to zero height while ON and returns while OFF. Full-channel chat and an actual theatre-mode switch also passed. Autoplay was blocked/paused in that test profile to reduce resource use; this is not a video-playback quality test.

Evidence: `artifacts/firefox-live.json`, `artifacts/live-*-filtered.png`, and `artifacts/live-*-unfiltered.png`. JSON contains counts, package versions/hashes and class names, not chat content. Local OFF screenshots include public chat. Initial exploratory evidence is retained separately; the final report supersedes the earlier empty Monstercat sample.

## Regression coverage

Live testing found two omissions in 1.0.0: native subscription notices use `[data-test-selector="user-notice-line"]`, and native pinned cards sit outside the ordinary transcript container. Version 1.0.1 filters both. It also recognizes current 7TV's `.seventv-emote-container` / `.seventv-emote` / `.seventv-emote-zw` composition, alongside its older replacement-chat renderer. Supported roots hide unfamiliar content by default so a new notice cannot expose ordinary words while waiting for adapter support.

Node fixtures cover text-only/mixed/emoji messages, exclusions, provider composition nodes, late insertion/loading/errors, batched updates without old-row rescans, exact OFF restoration, concurrent renderer style changes, row/container replacement, pinned cards, both notice contracts, toolbar state persistence/rapid clicks and the initial-storage-read race.

Real Firefox fixtures add actual toolbar actions, global two-tab state, whole-transcript visual audits, unchanged image node identity/source/dimensions/order/spacing, wide and zero-width compositions, late/lazy emotes, 1000 messages in a burst, and SPA container replacement. GIF animation is verified from **two distinct rendered pixel frames** while ON. Reports: `artifacts/firefox-smoke.json` and its before/after screenshots.

## Remaining acceptance boundaries

These are finite samples, not certification of every provider combination or future Twitch update. Rare wide/zero-width compositions are tested with controlled Firefox fixtures rather than claimed to have occurred live. A 20-minute comparative Firefox Profiler/memory/scrolling soak and signed-install browser restart remain release checks; no sustained CPU/FPS benchmark or Mozilla signing was performed. Original source spaces surrounding hidden words can retain wider gaps. See the README for unsupported containers and pending-image behavior.

## Manual acceptance steps

Use a Firefox test profile with a signed build or a temporarily loaded build. Record Firefox version, provider versions, channel, mode, and test time. Watch chat first with EmoteOnly OFF to confirm that the provider itself is rendering emotes.

1. **Native:** With providers disabled, observe text-only, emote-only and mixed native Twitch messages. Toggle ON. Verify that every word, username, timestamp, badge, reply label, mention, link and punctuation disappears. Text-only messages should have no row height. Confirm that emotes retain their order and size.
2. **Providers:** Repeat with 7TV, BTTV and FFZ individually, then with the combinations you normally use. Include BTTV emotes inside 7TV's replacement chat. If providers conflict with each other even while EmoteOnly is OFF, resolve that first.
3. **Graphic variants:** Check animated GIF/WebP, wide emotes, multiple adjacent emotes, and base-plus-zero-width compositions. Compare OFF/ON, especially overlay alignment. Check FFZ background-image rendering and provider-rendered emoji. Plain `😂` or unresolved `KEKW` must stay hidden.
4. **Late rendering:** Enable before provider chat/emotes load. Verify lazy and delayed emotes appear once rendered; their codes must never be exposed. Ordinary new messages must never flash into view while ON. Broken images should not expose alt text.
5. **Events/replies:** Verify native subscription/status notices and replies have no visible ordinary text. A subscription message containing emotes should keep those graphics while hiding the subscription header.
6. **Navigation:** Visit another live channel without reloading. Open popout chat, change theatre mode, and open/close chat. Check filtering after containers are recreated. Confirm player/input/channel controls still work. Inline message actions are visually hidden while ON; switch OFF for the full message.
7. **Global state:** Open two Twitch tabs and a popout. Toggle from each window, including a background tab. Every transcript should switch without a reload. Verify ON/OFF badge and tooltip. With a permanently installed signed build, leave OFF, restart Firefox and confirm it remains OFF; repeat ON.
8. **Restoration:** Toggle OFF during active chat and check full text, timestamps, badges, provider hover behavior, overlays and scrolling. Keep it OFF for a minute: filtering work should stop. Toggle ON to filter accumulated messages.
9. **Long session:** On a fast-moving live chat, compare Firefox Profiler recordings with ON/OFF over equal intervals. Monitor CPU, frame pacing, dropped messages, scroll position and memory over at least 20 minutes and several channel changes. Check that detached rows do not accumulate. Preserve recordings with your release review.

If a renderer is unfamiliar, EmoteOnly leaves that container alone. If a known renderer's internal contract changes, some emotes may be hidden until the adapter is updated. Turn OFF to restore the original interface and capture a minimal, anonymized DOM sample for a regression fixture. Finite live samples do not certify every channel or future renderer update. Within supported transcript roots, unfamiliar notices are hidden by default and can retain invisible layout space until their structure is supported.
