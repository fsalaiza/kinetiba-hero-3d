import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshPhysicalNodeMaterial, NoColorSpace, RepeatWrapping, RGBAFormat } from 'three/webgpu';
import { positionLocal } from 'three/tsl';

export const PREMIUM_PALETTE = Object.freeze({
  shell: '#b8bbaa', face: '#cbccba', selected: '#d7dcc0', porcelain: '#f5f4e9',
  moss: '#849076', periwinkle: '#9294aa', core: '#6c8160', flow: '#c9dcaa',
});

/** Deterministic, mipmapped microstructure. No image downloads or per-frame
 * randomness: the same physical grain remains attached to the same surface. */
export function createCompositeGrain(size = 512) {
  const pixels = new Uint8Array(size * size * 4);
  const hash = (index) => {
    let n = Math.imul(index ^ 0x59a70f3d, 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, fine = hash(index + size * size);
    const grain = hash(Math.floor(y / 2) * (size / 2) + Math.floor(x / 2));
    const speckle = grain > .964 ? 34 + fine * 62 : fine * 5;
    pixels.set([Math.round(255 - speckle * .86), Math.round(255 - speckle), Math.round(255 - speckle * 1.12), 255], index * 4);
  }
  const texture = new DataTexture(pixels, size, size, RGBAFormat);
  texture.name = 'Kineti deterministic composite micrograin';
  texture.colorSpace = NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  return texture;
}

export function createPremiumMaterial(kind, grain, tint) {
  const settings = {
    shell: { color: PREMIUM_PALETTE.shell, roughness: .49, metalness: .02, clearcoat: .08, clearcoatRoughness: .43 },
    face: { color: PREMIUM_PALETTE.face, roughness: .43, metalness: .015, clearcoat: .16, clearcoatRoughness: .36 },
    rim: { color: tint || PREMIUM_PALETTE.moss, roughness: .38, metalness: .18, clearcoat: .20, clearcoatRoughness: .32 },
    glyph: { color: PREMIUM_PALETTE.porcelain, roughness: .31, metalness: 0, clearcoat: .18, clearcoatRoughness: .29 },
    core: { color: PREMIUM_PALETTE.core, roughness: .31, metalness: .20, clearcoat: .3, emissive: '#72884e', emissiveIntensity: .035 },
  };
  const material = new MeshPhysicalNodeMaterial(settings[kind] || settings.face);
  material.name = `Kineti premium ${kind}`;
  // Keep transform uniforms live for every submitted draw. In Three r185 an
  // unmodified NodeMaterial may skip refreshing an object whose draw order
  // changed while returning to a previously seen world matrix. The explicit
  // identity node uses the public TSL path and leaves the geometry unchanged.
  material.positionNode = positionLocal;
  if (kind === 'shell' || kind === 'face') {
    material.map = grain; material.roughnessMap = grain;
    material.bumpMap = grain; material.bumpScale = .00115;
  }
  return material;
}
