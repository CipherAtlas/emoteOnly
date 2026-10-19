import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import auditChat from './browser-audit.cjs';

// Opt-in, read-only live test. Provider add-ons are official AMO builds installed
// only in disposable headless profiles. No login, chat posting or user profile.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(join(tmpdir(), 'emoteonly-live-'));
const artifacts = join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const modes = (process.env.EMOTEONLY_PROVIDERS || 'native,bttv,ffz,7tv,combined,layouts').split(',');
const channel = process.env.TWITCH_CHANNEL || 'jinnytty';
if (!/^[a-zA-Z0-9_]{1,25}$/.test(channel)) throw new Error('Invalid TWITCH_CHANNEL');
const duration = Number(process.env.LIVE_SAMPLE_SECONDS || 45) * 1000;
const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
const addonId = manifest.browser_specific_settings.gecko.id;
const providerFiles = new Map();
const providerSlugs = { bttv: 'betterttv', ffz: 'frankerfacez', '7tv': '7tv-new' };
const report = { startedAt: new Date().toISOString(), channel, sampleSeconds: duration / 1000,
  scope: 'Actual public Twitch pages, real incoming messages, production extension, official provider add-ons, isolated headless Firefox profiles. No account login or outgoing chat messages.',
  extension: { version: manifest.version, files: {} }, providers: {}, checks: [], limitations: ['Finite live samples do not certify all channels, messages or future renderer updates.', 'Rare wide/zero-width compositions remain covered by controlled Firefox fixtures unless they occur in the live sample.'] };
