// elim.js — deciding which squares die when a challenge is banked.
//
// Kept separate from db.js on purpose: sandbox.html runs this exact code with
// no database attached, so testing the sandbox tells you something real about
// the game rather than something about a copy of it.

export const DEFAULTS = {
  elimPercent: 0.20,  // share of still-live squares removed per challenge
  viewSeconds: 180,   // total map time for each team's passenger
  minCells: 3,        // never shrink below this many squares
  elimMode: "drift"   // "drift" closes in on them; "scatter" removes at random
};

const rc = id => id.split("-").map(Number);  // see the note in grid.js about this separator

function uniformPick(pool, n) {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function driftPick(pool, safeCells, n) {
  const anchors = safeCells.map(rc);
  if (!anchors.length) return uniformPick(pool, n);
  const weighted = pool.map(id => {
    const [r, c] = rc(id);
    const d = Math.min(...anchors.map(([ar, ac]) => Math.hypot(r - ar, c - ac)));
    // Squared distance, plus a floor so nearby squares are unlikely, not immune.
    return { id, w: d * d + 0.4 };
  });
  const out = [];
  let total = weighted.reduce((s, x) => s + x.w, 0);
  for (let k = 0; k < n && weighted.length; k++) {
    let roll = Math.random() * total;
    let i = 0;
    while (i < weighted.length - 1 && (roll -= weighted[i].w) > 0) i++;
    out.push(weighted[i].id);
    total -= weighted[i].w;
    weighted.splice(i, 1);
  }
  return out;
}

// Returns the IDs to wipe. Never returns a square a hostage is standing in.
export function chooseEliminations({ land, eliminated = {}, safeCells = [], config = {} }) {
  const cfg = { ...DEFAULTS, ...config };
  const safe = new Set(safeCells.filter(Boolean));
  const live = land.filter(id => !eliminated[id]);
  const cuttable = live.filter(id => !safe.has(id));

  let take = Math.max(1, Math.round(cuttable.length * cfg.elimPercent));
  take = Math.min(take, Math.max(0, live.length - Math.max(cfg.minCells, safe.size)));
  if (take <= 0) return [];

  return cfg.elimMode === "scatter"
    ? uniformPick(cuttable, take)
    : driftPick(cuttable, [...safe], take);
}
