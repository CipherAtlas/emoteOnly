import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8');
const sources = await Promise.all(['settings.js','popup.js'].map(name => readFile(new URL(`../extension/${name}`, import.meta.url), 'utf8')));
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
async function setup(storage = {}, fail = false) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const listeners = [];
  dom.window.browser = { storage: { local: {
    get: async () => ({ ...storage }),
    set: async changes => {
      if (fail) throw Error('Storage unavailable');
      Object.assign(storage, changes);
      listeners.forEach(listener => listener(Object.fromEntries(Object.entries(changes).map(([key,newValue]) => [key,{newValue}])), 'local'));
    }
  }, onChanged: { addListener: listener => listeners.push(listener) } } };
  dom.window.console.error = () => {};
  sources.forEach(source => dom.window.eval(source));
  await tick();
  return { dom, document: dom.window.document, storage };
}

test('popup loads saved switches, saves preferences, and disables details while OFF without losing them', async () => {
  const app = await setup({ enabled: true, badges: false });
  try {
    const input = id => app.document.getElementById(id);
    assert.equal(input('usernames').checked, true);
    assert.equal(input('badges').checked, false);
    assert.equal(input('timestamps').checked, true);
    input('enabled').focus();
    input('enabled').click();
    await tick();
    assert.equal(app.document.activeElement, input('enabled'), 'saving keeps keyboard focus');
    assert.equal(app.storage.enabled, false);
    assert.equal(input('details').disabled, true);
    assert.equal(input('badges').checked, false);
    input('enabled').click();
    await tick();
    assert.equal(input('details').disabled, false);
    input('badges').click();
    await tick();
    assert.equal(app.storage.badges, true);
    assert.match(input('status').textContent, /Saved/);
  } finally { app.dom.window.close(); }
});

test('popup reports a failed write and restores the previously saved switch', async () => {
  const app = await setup({ enabled: true }, true);
  try {
    app.document.getElementById('enabled').click();
    await tick();
    assert.equal(app.document.getElementById('enabled').checked, true);
    assert.equal(app.storage.enabled, true);
    assert.equal(app.document.getElementById('status').className, 'error');
  } finally { app.dom.window.close(); }
});
