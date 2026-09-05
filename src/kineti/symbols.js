import { ExtrudeGeometry, Path, Shape } from 'three/webgpu';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAPABILITIES = Object.freeze([
  { id: 'data', label: 'Datos', description: 'Convierte información dispersa en una base clara para actuar.', color: '#c6f85c' },
  { id: 'code', label: 'Código', description: 'Construye soluciones que conectan las ideas con su ejecución.', color: '#f2f0e9' },
  { id: 'agents', label: 'Agentes', description: 'Coordina agentes que entienden el contexto y realizan tareas.', color: '#d9ddd0' },
  { id: 'automation', label: 'Automatización', description: 'Da continuidad al trabajo con procesos que avanzan por sí solos.', color: '#c6f85c' },
  { id: 'integration', label: 'Integración', description: 'Conecta tus herramientas para trabajar como un solo sistema.', color: '#e8e8df' },
  { id: 'decisions', label: 'Decisiones', description: 'Transforma señales en decisiones concretas y bien informadas.', color: '#bbc4b8' },
]);

const RELIEF_DEPTH = 0.02;
const STROKE = 0.073;
const TAU = Math.PI * 2;

function polygon(points) {
  const shape = new Shape();
  shape.moveTo(...points[0]);
  points.slice(1).forEach((point) => shape.lineTo(...point));
  shape.closePath();
  return shape;
}

function roundedRect(cx, cy, width, height, radius) {
  const x = cx - width / 2;
  const y = cy - height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  shape.closePath();
  return shape;
}

function disc(cx, cy, radius) {
  const shape = new Shape();
  shape.absarc(cx, cy, radius, 0, TAU, false);
  return shape;
}

function ellipseRing(cx, cy, rx, ry, thickness = STROKE) {
  const shape = new Shape();
  shape.absellipse(cx, cy, rx, ry, 0, TAU, false, 0);
  const hole = new Path();
  hole.absellipse(cx, cy, rx - thickness, ry - thickness, 0, TAU, true, 0);
  shape.holes.push(hole);
  return shape;
}

function capsule(a, b, width = STROKE) {
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const r = width / 2;
  const shape = new Shape();
  shape.moveTo(a[0] - Math.sin(angle) * r, a[1] + Math.cos(angle) * r);
  shape.lineTo(b[0] - Math.sin(angle) * r, b[1] + Math.cos(angle) * r);
  shape.absarc(...b, r, angle + Math.PI / 2, angle - Math.PI / 2, true);
  shape.lineTo(a[0] + Math.sin(angle) * r, a[1] - Math.cos(angle) * r);
  shape.absarc(...a, r, angle - Math.PI / 2, angle + Math.PI / 2, true);
  shape.closePath();
  return shape;
}

function databaseShapes() {
  const bowl = (y) => {
    const shape = new Shape();
    shape.moveTo(-0.4, y);
    shape.bezierCurveTo(-0.4, y - 0.19, 0.4, y - 0.19, 0.4, y);
    shape.lineTo(0.327, y);
    shape.bezierCurveTo(0.327, y - 0.096, -0.327, y - 0.096, -0.327, y);
    shape.closePath();
    return shape;
  };
  return [
    ellipseRing(0, 0.25, 0.4, 0.145, 0.073),
    roundedRect(-0.3635, -0.008, STROKE, 0.516, STROKE / 2),
    roundedRect(0.3635, -0.008, STROKE, 0.516, STROKE / 2),
    bowl(0), bowl(-0.26),
  ];
}

function codeShapes() {
  const left = [[-0.16, 0.28], [-0.25, 0.28], [-0.45, 0], [-0.25, -0.28], [-0.16, -0.28], [-0.35, 0]];
  return [polygon(left), polygon(left.map(([x, y]) => [-x, y])), capsule([-0.073, -0.31], [0.073, 0.31])];
}

function agentShapes() {
  const head = roundedRect(0, -0.025, 0.67, 0.49, 0.105);
  head.holes.push(disc(-0.115, 0.025, 0.052), disc(0.115, 0.025, 0.052));
  head.holes.push(roundedRect(0, -0.127, 0.166, 0.041, 0.02));
  return [
    head,
    capsule([0, 0.2], [0, 0.325], 0.059),
    disc(0, 0.371, 0.063),
    roundedRect(-0.4, -0.008, 0.071, 0.174, 0.027),
    roundedRect(0.4, -0.008, 0.071, 0.174, 0.027),
  ];
}

