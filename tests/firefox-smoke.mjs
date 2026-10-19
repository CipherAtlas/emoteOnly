import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import auditChat from './browser-audit.cjs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:https';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// No Selenium dependency: use geckodriver's standard WebDriver HTTP interface.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extension = join(root, 'extension');
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
const addonId = manifest.browser_specific_settings.gecko.id;
const scratch = await mkdtemp(join(tmpdir(), 'emoteonly-firefox-'));
const report = { browser: null, fixture: 'Local HTTPS fixture at a Twitch hostname; production extension manifest and source unchanged.', checks: [], limitations: ['Synthetic renderer fixtures do not establish live Twitch/provider compatibility.', 'GIF playback is checked using distinct rendered frames; a human may still prefer different provider appearance/settings.'] };
let driver, session, server, driverOutput = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function availablePort() {
  const socket = createNetServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

const port = await availablePort();
const base = `http://127.0.0.1:${port}`;
async function request(method, path, body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  const result = await response.json();
  if (!response.ok || result.value?.error) throw new Error(`${method} ${path}: ${JSON.stringify(result.value)}`);
  return result.value;
}
const command = (method, path, body) => request(method, `/session/${session}${path}`, body);
const execute = (script, ...args) => command('POST', '/execute/sync', { script, args });
async function until(script, description, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let latest;
  while (Date.now() < deadline) {
    latest = await execute(script);
    if (latest) return latest;
    await pause(50);
  }
  throw new Error(`Timed out: ${description}; latest=${JSON.stringify(latest)}`);
}
async function check(name, operation) {
  const evidence = await operation();
  report.checks.push({ name, status: 'passed', ...(evidence === undefined ? {} : { evidence }) });
  console.log(`PASS ${name}`);
}
async function chrome(script, ...args) {
  await command('POST', '/moz/context', { context: 'chrome' });
  try { return await execute(script, ...args); }
  finally { await command('POST', '/moz/context', { context: 'content' }); }
}
async function toolbarClick() {
  return chrome(`
    const widgetId = arguments[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '-browser-action';
    const {CustomizableUI} = ChromeUtils.importESModule('moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs');
    CustomizableUI.addWidgetToArea(widgetId, CustomizableUI.AREA_NAVBAR);
    const button = document.getElementById(widgetId)?.querySelector('toolbarbutton.unified-extensions-item-action-button');
    if (!button) throw new Error('Extension toolbar button not found');
    button.click();
    return true;
  `, addonId);
}
async function toolbarState(expected) {
  const deadline = Date.now() + 3000;
  let latest;
  do {
    latest = await chrome(`
    const widgetId=arguments[0].toLowerCase().replace(/[^a-z0-9_-]/g,'_')+'-browser-action';
    const button=document.getElementById(widgetId)?.querySelector('toolbarbutton.unified-extensions-item-action-button');
    return {badge:button?.getAttribute('badge'),tooltip:button?.getAttribute('tooltiptext')};
  `, addonId);
    if (!expected || latest.badge === expected) return latest;
    await pause(50);
  } while (Date.now() < deadline);
  return latest;
}
async function setCurrentTab(handle) { await command('POST', '/window', { handle }); }
const waitEnabled = () => until("return document.documentElement.dataset.emoteonlyEnabled === 'true' && document.querySelector('#mixed')?.dataset.eoRow === 'show'", 'enabled existing messages');
const waitDisabled = () => until("return !document.documentElement.hasAttribute('data-emoteonly-enabled') && !document.querySelector('[data-eo-row]')", 'disabled and restored');
const geometry = `
  const ids=['first','second','third','wide','animated','bttv-base','bttv-overlay','ffz-base','ffz-background','seven-base','seven-overlay','seven-current-base','seven-current-overlay'];
  return Object.fromEntries(ids.map(id=>{ const el=document.getElementById(id), r=el.getBoundingClientRect(); return [id,{x:r.x,y:r.y,width:r.width,height:r.height,src:el.getAttribute('src'),html:el.outerHTML}]; }));
`;

try {
  const cert = join(scratch, 'cert.pem'), key = join(scratch, 'key.pem');
  const openssl = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=www.twitch.tv'], { encoding: 'utf8' });
  if (openssl.status !== 0) throw new Error(`openssl failed: ${openssl.stderr}`);
  const fixture = await readFile(join(root, 'tests', 'fixture.html'));
  // Two 1px GIF frames (red/blue), looped indefinitely by a Netscape extension.
  const animatedGif = Buffer.from('47494638396101000100800000ff00000000ff21ff0b4e45545343415045322e30030100000021f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex');
  server = createServer({ cert: await readFile(cert), key: await readFile(key) }, (req, res) => {
    if (req.url === '/emote.svg' || req.url === '/lazy.svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#f5bd6c"/><circle cx="9" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M8 18h12" stroke="black" stroke-width="2"/></svg>'); }
    else if (req.url === '/animated.gif') { res.writeHead(200, { 'Content-Type': 'image/gif' }); res.end(animatedGif); }
    else if (req.url === '/missing.png') { res.writeHead(404); res.end(); }
    else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `https://www.twitch.tv:${server.address().port}/fixture`;
  driver = spawn(process.env.GECKODRIVER || 'geckodriver', ['--port', String(port), '--allow-system-access', '--log', 'warn'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let spawnError;
  driver.on('error', error => { spawnError = error; });
  for (const stream of [driver.stdout, driver.stderr]) stream.on('data', chunk => { driverOutput = (driverOutput + chunk).slice(-30_000); });
  for (let attempt = 0; ; attempt++) {
    if (spawnError) throw new Error(`Cannot launch geckodriver. Set GECKODRIVER to its executable path: ${spawnError.message}`);
    try { await request('GET', '/status'); break; }
    catch (error) { if (attempt >= 60) throw error; await pause(100); }
  }
  const options = { args: ['-headless'], prefs: { 'network.dns.localDomains': 'www.twitch.tv', 'browser.shell.checkDefaultBrowser': false, 'browser.startup.homepage_override.mstone': 'ignore' } };
  if (process.env.FIREFOX_BINARY) options.binary = process.env.FIREFOX_BINARY;
  else if (process.platform === 'darwin') options.binary = '/Applications/Firefox.app/Contents/MacOS/firefox';
  const created = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', acceptInsecureCerts: true, 'moz:firefoxOptions': options } } });
  session = created.sessionId;
  report.browser = { name: 'Firefox', version: created.capabilities.browserVersion, disposableProfile: true };
  await command('POST', '/timeouts', { script: 10_000 });
  await command('POST', '/window/rect', { width: 1100, height: 1200 });
  await command('POST', '/moz/addon/install', { path: extension, temporary: true });
  await command('POST', '/url', { url });
  const firstTab = await command('GET', '/window');
  await waitEnabled();
  await until("return [...document.images].filter(img=>img.id!=='failed').every(img=>img.complete && img.naturalWidth > 0)", 'fixture image loads');
  await check('Native rows without FFZ wrappers, lazy 7TV images, and BTTV inside 7TV all render', async () => {
    await until("return ['seven-lazy','seven-bttv','ffz-base','ffz-background'].every(id=>document.getElementById(id).getAttribute('data-eo-graphic')==='ready')", 'provider graphics including lazy loading');
    assert.equal(await execute("return document.querySelector('#mixed span.message')===null"), true);
    return { nativeMessageHasNoFfzWrapper: true, lazyImageLoadedWhileEnabled: true, bttvInsideSevenTv: true };
  });

  await check('Enabled on first installation; text-only/Unicode/broken-image rows disappear without empty rows', async () => {
    const result = await execute("return ['text-only','unicode-only','failed-row','welcome-status','native-notice','pinned-text'].map(id=>{ const el=document.getElementById(id); return {id,state:el.dataset.eoRow,display:getComputedStyle(el).display,height:el.getBoundingClientRect().height}; })");
    for (const row of result) { assert.equal(row.display, 'none'); assert.equal(row.height, 0); }
    return result;
  });
  await toolbarClick(); await waitDisabled();
  let before;
  await check('Actual toolbar OFF restores original DOM and content', async () => {
    const restoration = await execute(`
      const before=window.pristineChatHTML,after=document.querySelector('#chat-region').innerHTML;
      return {equal:before===after,before,after};
    `);
    assert.equal(restoration.equal, true, `Restored DOM differs: ${JSON.stringify(restoration)}`);
    const action = await toolbarState('OFF');
    assert.equal(action.badge, 'OFF');
    assert(action.tooltip.includes('OFF'));
    before = await execute(geometry);
    await mkdir(join(root, 'artifacts'), { recursive: true });
    await writeFile(join(root, 'artifacts', 'firefox-unfiltered.png'), Buffer.from(await command('GET', '/screenshot'), 'base64'));
    return { exactChatMarkupRestored: true, action };
  });
  await toolbarClick(); await waitEnabled();
  await check('Toolbar ON filters existing messages and removes all visible ordinary text', async () => {
    const result = await execute(`
      const leaked=[];
      for(const row of document.querySelectorAll('.chat-scrollable-area__message-container,.seventv-chat-list,.pinned-chat__highlight-card')) {
        const walker=document.createTreeWalker(row,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) { const node=walker.currentNode;if(!node.textContent.trim())continue; const style=getComputedStyle(node.parentElement); const range=document.createRange();range.selectNodeContents(node); const r=range.getBoundingClientRect(); if(style.visibility==='visible'&&style.color!=='rgba(0, 0, 0, 0)'&&parseFloat(style.fontSize)>0&&r.width>0&&r.height>0) leaked.push(node.textContent); }
      }
      return {leaked,graphics:[...document.querySelectorAll('[data-eo-graphic]')].map(el=>el.id),controls:['player','chat-input','moderation'].map(id=>({id,display:getComputedStyle(document.getElementById(id)).display,visibility:getComputedStyle(document.getElementById(id)).visibility}))};
    `);
    const transcriptAudit = await execute(`return (${auditChat.toString()})()`);
    assert(transcriptAudit.visibleReadyGraphics > 0, 'recognized emote graphics must remain visible');
    assert.equal(transcriptAudit.visibleTextNodes, 0, 'entire transcript must contain no visible words');
    assert.equal(transcriptAudit.visibleNonEmoteGraphics, 0, 'badges/decorations must not remain');
    assert.equal(transcriptAudit.visiblePseudoLabels, 0, 'generated labels must not remain');
    result.transcriptAudit = transcriptAudit;
    assert.deepEqual(result.leaked, []);
    assert(result.graphics.includes('mixed-emote'));
    for (const control of result.controls) { assert.notEqual(control.display, 'none'); assert.equal(control.visibility, 'visible'); }
    await writeFile(join(root, 'artifacts', 'firefox-filtered.png'), Buffer.from(await command('GET', '/screenshot'), 'base64'));
    return result;
  });
  await check('Native/provider dimensions, order, spacing, animation source, and zero-width layers survive', async () => {
    const after = await execute(geometry);
    for (const id of Object.keys(before)) {
      assert.equal(after[id].width, before[id].width, `${id} width`);
      assert.equal(after[id].height, before[id].height, `${id} height`);
      assert.equal(after[id].src, before[id].src, `${id} source`);
    }
    const gap = (items, left, right) => items[right].x - items[left].x - items[left].width;
    assert(Math.abs(gap(after,'first','second') - gap(before,'first','second')) < 0.2, 'adjacent emote spacing');
    assert(after.first.x < after.second.x && after.second.x < after.third.x);
    assert.equal(await execute("return document.getElementById('animated') === window.originalAnimatedNode"), true);
    assert.equal(after.wide.width, 84);
    assert.equal(after['seven-base'].x, after['seven-overlay'].x);
    assert.equal(after['seven-base'].y, after['seven-overlay'].y);
    assert.equal(after['seven-current-overlay'].x - after['seven-current-base'].x, before['seven-current-overlay'].x - before['seven-current-base'].x, 'current 7TV centered overlay alignment');
    assert.equal(after['bttv-base'].x, after['bttv-overlay'].x);
    assert.equal(after.animated.src, '/animated.gif');
    const animatedElement = await command('POST', '/element', { using: 'css selector', value: '#animated' });
    const elementId = animatedElement['element-6066-11e4-a52e-4f735466cecf'];
    const frames = new Set();
    for (let frame = 0; frame < 8; frame++) {
      const pixels = Buffer.from(await command('GET', `/element/${elementId}/screenshot`), 'base64');
      frames.add(createHash('sha256').update(pixels).digest('hex'));
      await pause(70);
    }
    assert(frames.size >= 2, 'animated emote pixels must continue changing while ON');
    const action = await toolbarState('ON');
    assert.equal(action.badge, 'ON');
    assert(action.tooltip.includes('ON'));
    return { adjacentGapBefore: gap(before,'first','second'), adjacentGapAfter: gap(after,'first','second'), wideWidth: after.wide.width, zeroWidthCompositionsPreserved: true, animatedSourcePreserved: true, imageNodeIdentityPreserved: true, animatedDistinctFrames: frames.size, action };
  });
  await check('Two tabs share toolbar state changes', async () => {
    const secondTab = (await command('POST', '/window/new', { type: 'tab' })).handle;
    await setCurrentTab(secondTab); await command('POST', '/url', { url: url + '?second' }); await waitEnabled();
    await toolbarClick(); await waitDisabled();
    await setCurrentTab(firstTab); await waitDisabled();
    await toolbarClick(); await waitEnabled();
    await setCurrentTab(secondTab); await waitEnabled();
    await setCurrentTab(firstTab);
    return { tabCount: 2, actualToolbarClicks: true };
  });
  await check('Late rendered emotes and changed image sources update existing rows', async () => {
    await execute("document.querySelector('#late-row [data-a-target=chat-line-message-body]').innerHTML='words '+emote('late-emote')+' more words';");
    await until("return document.getElementById('late-row').dataset.eoRow==='show' && document.getElementById('late-emote').hasAttribute('data-eo-graphic')", 'late emote rendering');
    await execute("document.getElementById('failed').src='/emote.svg';");
    await until("return document.getElementById('failed-row').dataset.eoRow==='show'", 'failed image replacement');
  });
  await check('MutationObserver handles a rapid 1000-message batch', async () => {
    const started = Date.now();
    await execute("const batch=document.createElement('div');batch.id='burst';batch.innerHTML=Array.from({length:1000},(_,i)=>nativeRow('burst-'+i,i%2 ? emote('burst-emote-'+i) : 'text only')).join('');document.getElementById('native-list').append(batch);");
    await until("return document.querySelectorAll('#burst [data-eo-row=show]').length===500 && document.querySelectorAll('#burst [data-eo-row=hide]').length===500", '1000-message batch', 15_000);
    const elapsedMs = Date.now() - started;
    await execute("document.getElementById('burst').remove();");
    return { rows: 1000, emoteRows: 500, elapsedMs, note: 'Fixture batch latency, not a live-chat CPU benchmark.' };
  });
  await check('SPA navigation and destroyed/recreated chat containers are discovered', async () => {
    await execute("document.querySelector('#native-list').remove(); history.pushState({},'', '/another-channel'); const list=document.createElement('div');list.className='chat-scrollable-area__message-container';list.id='replacement-list';list.innerHTML=nativeRow('replacement-emote-row','hello '+emote('replacement-emote'))+nativeRow('replacement-text-row','hello');document.getElementById('chat-region').append(list);");
    await until("return document.getElementById('replacement-emote-row').dataset.eoRow==='show' && getComputedStyle(document.getElementById('replacement-text-row')).display==='none'", 'SPA chat replacement');
    return { urlChanged: true, replacementRowsFiltered: true };
  });
  await check('Final toolbar OFF removes all extension markers and restores controls', async () => {
    await toolbarClick(); await waitDisabled();
    assert.equal(await execute("return [...document.querySelectorAll('*')].some(el=>[...el.attributes].some(a=>a.name.startsWith('data-eo-') || a.name==='data-emoteonly-enabled' || a.value.includes('--eo-')))"), false);
    assert.equal(await execute("return getComputedStyle(document.getElementById('replacement-text-row')).display !== 'none' && document.getElementById('chat-input').value === 'Your message'"), true);
  });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  process.exitCode = 1;
  console.error(error.stack);
} finally {
  if (session) { try { await request('DELETE', `/session/${session}`); } catch {} }
  if (driver) driver.kill('SIGTERM');
  if (server) await new Promise(resolve => server.close(resolve));
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writeFile(join(root, 'artifacts', 'firefox-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.status === 'failed') await writeFile(join(root, 'artifacts', 'firefox-driver.log'), driverOutput);
  await rm(scratch, { recursive: true, force: true });
}
