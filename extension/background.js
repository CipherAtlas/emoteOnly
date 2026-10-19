/* Firefox MV3 event page: listeners must be registered synchronously. */
(() => {
  "use strict";
  const { defaults, normalize } = globalThis.EmoteOnlySettings;
  let revision = 0;

  async function updateAction(enabled) {
    await Promise.all([
      browser.action.setBadgeText({ text: enabled ? "ON" : "OFF" }),
      browser.action.setBadgeBackgroundColor({ color: enabled ? "#b8f29c" : "#555568" }),
      browser.action.setBadgeTextColor({ color: enabled ? "#202031" : "#ffffff" }),
      browser.action.setTitle({ title: `EmoteOnly is ${enabled ? "ON" : "OFF"} — chat settings` })
    ]);
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) {
      revision++;
      updateAction(normalize({ enabled: changes.enabled.newValue }).enabled).catch(console.error);
    }
  });
  const initialRevision = revision;
  browser.storage.local.get(defaults).then(values => {
    if (revision === initialRevision) return updateAction(normalize(values).enabled);
  }).catch(error => console.error("EmoteOnly could not read its settings:", error));
})();
