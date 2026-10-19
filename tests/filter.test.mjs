import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = await Promise.all(['adapters.js', 'content.js'].map(name => readFile(new URL(`../extension/${name}`, import.meta.url), 'utf8')));
const css = await readFile(new URL('../extension/filter.css', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const img = (name = 'Kappa', extra = '') => `<img class="chat-line__message--emote ${extra}" src="${name}.webp" alt="${name}" width="28" height="28">`;
const row = (body, id = 'm') => `<div class="chat-line__message" id="${id}"><span class="chat-line__message--timestamp">12:30</span><span class="chat-line__message--badges"><img class="chat-line__message--emote" alt="badge"></span><span data-a-target="chat-message-username">User</span>: <span class="message">${body}</span></div>`;

async function setup(html, initial = true) {
  const dom = new JSDOM(`<html><head><style>${css}</style></head><body><main><div class="chat-scrollable-area__message-container">${html}</div></main><textarea id="input"></textarea><button id="control">Control</button></body></html>`, { runScripts: 'outside-only', url: 'https://www.twitch.tv/channel' });
  const { window } = dom;
  Object.defineProperties(window.HTMLImageElement.prototype, {
    complete: { configurable: true, get() { return !this.hasAttribute('pending'); } },
    naturalWidth: { configurable: true, get() { return this.hasAttribute('pending') ? 0 : Number(this.width) || 28; } }
  });
  window.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: () => ({ width: 3.5 }) });
  const listeners = new Set();
  let value = initial;
  window.browser = { storage: {
    local: { get: async () => ({ enabled: value }) },
    onChanged: { addListener: listener => listeners.add(listener) }
  } };
  window.eval(source[0]);
  window.eval(source[1]);
  const toggle = async enabled => {
    const oldValue = value; value = enabled;
    for (const listener of listeners) listener({ enabled: { oldValue, newValue: enabled } }, 'local');
    await tick();
  };
  await tick();
  return { dom, window, document: window.document, toggle, close: () => window.close() };
}

test('text-only, emoji, mentions and decorative images vanish; known emotes keep order', async () => {
  const app = await setup(row('hello everyone 😂 @someone <img alt="not an emote">', 'text') + row(`hello ${img('LUL')} insane ${img('PogChamp')}`, 'mixed'));
  try {
    const { document } = app;
    assert.equal(document.querySelector('#text').getAttribute('data-eo-row'), 'hide');
    assert.equal(document.querySelector('#mixed').getAttribute('data-eo-row'), 'show');
    assert.deepEqual([...document.querySelectorAll('[data-eo-graphic]')].map(node => node.alt), ['LUL', 'PogChamp']);
    assert.equal(document.querySelector('[data-a-target="chat-message-username"]').hasAttribute('data-eo-path'), false);
    assert.equal(document.querySelector('.chat-line__message--badges img').hasAttribute('data-eo-graphic'), false);
    assert.equal(document.querySelector('#input').outerHTML, '<textarea id="input"></textarea>');
  } finally { app.close(); }
});

test('preserves animated/wide sources and FFZ/BTTV composition nodes without reparenting', async () => {
  const html = row(`<span class="modified-emote" style="width:90px"><div class="ffz-emote ffz-tooltip chat-line__message--emote" style="background-image:url(wide.webp);width:90px;height:28px"><span class="ffz-alt-text">WIDE</span></div>${img('modifier')}</span><div class="bttv-emote">${img('dance', 'bttv-emote-image')}</div> <div class="bttv-emote bttv-emote-overlay">${img('overlay', 'bttv-emote-image')}</div>`);
  const app = await setup(html);
  try {
    const { document } = app;
    assert.equal(document.querySelector('.modified-emote').hasAttribute('data-eo-unit'), true);
    assert.equal(document.querySelector('.ffz-alt-text').hasAttribute('data-eo-graphic'), false);
    assert.equal(document.querySelector('.ffz-emote').style.width, '90px');
    assert.equal(document.querySelector('[alt="dance"]').src, 'https://www.twitch.tv/dance.webp');
    assert.equal(document.querySelector('.bttv-emote-overlay').previousElementSibling.className, 'bttv-emote');
    assert.equal(document.querySelector('[alt="modifier"]').parentElement.className, 'modified-emote');
  } finally { app.close(); }
});

