import { popupController } from './popup-control.mjs';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
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
const reportFile = modes.every(mode => mode === 'performance') ? 'firefox-performance.json' : 'firefox-live.json';
const channel = process.env.TWITCH_CHANNEL || 'jinnytty';
if (!/^[a-zA-Z0-9_]{1,25}$/.test(channel)) throw new Error('Invalid TWITCH_CHANNEL');
const duration = Number(process.env.LIVE_SAMPLE_SECONDS || 45) * 1000;
const manifest = JSON.parse(await readFile(join(root, 'extension/manifest.json'), 'utf8'));
const addonId = manifest.browser_specific_settings.gecko.id;
const providerFiles = new Map();
const providerSlugs = { bttv: 'betterttv', ffz: 'frankerfacez', '7tv': '7tv-new', '7tv-legacy': '7tv-extension' };
const report = { startedAt: new Date().toISOString(), channel, sampleSeconds: duration / 1000,
  scope: 'Actual public Twitch pages, real incoming messages, production extension, official provider add-ons, isolated headless Firefox profiles. No account login or outgoing chat messages.',
  extension: { version: manifest.version, files: {} }, providers: {}, checks: [], limitations: ['Finite live samples do not certify all channels, messages or future renderer updates.', 'Rare wide/zero-width compositions remain covered by controlled Firefox fixtures unless they occur in the live sample.'] };
