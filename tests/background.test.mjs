import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = await readFile(new URL('../extension/background.js', import.meta.url), 'utf8');
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
  assert.equal(app.storage.enabled, true);
  assert.equal(app.display.setBadgeText.text, 'ON');
  assert.match(app.display.setTitle.title, /is ON/);
  app.browser.action.onClicked.fire();
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

test('rapid clicks serialize with initialization; shared storage events update toolbar', async () => {
  const app = start();
  for (let index = 0; index < 5; index++) app.browser.action.onClicked.fire();
  await tick();
  assert.equal(app.storage.enabled, false);
  for (let index = 0; index < 4; index++) app.browser.action.onClicked.fire();
  await tick();
  assert.equal(app.storage.enabled, false);
  await app.browser.storage.local.set({ enabled: true });
  await tick();
  assert.equal(app.display.setBadgeText.text, 'ON');
});
