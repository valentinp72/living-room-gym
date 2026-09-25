// Room awareness, as pure 2D geometry on the floor (points { x, z }, meters,
// in the XR reference space). No A-Frame / three.js here: it's fed plain
// data (see readSurfaces() in tracking.js) and returns plain data.
//
//   buildRoom(surfaces)             walls (floor segments) + obstacles
//                                   (furniture footprints) from the headset's
//                                   room scan
//   placeStage(room, head, layout)  where to put the stage (panels +
//                                   mannequin) so they're clear of both

const FLOOR_MAX_Y = 0.15;     // horizontal surfaces lower than this are the floor (or a rug)
const CEILING_MIN_Y = 2.0;    // ...and higher than this, the ceiling
const MESH_MAX_SIZE = 4;      // bigger meshes are the room itself, not furniture
const SKIP_MESH = ['global mesh', 'floor', 'ceiling', 'wall', 'wall_face'];

// surfaces: [{ kind: 'vertical' | 'horizontal' | 'mesh', label, points: [[x, y, z], ...] }]
// (world coordinates). Returns { walls: [{ a, b, label }], obstacles: [{ points, top, label }] }.
export function buildRoom(surfaces) {
  const walls = [], obstacles = [];
  for (const s of surfaces) {
    if (s.points.length < 2) continue;
    const flat = s.points.map(([x, , z]) => ({ x, z }));
    if (s.kind === 'vertical') {
      // Walls, doors, windows, furniture sides: the two farthest-apart points.
      let best = [flat[0], flat[1]], len = -1;
      for (const p of flat) for (const q of flat) {
        const d = Math.hypot(p.x - q.x, p.z - q.z);
        if (d > len) { len = d; best = [p, q]; }
      }
      walls.push({ a: best[0], b: best[1], label: s.label });
      continue;
    }
    const top = Math.max(...s.points.map(p => p[1]));
    if (s.kind === 'horizontal') {
      if (s.label === 'floor' || s.label === 'ceiling' || top < FLOOR_MAX_Y || top > CEILING_MIN_Y) continue;
      obstacles.push({ points: flat, top, label: s.label });
    } else if (s.kind === 'mesh') {
      if (SKIP_MESH.includes(s.label) || top < FLOOR_MAX_Y) continue;
      // Furniture volume: its bounding rectangle on the floor.
      const xs = flat.map(p => p.x), zs = flat.map(p => p.z);
      const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
      if (x1 - x0 > MESH_MAX_SIZE || z1 - z0 > MESH_MAX_SIZE) continue;
      obstacles.push({ points: [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], top, label: s.label });
    }
  }
  return { walls, obstacles };
}

export const isEmpty = room => !room || (!room.walls.length && !room.obstacles.length);

// ---- 2D geometry --------------------------------------------------------

const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

function segmentsCross(p, q, a, b) {
  const d1 = cross(a, b, p), d2 = cross(a, b, q), d3 = cross(p, q, a), d4 = cross(p, q, b);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function pointSegDist(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}

function segSegDist(p, q, a, b) {
  if (segmentsCross(p, q, a, b)) return 0;
  return Math.min(pointSegDist(p, a, b), pointSegDist(q, a, b), pointSegDist(a, p, q), pointSegDist(b, p, q));
}

function inPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

const edges = poly => poly.map((a, i) => [a, poly[(i + 1) % poly.length]]);
const pointPolyDist = (p, poly) =>
  inPolygon(p, poly) ? 0 : Math.min(...edges(poly).map(([a, b]) => pointSegDist(p, a, b)));
const segPolyDist = (p, q, poly) =>
  inPolygon(p, poly) || inPolygon(q, poly) ? 0 : Math.min(...edges(poly).map(([a, b]) => segSegDist(p, q, a, b)));

// ---- Placement ----------------------------------------------------------

const PANEL_MARGIN = 0.15;   // gap between a panel and a wall or piece of furniture (m)
const TURNS = [0];           // candidate turns from where the user looks, degrees
for (let d = 15; d <= 180; d += 15) TURNS.push(d, -d);
const PULLS = [0, 0.3, 0.6, 0.9];   // candidate distances to bring everything closer (m)
const SHIFTS = [0, -0.4, 0.4];      // candidate sideways slides of everything (m)
const SCALES = [1, 0.75, 0.6];      // candidate mannequin sizes, for cramped rooms
// Cost units: a 15° turn = bringing things 30 cm closer = sliding them
// 40 cm sideways = using the next mannequin spot = half a size step.
const TURN_COST = 15, PULL_COST = 0.3, SHIFT_COST = 0.4, SCALE_COST = 2;
// What's in the way. Panels always come first: any placement with fewer
// panel problems wins, whatever the mannequin (see placeStage()).
const HIDDEN = 2;            // a panel behind a wall
const BLOCKED = 1;           // a panel through a wall or furniture

// Stage-frame point -> world, for a stage at `origin` turned `yaw` radians
// (three.js rotation about Y).
function toWorld(p, origin, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: origin.x + p.x * c + p.z * s, z: origin.z - p.x * s + p.z * c };
}

