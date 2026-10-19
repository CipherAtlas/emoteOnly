# Verification

## Verified 2026-10-19, version 1.0.2

- All **17 Node tests** passed.
- All **10 Firefox 158.0 fixture groups** passed.
- All **6 live Firefox groups** passed: native, BTTV, FFZ, current 7TV, all three provider add-ons installed together, and real pinned/full-channel/theatre layouts.
- Mozilla lint returned zero errors, warnings or notices. `web-ext build` produced `artifacts/emoteonly-1.0.2.zip`; its payload was compared byte-for-byte with source. Runtime SHA-256 hashes in the live report match the final packaged source.

All browser checks used disposable headless profiles. No normal user profile, login or outgoing chat messages were used. Public chat was read through the actual Twitch web application; the live suite did not inject synthetic messages.

## Actual incoming live chat

Channel: `jinnytty`. Each provider configuration was sampled for 45 seconds at roughly 500 ms intervals. Installed official releases: bttv 7.7.28, ffz 4.80.4.0, 7tv 1.10.4. The harness checks their downloaded packages against Mozilla's published SHA-256 values.

| Configuration | New DOM message rows observed | Peak visible emote graphics | Visible text leaks | Result |
| --- | ---: | ---: | ---: | --- |
| native | 71 | 3 | 0 | Passed |
| bttv | 24 | 4 | 0 | Passed |
| ffz | 33 | 7 | 0 | Passed |
| 7tv | 19 | 8 | 0 | Passed |
| combined | 34 | 19 | 0 | Passed |

Across these configurations, **181 new message-row instances** were observed with zero sampled ordinary message-text leaks. Every mode retained visible usernames and subscriber badges. The audit scans every text node inside supported transcript and pinned-message roots, including unfamiliar notice structures. Only marked author-name text leaves are allowed; all other visible text fails. Visible graphics must be recognized emotes or subscriber badges. Each configuration toggles the toolbar OFF, verifies original text and metadata return without extension markers, then toggles ON and rechecks.

The separate live layout group confirmed a real pinned text card collapses to zero height while ON and returns while OFF. Full-channel chat and an actual theatre-mode switch also passed. Autoplay was blocked/paused in that test profile to reduce resource use; this is not a video-playback quality test.

Evidence: `artifacts/firefox-live.json`, `artifacts/live-*-filtered.png`, and `artifacts/live-*-unfiltered.png`. JSON contains counts, package versions/hashes and class names, not chat content. Local OFF screenshots include public chat. Initial exploratory evidence is retained separately; the final report supersedes the earlier empty Monstercat sample.

## Regression coverage

Live testing found two omissions in 1.0.0: native subscription notices use `[data-test-selector="user-notice-line"]`, and native pinned cards sit outside the ordinary transcript container. Version 1.0.1 filters both. It also recognizes current 7TV's `.seventv-emote-container` / `.seventv-emote` / `.seventv-emote-zw` composition, alongside its older replacement-chat renderer. Supported roots hide unfamiliar content by default so a new notice cannot expose ordinary words while waiting for adapter support.

Node fixtures cover text-only/mixed/emoji messages, author/subscriber-badge selection (excluding gifter/moderator/VIP roles), metadata changes, exclusions, provider composition nodes, late insertion/loading/errors, batched updates without old-row rescans, exact OFF restoration, concurrent renderer style changes, row/container replacement, pinned cards, both notice contracts, toolbar state persistence/rapid clicks and the initial-storage-read race.

Real Firefox fixtures verify visible author names/subscriber badges, readable painted names, hidden FFZ fallback text, and add actual toolbar actions, global two-tab state, whole-transcript visual audits, unchanged image node identity/source/dimensions/order/spacing, wide and zero-width compositions, late/lazy emotes, 1000 messages in a burst, and SPA container replacement. GIF animation is verified from **two distinct rendered pixel frames** while ON. Reports: `artifacts/firefox-smoke.json` and its before/after screenshots.

## Short performance comparison

Measured on Apple M4, 16 GiB RAM, Firefox 158.0 with official BTTV, FFZ and 7TV installed. A separate disposable headless profile alternated OFF/ON/OFF/ON, with four 15-second windows per workload and warm-up between switches. Video was excluded. Background timer throttling was disabled only in the benchmark profile; this was necessary to measure an actual fast-message workload. An initial throttled run was discarded.

| Workload | CPU OFF | CPU ON | Page timer delay p95 OFF / ON |
| --- | ---: | ---: | ---: |
| Real incoming chat | 52.0% | 50.1% | 6 / 6 ms |
| Synthetic fast chat | 50.4% | 49.1% | 6 / 5 ms |

