// db.js — all shared state lives in one Firebase Realtime Database node per game.
//
// games/{code}
//   config: { elimPercent, viewSeconds, minCells, elimMode }
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
import { chooseEliminations, DEFAULTS } from "./elim.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { DEFAULTS };
export { db };

// Every network call gets a deadline. Without one, a call that Firebase never
// answers leaves the UI sitting on "Banking…" forever with nothing in the log.
const TIMEOUT_MS = 12000;
function deadline(promise, what) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${what} got no reply in ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS))
  ]);
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
  await deadline(set(gameRef(code), {
    config: cfg,
    startedAt: Date.now(),
    teams: {
      A: { viewLeft: cfg.viewSeconds, found: false },
      B: { viewLeft: cfg.viewSeconds, found: false }
    }
  }), "createGame");
  return cfg;
}

export async function gameExists(code) {
  const snap = await deadline(get(gameRef(code)), "gameExists");
  return snap.exists();
}

export function watchGame(code, cb) {
  return onValue(gameRef(code), snap => cb(snap.val()), err => {
    console.error("[chartroom] watchGame failed:", err.code, err.message);
  });
}

export function watchTeam(code, team, cb) {
  return onValue(teamRef(code, team), snap => cb(snap.val()), err => {
    console.error("[chartroom] watchTeam failed:", err.code, err.message);
  });
}

export async function lockLocation(code, team, id, name, lat, lng, cell) {
  await deadline(update(ref(db, `games/${code}/teams/${team}/hostages/${id}`), {
    name, lat, lng, cell, lockedAt: Date.now()
  }), "lockLocation");
}

// Completing a challenge removes a slice of the remaining squares. The squares
// the hostages are actually standing in are never removed, so the true location
// always survives to the end.
//
// Throws on failure. Callers must catch, or the UI will hang.
export async function completeChallenge(code, team, challengeId, config = {}) {
  const land = landCellIds();
  let outcome = { ok: false, reason: "unknown", removed: 0 };

  const res = await deadline(runTransaction(teamRef(code, team), t => {
    if (!t) return t;                       // no local copy yet — retry against the server
    t.completed = t.completed || {};
    t.eliminated = t.eliminated || {};

    if (t.completed[challengeId]) {
      outcome = { ok: false, reason: "already banked", removed: 0 };
      return;                               // abort
    }

    const hostages = Object.values(t.hostages || {});
    const safeCells = hostages.map(h => h.cell).filter(Boolean);
    if (!safeCells.length) {
      outcome = { ok: false, reason: "nobody on this team has locked a location", removed: 0 };
      return;                               // abort
    }

    const kill = chooseEliminations({ land, eliminated: t.eliminated, safeCells, config });
    for (const id of kill) t.eliminated[id] = true;
    t.completed[challengeId] = Date.now();

    outcome = { ok: true, reason: "", removed: kill.length };
    return t;
  }), "completeChallenge");

  if (!res.committed && outcome.ok) outcome = { ok: false, reason: "not committed", removed: 0 };
  return outcome;
}

// The passenger's map budget. Written back every couple of seconds so a
// refresh, a crash or a dropped signal can't hand back free seconds.
export async function setViewLeft(code, team, seconds) {
  await update(teamRef(code, team), { viewLeft: Math.max(0, Math.round(seconds)) });
}

export async function markFound(code, team) {
  await deadline(update(teamRef(code, team), { found: true, foundAt: Date.now() }), "markFound");
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
