import { ExtrudeGeometry, Shape } from 'three/webgpu';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSymbolGeometry } from './symbols.js';

const FAMILIES = ['data', 'code', 'agents', 'automation', 'integration', 'decisions'];
const RELIEF = 0.02;
const CONNECTOR_RELIEF = 0.0115;
const BEVEL_WIDTH = 0.0048;
const BEVEL_DEPTH = 0.0021;
const DETAIL = Object.freeze({
  hero: Object.freeze({ bevelSegments: 3, curveSegments: 5, cycleSegments: 40 }),
  field: Object.freeze({ bevelSegments: 2, curveSegments: 2, cycleSegments: 22 }),
});

/**
 * The six profiles share clipped corners, broad faces and deliberate air gaps.
 * Coordinates describe the front: +X right, +Y up, +Z toward the viewer.
 * Small corner fillets soften the machining without rounding whole strokes.
 */
function profile(points, fillet = 0.008) {
  const corners = points.map((point, i) => {
    const previous = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const before = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
    const after = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const radius = typeof fillet === 'function' ? fillet(i) : fillet;
    const cut = Math.min(radius, before * 0.4, after * 0.4);
    return {
      point,
      rounded: cut > 0,
      in: [point[0] + (previous[0] - point[0]) * cut / before, point[1] + (previous[1] - point[1]) * cut / before],
      out: [point[0] + (next[0] - point[0]) * cut / after, point[1] + (next[1] - point[1]) * cut / after],
    };
  });
  const shape = new Shape();
  shape.moveTo(...corners[0].in);
  for (let i = 0; i < corners.length; i++) {
    const corner = corners[i];
    if (i > 0) shape.lineTo(...corner.in);
    if (corner.rounded) shape.quadraticCurveTo(...corner.point, ...corner.out);
  }
  shape.closePath();
  return shape;
}

function clippedBox(cx, cy, width, height = width, clip = width * 0.19) {
  const x0 = cx - width / 2, x1 = cx + width / 2;
  const y0 = cy - height / 2, y1 = cy + height / 2;
  const c = Math.min(clip, width / 3, height / 3);
  return profile([
    [x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c],
    [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c],
  ], 0.005);
}

function rail(a, b, width = 0.102) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / length * width / 2;
  const ny = (b[0] - a[0]) / length * width / 2;
  return profile([
    [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny],
  ], 0.008);
}

const part = (shape, relief = RELIEF) => ({ shape, relief });
const rotate = (points, angle) => points.map(([x, y]) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
]);

function dataProfiles() {
  // Three ledger strata. Wide horizontal lands and recessed separation remain
  // legible at icon size; the end facets echo the chassis corner cuts.
  return [0.238, 0, -0.238].map((y) =>
    part(clippedBox(0, y, 0.82, 0.158, 0.047)));
}

function codeProfiles() {
  const chevron = [
    [-0.204, 0.306], [-0.320, 0.306], [-0.502, 0.051],
    [-0.502, -0.051], [-0.320, -0.306], [-0.204, -0.306],
    [-0.414, 0],
  ];
  return [
    part(profile(chevron, 0.009)),
    part(profile(chevron.map(([x, y]) => [-x, y]), 0.009)),
    part(rail([-0.059, -0.338], [0.059, 0.338], 0.105)),
  ];
}

function agentProfiles() {
  const pieces = [];
  // Lower connecting traces meet the undersides of the raised terminals.
  // Different Z planes avoid coincident front faces at their junctions.
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    pieces.push(part(rail([x * 0.09, y * 0.09], [x * 0.275, y * 0.275], 0.083), CONNECTOR_RELIEF));
  }
  const core = clippedBox(0, 0, 0.245, 0.245, 0.048);
  core.holes.push(clippedBox(0, 0, 0.088, 0.088, 0.017));
  pieces.push(part(core));
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    pieces.push(part(clippedBox(x * 0.285, y * 0.285, 0.186, 0.186, 0.035)));
  }
  return pieces;
}

