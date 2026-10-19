(() => {
  "use strict";
  const { lists, rows, messageFor, detect, identity } = globalThis.EmoteOnlyAdapters;
  const { defaults, normalize } = globalThis.EmoteOnlySettings;
  let settings = { ...defaults };
  const root = document.documentElement;
  const attributes = ["class", "src", "srcset", "style", "data-a-target", "data-test-selector", "alt", "data-badge"];
  const containers = new Map();
  const pending = new Set();
  const spaces = new Map();
  let records = new WeakMap();
  let enabled = false;
  let timer = null;
  let retryTimer = null;
  let ancestry = null;
  let discoveryTimer = null;

  function remember(state, element, name, value) {
    let saved = state.get(element);
    if (!saved) { saved = new Map(); state.set(element, saved); }
    if (!saved.has(name)) {
      saved.set(name, name === "style" ? {
        raw: element.getAttribute("style"), normalized: element.style.cssText,
        properties: ["--eo-font", "--eo-line", "--eo-color", "--eo-gap"].map(key =>
          [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)])
      } : element.getAttribute(name));
    }
    if (name !== "style") element.setAttribute(name, value);
  }

  function restore(row) {
    const state = records.get(row);
    if (!state) return;
    for (const [element, saved] of state) {
      for (const [name, value] of saved) {
        if (name === "style") {
          // Remove only our properties; preserve style changes made by the renderer.
          for (const [key, original, priority] of value.properties) {
            if (original) element.style.setProperty(key, original, priority);
            else element.style.removeProperty(key);
          }
          if (element.style.cssText === value.normalized) {
            if (value.raw === null) element.removeAttribute("style");
            else element.setAttribute("style", value.raw);
          }
        } else if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    records.delete(row);
  }

  function spaceWidth(style) {
    const key = `${style.font}|${style.fontSize}|${style.fontFamily}`;
    if (spaces.has(key)) return spaces.get(key);
    const context = document.createElement("canvas").getContext("2d");
    let width = parseFloat(style.fontSize) / 4 || 3.5;
    if (context) {
      context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
      width = context.measureText(" ").width;
    }
    if (spaces.size >= 32) spaces.clear();
    spaces.set(key, `${width}px`);
    return `${width}px`;
  }

  function prepare(row) {
    const units = detect(row);
    const metrics = units.map(({ element }) => {
      const style = getComputedStyle(element);
      return { font: style.fontSize, line: style.lineHeight, space: spaceWidth(style), margin: style.marginInlineEnd };
    });
    const identities = units.length ? identity(row).filter(item => settings[{ name: "usernames", badge: "badges", time: "timestamps" }[item.kind]]).map(item => {
      const style = getComputedStyle(item.element);
      return { ...item, font: style.fontSize, line: style.lineHeight, color: style.color };
    }) : [];
    return { row, units, metrics, identities };
  }

  function present({ row, units, metrics, identities }) {
    const state = new Map();
    records.set(row, state);
    const paths = new Set([row]);
    for (let index = 0; index < units.length; index++) {
      const { element, graphics } = units[index];
      const metric = metrics[index];
      remember(state, element, "data-eo-unit", "");
      remember(state, element, "style", "");
      element.style.setProperty("--eo-font", metric.font);
      element.style.setProperty("--eo-line", metric.line);
      // Add one gap per composition, never between a BTTV base and its overlay.
      const next = units[index + 1]?.element;
      const gap = next && !next.matches(".bttv-emote-overlay") ? metric.space : "0px";
      element.style.setProperty("--eo-gap", `calc(${metric.margin || "0px"} + ${gap})`);
      for (const graphic of graphics) {
        remember(state, graphic, "data-eo-graphic", graphic.tagName === "IMG" && !graphic.naturalWidth ? "pending" : "ready");
        // Wrapper paths retain CSS grids, negative margins and transforms.
        for (let parent = graphic; parent && parent !== row; parent = parent.parentElement) paths.add(parent);
      }
    }
    for (const { element, kind, font, line, color } of identities) {
      remember(state, element, `data-eo-${kind}`, "");
      remember(state, element, "style", "");
      element.style.setProperty("--eo-font", font);
      element.style.setProperty("--eo-line", line);
      if (kind === "name" || kind === "time") element.style.setProperty("--eo-color", color);
      for (let parent = element; parent && parent !== row; parent = parent.parentElement) paths.add(parent);
    }
    if (units.length) {
      for (const path of paths) remember(state, path, "data-eo-path", "");
    }
    remember(state, row, "data-eo-row", units.length ? "show" : "hide");
  }

  function schedule() {
    if (timer === null && enabled) timer = setTimeout(flush, 0);
  }

  function enqueue(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    if (!node) return;
    const row = messageFor(node);
    if (row) pending.add(row);
    else {
      for (const child of node.querySelectorAll(rows)) pending.add(messageFor(child));
    }
    if (pending.size) schedule();
  }

  function cleanRemoved(node) {
    if (node.nodeType !== Node.ELEMENT_NODE || node.isConnected && node.closest(lists)) return;
    if (node.matches(rows)) restore(node);
    for (const row of node.querySelectorAll("[data-eo-row]")) restore(row);
  }

  function changed(mutations) {
    if (!enabled) return;
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        // Target covers edits to a reused row; added subtrees cover new rows only.
        const row = mutation.target.nodeType === Node.ELEMENT_NODE && messageFor(mutation.target);
        if (row) pending.add(row);
        for (const node of mutation.addedNodes) enqueue(node);
        for (const node of mutation.removedNodes) cleanRemoved(node);
      } else {
        const node = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
        const row = node && messageFor(node);
        if (row) pending.add(row);
      }
    }
    if (pending.size) schedule();
  }

  function observe(container, observer) {
    observer.observe(container, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: attributes });
  }

  function flush() {
    timer = null;
    if (!enabled) return;
    // Synchronous writes while disconnected cannot feed back into the observer.
    for (const observer of containers.values()) {
      changed(observer.takeRecords());
      observer.disconnect();
    }
    try {
      const batch = [];
      for (const row of pending) {
        pending.delete(row);
        restore(row);
        if (row.isConnected && row.closest(lists)) batch.push(row);
        if (batch.length >= 200) break;
      }
      // Separate restoration, style reads and marker writes for the entire batch.
      // Read original colors/metrics synchronously; reapply the gate before any paint.
      let prepared;
      root.removeAttribute("data-emoteonly-enabled");
      try { prepared = batch.map(prepare); }
      finally { root.setAttribute("data-emoteonly-enabled", "true"); }
      for (const item of prepared) present(item);
    } finally {
      for (const [container, observer] of containers) observe(container, observer);
    }
    if (pending.size) schedule();
  }

  function loaded(event) {
    const row = event.target.nodeType === Node.ELEMENT_NODE && messageFor(event.target);
    if (row) { pending.add(row); schedule(); }
  }

  function scheduleDiscovery() {
    if (enabled && discoveryTimer === null) {
      discoveryTimer = setTimeout(() => { discoveryTimer = null; discover(); }, 0);
    }
  }

  function discover() {
    if (!enabled) return;
    for (const [container, observer] of containers) {
      if (!container.isConnected || !container.matches(lists)) {
        observer.disconnect();
        container.removeEventListener("load", loaded, true);
        container.removeEventListener("error", loaded, true);
        cleanRemoved(container);
        containers.delete(container);
      }
    }
    for (const container of document.querySelectorAll(lists)) {
      if (containers.has(container)) continue;
      const observer = new MutationObserver(changed);
      containers.set(container, observer);
      observe(container, observer);
      container.addEventListener("load", loaded, true);
      container.addEventListener("error", loaded, true);
      enqueue(container);
    }
    clearTimeout(retryTimer);
    ancestry?.disconnect();
    if (containers.size) {
      // Watch direct children along the ancestry, never the whole page subtree during chat.
      ancestry = new MutationObserver(scheduleDiscovery);
      const parents = new Set();
      for (const container of containers.keys()) {
        for (let parent = container.parentElement; parent; parent = parent.parentElement) parents.add(parent);
      }
      for (const parent of parents) ancestry.observe(parent, { childList: true });
    }
    // Root-only fallback catches provider mounts in an existing sibling branch.
    // It never scans old messages and avoids a permanent whole-document observer.
    retryTimer = setTimeout(discover, containers.size ? 2000 : 500);
  }

  function apply(next) {
    const previous = settings;
    settings = normalize(next);
    if (enabled === settings.enabled) {
      if (enabled && Object.keys(defaults).some(key => previous[key] !== settings[key])) {
        for (const container of containers.keys()) enqueue(container);
      }
      return;
    }
    enabled = settings.enabled;
    if (enabled) {
      root.setAttribute("data-emoteonly-enabled", "true");
      discover();
    } else {
      root.removeAttribute("data-emoteonly-enabled");
      clearTimeout(retryTimer);
      ancestry?.disconnect();
      for (const [container, observer] of containers) {
        observer.disconnect();
        container.removeEventListener("load", loaded, true);
        container.removeEventListener("error", loaded, true);
      }
      containers.clear();
      clearTimeout(timer);
      clearTimeout(discoveryTimer);
      timer = discoveryTimer = retryTimer = null;
      pending.clear();
      for (const row of document.querySelectorAll("[data-eo-row]")) restore(row);
      records = new WeakMap();
    }
  }

  // Register before reading storage; a concurrent toggle must win over the initial read.
  let initialized = false;
  const initialChanges = {};
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const next = { ...settings };
    let changed = false;
    for (const key of Object.keys(defaults)) if (changes[key]) {
      next[key] = changes[key].newValue;
      changed = true;
    }
    if (changed) {
      if (!initialized) {
        for (const key of Object.keys(defaults)) if (changes[key]) initialChanges[key] = changes[key].newValue;
      } else apply(next);
    }
  });
  browser.storage.local.get(defaults).then(values => {
    initialized = true;
    apply({ ...values, ...initialChanges });
  }).catch(error => console.error("EmoteOnly could not read its settings:", error));
})();
