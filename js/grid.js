// grid.js — the searchable board.
// Malta's main island is chopped into a lat/lon grid. Cells whose centre or a
// corner falls inside the coastline outline count as land; everything else is
// sea and is blacked out from the start.
//
// Every device builds this grid from the same constants, so cell IDs mean the
// same thing on every phone. Change a constant and everyone must reload.

export const MALTA_BOUNDS = {
  south: 35.800,
  west: 14.305,
  north: 36.005,
  east: 14.585
};

// ~1.3 km cells. Smaller = longer game, more challenges needed.
export const CELL_LAT = 0.012;
export const CELL_LON = 0.0148;

// Rough coastline of the main island, clockwise from the Marfa ridge.
// Deliberately a little generous — better to include a scrap of sea than to
// cut out a village. Tweak freely; the grid rebuilds around it.
export const MALTA_OUTLINE = [
  [35.988, 14.325], // Ċirkewwa
  [35.999, 14.352], // Aħrax Point
  [35.973, 14.374], // Mellieħa Bay
  [35.957, 14.395], // Xemxija
  [35.964, 14.437], // Qawra Point
  [35.943, 14.452], // Salina
  [35.937, 14.480], // Baħar iċ-Ċagħaq
  [35.921, 14.502], // St Julian's
  [35.903, 14.520], // Valletta
  [35.893, 14.537], // Ricasoli
  [35.878, 14.556], // Żonqor
  [35.860, 14.575], // Marsaskala
  [35.843, 14.568], // St Thomas Bay
  [35.816, 14.570], // Delimara Point
  [35.808, 14.543], // Benghajsa
  [35.810, 14.508], // Ħal Far
  [35.822, 14.470], // south coast
  [35.828, 14.438], // Għar Lapsi
  [35.843, 14.392], // Dingli Cliffs
  [35.872, 14.348], // Baħrija
  [35.903, 14.325], // Fomm ir-Riħ
  [35.923, 14.338], // Ġnejna
  [35.940, 14.340], // Golden Bay
  [35.957, 14.331], // Anchor Bay
  [35.975, 14.318]  // Ras il-Qammieħ
];

export const ROWS = Math.ceil((MALTA_BOUNDS.north - MALTA_BOUNDS.south) / CELL_LAT);
export const COLS = Math.ceil((MALTA_BOUNDS.east - MALTA_BOUNDS.west) / CELL_LON);

function inside(lat, lng, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ay, ax] = poly[i];
    const [by, bx] = poly[j];
    if ((ay > lat) !== (by > lat) && lng < ((bx - ax) * (lat - ay)) / (by - ay) + ax) {
      hit = !hit;
    }
  }
  return hit;
}

let cache = null;

export function buildGrid() {
  if (cache) return cache;
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const south = MALTA_BOUNDS.south + r * CELL_LAT;
      const west = MALTA_BOUNDS.west + c * CELL_LON;
      const north = south + CELL_LAT;
      const east = west + CELL_LON;
      const probes = [
        [south + CELL_LAT / 2, west + CELL_LON / 2],
        [south, west], [south, east], [north, west], [north, east]
      ];
      const land = probes.some(([la, ln]) => inside(la, ln, MALTA_OUTLINE));
      cells.push({ id: `${r}.${c}`, row: r, col: c, south, west, north, east, land });
    }
  }
  cache = cells;
  return cells;
}

export function landCellIds() {
  return buildGrid().filter(c => c.land).map(c => c.id);
}

export function cellIdFor(lat, lng) {
  const r = Math.floor((lat - MALTA_BOUNDS.south) / CELL_LAT);
  const c = Math.floor((lng - MALTA_BOUNDS.west) / CELL_LON);
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
  return `${r}.${c}`;
}

export function cellById(id) {
  return buildGrid().find(c => c.id === id) || null;
}

// Great-circle midpoint. Over Malta a flat average would do, but this costs
// nothing and behaves properly.
export function midpoint(points) {
  const pts = points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length) return null;
  let x = 0, y = 0, z = 0;
  for (const p of pts) {
    const la = (p.lat * Math.PI) / 180;
    const ln = (p.lng * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(ln);
    y += Math.cos(la) * Math.sin(ln);
    z += Math.sin(la);
  }
  x /= pts.length; y /= pts.length; z /= pts.length;
  const lng = Math.atan2(y, x);
  const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}