function cycleArrow(rotation, steps = DETAIL.hero.cycleSegments) {
  const start = -Math.PI / 8 + rotation;
  const end = Math.PI * 0.60 + rotation;
  const radius = 0.312, halfStroke = 0.051;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const angle = start + (end - start) * i / steps;
    points.push([Math.cos(angle) * (radius + halfStroke), Math.sin(angle) * (radius + halfStroke)]);
  }
  const nx = Math.cos(end), ny = Math.sin(end);
  const tx = -ny, ty = nx;
  points.push(
    [nx * (radius + 0.104), ny * (radius + 0.104)],
    [nx * radius + tx * 0.151, ny * radius + ty * 0.151],
    [nx * (radius - 0.104), ny * (radius - 0.104)],
  );
  for (let i = steps; i >= 0; i--) {
    const angle = start + (end - start) * i / steps;
    points.push([Math.cos(angle) * (radius - halfStroke), Math.sin(angle) * (radius - halfStroke)]);
  }
  // Arc samples already approximate a smooth circle. Only the tail and head
  // corners need fillets; rounding every arc sample wastes bevel triangles.
  return profile(points, (i) =>
    i === 0 || (i >= steps && i <= steps + 4) || i === points.length - 1 ? 0.006 : 0);
}

function automationProfiles(detail = DETAIL.hero) {
  // The arrowheads belong to the arc outlines: no overlapping triangles,
  // bolt ornament or thin circular hairline.
  return [part(cycleArrow(0, detail.cycleSegments)), part(cycleArrow(Math.PI, detail.cycleSegments))];
}

function integrationProfiles() {
  // Two open couplings and a floating locking bar, all on one diagonal.
  // The negative space is continuous and there are no overlapping ring caps.
  const coupling = [
    [-0.07, 0.238], [-0.352, 0.238], [-0.456, 0.134], [-0.456, -0.134],
    [-0.352, -0.238], [-0.07, -0.238], [-0.07, -0.127], [-0.306, -0.127],
    [-0.345, -0.088], [-0.345, 0.088], [-0.306, 0.127], [-0.07, 0.127],
  ];
  const angle = Math.PI / 4;
  const connector = [
    [-0.237, -0.053], [0.237, -0.053], [0.237, 0.053], [-0.237, 0.053],
  ];
  return [
    part(profile(rotate(coupling, angle))),
    part(profile(rotate(coupling.map(([x, y]) => [-x, y]), angle))),
    part(profile(rotate(connector, angle))),
  ];
}

function decisionProfiles() {
  const choice = clippedBox(0.29, 0.245, 0.20, 0.20, 0.038);
  choice.holes.push(clippedBox(0.29, 0.245, 0.083, 0.083, 0.016));
  return [
    part(rail([0, -0.30], [0, -0.052], 0.095), CONNECTOR_RELIEF),
    part(rail([0, -0.045], [-0.29, 0.245], 0.095), CONNECTOR_RELIEF),
    part(rail([0, -0.045], [0.245, 0.20], 0.095), CONNECTOR_RELIEF),
    part(clippedBox(0, -0.30, 0.20, 0.20, 0.038)),
    part(clippedBox(0, -0.055, 0.154, 0.154, 0.028)),
    part(clippedBox(-0.29, 0.245, 0.20, 0.20, 0.038)),
    part(choice),
  ];
}

const FACTORIES = [dataProfiles, codeProfiles, agentProfiles, automationProfiles, integrationProfiles, decisionProfiles];

function extrudePart({ shape, relief }, detail) {
  const geometry = new ExtrudeGeometry(shape, {
    depth: relief - BEVEL_DEPTH * 2,
    bevelEnabled: true,
    bevelSize: BEVEL_WIDTH,
    bevelThickness: BEVEL_DEPTH,
    bevelSegments: detail.bevelSegments,
    curveSegments: detail.curveSegments,
    steps: 1,
  });
  geometry.translate(0, 0, BEVEL_DEPTH);

  // The utility quantizes positions at 0.01 units. Temporarily use a larger
  // coordinate scale so it does not weld the shallow bevel's separate rows.
  geometry.scale(1000, 1000, 1000);
  const smoothed = toCreasedNormals(geometry, Math.PI / 3);
  smoothed.scale(0.001, 0.001, 0.001);
  if (smoothed !== geometry) geometry.dispose();

  // Keep the broad front/back lands optically planar. The surrounding bevel
  // is smooth, but its normals must not bend the cap's triangulated surface.
  const positions = smoothed.attributes.position;
  const normals = smoothed.attributes.normal;
  for (const group of smoothed.groups) {
    if (group.materialIndex !== 0) continue;
    for (let i = group.start; i < group.start + group.count; i++) {
      normals.setXYZ(i, 0, 0, positions.getZ(i) > relief / 2 ? 1 : -1);
    }
  }
  normals.needsUpdate = true;
  smoothed.clearGroups();
  return smoothed;
}