// The mannequin's demo space at stage point `spot`, at size `scale`: a
// capsule (segment + radius) across the line of sight, since the demos show
// it side on, and lying down it is long but narrow.
function mannequinSpace(spot, m, scale = 1) {
  const d = Math.hypot(spot.x, spot.z) || 1, half = m.half * scale;
  const ax = -spot.z / d * half, az = spot.x / d * half;   // perpendicular to the user
  return { a: { x: spot.x - ax, z: spot.z - az }, b: { x: spot.x + ax, z: spot.z + az } };
}

// How bad this placement is, for the panels and for the mannequin
// (0 = nothing in the way).
function badness(room, head, origin, yaw, layout, spot, scale) {
  let n = 0;
  const hidden = p => room.walls.some(w => segmentsCross(head, p, w.a, w.b));
  const world = seg => ({ a: toWorld(seg.a, origin, yaw), b: toWorld(seg.b, origin, yaw) });
  for (const panel of layout.panels) {
    const { a, b } = world(panel);
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    n += HIDDEN * [a, mid, b].filter(hidden).length;
    n += BLOCKED * room.walls.filter(w => segSegDist(a, b, w.a, w.b) < PANEL_MARGIN).length;
    n += BLOCKED * room.obstacles.filter(o => segPolyDist(a, b, o.points) < PANEL_MARGIN).length;
  }
  if (!spot) return { panels: n, mannequin: 0 };
  const m = layout.mannequin, r = m.r * scale;
  const { a, b } = world(mannequinSpace(spot, m, scale));
  let mn = hidden(toWorld(spot, origin, yaw)) ? 1 : 0;
  mn += room.walls.filter(w => segSegDist(a, b, w.a, w.b) < r).length;
  mn += room.obstacles.filter(o => segPolyDist(a, b, o.points) < r).length;
  return { panels: n, mannequin: mn };
}

// Mannequin spots that neither overlap the panels nor stand between them
// and the user (stage frame, so the same for every placement).
function freeSpots(layout) {
  const m = layout.mannequin, user = { x: 0, z: 0 };
  if (!m) return [null];
  return m.spots.filter(spot => {
    const { a, b } = mannequinSpace(spot, m);
    return layout.panels.every(p => {
      const mid = { x: (p.a.x + p.b.x) / 2, z: (p.a.z + p.b.z) / 2 };
      return segSegDist(a, b, p.a, p.b) >= m.r && [p.a, mid, p.b].every(q => segSegDist(user, q, a, b) >= m.r);
    });
  });
}

// head: { x, z, yaw } (yaw in radians, as the stage's rotation.y when facing
// where the user looks). layout: what's shown together (one screen), in
// stage coordinates (the user at the origin looking toward -z):
//   panels: [{ a, b }]      each panel's footprint on the floor
//   mannequin (optional): { spots: [{ x, z }], half, r }
//                           where it may stand, best first, and its demo
//                           space (capsule half length, radius)
// Returns { x, z, yaw, turn (degrees), pull, shift (m), spot and scale (the
// mannequin's; spot is null without one), clear, panelsClear }: the cheapest
// placement with nothing in the way, or if there is none, the one with the
// least in the way, panels first (clear: false; panelsClear: true when only
// the mannequin's space is cramped).
export function placeStage(room, head, layout) {
  const spots = freeSpots(layout);
  let best = null;
  for (const turn of TURNS) {
    for (const pull of PULLS) {
      for (const shift of SHIFTS) {
        for (const [i, spot] of spots.entries()) {
          for (const [j, scale] of (spot ? SCALES : [1]).entries()) {
            const yaw = head.yaw + turn * Math.PI / 180;
            // The whole stage slides toward the user (pull) and sideways (shift).
            const origin = toWorld({ x: shift, z: pull }, head, yaw);
            const bad = isEmpty(room) ? { panels: 0, mannequin: 0 } : badness(room, head, origin, yaw, layout, spot, scale);
            const cost = Math.abs(turn) / TURN_COST + pull / PULL_COST + Math.abs(shift) / SHIFT_COST + i + j * SCALE_COST;
            if (!best || bad.panels < best.bad.panels || (bad.panels === best.bad.panels &&
                (bad.mannequin < best.bad.mannequin || (bad.mannequin === best.bad.mannequin && cost < best.cost)))) {
              best = { cost, bad, x: origin.x, z: origin.z, yaw, turn, pull, shift, spot, scale };
            }
          }
        }
      }
    }
  }
  const { cost, bad, ...placement } = best;
  return { ...placement, clear: !bad.panels && !bad.mannequin, panelsClear: !bad.panels };
}