CPU is the entire Firefox process tree, expressed as a percentage of **one core**, not total machine CPU. These short comparisons show no consistent CPU increase from enabling the filter; they do not establish zero overhead. Live arrival rates varied. The controlled workload delivered approximately 58 messages/second (target 60), half text-only and half mixed, with 150 retained DOM rows. All ON audits still passed.

Resident-memory totals include shared pages and the whole browser/provider workload, so they cannot identify extension-only allocation. During the synthetic run, OFF peaks were 1956 then 1892 MiB and ON peaks were 1937 then 1861 MiB: no upward short-run trend. Live peaks ranged from 5527 to 5638 MiB as Twitch/provider caches warmed. These are not private-heap measurements or proof against a long-session leak. Timer measurements describe page event-loop responsiveness, not physical display FPS or game performance.

Reproduce on macOS with `EMOTEONLY_PROVIDERS=performance PERF_SAMPLE_SECONDS=15 GECKODRIVER=/path/to/geckodriver npm run test:live`. Evidence: `artifacts/firefox-performance.json`, including source hashes matching the final ZIP.

## Remaining acceptance boundaries

These are finite samples, not certification of every provider combination or future Twitch update. Rare wide/zero-width compositions are tested with controlled Firefox fixtures rather than claimed to have occurred live. A 20-minute comparative Firefox Profiler/memory/scrolling soak and signed-install browser restart remain release checks; no sustained CPU/FPS benchmark or Mozilla signing was performed. Original source spaces surrounding hidden words can retain wider gaps. See the README for unsupported containers and pending-image behavior.

## Manual acceptance steps

Use a Firefox test profile with a signed build or a temporarily loaded build. Record Firefox version, provider versions, channel, mode, and test time. Watch chat first with EmoteOnly OFF to confirm that the provider itself is rendering emotes.

1. **Native:** With providers disabled, observe text-only, emote-only and mixed native Twitch messages. Toggle ON. Verify that usernames, subscriber/Founder badges and emotes remain on emote-containing rows. Ordinary message text, timestamps, other badges, reply labels, mentions, links and punctuation disappear. Text-only messages should have no row height and show no name or badge. Confirm that emotes retain their order and size.
2. **Providers:** Repeat with 7TV, BTTV and FFZ individually, then with the combinations you normally use. Include BTTV emotes inside 7TV's replacement chat. If providers conflict with each other even while EmoteOnly is OFF, resolve that first.
3. **Graphic variants:** Check animated GIF/WebP, wide emotes, multiple adjacent emotes, and base-plus-zero-width compositions. Compare OFF/ON, especially overlay alignment. Check FFZ background-image rendering and provider-rendered emoji. Plain `😂` or unresolved `KEKW` must stay hidden.
4. **Late rendering:** Enable before provider chat/emotes load. Verify lazy and delayed emotes appear once rendered; their codes must never be exposed. Ordinary new messages must never flash into view while ON. Broken images should not expose alt text.
5. **Events/replies:** Verify native subscription/status notices and replies have no visible ordinary text. A subscription message containing emotes should keep those graphics while hiding the subscription header.
6. **Navigation:** Visit another live channel without reloading. Open popout chat, change theatre mode, and open/close chat. Check filtering after containers are recreated. Confirm player/input/channel controls still work. Inline message actions are visually hidden while ON; switch OFF for the full message.
7. **Global state:** Open two Twitch tabs and a popout. Toggle from each window, including a background tab. Every transcript should switch without a reload. Verify ON/OFF badge and tooltip. With a permanently installed signed build, leave OFF, restart Firefox and confirm it remains OFF; repeat ON.
8. **Restoration:** Toggle OFF during active chat and check full text, timestamps, badges, provider hover behavior, overlays and scrolling. Keep it OFF for a minute: filtering work should stop. Toggle ON to filter accumulated messages.
9. **Long session:** On a fast-moving live chat, compare Firefox Profiler recordings with ON/OFF over equal intervals. Monitor CPU, frame pacing, dropped messages, scroll position and memory over at least 20 minutes and several channel changes. Check that detached rows do not accumulate. Preserve recordings with your release review.

If a renderer is unfamiliar, EmoteOnly leaves that container alone. If a known renderer's internal contract changes, some emotes may be hidden until the adapter is updated. Turn OFF to restore the original interface and capture a minimal, anonymized DOM sample for a regression fixture. Finite live samples do not certify every channel or future renderer update. Within supported transcript roots, unfamiliar notices are hidden by default and can retain invisible layout space until their structure is supported.