for (const name of ['adapters.js', 'background.js', 'content.js', 'filter.css']) {
  report.extension.files[name] = createHash('sha256').update(await readFile(join(root, 'extension', name))).digest('hex');
}
if (process.env.LIVE_RESUME === '1') {
  const previous = JSON.parse(await readFile(join(artifacts, 'firefox-live.json'), 'utf8'));
  assert.deepEqual(previous.extension, report.extension, 'Only resume evidence for identical extension sources');
  report.checks = previous.checks.filter(check => !modes.includes(check.mode));
  report.providers = previous.providers;
  report.resumedAt = report.startedAt;
  report.startedAt = previous.startedAt;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let driver, base, session;
async function request(method, path, body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(40_000) });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(`${method} ${path}: ${JSON.stringify(result.value)}`);
  return result.value;
}
const command = (method, path, body) => request(method, `/session/${session}${path}`, body);
const execute = (script, ...args) => command('POST', '/execute/sync', { script, args });
const audit = () => execute(`return (${auditChat.toString()})()`);
async function toolbarClick() {
  await command('POST', '/moz/context', { context: 'chrome' });
  try {
    await execute(`const id=arguments[0].toLowerCase().replace(/[^a-z0-9_-]/g,'_')+'-browser-action';
      const {CustomizableUI}=ChromeUtils.importESModule('moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs');
      CustomizableUI.addWidgetToArea(id,CustomizableUI.AREA_NAVBAR);
      const button=document.getElementById(id)?.querySelector('toolbarbutton.unified-extensions-item-action-button');
      if(!button)throw Error('No toolbar action');button.click();`, addonId);
  } finally { await command('POST', '/moz/context', { context: 'content' }); }
}
async function screenshot(name) {
  await writeFile(join(artifacts, `live-${name}.png`), Buffer.from(await command('GET', '/screenshot'), 'base64'));
}
async function getProvider(name) {
  if (providerFiles.has(name)) return providerFiles.get(name);
  const slug = providerSlugs[name];
  const metadataResponse = await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${slug}/`, { signal: AbortSignal.timeout(30_000) });
  assert(metadataResponse.ok, `${name} AMO metadata`);
  const metadata = await metadataResponse.json();
  const version = metadata.current_version;
  const response = await fetch(version.file.url, { signal: AbortSignal.timeout(60_000) });
  assert(response.ok, `${name} AMO download`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  assert.equal(hash, version.file.hash, `${name} official package integrity`);
  await writeFile(join(scratch, `${name}.xpi`), bytes);
  providerFiles.set(name, join(scratch, `${name}.xpi`));
  report.providers[name] = { version: version.version, source: version.file.url, hash };
  return join(scratch, `${name}.xpi`);
}
async function startBrowser() {
  const options = { args: ['-headless'], prefs: { 'browser.shell.checkDefaultBrowser': false, 'browser.startup.homepage_override.mstone': 'ignore', 'media.autoplay.default': 5 } };
  if (process.env.FIREFOX_BINARY) options.binary = process.env.FIREFOX_BINARY;
  else if (process.platform === 'darwin') options.binary = '/Applications/Firefox.app/Contents/MacOS/firefox';
  const result = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', pageLoadStrategy: 'eager', 'moz:firefoxOptions': options } } });
  session = result.sessionId;
  report.browser = { name: 'Firefox', version: result.capabilities.browserVersion, headless: true, disposableProfiles: true };
  await command('POST', '/timeouts', { pageLoad: 30_000, script: 10_000 });
  await command('POST', '/window/rect', { width: 1100, height: 1000 });
  await command('POST', '/moz/addon/install', { path: join(root, 'extension'), temporary: true });
}
async function stopBrowser() {
  if (session) {
    try { await request('DELETE', `/session/${session}`); } finally { session = null; }
  }
}
function assertFiltered(sample) {
  assert.equal(sample.visibleTextNodes, 0, `visible transcript text: ${JSON.stringify(sample.leakClasses)}`);
  assert.equal(sample.visibleNonEmoteGraphics, 0, 'visible badges/avatars/non-emote graphics');
  assert.equal(sample.visiblePseudoLabels, 0, 'visible generated text');
}
async function sampleMode(mode) {
  const check = { mode, status: 'running', samples: 0, totalNewRows: 0, peakEmotes: 0, peakVisibleEmotes: 0,
    nativeGraphics: 0, bttvGraphics: 0, ffzGraphics: 0, sevenTvGraphics: 0,
    visibleTextNodes: 0, visibleNonEmoteGraphics: 0, visiblePseudoLabels: 0 };
  report.checks.push(check);
  try {
    console.log(`START ${mode}`);
    await startBrowser();
    const providers = mode === 'native' ? [] : mode === 'combined' ? ['bttv', 'ffz', '7tv'] : [mode];
    for (const provider of providers) {
      if (!providerSlugs[provider]) throw Error(`Unknown mode ${provider}`);
      const path = await getProvider(provider);
      await command('POST', '/moz/addon/install', { path, temporary: true });
    }
    await command('POST', '/url', { url: `https://www.twitch.tv/popout/${channel}/chat` });
    const deadline = Date.now() + duration;
    while (Date.now() < deadline) {
      const sample = await audit();
      check.samples++;
      for (const field of ['visibleTextNodes', 'visibleNonEmoteGraphics', 'visiblePseudoLabels']) check[field] += sample[field];
      check.peakEmotes = Math.max(check.peakEmotes, sample.readyGraphics);
      check.peakVisibleEmotes = Math.max(check.peakVisibleEmotes, sample.visibleReadyGraphics);
      assertFiltered(sample);
      const counts = await execute(`
        const seen=window.__eoSeenRows||(window.__eoSeenRows=new WeakSet());let added=0;
        for(const row of document.querySelectorAll('.chat-line__message,.seventv-message,[data-test-selector="user-notice-line"]'))if(!seen.has(row)){seen.add(row);added++;}
        return {added,native:document.querySelectorAll('[data-eo-graphic].chat-line__message--emote:not(.bttv-emote-image):not(.ffz-emote)').length,
          bttv:document.querySelectorAll('[data-eo-graphic].bttv-emote-image').length,
          ffz:document.querySelectorAll('[data-eo-graphic].ffz-tooltip').length,
          seven:document.querySelectorAll('[data-eo-graphic].seventv-chat-emote,[data-eo-graphic].seventv-emote,[data-eo-graphic].seventv-emoji').length};`);
      check.totalNewRows += counts.added;
      check.nativeGraphics = Math.max(check.nativeGraphics, counts.native);
      check.bttvGraphics = Math.max(check.bttvGraphics, counts.bttv);
      check.ffzGraphics = Math.max(check.ffzGraphics, counts.ffz);
      check.sevenTvGraphics = Math.max(check.sevenTvGraphics, counts.seven);
      if (check.samples % 10 === 0) console.log(`SAMPLE ${mode}: ${check.totalNewRows} rows, ${check.peakEmotes} peak emotes, 0 text leaks`);
      await pause(500);
    }
    if (!check.totalNewRows || !check.peakVisibleEmotes) {
      check.status = 'inconclusive';
      check.reason = 'No real incoming messages with rendered emotes arrived within the sample.';
      return;
    }
    await screenshot(`${mode}-filtered`);
    await toolbarClick();
    await pause(500);
    const off = await audit();
    assert(off.visibleTextNodes > 0, 'OFF must reveal real original text');
    assert.equal(await execute("return document.querySelector('[data-eo-row]')===null"), true, 'OFF cleans markers');
    check.offVisibleTextNodes = off.visibleTextNodes;
    await screenshot(`${mode}-unfiltered`);
    await toolbarClick();
    await pause(500);
    assertFiltered(await audit());
    check.toggleRestoration = 'passed';
    const expected = { bttv: 'bttvGraphics', ffz: 'ffzGraphics', '7tv': 'sevenTvGraphics' }[mode];
    if (expected && !check[expected]) {
      check.status = 'inconclusive';
      check.reason = 'Native chat worked but no graphics from this provider renderer appeared in the sample.';
    } else { check.status = 'passed'; }
    console.log(`${check.status.toUpperCase()} ${mode}: ${check.totalNewRows} rows; OFF restores ${check.offVisibleTextNodes} text nodes; ON leaves zero`);
  } catch (error) {
    check.status = 'failed'; check.error = error.message; process.exitCode = 1;
    if (session) try { await screenshot(`${mode}-failure`); } catch {}
    console.error(`FAIL ${mode}: ${error.message}`);
  } finally { await stopBrowser(); }
}
async function sampleLayouts() {
  const check = { mode: 'layouts', status: 'running' };
  report.checks.push(check);
  async function until(script, description, timeout = 30_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await execute(script);
      if (result) return result;
      await pause(500);
    }
    throw Error(`Timed out: ${description}`);
  }
  try {
    console.log('START layouts: pinned card, full channel, theatre');
    await startBrowser();
    await command('POST', '/url', { url: 'https://www.twitch.tv/popout/caedrel/chat' });
    await until("return document.querySelector('.pinned-chat__highlight-card')?.hasAttribute('data-eo-row')", 'actual pinned chat card');
    const pin = await execute("const card=document.querySelector('.pinned-chat__highlight-card');return {textLength:card.textContent.length,graphics:card.querySelectorAll('[data-eo-graphic]').length,height:card.getBoundingClientRect().height,state:card.dataset.eoRow};");
    assert(pin.textLength > 0);
    if (!pin.graphics) { assert.equal(pin.height, 0); assert.equal(pin.state, 'hide'); }
    assertFiltered(await audit());
    await screenshot('pinned-filtered');
    await toolbarClick(); await pause(500);
    assert((await audit()).visibleTextNodes > 0, 'OFF restores pinned message and attribution');
    await toolbarClick(); await pause(500);
    assertFiltered(await audit());
    check.pinnedCard = { status: 'passed', ...pin };
    console.log('PASSED actual pinned card ON/OFF');

    await command('POST', '/url', { url: `https://www.twitch.tv/${channel}` });
    // Block playback in this test profile to avoid consuming the user's gaming resources.
    await execute("window.__pauseTestVideo=setInterval(()=>document.querySelectorAll('video').forEach(video=>video.pause()),500)");
    await until(`return (${auditChat.toString()})().visibleReadyGraphics > 0`, 'real emotes on full channel page', 45_000);
    assertFiltered(await audit());
    check.fullChannel = 'passed';
    await screenshot('full-channel-filtered');
    const before = await execute("const button=[...document.querySelectorAll('[data-a-target=player-theatre-mode-button],button[aria-label^=\"Theatre Mode\"]')].find(element=>element.getBoundingClientRect().width>0);return button ? {label:button.getAttribute('aria-label')} : null");
    assert(before, 'theatre mode control exists');
    await execute("[...document.querySelectorAll('[data-a-target=player-theatre-mode-button],button[aria-label^=\"Theatre Mode\"]')].find(element=>element.getBoundingClientRect().width>0).click()");
    const after = await until("const button=document.querySelector('button[aria-label^=\"Exit Theatre Mode\"]');return document.querySelector('.channel-page__video-player--theatre-mode,.persistent-player--theatre') && button ? button.getAttribute('aria-label') : null", 'theatre mode active', 10_000);
    await pause(1000);
    assertFiltered(await audit());
    check.theatre = { status: 'passed', before: before.label, after };
    await screenshot('theatre-filtered');
    check.status = 'passed';
    console.log('PASSED full channel and actual theatre-mode toggle');
  } catch (error) {
    check.status = 'failed'; check.error = error.message; process.exitCode = 1;
    if (session) try { await screenshot('layouts-failure'); } catch {}
    console.error(`FAIL layouts: ${error.message}`);
  } finally { await stopBrowser(); }
}

try {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  driver = spawn(process.env.GECKODRIVER || 'geckodriver', ['--port', String(port), '--allow-system-access', '--log', 'fatal'], { stdio: 'ignore' });
  let spawnError; driver.on('error', error => { spawnError = error; });
  for (let attempt = 0; ; attempt++) {
    if (spawnError) throw spawnError;
    try { await request('GET', '/status'); break; }
    catch (error) { if (attempt >= 60) throw error; await pause(100); }
  }
  for (const mode of modes) {
    if (mode === 'layouts') await sampleLayouts();
    else await sampleMode(mode);
    await writeFile(join(artifacts, 'firefox-live.json'), JSON.stringify(report, null, 2) + '\n');
  }
  report.status = report.checks.some(check => check.status === 'failed') ? 'failed' : report.checks.some(check => check.status === 'inconclusive') ? 'inconclusive' : 'passed';
  if (report.status === 'inconclusive') process.exitCode = 2;
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
finally {
  await stopBrowser();
  if (driver) driver.kill('SIGTERM');
  report.finishedAt = new Date().toISOString();
  await writeFile(join(artifacts, 'firefox-live.json'), JSON.stringify(report, null, 2) + '\n');
  await rm(scratch, { recursive: true, force: true });
}