/**
 * Own the returned, non-indexed geometry and dispose it when finished.
 * Largest XY bound = size; XY centered; back Z=0, front Z=0.02.
 * Raised terminals have lower connecting traces at Z=0.0115.
 * Family accepts 0..5 or existing capability ids. 'K' preserves the original
 * monogram exactly. No material, mesh, renderer or GPU work is created here.
 * Omit options for the original hero tessellation. Use { detail: 'field' }
 * (or 'field') for fewer bevel, corner and arc samples at small screen sizes.
 * Both levels retain the same relief depths, profile widths and face normals.
 */
export function createKinetiGlyphGeometry(family, size = 0.435, options = {}) {
  if (!Number.isFinite(size) || size <= 0) throw new RangeError('Kineti glyph size must be positive and finite.');
  const level = typeof options === 'string' ? options : options?.detail ?? 'hero';
  if (!Object.hasOwn(DETAIL, level)) throw new RangeError(`Unknown Kineti glyph detail: ${level}`);
  const detail = DETAIL[level];
  if (String(family).toUpperCase() === 'K') return createSymbolGeometry('K', size);
  const index = Number.isInteger(family) ? family : FAMILIES.indexOf(family);
  if (index < 0 || index >= FACTORIES.length) throw new RangeError(`Unknown Kineti glyph family: ${family}`);

  const parts = FACTORIES[index](detail).map((profile) => extrudePart(profile, detail));
  const geometry = mergeGeometries(parts, false);
  parts.forEach((item) => item.dispose());
  if (!geometry) throw new Error(`Could not merge Kineti glyph: ${family}`);

  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const scale = size / Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  geometry.translate(-(bounds.max.x + bounds.min.x) / 2, -(bounds.max.y + bounds.min.y) / 2, -bounds.min.z);
  geometry.scale(scale, scale, 1);

  // Front-space UVs are shared across separate terminals and connecting traces.
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, positions.getX(i) / size + 0.5, positions.getY(i) / size + 0.5);
  }
  uv.needsUpdate = true;
  geometry.clearGroups();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `kineti-premium-glyph-${FAMILIES[index]}${level === 'field' ? '-field' : ''}`;
  geometry.userData = {
    family: FAMILIES[index], familyIndex: index, size, reliefDepth: RELIEF,
    connectorRelief: CONNECTOR_RELIEF, detail: level,
    bevelSegments: detail.bevelSegments, curveSegments: detail.curveSegments,
    cycleSegments: index === 3 ? detail.cycleSegments : undefined,
    symbolSystem: 'kineti-machined',
  };
  return geometry;
}

function svgProfile(path, project) {
  const curves = path.curves;
  if (!curves.length) return '';
  let d = `M${project(curves[0].getPoint(0))}`;
  for (const curve of curves) {
    if (curve.isLineCurve) d += `L${project(curve.v2)}`;
    else if (curve.isQuadraticBezierCurve) d += `Q${project(curve.v1)} ${project(curve.v2)}`;
    else if (curve.isCubicBezierCurve) d += `C${project(curve.v1)} ${project(curve.v2)} ${project(curve.v3)}`;
    else for (const point of curve.getPoints(16).slice(1)) d += `L${project(point)}`;
  }
  return `${d}Z`;
}

/**
 * Exact front profiles for matching UI icons. Use a 0 0 100 100 viewBox,
 * fill="currentColor", fillRule="evenodd", and stroke="none"; render each
 * string in paths as its own <path>. SVG already accounts for Y-down.
 * The six records are in the same family order as the geometry function.
 */
export const KINETI_GLYPH_SVG = Object.freeze(FACTORIES.map((factory, index) => {
  const profiles = factory();
  const points = profiles.flatMap(({ shape }) => shape.getPoints(16));
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  const scale = 92 / Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const project = ({ x, y }) => `${(50 + (x - cx) * scale).toFixed(3)},${(50 - (y - cy) * scale).toFixed(3)}`;
  return Object.freeze({
    id: FAMILIES[index],
    viewBox: '0 0 100 100',
    fillRule: 'evenodd',
    paths: Object.freeze(profiles.map(({ shape }) =>
      [shape, ...shape.holes].map((path) => svgProfile(path, project)).join(' '))),
  });
}));
