// db.js — all shared state lives in one Firebase Realtime Database node per game.
//
// games/{code}
//   config: { elimPercent, viewSeconds, minCells }
//   startedAt
//   teams/{A|B}
//     hostages/{playerId}: { name, lat, lng, cell, lockedAt }
//     eliminated/{cellId}: true
//     completed/{challengeId}: timestamp
//     viewLeft: seconds of map time the passenger has left
//     found: true once the seekers have their hostages back
//   meetingPoint: { lat, lng }

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
import { landCellIds, midpoint } from "./grid.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const DEFAULTS = {
  elimPercent: 0.20,  // share of still-live cells removed per challenge
  viewSeconds: 180,   // total map time for each team's passenger
  minCells: 3,        // never shrink below this many cells
  elimMode: "drift"   // "drift" closes in on them; "scatter" removes at random
};

const rc = id => id.split(".").map(Number);

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
  const weighted = pool.map(id => {
    const [r, c] = rc(id);
    const d = Math.min(...anchors.map(([ar, ac]) => Math.hypot(r - ar, c - ac)));
    // Squared distance, plus a floor so nearby cells are unlikely, not immune.
    return { id, w: Math.pow(d, 2) + 0.4 };
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

export function gameRef(code) { return ref(db, `games/${code}`); }
export function teamRef(code, team) { return ref(db, `games/${code}/teams/${team}`); }

export function newCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
}

export function playerId() {
  let id = localStorage.getItem("mh.playerId");
  if (!id) {
    id = "p" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("mh.playerId", id);
  }
  return id;
}

export async function createGame(code, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  await set(gameRef(code), {
    config: cfg,
    startedAt: Date.now(),
    teams: {
      A: { viewLeft: cfg.viewSeconds, found: false },
      B: { viewLeft: cfg.viewSeconds, found: false }
    }
  });
  return cfg;
}

export async function gameExists(code) {
  const snap = await get(gameRef(code));
  return snap.exists();
}

export function watchGame(code, cb) {
  return onValue(gameRef(code), snap => cb(snap.val()));
}

export function watchTeam(code, team, cb) {
  return onValue(teamRef(code, team), snap => cb(snap.val()));
}

export async function lockLocation(code, team, id, name, lat, lng, cell) {
  await update(ref(db, `games/${code}/teams/${team}/hostages/${id}`), {
    name, lat, lng, cell, lockedAt: Date.now()
  });
}

// Completing a challenge removes a slice of the remaining cells. The cells the
// hostages are actually standing in are never removed, so the true location
// always survives to the end.
export async function completeChallenge(code, team, challengeId, config = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const land = landCellIds();
  let outcome = { ok: false, removed: 0, left: land.length };

  await runTransaction(teamRef(code, team), t => {
    if (!t) return t;
    t.completed = t.completed || {};
    if (t.completed[challengeId]) return; // abort — already banked
    t.eliminated = t.eliminated || {};

    const hostages = Object.values(t.hostages || {});
    if (!hostages.some(h => h.cell)) return; // abort — nobody has locked a location

    const safe = new Set(hostages.map(h => h.cell).filter(Boolean));
    const live = land.filter(c => !t.eliminated[c]);
    const cuttable = live.filter(c => !safe.has(c));

    const pct = cfg.elimPercent;
    const floor = cfg.minCells;
    let take = Math.max(1, Math.round(cuttable.length * pct));
    take = Math.min(take, Math.max(0, live.length - Math.max(floor, safe.size)));

    // Which cells go. "drift" weights removal by distance from the hostages, so
    // the live area creeps inward without ever handing over an exact centre.
    // "scatter" removes uniformly, leaving candidates spread across the island.
    const pick = cfg.elimMode === "scatter"
      ? uniformPick(cuttable, take)
      : driftPick(cuttable, [...safe], take);
    for (const id of pick) t.eliminated[id] = true;

    t.completed[challengeId] = Date.now();
    outcome = { ok: true, removed: take, left: live.length - take };
    return t;
  });

  return outcome;
}

// The passenger's map budget. Written back every couple of seconds so a
// refresh, a crash or a dropped signal can't hand back free seconds.
export async function setViewLeft(code, team, seconds) {
  await update(teamRef(code, team), { viewLeft: Math.max(0, Math.round(seconds)) });
}

export async function markFound(code, team) {
  await update(teamRef(code, team), { found: true, foundAt: Date.now() });
}

// Once both teams have their people back, work out where everyone meets:
// the midpoint of the two drop-off zones.
export async function resolveMeetingPoint(code) {
  const snap = await get(gameRef(code));
  const g = snap.val();
  if (!g || g.meetingPoint) return g?.meetingPoint || null;
  const teams = g.teams || {};
  if (!teams.A?.found || !teams.B?.found) return null;

  const centre = t => midpoint(Object.values(t?.hostages || {}));
  const a = centre(teams.A);
  const b = centre(teams.B);
  if (!a || !b) return null;

  const point = midpoint([a, b]);
  await update(gameRef(code), { meetingPoint: point });
  return point;
}