test('7TV keeps base/zero-width and SVG emoji within the original box, excludes badges', async () => {
  const app = await setup('');
  try {
    app.document.querySelector('main').innerHTML = `<div class="seventv-chat-list"><div class="seventv-message" msg-id="1"><div class="seventv-chat-user-badge-list"><img class="seventv-chat-emote" src="badge.webp"></div><span class="seventv-chat-message-body">hello <span class="emote-token"><div class="seventv-emote-box"><img class="seventv-chat-emote" src="base.webp"><img class="seventv-chat-emote zero-width-emote" src="overlay.webp"></div></span><svg class="seventv-chat-emote seventv-emoji"><path d="M0 0"/></svg></span></div></div>`;
    await tick();
    assert.equal(app.document.querySelectorAll('[data-eo-graphic]').length, 3);
    assert.equal(app.document.querySelector('.seventv-emote-box').hasAttribute('data-eo-unit'), true);
    assert.equal(app.document.querySelector('.seventv-chat-user-badge-list img').hasAttribute('data-eo-graphic'), false);
    assert.equal(app.document.querySelector('.zero-width-emote').parentElement.className, 'seventv-emote-box');
  } finally { app.close(); }
});

test('late images, source errors, text edits and reused message nodes are re-evaluated', async () => {
  const app = await setup(row('KEKW'));
  try {
    const body = app.document.querySelector('.message');
    body.innerHTML = '<img class="chat-line__message--emote" pending src="late.webp">';
    await tick();
    assert.equal(app.document.querySelector('#m').getAttribute('data-eo-row'), 'show');
    assert.equal(body.firstElementChild.getAttribute('data-eo-graphic'), 'pending');
    const image = body.firstElementChild;
    image.removeAttribute('pending');
    image.dispatchEvent(new app.window.Event('load'));
    await tick();
    assert.equal(app.document.querySelector('#m').getAttribute('data-eo-row'), 'show');
    image.removeAttribute('src');
    image.setAttribute('pending', '');
    image.dispatchEvent(new app.window.Event('error'));
    await tick();
    assert.equal(app.document.querySelector('#m').getAttribute('data-eo-row'), 'hide');
    body.textContent = 'normal again';
    await tick();
    assert.equal(app.document.querySelectorAll('[data-eo-graphic]').length, 0);
  } finally { app.close(); }
});

test('OFF restores DOM and concurrent provider styles; ON processes existing messages', async () => {
  const app = await setup(row(`<button data-test-selector="emote-button" style="font-size:14px">${img()}</button>`), false);
  try {
    const original = app.document.querySelector('main').innerHTML;
    assert.equal(app.document.querySelector('[data-eo-row]'), null);
    await app.toggle(true);
    assert.equal(app.document.querySelector('#m').getAttribute('data-eo-row'), 'show');
    await app.toggle(false);
    assert.equal(app.document.querySelector('main').innerHTML, original);
    await app.toggle(true);
    const button = app.document.querySelector('[data-test-selector="emote-button"]');
    button.style.opacity = '0.7';
    await tick();
    await app.toggle(false);
    assert.equal(button.style.opacity, '0.7');
    assert.equal(button.style.fontSize, '14px');
    assert.equal(app.document.querySelector('[data-eo-row]'), null);
    const list = app.document.querySelector('main > div');
    list.insertAdjacentHTML('beforeend', row(img('off'), 'off'));
    await tick();
    assert.equal(app.document.querySelector('#off').hasAttribute('data-eo-row'), false);
    await app.toggle(true);
    assert.equal(app.document.querySelector('#off').getAttribute('data-eo-row'), 'show');
  } finally { app.close(); }
});

