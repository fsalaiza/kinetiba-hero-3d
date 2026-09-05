import { CylinderGeometry, ExtrudeGeometry, Shape } from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createKinetiGlyphGeometry } from './premiumSymbols.js';

// These production meshes are independent of the frozen renderer-comparison
// geometry. Hero parts have more bevel samples; the small field uses fewer.
export function createPremiumChassis(tile = false, detail = 3) {
  const geometry = new RoundedBoxGeometry(.82, .82, tile ? .125 : .82, detail, tile ? .032 : .058);
  geometry.clearGroups();
  geometry.name = tile ? 'premium-field-chassis' : 'premium-cubie-chassis';
  return geometry;
}

function plateOutline(size, notch = .026) {
  const h = size / 2, c = size * .095, r = notch;
  const shape = new Shape();
  shape.moveTo(-h + c, -h);
  shape.lineTo(-r, -h);
  shape.quadraticCurveTo(-r, -h + r, 0, -h + r);
  shape.quadraticCurveTo(r, -h + r, r, -h);
  shape.lineTo(h - c, -h); shape.lineTo(h, -h + c);
  shape.lineTo(h, -r);
  shape.quadraticCurveTo(h - r, -r, h - r, 0);
  shape.quadraticCurveTo(h - r, r, h, r);
  shape.lineTo(h, h - c); shape.lineTo(h - c, h);
  shape.lineTo(r, h);
  shape.quadraticCurveTo(r, h - r, 0, h - r);
  shape.quadraticCurveTo(-r, h - r, -r, h);
  shape.lineTo(-h + c, h); shape.lineTo(-h, h - c);
  shape.lineTo(-h, r);
  shape.quadraticCurveTo(-h + r, r, -h + r, 0);
  shape.quadraticCurveTo(-h + r, -r, -h, -r);
  shape.lineTo(-h, -h + c); shape.closePath();
  return shape;
}

/** A separate machined face plate: clipped corners, four registration notches,
 * and a real bevel around its outline. Back Z=0, front Z=thickness. */
export function createPremiumPlate({ size = .766, thickness = .032, detail = 3, notch = .024, bevel = .005 } = {}) {
  const geometry = new ExtrudeGeometry(plateOutline(size, notch), {
    depth: thickness - 2 * bevel, steps: 1, bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: detail,
    curveSegments: detail === 2 ? 6 : 10,
  });
  geometry.translate(0, 0, bevel);
  // Stable face-space UVs keep grain physically attached during layer turns,
  // explosions, direct navigation and GPU-instanced wave motion.
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) uv.setXY(i, positions.getX(i) / size + .5, positions.getY(i) / size + .5);
  uv.needsUpdate = true;
  geometry.clearGroups(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = 'premium-notched-face-plate';
  return geometry;
}

/** A recessed edge ring plus four individual support bosses. The face plate
 * can lift away from this fixed backing, exposing real air and contact gaps. */
export function createPremiumBacking(detail = 3) {
  const rim = createPremiumPlate({ size: .794, thickness: .013, detail, notch: .020, bevel: .003 });
  const parts = [rim];
  for (const x of [-.255, .255]) for (const y of [-.255, .255]) {
    const support = new CylinderGeometry(.018, .024, .031, detail === 2 ? 8 : 12, 1);
    support.rotateX(Math.PI / 2); support.translate(x, y, .023);
    parts.push(support.toNonIndexed()); support.dispose();
  }
  const result = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  result.clearGroups(); result.name = 'premium-edge-ring-and-four-supports';
  return result;
}

export function createPremiumGlyph(family, size = .435, detail) {
  const geometry = createKinetiGlyphGeometry(family, size, detail);
  // A shallow porcelain relief retains readable flat faces, without the thick
  // glossy sidewalls that made the previous dark glyphs look swollen.
  geometry.scale(1, 1, .72);
  geometry.name = `premium-porcelain-glyph-${family}`;
  return geometry;
}
