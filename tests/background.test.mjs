import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = (await Promise.all(['settings.js','background.js'].map(name => readFile(new URL(`../extension/${name}`, import.meta.url), 'utf8')))).join('\n');
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
function event() {
  const listeners = [];
  return { addListener: listener => listeners.push(listener), fire: (...args) => listeners.forEach(listener => listener(...args)) };
}
function start(storage = {}) {
  const onChanged = event(), onClicked = event(), onInstalled = event(), onStartup = event();
  const display = {};
  const browser = { storage: { local: {
    get: async () => ({ ...storage }),
    set: async changes => {
      const events = {};
      for (const [key, value] of Object.entries(changes)) { events[key] = { oldValue: storage[key], newValue: value }; storage[key] = value; }
      onChanged.fire(events, 'local');
    }
  }, onChanged }, action: { onClicked, ...Object.fromEntries(['setBadgeText','setBadgeBackgroundColor','setBadgeTextColor','setTitle'].map(name => [name, async value => { display[name] = value; }])) }, runtime: { onInstalled, onStartup } };
  runInNewContext(source, { browser, console });
  return { browser, storage, display };
}

test('first-install default, tooltip and ON badge; existing OFF survives fresh event page', async () => {
  const app = start();
  await tick();
  assert.equal(app.storage.enabled, undefined, "defaults need no storage write");
  assert.equal(app.display.setBadgeText.text, 'ON');
  assert.match(app.display.setTitle.title, /is ON/);
  await app.browser.storage.local.set({ enabled: false });
  await tick();
  assert.equal(app.storage.enabled, false);
  assert.equal(app.display.setBadgeText.text, 'OFF');
  const fresh = start(app.storage);
  fresh.browser.runtime.onStartup.fire();
  fresh.browser.runtime.onInstalled.fire({ reason: 'update' });
  await tick();
  assert.equal(fresh.storage.enabled, false);
  assert.equal(fresh.display.setBadgeText.text, 'OFF');
});

test('storage updates and preference removal refresh toolbar without overwriting other settings', async () => {
  const app = start({ enabled: false, usernames: false, badges: false });
  await tick();
  assert.equal(app.display.setBadgeText.text, 'OFF');
  await app.browser.storage.local.set({ enabled: true });
  await tick();
  assert.equal(app.display.setBadgeText.text, 'ON');
  assert.equal(app.storage.usernames, false);
  await app.browser.storage.local.set({ enabled: undefined });
  await tick();
  assert.equal(app.display.setBadgeText.text, 'ON');
});