test('rapid updates process only changed rows and do not feed back or retain removed rows', async () => {
  const app = await setup(row(img(), 'old'));
  try {
    const adapter = app.window.EmoteOnlyAdapters;
    let calls = 0;
    app.window.getComputedStyle = new Proxy(app.window.getComputedStyle, { apply(target, self, args) { calls++; return Reflect.apply(target, self, args); } });
    const list = app.document.querySelector('main > div');
    list.insertAdjacentHTML('beforeend', Array.from({ length: 500 }, (_, index) => row(index % 2 ? 'words' : img(), `new-${index}`)).join(''));
    await new Promise(resolve => setTimeout(resolve, 160));
    assert.equal(app.document.querySelectorAll('[data-eo-row]').length, 501);
    assert.equal(app.document.querySelectorAll('[data-eo-row="show"]').length, 251);
    assert.equal(calls, 250);
    await tick();
    assert.equal(calls, 250, 'no observer feedback or old-row rescans');
    const removed = app.document.querySelector('#old'); removed.remove();
    await tick();
    assert.equal(removed.hasAttribute('data-eo-row'), false);
    assert.equal(removed.querySelector('[data-eo-graphic]'), null);
    assert.equal(adapter.detect(removed).length, 1);
  } finally { app.close(); }
});

test('SPA removal, delayed recreation and provider takeover rediscover containers', async () => {
  const app = await setup(row(img()));
  try {
    const main = app.document.querySelector('main');
    main.innerHTML = '';
    await tick();
    main.innerHTML = '<div><div class="chat-scrollable-area__message-container"></div></div>';
    await tick();
    main.querySelector('.chat-scrollable-area__message-container').innerHTML = row(img('new'));
    const deadline = Date.now() + 1200;
    while (!main.querySelector('#m').hasAttribute('data-eo-row') && Date.now() < deadline) await tick();
    assert.equal(main.querySelector('#m').getAttribute('data-eo-row'), 'show');
  } finally { app.close(); }
});

test('initial storage snapshot cannot override a newer toggle event', async () => {
  const dom = new JSDOM('<html><body></body></html>', { runScripts: 'outside-only' });
  try {
    let resolveGet; let listener;
    dom.window.browser = { storage: { local: { get: () => new Promise(resolve => { resolveGet = resolve; }) }, onChanged: { addListener: value => { listener = value; } } } };
    dom.window.eval(source[0]); dom.window.eval(source[1]);
    listener({ enabled: { newValue: true } }, 'local');
    listener({ enabled: { newValue: false } }, 'local');
    resolveGet({ enabled: true });
    await tick();
    assert.equal(dom.window.document.documentElement.hasAttribute('data-emoteonly-enabled'), false);
  } finally { dom.window.close(); }
});

test('subscription/status notices hide their header while retaining the associated emotes', async () => {
  const app = await setup(`<div class="chat-line__status" id="status">Welcome to chat</div><div class="user-notice-line" id="notice"><div class="notice-header">User subscribed!</div>${row(img('sub-emote'), 'sub-message')}</div><div class="user-notice-line" id="empty-notice">Gift subscription</div>`);
  try {
    assert.equal(app.document.querySelector('#status').getAttribute('data-eo-row'), 'hide');
    assert.equal(app.document.querySelector('#empty-notice').getAttribute('data-eo-row'), 'hide');
    assert.equal(app.document.querySelector('#notice').getAttribute('data-eo-row'), 'show');
    assert.equal(app.document.querySelector('.notice-header').hasAttribute('data-eo-path'), false);
    assert.equal(app.document.querySelector('[alt="sub-emote"]').getAttribute('data-eo-graphic'), 'ready');
    await app.toggle(false);
    assert.equal(app.document.querySelector('[data-eo-row]'), null);
  } finally { app.close(); }
});

test('moving a managed row outside the transcript cleans its markers', async () => {
  const app = await setup(row(img()));
  try {
    const message = app.document.querySelector('#m');
    app.document.body.append(message);
    await tick();
    assert.equal(message.hasAttribute('data-eo-row'), false);
    assert.equal(message.querySelector('[data-eo-graphic]'), null);
  } finally { app.close(); }
});

