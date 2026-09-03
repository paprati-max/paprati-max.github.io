// footer.js — tells you, on the page, exactly which files the browser is
// actually running.
//
// The failure this exists to catch: a page updates but one module doesn't, so
// the app looks current and behaves like an old version. A single date at the
// bottom of the HTML would have reported "up to date" through that entire mess.
// So every module carries its own BUILD string and this compares them.
//
// When you change any JS file, bump BUILD in that file AND in this one.

export const BUILD = "v5 · 2026-09-03";

const FILES = {
  "grid.js": "./js/grid.js?v=5",
  "elim.js": "./js/elim.js?v=5",
  "db.js": "./js/db.js?v=5",
  "challenges.js": "./js/challenges.js?v=5"
};

export async function renderFooter() {
  const rows = [];
  let stale = 0;

  for (const [name, path] of Object.entries(FILES)) {
    try {
      const mod = await import(path);
      const b = mod.BUILD;
      if (!b) { rows.push([name, "no build stamp — old file", true]); stale++; }
      else if (b !== BUILD) { rows.push([name, b, true]); stale++; }
      else rows.push([name, b, false]);
    } catch (e) {
      rows.push([name, "failed to load", true]);
      stale++;
    }
  }

  const el = document.createElement("div");
  el.style.cssText =
    "max-width:34rem;margin:0 auto;padding:1rem 1.1rem 2.5rem;font-size:.8rem;color:var(--ink-dim)";

  if (stale) {
    el.innerHTML =
      `<div style="border:1px solid var(--hazard);border-radius:3px;padding:.7rem .8rem">
        <b style="color:var(--hazard)">${stale} file${stale > 1 ? "s are" : " is"} out of date.</b>
        The browser is not running the code you think it is. Push the missing files,
        then hard-refresh. Don't trust anything you see until this clears.
        <div style="margin-top:.5rem">` +
      rows.map(([n, b, bad]) =>
        `<div style="color:${bad ? "var(--hazard)" : "inherit"}">${n} — ${b}</div>`).join("") +
      `</div></div>`;
  } else {
    el.innerHTML = `All files ${BUILD} · page ${new Date(document.lastModified).toLocaleString()}`;
  }

  document.body.append(el);
}
