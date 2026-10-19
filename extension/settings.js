/* Shared defaults keep popup, toolbar and chat consistent across upgrades. */
(() => {
  "use strict";
  const defaults = Object.freeze({ enabled: true, usernames: true, badges: true, timestamps: true });
  const normalize = values => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
    [key, typeof values[key] === "boolean" ? values[key] : fallback]));
  globalThis.EmoteOnlySettings = Object.freeze({ defaults, normalize });
})();