test('root-only fallback finds a late provider mount in an existing sibling branch', async () => {
  const app = await setup(row(img()));
  try {
    const branch = app.document.createElement('section');
    branch.innerHTML = '<div class="existing-host"></div>';
    app.document.body.append(branch);
    await tick();
    // Insertion deep inside a sibling is outside the active ancestry observers.
    branch.firstElementChild.innerHTML = '<div class="seventv-chat-list"><div class="seventv-message" id="late-provider"><span class="seventv-chat-message-body"><img class="seventv-chat-emote" src="late.webp"></span></div></div>';
    await new Promise(resolve => setTimeout(resolve, 2100));
    assert.equal(app.document.querySelector('#late-provider').getAttribute('data-eo-row'), 'show');
  } finally { app.close(); }
});

test('current native user-notice data selector hides subscriptions and retains nested message emotes', async () => {
  const app = await setup(`<div data-test-selector="user-notice-line" id="current-notice"><span class="chatter-name">Subscriber</span><p>Subscribed for 47 months!</p>${row(img('notice-emote'), 'nested')}</div><div data-test-selector="user-notice-line" id="current-empty-notice">Gifted a subscription</div>`);
  try {
    assert.equal(app.document.querySelector('#current-notice').dataset.eoRow, 'show');
    assert.equal(app.document.querySelector('#current-empty-notice').dataset.eoRow, 'hide');
    assert.equal(app.document.querySelector('.chatter-name').hasAttribute('data-eo-path'), false);
    assert.equal(app.document.querySelector('[alt="notice-emote"]').dataset.eoGraphic, 'ready');
    assert.equal(app.document.querySelector('#nested').hasAttribute('data-eo-row'), false);
    await app.toggle(false);
    assert.equal(app.document.querySelector('[data-eo-row]'), null);
  } finally { app.close(); }
});

test('pinned chat cards hide author/time/text while retaining only rendered emotes and restore exactly', async () => {
  const app = await setup('', false);
  try {
    const main = app.document.querySelector('main');
    main.insertAdjacentHTML('beforeend', `<div class="pinned-chat__highlight-card" id="pin"><p class="pinned-chat__pinned-by">Pinned by User</p><p class="pinned-chat__message">hello ${img('pinned')} goodbye</p><p>Sent at 12:00</p></div><div class="pinned-chat__highlight-card" id="empty-pin"><p class="pinned-chat__message">hello everyone</p></div>`);
    const original = main.innerHTML;
    await app.toggle(true);
    assert.equal(app.document.querySelector('#pin').dataset.eoRow, 'show');
    assert.equal(app.document.querySelector('#empty-pin').dataset.eoRow, 'hide');
    assert.equal(app.document.querySelector('.pinned-chat__pinned-by').hasAttribute('data-eo-path'), false);
    assert.equal(app.document.querySelector('[alt="pinned"]').dataset.eoGraphic, 'ready');
    await app.toggle(false);
    assert.equal(main.innerHTML, original);
  } finally { app.close(); }
});

test('current 7TV 1.10 renderer recognizes emote/emoji images and groups zero-width composition', async () => {
  const app = await setup(row(`<span class="seventv-emote-anchor"><span class="seventv-emote-container modified-emote" style="width:84px;height:28px"><img class="seventv-emote seventv-emote--base" src="wide.webp" width="84" height="28"><img class="seventv-emote seventv-emote-zw" src="overlay.webp" width="28" height="28"></span></span> text <img class="seventv-emoji" src="emoji.svg" width="28" height="28">`));
  try {
    assert.equal(app.document.querySelectorAll('[data-eo-graphic="ready"]').length, 3);
    assert.equal(app.document.querySelector('.seventv-emote-container').hasAttribute('data-eo-unit'), true);
    assert.equal(app.document.querySelector('.seventv-emote-zw').parentElement, app.document.querySelector('.seventv-emote--base').parentElement);
    assert.equal(app.document.querySelector('.seventv-emote-container').style.width, '84px');
    await app.toggle(false);
    assert.equal(app.document.querySelector('[data-eo-unit]'), null);
  } finally { app.close(); }
});
