# EmoteOnly project state

Updated 2026-10-18.

- Scope: Firefox desktop MV3 emotes-only Twitch live-chat display filter. One global persisted toolbar toggle, enabled by default, no runtime dependencies or network logic.
- Implemented: event-page background, source-researched provider adapters, reversible CSS presentation, bounded batched transcript observers, discovery/replacement lifecycle, icon, Node and real-Firefox fixture tests, installation/signing docs.
- Verification: All 13 Node tests and Mozilla lint/build have passed with zero lint warnings/notices/errors. All 10 Firefox 158 fixture groups pass with actual toolbar actions, two tabs, provider compositions, lazy images, exact OFF restoration, and a 1000-message burst. Final results and local screenshots are in artifacts/; rerun after source changes. The built ZIP payload matches the extension sources byte-for-byte. A bounded public Twitch popout probe loaded the extension and found a native list but received no messages, so live filtering remains unverified.
- Release boundary: package is unsigned, no remote repository or publishing. Source contracts and manual acceptance matrix are in docs/. Live provider/browser combination acceptance, signed-install restart check and sustained live-chat profiling remain manual release checks.
- Known limitation: CSS keeps source whitespace around hidden words when it shares an emote path; does not normalize every mixed-message gap. Pending lazy emotes reserve layout while loading. Unknown renderer containers stay unchanged.
