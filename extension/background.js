/* Firefox MV3 event page: listeners must be registered synchronously. */
(() => {
  "use strict";
  let operations = Promise.resolve();

  async function updateAction(enabled) {
    await Promise.all([
      browser.action.setBadgeText({ text: enabled ? "ON" : "OFF" }),
      browser.action.setBadgeBackgroundColor({ color: enabled ? "#b8f29c" : "#555568" }),
      browser.action.setBadgeTextColor({ color: enabled ? "#202031" : "#ffffff" }),
      browser.action.setTitle({ title: enabled
        ? "EmoteOnly is ON — click to show normal chat"
        : "EmoteOnly is OFF — click for emotes only" })
    ]);
  }

  async function initialize() {
    const { enabled } = await browser.storage.local.get("enabled");
    if (typeof enabled !== "boolean") {
      await browser.storage.local.set({ enabled: true });
    } else {
      await updateAction(enabled);
    }
  }

  function enqueue(operation) {
    operations = operations.then(operation).catch(error =>
      console.error("EmoteOnly could not update its setting:", error));
  }

  browser.action.onClicked.addListener(() => {
    // Serialize initialization and clicks; each click inverts the persisted state.
    enqueue(async () => {
      const { enabled = true } = await browser.storage.local.get("enabled");
      await browser.storage.local.set({ enabled: !enabled });
    });
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) {
      updateAction(changes.enabled.newValue !== false).catch(console.error);
    }
  });
  browser.runtime.onInstalled.addListener(() => { enqueue(initialize); });
  browser.runtime.onStartup.addListener(() => { enqueue(initialize); });
  enqueue(initialize);
})();