for (const name of ['settings.js', 'adapters.js', 'background.js', 'content.js', 'filter.css', 'popup.html', 'popup.css', 'popup.js']) {
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
let driver, base, session, browserPid;
async function request(method, path, body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(40_000) });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(`${method} ${path}: ${JSON.stringify(result.value)}`);
  return result.value;
}
const command = (method, path, body) => request(method, `/session/${session}${path}`, body);
const execute = (script, ...args) => command('POST', '/execute/sync', { script, args });
const audit = () => execute(`return (${auditChat.toString()})()`);
const configurePopup = popupController({ command, execute, addonId });
const toolbarClick = () => configurePopup();

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
  if (modes.includes('performance')) Object.assign(options.prefs, {
    'dom.min_background_timeout_value': 0,
    'dom.min_background_timeout_value_without_budget_throttling': 0,
    'dom.timeout.enable_budget_timer_throttling': false,
    'dom.timeout.throttling_delay': 3_600_000
  });
  if (process.env.FIREFOX_BINARY) options.binary = process.env.FIREFOX_BINARY;
  else if (process.platform === 'darwin') options.binary = '/Applications/Firefox.app/Contents/MacOS/firefox';
  const result = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', pageLoadStrategy: 'eager', 'moz:firefoxOptions': options } } });
  session = result.sessionId;
  browserPid = result.capabilities['moz:processID'];
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
  assert.equal(sample.visibleNonEmoteGraphics, 0, 'visible graphics outside emotes/author badges');
  assert.equal(sample.visiblePseudoLabels, 0, `visible generated text: ${JSON.stringify(sample.pseudoClasses)}`);
}
async function sampleMode(mode) {
  const check = { mode, channel, status: 'running', samples: 0, totalNewRows: 0, peakEmotes: 0, peakVisibleEmotes: 0,
    peakVisibleUsernames: 0, peakVisibleBadges: 0, nativeGraphics: 0, bttvGraphics: 0, ffzGraphics: 0, sevenTvGraphics: 0,
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
      check.peakVisibleUsernames = Math.max(check.peakVisibleUsernames, sample.visibleUsernames);
      check.peakVisibleBadges = Math.max(check.peakVisibleBadges, sample.visibleBadges);
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
    assert(check.peakVisibleUsernames > 0, "real author usernames must remain visible");
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
    const expected = { bttv: 'bttvGraphics', ffz: 'ffzGraphics', '7tv': 'sevenTvGraphics', '7tv-legacy': 'sevenTvGraphics' }[mode];
    if (expected && !check[expected]) {
      check.status = 'inconclusive';
      check.reason = 'Native chat worked but no graphics from this provider renderer appeared in the sample.';
    } else { check.status = 'passed'; }
    console.log(`${check.status.toUpperCase()} ${mode}: ${check.totalNewRows} rows; OFF restores ${check.offVisibleTextNodes} text nodes; ON leaves zero message-text leaks`);
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

// macOS process CPU time includes the Firefox parent and all current descendants.
function processSnapshot() {
  assert.equal(process.platform, 'darwin', 'Performance process accounting currently supports macOS');
  assert(Number.isInteger(browserPid), 'Firefox reports its process ID');
  const output = spawnSync('ps', ['-axo', 'pid=,ppid=,time=,rss='], { encoding: 'utf8' });
  assert.equal(output.status, 0, 'read browser process accounting');
  const processes = output.stdout.trim().split('\n').map(line => {
    const [pid, parent, time, rss] = line.trim().split(/\s+/);
    return { pid: Number(pid), parent: Number(parent), cpu: time.split(':').reduce((total, value) => total * 60 + Number(value), 0), rss: Number(rss) };
  });
  const ids = new Set([browserPid]);
  for (let previous = 0; previous !== ids.size;) {
    previous = ids.size;
    for (const process of processes) if (ids.has(process.parent)) ids.add(process.pid);
  }
  return new Map(processes.filter(process => ids.has(process.pid)).map(process => [process.pid, process]));
}
async function measurePhase(enabled, seconds) {
  const current = await execute("return document.documentElement.dataset.emoteonlyEnabled==='true'");
  if (current !== enabled) await toolbarClick();
  await pause(2500);
  await execute(`
    window.__eoPerf={rows:0,delays:[],last:performance.now()};
    const list=document.querySelector('.chat-scrollable-area__message-container');
    window.__eoPerf.observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)window.__eoPerf.rows+=(node.matches('.chat-line__message')?1:0)+node.querySelectorAll('.chat-line__message').length;});
    window.__eoPerf.observer.observe(list,{childList:true,subtree:true});
    window.__eoPerf.timer=setInterval(()=>{const now=performance.now();window.__eoPerf.delays.push(Math.max(0,now-window.__eoPerf.last-50));window.__eoPerf.last=now;},50);
  `);
  const before = processSnapshot();
  const started = performance.now();
  let previous = before, cpu = 0, peakRss = 0;
  while (performance.now() - started < seconds * 1000) {
    await pause(1000);
    const next = processSnapshot();
    for (const [pid, process] of next) cpu += Math.max(0, process.cpu - (previous.get(pid)?.cpu || 0));
    peakRss = Math.max(peakRss, [...next.values()].reduce((total, process) => total + process.rss, 0));
    previous = next;
  }
  const elapsed = (performance.now() - started) / 1000;
  const page = await execute(`const probe=window.__eoPerf;clearInterval(probe.timer);probe.observer.disconnect();
    const delays=probe.delays.sort((a,b)=>a-b);return {newRows:probe.rows,retainedRows:document.querySelectorAll('.chat-line__message').length,
    timerSamples:delays.length,timerDelayP95Ms:delays[Math.floor(delays.length*.95)]||0,timerDelayMaxMs:delays.at(-1)||0};`);
  if (enabled) assertFiltered(await audit());
  return { enabled, seconds: elapsed, cpuPercentOfOneCore: cpu / elapsed * 100,
    peakProcessRssMiB: peakRss / 1024, ...page };
}
async function samplePerformance() {
  const check = { mode: 'performance', status: 'running', live: [], synthetic: [],
    method: 'Alternating OFF/ON windows in one warmed disposable headless Firefox; popout chat has no video; background timer throttling is disabled only in this benchmark profile. CPU uses macOS process CPU-time deltas for the Firefox process tree. RSS sums resident pages and includes shared pages. Timer delays measure page responsiveness, not monitor FPS.' };
  report.checks.push(check);
  try {
    console.log('START performance');
    await startBrowser();
    // Include the providers used in the user profile, installed only in this test profile.
    for (const provider of ['bttv', 'ffz', '7tv']) await command('POST', '/moz/addon/install', { path: await getProvider(provider), temporary: true });
    await command('POST', '/url', { url: `https://www.twitch.tv/popout/${channel}/chat` });
    const deadline = Date.now() + 45_000;
    while (await execute("return document.querySelectorAll('.chat-line__message').length") < 5 && Date.now() < deadline) await pause(1000);
    assert(await execute("return document.querySelectorAll('.chat-line__message').length>=5"), 'live chat must be active before measuring');
    for (const enabled of [false, true, false, true]) {
      const phase = await measurePhase(enabled, Number(process.env.PERF_SAMPLE_SECONDS || 20));
      check.live.push(phase); console.log('PERF live', JSON.stringify(phase));
    }
    // Navigate away from Twitch's application, then create a controlled local DOM
    // fixture in this disposable tab. These are synthetic messages, never posted.
    await command('POST', '/url', { url: 'https://www.twitch.tv/robots.txt' });
    await execute(`document.body.innerHTML='<style>body{font:14px/20px Arial}.chat-badge{width:18px;height:18px}img{vertical-align:middle}</style><div class="chat-scrollable-area__message-container"></div>';
      const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="orange"/></svg>');
      let count=0;window.__eoBurst=setInterval(()=>{const list=document.querySelector('.chat-scrollable-area__message-container');for(let i=0;i<6;i++){count++;const row=document.createElement('div');row.className='chat-line__message';row.innerHTML='<span class="chat-line__message--timestamp">12:34</span><img class="chat-badge" alt="Subscriber" src="'+svg+'"><span class="chat-author__display-name" style="color:purple">FixtureUser</span>: <span>'+ (count%2?'ordinary words':'ordinary words <img class="chat-line__message--emote" width="28" height="28" src="'+svg+'">')+'</span>';list.append(row);}while(list.children.length>150)list.firstElementChild.remove();},100);`);
    for (const enabled of [false, true, false, true]) {
      const phase = await measurePhase(enabled, Number(process.env.PERF_SAMPLE_SECONDS || 20));
      check.synthetic.push(phase); console.log('PERF synthetic', JSON.stringify(phase));
    }
    await execute('clearInterval(window.__eoBurst)');
    check.syntheticRate = '60 messages/second, half mixed emote/text and half text-only, at most 150 retained rows';
    check.status = 'passed';
  } catch (error) { check.status = 'failed'; check.error = error.message; process.exitCode = 1; console.error('FAIL performance:', error.message); }
  finally { await stopBrowser(); }
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
    if (mode === 'performance') await samplePerformance();
    else if (mode === 'layouts') await sampleLayouts();
    else await sampleMode(mode);
    await writeFile(join(artifacts, reportFile), JSON.stringify(report, null, 2) + '\n');
  }
  report.status = report.checks.some(check => check.status === 'failed') ? 'failed' : report.checks.some(check => check.status === 'inconclusive') ? 'inconclusive' : 'passed';
  if (report.status === 'inconclusive') process.exitCode = 2;
} catch (error) { report.status = 'failed'; report.error = error.message; process.exitCode = 1; }
finally {
  await stopBrowser();
  if (driver) driver.kill('SIGTERM');
  report.finishedAt = new Date().toISOString();
  await writeFile(join(artifacts, reportFile), JSON.stringify(report, null, 2) + '\n');
  await rm(scratch, { recursive: true, force: true });
}
