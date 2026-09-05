import { BoxGeometry } from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function positive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite.`);
  return value;
}

function roundedBlock(width, height, depth, radius, name) {
  positive(width, 'Width');
  positive(height, 'Height');
  positive(depth, 'Depth');
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError('Radius must be finite and non-negative.');
  const boundedRadius = Math.min(radius, Math.min(width, height, depth) / 2);
  // Three subdivisions retain continuous corner highlights at hero scale while
  // keeping the shared geometry practical for the 432-instance tile mosaic.
  const geometry = boundedRadius === 0
    ? new BoxGeometry(width, height, depth)
    : new RoundedBoxGeometry(width, height, depth, 3, boundedRadius);
  geometry.clearGroups();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = name;
  geometry.userData = { width, height, depth, radius: boundedRadius };
  return geometry;
}

/** A centered cubie with exact exterior size and smooth bevel normals. */
export function createCubeGeometry(size = 0.86, radius = 0.075) {
  return roundedBlock(size, size, size, radius, 'kineti-cubie');
}

/** A centered XY tile. Its front surface is +depth / 2 along Z. */
export function createTileGeometry(size = 0.78, depth = 0.14, radius = 0.06) {
  return roundedBlock(size, size, depth, radius, 'kineti-tile');
}
