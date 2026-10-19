(() => {
  "use strict";
  const { defaults, normalize } = globalThis.EmoteOnlySettings;
  const inputs = Object.fromEntries(Object.keys(defaults).map(key => [key, document.getElementById(key)]));
  const status = document.getElementById("status");
  let settings = { ...defaults };
  let ready = false;
  const pending = new Set();
  const initialChanges = {};

  function render() {
    for (const [key, input] of Object.entries(inputs)) {
      input.checked = settings[key];
      input.disabled = !ready;
    }
    document.getElementById("details").disabled = !ready || !settings.enabled;
  }
  function feedback(message, error = false) {
    status.textContent = message;
    status.classList.toggle("error", error);
  }
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of Object.keys(defaults)) if (changes[key]) {
      if (!ready) initialChanges[key] = changes[key].newValue;
      settings[key] = normalize({ [key]: changes[key].newValue })[key];
    }
    render();
  });
  for (const [key, input] of Object.entries(inputs)) {
    input.addEventListener("change", async () => {
      if (pending.has(key)) { render(); return; }
      const previous = settings[key];
      pending.add(key);
      settings[key] = input.checked;
      render();
      try {
        await browser.storage.local.set({ [key]: settings[key] });
        feedback("Saved");
      } catch (error) {
        settings[key] = previous;
        render();
        feedback("Couldn’t save. Please try again.", true);
        console.error("EmoteOnly could not save its settings:", error);
      } finally {
        pending.delete(key);
        render();
      }
    });
  }
  browser.storage.local.get(defaults).then(values => {
    settings = normalize({ ...values, ...initialChanges });
    ready = true;
    render();

  }).catch(error => {
    feedback("Couldn’t load settings. Reopen to retry.", true);
    console.error("EmoteOnly could not read its settings:", error);
  });
})();
