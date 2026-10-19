// Exercise the shipped popup page in a separate extension tab in disposable profiles.
// Native toolbar-panel appearance is also checked manually in the user's Firefox.
export function popupController({ command, execute, addonId }) {
  let popupTab;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  return async function configurePopup(changes) {
    const original = await command('GET', '/window');
    try {
      if (!popupTab || !(await command('GET', '/window/handles')).includes(popupTab)) {
        await command('POST', '/moz/context', { context: 'chrome' });
        let url;
        try {
          url = await execute("return WebExtensionPolicy.getByID(arguments[0]).getURL('popup.html')", addonId);
        } finally { await command('POST', '/moz/context', { context: 'content' }); }
        popupTab = (await command('POST', '/window/new', { type: 'tab' })).handle;
        await command('POST', '/window', { handle: popupTab });
        await command('POST', '/url', { url });
      } else await command('POST', '/window', { handle: popupTab });
      const deadline = Date.now() + 5000;
      while (await execute("return document.getElementById('enabled').disabled")) {
        if (Date.now() > deadline) throw Error('Popup settings did not load');
        await pause(30);
      }
      if (changes === undefined) changes = { enabled: !(await execute("return document.getElementById('enabled').checked")) };
      for (const [key, value] of Object.entries(changes)) {
        if ((await execute('return document.getElementById(arguments[0]).checked', key)) === value) continue;
        const element = await command('POST', '/element', { using: 'css selector', value: `#${key}` });
        await command('POST', `/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {});
        const saved = await command('POST', '/execute/async', {
          script: 'const [key,done]=arguments;browser.storage.local.get(key).then(value=>done(value[key]));', args: [key]
        });
        if (saved !== value) throw Error(`Popup did not save ${key}`);
      }
    } finally { await command('POST', '/window', { handle: original }); }
  };
}
