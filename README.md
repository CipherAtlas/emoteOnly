# EmoteOnly

<img src="docs/listing/icon.png" alt="EmoteOnly icon" width="96" height="96">

Keep the emotes. Quiet the words.

[Source and issues on GitHub](https://github.com/CipherAtlas/emoteOnly) · [MIT license](LICENSE)

Version **1.1.0** was submitted to Mozilla Add-ons on 2026-10-19. Publication is pending; the local ZIP remains unsigned.

A small Firefox extension that shows emotes with optional usernames, badge icons and timestamps in supported Twitch live-chat transcripts. Native Twitch, 7TV, BetterTTV and FrankerFaceZ renderers have dedicated detection rules. No runtime dependencies, catalog downloads, analytics, or chat uploads.

## Try it

Requires Firefox **142 or newer** on desktop.

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Choose **Load Temporary Add-on…** and select `extension/manifest.json` in this folder (or the built `artifacts/emoteonly-1.1.0.zip`).
3. Allow access to Twitch if Firefox asks. Open or reload an existing Twitch tab once after installing.
4. Pin EmoteOnly from Firefox's Extensions menu if desired. Click its face icon to open the settings popup. Switch **EmoteOnly**, **Usernames**, **Badges**, or **Timestamps** on or off. All four start ON.

While ON, text-only messages disappear completely. Messages with emotes retain recognized rendered emote graphics and your chosen metadata: usernames, badge icons (subscriber, moderator, VIP, custom and localized badges), and timestamps. Ordinary message text, reply labels and transcript notice headers disappear. Badges and timestamps never keep a text-only row visible.

Changes apply immediately to every open Twitch tab and are saved locally. Switching EmoteOnly OFF restores the original chat and keeps your display preferences for next time. Timestamps must also be enabled in Twitch’s **Chat settings → Chat Appearance → Timestamp For New Messages**, or your provider’s equivalent setting; EmoteOnly shows existing timestamps and does not invent message times. Signed installations preserve preferences between browser restarts. Temporary add-ons are removed when Firefox exits.

Twitch's video, input and controls outside transcript messages stay usable. Inline labels/actions inside filtered messages are visually hidden with their row; switch OFF to read or act on the complete original message.

**Build delivered:** `artifacts/emoteonly-1.1.0.zip` is an unsigned testing/submission package, not a permanently installable signed XPI.

## Development and verification

Node.js 22+ and npm:

```sh
npm ci
npm test
npm run lint
npm run build
```

Development-only dependencies are pinned in `package-lock.json`. The build packages only `extension/`; tests and development tools do not ship. `lint` runs Mozilla's `web-ext lint` with warnings treated as errors. `build` uses `web-ext build`.

The optional real-Firefox fixture suite needs Firefox, [geckodriver](https://github.com/mozilla/geckodriver/releases), and OpenSSL on PATH:

```sh
GECKODRIVER=/absolute/path/to/geckodriver npm run test:firefox
# Optional: FIREFOX_BINARY=/absolute/path/to/firefox
```

It launches a disposable headless profile, installs the unmodified extension temporarily, and serves a local HTTPS fixture at a Twitch hostname using a profile-local DNS override. It never uses your normal Firefox profile. It exercises the shipped popup controls in an extension tab and two-tab synchronization. The actual toolbar panel is also checked manually in Firefox. Reports and before/after screenshots go into `artifacts/`.

The opt-in live suite uses real public Twitch pages, incoming chat and official AMO provider releases in separate disposable profiles:

```sh
GECKODRIVER=/absolute/path/to/geckodriver npm run test:live
# Optional: TWITCH_CHANNEL=another_live_channel LIVE_SAMPLE_SECONDS=60
# Limit modes: EMOTEONLY_PROVIDERS=native,bttv,ffz,7tv,combined,layouts
# macOS CPU/RSS + responsiveness benchmark (separate report):
EMOTEONLY_PROVIDERS=performance GECKODRIVER=/absolute/path/to/geckodriver npm run test:live
```

It downloads provider test add-ons from Mozilla, checks their package hashes, and installs them only in its temporary profiles. It sends no chat messages and requires no login. The audit checks **all text inside supported transcripts**, not only known message selectors. OFF must reveal the original text; ON must leave emote graphics and selected metadata, with zero ordinary message words, other graphics or generated labels. JSON reports contain counts and class names; local comparison screenshots include public chat while OFF.

See [verification and manual checks](docs/VERIFICATION.md) for evidence, remaining checks, and live-provider limitations.

## How it works

`background.js` is a Firefox Manifest V3 **event page** using `background.scripts`. It updates the ON/OFF badge and tooltip. `settings.js` shares the four boolean defaults with the popup and content script; `popup.js` saves preferences through Firefox storage. Every content script listens directly for storage changes, so state also reaches background tabs without a tabs permission or messaging registry.

`adapters.js` recognizes provider-specific graphics and composition boundaries. Separate author detection never keeps a row alive without emotes. It excludes badges/reply previews and never interprets plain emote codes as images. `content.js` observes supported transcript containers, batches changed/new rows, and marks existing nodes with extension-owned attributes and CSS variables. It restores styles before a batch's style reads, captures original name colours with the CSS gate removed synchronously, and reinstates the gate before any browser paint. It then writes its markers. At most 200 rows are processed per task; old rows are not rescanned on each new message. Removed rows are cleaned without retaining them in a permanent message registry.

`filter.css` keeps supported transcripts hidden by default, including unfamiliar notices, and reveals recognized emote graphics plus narrowly selected author names, badge icons and timestamp leaves. Known text-only rows disappear completely; an unfamiliar notice can retain invisible layout space. It hides unrelated branches and collapses text metrics while revealing the allowed leaves. Composition wrappers, image sources, CSS animations, sibling order, grids, transforms and negative margins remain in place. Pending images are invisible but retain layout so lazy loading can start; failed images are excluded. Disabling removes the CSS gate, stops observers/timers and removes connected-row markers. Provider style changes made while filtering remain intact.

Observation stays on the transcript and direct child changes along its ancestors. A root-only discovery check runs every two seconds (500 ms while no transcript exists) to catch late provider mounts in other branches. It does not rescan messages or observe the entire document subtree. No network requests are made by extension JavaScript.

## Compatibility boundaries

- Provider rules cover native Twitch, 7TV stable 3.1.x replacement chat and the separate 7TV-new 1.10.x native renderer, BTTV and FFZ. Live samples and browser fixtures are described in [verification](docs/VERIFICATION.md); inspected contracts are in [source contracts](docs/PROVIDERS.md). Finite samples do not certify every channel or future update.
- Only already-rendered emotes qualify. Install/configure providers separately. Unicode text stays hidden; supported provider-rendered emoji graphics qualify.
- Native live chat, popout, theatre and native pinned-message cards have supported containers. VOD/replay, closed shadow DOM and unfamiliar replacement renderers are outside this version's scope. Unrecognized containers are left unchanged; turn OFF if a site update changes the renderer.
- Hidden words and their spaces collapse. Separate emote compositions receive a single measured space; BTTV base/overlay pairs remain joined. Badge and name gaps use fixed pixels so zero-sized hidden parent fonts cannot collapse them.
- Badge icons use known renderer elements rather than English label matching, including subscriber, moderator, VIP, custom and localized badges. Painted names use their original text colour while filtering; OFF restores provider cosmetics.
- Lazy images can briefly reserve their provider's normal emote space while loading. Broken background-image emotes cannot be detected as reliably as broken IMG elements.
- Short performance comparisons and fixture burst checks do not establish long-session memory or scrolling performance. Provider CSS/DOM changes require renewed verification.

## Permanent installation and signing

Firefox Release requires Mozilla signing for permanent installation. Version 1.1.0 has been submitted for a public AMO listing; publication is pending. The steps below also document the workflow for future releases.

1. Run the tests, lint and build above, then complete the manual checks.
2. Create a developer account at [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/).
3. Submit `artifacts/emoteonly-1.1.0.zip`. Choose **On your own** for unlisted, signed self-distribution, or **On this site** for a public AMO listing.
4. Complete Mozilla's metadata/review requirements. The manifest declares no data collection and contains a stable add-on ID; retain that ID for updates. If Mozilla reports an ID conflict at first submission, choose your own unique ID before signing.
5. Download Mozilla's signed `.xpi`. Install it through `about:addons` → gear menu → **Install Add-on From File…**. Give Twitch host access if requested.

Mozilla also supports `web-ext sign --channel=unlisted` with developer API credentials. Keep credentials outside this repository; do not paste them into source files. Consult [Mozilla's signing instructions](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) for the current submission workflow.