function automationShapes() {
  const start = Math.PI * 0.15;
  const end = Math.PI * 1.78;
  const outer = 0.4;
  const inner = outer - STROKE;
  const arc = new Shape();
  arc.absarc(0, 0, outer, start, end, false);
  arc.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
  arc.absarc(0, 0, inner, end, start, true);
  arc.closePath();
  const center = [(inner + STROKE / 2) * Math.cos(end), (inner + STROKE / 2) * Math.sin(end)];
  const tangent = [-Math.sin(end), Math.cos(end)];
  const normal = [Math.cos(end), Math.sin(end)];
  const arrow = polygon([
    [center[0] + tangent[0] * 0.145, center[1] + tangent[1] * 0.145],
    [center[0] - tangent[0] * 0.038 + normal[0] * 0.116, center[1] - tangent[1] * 0.038 + normal[1] * 0.116],
    [center[0] - tangent[0] * 0.038 - normal[0] * 0.116, center[1] - tangent[1] * 0.038 - normal[1] * 0.116],
  ]);
  const bolt = polygon([[0.058, 0.226], [-0.145, -0.023], [-0.025, -0.023], [-0.063, -0.213], [0.156, 0.056], [0.035, 0.056]]);
  return [arc, arrow, bolt];
}

function integrationShapes() {
  const ring = (cx) => {
    const shape = roundedRect(cx, 0, 0.535, 0.303, 0.1515);
    shape.holes.push(roundedRect(cx, 0, 0.535 - STROKE * 2, 0.303 - STROKE * 2, 0.1515 - STROKE));
    return shape;
  };
  // The two links share one deliberate diagonal, avoiding arbitrary node layouts.
  return [ring(-0.173), ring(0.173)];
}

function decisionShapes() {
  const diamond = polygon([[0, 0.415], [0.202, 0.2], [0, -0.015], [-0.202, 0.2]]);
  diamond.holes.push(polygon([[0, 0.302], [-0.096, 0.2], [0, 0.098], [0.096, 0.2]]));
  return [
    diamond,
    capsule([0, -0.005], [0, -0.133], 0.063),
    capsule([-0.276, -0.133], [0.276, -0.133], 0.063),
    capsule([-0.276, -0.133], [-0.276, -0.259], 0.063),
    capsule([0.276, -0.133], [0.276, -0.259], 0.063),
    roundedRect(-0.276, -0.335, 0.151, 0.151, 0.032),
    roundedRect(0.276, -0.335, 0.151, 0.151, 0.032),
  ];
}

function monogramShapes() {
  return [polygon([
    [-0.325, -0.38], [-0.204, -0.38], [-0.204, -0.08], [0.17, -0.38], [0.346, -0.38],
    [-0.066, -0.004], [0.307, 0.38], [0.151, 0.38], [-0.204, 0.094], [-0.204, 0.38], [-0.325, 0.38],
  ])];
}

const FACTORIES = [databaseShapes, codeShapes, agentShapes, automationShapes, integrationShapes, decisionShapes];

/**
 * A material-free, merged relief glyph. Its largest XY dimension is `size`,
 * XY bounds are centered at the origin, and its back/front are Z=0 / Z=0.02.
 * Accepts a capability index, capability id, or the K monogram. Caller owns disposal.
 */
export function createSymbolGeometry(type, size = 0.4) {
  if (!Number.isFinite(size) || size <= 0) throw new RangeError('Symbol size must be positive and finite.');
  const monogram = String(type).toUpperCase() === 'K';
  const index = Number.isInteger(type) ? type : CAPABILITIES.findIndex((capability) => capability.id === type);
  if (!monogram && (index < 0 || index >= FACTORIES.length)) throw new RangeError(`Unknown symbol family: ${type}`);
  const family = monogram ? 'K' : CAPABILITIES[index].id;
  const shapes = monogram ? monogramShapes() : FACTORIES[index]();
  // Extrude in normalized XY units, retaining exactly two centimetres of relief
  // after XY fitting. The tiny bevel catches light without erasing negative space.
  const bevel = 0.007;
  const parts = shapes.map((shape) => {
    const geometry = new ExtrudeGeometry(shape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 10,
      steps: 1,
    });
    if (family === 'integration') geometry.rotateZ(Math.PI / 5);
    geometry.clearGroups();
    return geometry;
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error(`Could not merge the ${family} symbol.`);
  const geometry = toCreasedNormals(merged, Math.PI / 3);
  if (geometry !== merged) merged.dispose();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const xyScale = size / Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y);
  const zScale = RELIEF_DEPTH / (bounds.max.z - bounds.min.z);
  geometry.translate(-(bounds.max.x + bounds.min.x) / 2, -(bounds.max.y + bounds.min.y) / 2, -bounds.min.z);
  geometry.scale(xyScale, xyScale, zScale);
  geometry.clearGroups();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `kineti-symbol-${family}`;
  geometry.userData = { family, size, reliefDepth: RELIEF_DEPTH };
  return geometry;
}
