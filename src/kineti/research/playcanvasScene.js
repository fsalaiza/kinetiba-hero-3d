import * as pc from 'playcanvas';
import { createCubeGeometry, createTileGeometry } from '../cubeGeometry.js';
import { createSymbolGeometry } from '../symbols.js';

export const DEFAULT_CONTROLS = Object.freeze({
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [.30, .53, -.045],
  cameraFov: 37, autoFrame: true, roughness: .27, metalness: .08, clearcoat: .46,
  environmentIntensity: .68, keyIntensity: 3.8, exposure: 1.06,
  glyphColor: '#354330', shadows: false, postEffect: 0,
  waveAmplitude: 0, wavePhase: 0, density: 432,
});

const clamp = (v) => Math.min(1, Math.max(0, v));
const BASE_CAMERA_Z = 7.05 / (2 * Math.tan(37 * Math.PI / 360));
const color = (hex) => new pc.Color().fromString(hex);
const array = (v) => [v.x, v.y, v.z];

// Explicitly preserve Three's Euler XYZ convention in PlayCanvas's quaternion.
function quaternionXYZ(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return new pc.Quat(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3);
}

// Three is used only to author the shared vertices; PlayCanvas owns every draw.
function fromBufferGeometry(device, geometry) {
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(geometry.getAttribute('position').array));
  mesh.setNormals(new Float32Array(geometry.getAttribute('normal').array));
  if (geometry.getAttribute('uv')) mesh.setUvs(0, new Float32Array(geometry.getAttribute('uv').array));
  if (geometry.index) mesh.setIndices(new Uint32Array(geometry.index.array));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  geometry.dispose();
  return mesh;
}

function pbrMaterial(name, hex, ink = false) {
  const material = new pc.StandardMaterial();
  material.name = name;
  material.diffuse = color(hex);
  material.useMetalness = true;
  material.metalness = ink ? .18 : .08;
  material.gloss = 1 - (ink ? .35 : .27);
  material.clearCoat = ink ? .2 : .46;
  material.clearCoatGloss = 1 - .26;
  material.update();
  return material;
}

// The original instance matrices stay in static vertex buffers. The custom
// shader changes their world translation, including the shadow shader variant.
// Both the embossed glyph and the tile receive precisely the same displacement.
function installWave(material, device) {
  pc.VertexFormat.getDefaultInstancingFormat(device).elements
    .forEach((element, i) => material.setAttribute(`instance_line${i + 1}`, element.name));
  material.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set('transformInstancingVS', `
    attribute vec4 instance_line1;
    attribute vec4 instance_line2;
    attribute vec4 instance_line3;
    attribute vec4 instance_line4;
    uniform float kinetiWaveAmplitude;
    uniform float kinetiWavePhase;
    mat4 getModelMatrix() {
      mat4 model = matrix_model * mat4(instance_line1, instance_line2, instance_line3, instance_line4);
      model[3].z += sin(model[3].x * 1.3 + model[3].y * .7 - kinetiWavePhase) * kinetiWaveAmplitude;
      return model;
    }
  `);
  material.getShaderChunks(pc.SHADERLANGUAGE_WGSL).set('transformInstancingVS', `
    attribute instance_line1: vec4f;
    attribute instance_line2: vec4f;
    attribute instance_line3: vec4f;
    attribute instance_line4: vec4f;
    uniform kinetiWaveAmplitude: f32;
    uniform kinetiWavePhase: f32;
    fn getModelMatrix() -> mat4x4f {
      var model = uniform.matrix_model * mat4x4f(instance_line1, instance_line2, instance_line3, instance_line4);
      model[3].z += sin(model[3].x * 1.3 + model[3].y * .7 - uniform.kinetiWavePhase) * uniform.kinetiWaveAmplitude;
      return model;
    }
  `);
  material.shaderChunksVersion = '2.22';
  material.setParameter('kinetiWaveAmplitude', 0);
  material.setParameter('kinetiWavePhase', 0);
  material.update();
}

class RGBContrastEffect extends pc.PostEffect {
  constructor(device, readControls) {
    super(device);
    this.readControls = readControls;
    this.shader = pc.ShaderUtils.createShader(device, {
      uniqueName: 'KinetiRGBContrast',
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: pc.PostEffect.quadVertexShader,
      vertexWGSL: `
        attribute aPosition: vec2f;
        varying vUv0: vec2f;
        @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4f(input.aPosition, 0.0, 1.0);
          output.vUv0 = getImageEffectUV((input.aPosition + 1.0) * .5);
          return output;
        }
      `,
      fragmentGLSL: `
        varying vec2 vUv0;
        uniform sampler2D kinetiSceneTexture;
        uniform float kinetiPostStrength;
        void main() {
          vec2 offset = vec2(kinetiPostStrength * .012, 0.0);
          vec3 c = vec3(texture2D(kinetiSceneTexture, vUv0 + offset).r,
            texture2D(kinetiSceneTexture, vUv0).g, texture2D(kinetiSceneTexture, vUv0 - offset).b);
          gl_FragColor = vec4(clamp((c - .5) * (1.0 + .18 * kinetiPostStrength) + .5, 0.0, 1.0), 1.0);
        }
      `,
      fragmentWGSL: `
        varying vUv0: vec2f;
        var kinetiSceneTexture: texture_2d<f32>;
        var kinetiSceneTextureSampler: sampler;
        uniform kinetiPostStrength: f32;
        @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
          var output: FragmentOutput;
          let offset = vec2f(uniform.kinetiPostStrength * .012, 0.0);
          let c = vec3f(textureSample(kinetiSceneTexture, kinetiSceneTextureSampler, input.vUv0 + offset).r,
            textureSample(kinetiSceneTexture, kinetiSceneTextureSampler, input.vUv0).g,
            textureSample(kinetiSceneTexture, kinetiSceneTextureSampler, input.vUv0 - offset).b);
          output.color = vec4f(clamp((c - .5) * (1.0 + .18 * uniform.kinetiPostStrength) + .5, vec3f(0.0), vec3f(1.0)), 1.0);
          return output;
        }
      `,
    });
  }
  render(input, output, rect) {
    this.device.scope.resolve('kinetiSceneTexture').setValue(input.colorBuffer);
    this.device.scope.resolve('kinetiPostStrength').setValue(this.readControls().postEffect);
    this.drawQuad(output, this.shader, rect);
  }
}

async function loadEnvironment(app, state) {
  const asset = new pc.Asset('Kineti studio HDR', 'texture', { url: state.url });
  app.assets.add(asset);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('HDR loading exceeded 8 seconds.')), 8000);
      asset.once('load', () => { clearTimeout(timeout); resolve(); });
      asset.once('error', (error) => { clearTimeout(timeout); reject(new Error(String(error))); });
      app.assets.load(asset);
    });
    asset.resource.projection = pc.TEXTUREPROJECTION_EQUIRECT;
    const source = pc.EnvLighting.generateLightingSource(asset.resource, { size: 128 });
    const atlas = pc.EnvLighting.generateAtlas(source, { size: 512 });
    app.scene.envAtlas = atlas;
    app.scene.skyboxRotation = quaternionXYZ(0, .4, 0);
    state.status = 'loaded';
    state.sourceSize = [asset.resource.width, asset.resource.height];
    state.atlasSize = [atlas.width, atlas.height];
    return { asset, source, atlas };
  } catch (error) {
    state.status = 'unavailable'; state.error = String(error);
    return { asset };
  }
}

/** Same geometry/control fixture as Three/Babylon, independently rendered by PlayCanvas. */
export async function createPlayCanvasComparison(canvas) {
  let controls = structuredClone(DEFAULT_CONTROLS);
  const query = new URLSearchParams(location.search);
  const forceWebGL = query.get('renderer') === 'webgl' || query.get('backend') === 'webgl2';
  const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: forceWebGL ? [pc.DEVICETYPE_WEBGL2] : [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
    antialias: true, stencil: false, powerPreference: 'high-performance',
  });
  device.maxPixelRatio = 1;
  const backend = device.isWebGPU ? 'WebGPU' : 'WebGL2';
  const fallbackReason = !forceWebGL && !device.isWebGPU ? 'createGraphicsDevice selected WebGL2 because WebGPU initialization was unavailable.' : null;
  const app = new pc.Application(canvas, { graphicsDevice: device });
  app.setCanvasResolution(pc.RESOLUTION_FIXED, innerWidth, innerHeight);
  app.scene.exposure = controls.exposure;
  app.scene.skyboxIntensity = controls.environmentIntensity;
  // The native ambient/environment model differs from HemisphereLight.
  app.scene.ambientLight = color('#929e7e');
  const cameraEntity = new pc.Entity('comparison-camera');
  cameraEntity.addComponent('camera', {
    clearColor: color('#10130f'), fov: 37, nearClip: .1, farClip: 60,
    gammaCorrection: pc.GAMMA_SRGB, toneMapping: pc.TONEMAP_ACES,
  });
  cameraEntity.setPosition(0, 0, BASE_CAMERA_Z);
  app.root.addChild(cameraEntity);
  const camera = cameraEntity.camera;
  // Environment lighting is retained while the camera uses the fixture's solid background.
  camera.layers = camera.layers.filter((id) => id !== pc.LAYERID_SKYBOX);
  const directional = (name, position, hex, intensity) => {
    const entity = new pc.Entity(name);
    entity.addComponent('light', { type: 'directional', color: color(hex), intensity,
      castShadows: false, shadowResolution: 1024, shadowDistance: 25,
      shadowType: pc.SHADOW_PCF3_32F, shadowBias: .00015, normalOffsetBias: .035 });
    entity.setPosition(...position);
    const d = new pc.Vec3(...position).mulScalar(-1).normalize();
    entity.setRotation(new pc.Quat(-d.z, 0, d.x, 1 - d.y).normalize());
    app.root.addChild(entity);
    return entity;
  };
  const key = directional('warm-key', [-3, 7, 9], '#fff4dc', 3.8);
  directional('cool-fill', [5, .5, 6], '#e4eaff', .9);
  const environment = { status: 'loading', error: null, url: '/hdri/studio_small_09_1k.hdr', rotationY: .4 };
  const environmentResources = await loadEnvironment(app, environment);

  const ceramic = pbrMaterial('ceramic', '#e9ebdc');
  const ink = pbrMaterial('ink', '#354330', true);
  const fieldCeramic = pbrMaterial('field-ceramic', '#e9ebdc');
  const fieldInk = pbrMaterial('field-ink', '#354330', true);
  installWave(fieldCeramic, device); installWave(fieldInk, device);
  const materials = [ceramic, ink, fieldCeramic, fieldInk];
  const cube = new pc.Entity('hero-27-cubies'); app.root.addChild(cube);
  const cubeMesh = fromBufferGeometry(device, createCubeGeometry());
  const glyphMeshes = Array.from({ length: 6 }, (_, i) => fromBufferGeometry(device, createSymbolGeometry(i, .43)));
  const renderMesh = (name, mesh, material, parent) => {
    const entity = new pc.Entity(name);
    const instance = new pc.MeshInstance(mesh, material, entity);
    instance.castShadow = true; instance.receiveShadow = true;
    entity.addComponent('render', { meshInstances: [instance], castShadows: true, receiveShadows: true });
    parent.addChild(entity);
    return entity;
  };
  const faces = [
    [0, 1, 0, Math.PI / 2, 0], [0, -1, 0, -Math.PI / 2, 0],
    [1, 1, -Math.PI / 2, 0, 0], [1, -1, Math.PI / 2, 0, 0],
    [2, 1, 0, 0, 0], [2, -1, 0, Math.PI, 0],
  ];
  const pieces = [];
  let glyphCount = 0;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const index = pieces.length, coordinates = [x, y, z];
    const group = new pc.Entity(`cubie-${index}`); cube.addChild(group);
    const base = new pc.Vec3(x * .96, y * .96, z * .96);
    group.setLocalPosition(base);
    renderMesh(`body-${index}`, cubeMesh, ceramic, group);
    for (const [axis, sign, rx, ry, rz] of faces) {
      if (coordinates[axis] !== sign) continue;
      const glyph = renderMesh(`glyph-${index}-${axis}-${sign}`, glyphMeshes[index % 6], ink, group);
      const offset = [0, 0, 0]; offset[axis] = sign * .4305;
      glyph.setLocalPosition(...offset); glyph.setLocalRotation(quaternionXYZ(rx, ry, rz)); glyphCount++;
    }
    pieces.push({ group, base });
  }
  const floorMaterial = pbrMaterial('floor', '#182015'); floorMaterial.gloss = .1; floorMaterial.clearCoat = 0; floorMaterial.update();
  materials.push(floorMaterial);
  const floorMesh = pc.Mesh.fromGeometry(device, new pc.PlaneGeometry({ halfExtents: new pc.Vec2(25, 25), widthSegments: 1, lengthSegments: 1 }));
  const floor = renderMesh('shadow-floor', floorMesh, floorMaterial, app.root);
  floor.render.castShadows = false; floor.setPosition(0, -2.1, 0); floor.enabled = false;
  let field = new pc.Entity('mosaic'); app.root.addChild(field);
  let matrixRevision = 0;
  let fieldBatches = [];
  let fieldBuffers = [];
  const buildField = () => {
    field.destroy();
    fieldBuffers.forEach((buffer) => buffer.destroy()); fieldBuffers = [];
    field = new pc.Entity('mosaic'); app.root.addChild(field);
    fieldBatches = [];
    const cols = controls.density === 162 ? 9 : 24, rows = 18;
    const unit = Math.max(7.05 * (device.width / device.height) / cols, 7.05 / rows) * 1.06;
    const groups = Array.from({ length: 6 }, () => []);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      groups[((i * 7) % 27) % 6].push([(col - (cols - 1) / 2) * unit, ((rows - 1) / 2 - row) * unit, -.1]);
    }
    const scale = unit / .86 * .91;
    groups.forEach((positions, family) => {
      for (const isGlyph of [false, true]) {
        const geometry = isGlyph ? createSymbolGeometry(family, .40) : createTileGeometry(.78, .15, .055);
        if (isGlyph) geometry.translate(0, 0, .077);
        const entity = renderMesh(`field-${family}-${isGlyph ? 'glyph' : 'tile'}`,
          fromBufferGeometry(device, geometry), isGlyph ? fieldInk : fieldCeramic, field);
        const matrices = new Float32Array(positions.length * 16);
        positions.forEach(([x, y, z], i) => {
          const offset = i * 16;
          matrices[offset] = matrices[offset + 5] = matrices[offset + 10] = scale;
          matrices[offset + 12] = x; matrices[offset + 13] = y; matrices[offset + 14] = z; matrices[offset + 15] = 1;
        });
        const buffer = new pc.VertexBuffer(device, pc.VertexFormat.getDefaultInstancingFormat(device), positions.length,
          { usage: pc.BUFFER_STATIC, data: matrices });
        const instance = entity.render.meshInstances[0];
        instance.setInstancing(buffer, false);
        fieldBuffers.push(buffer);
        fieldBatches.push({ instance, family, isGlyph, count: positions.length });
      }
    });
    matrixRevision++;
  };
  buildField();
  const postEffect = new RGBContrastEffect(device, () => controls);
  let postAttached = false;
  let progress = 0, disposed = false, frameNumber = 0, frameMs = 16.67;
  let frameCounts = { drawCalls: 0, submittedTriangles: 0 }, lastFrame = null;
  const originalDraw = device.draw;
  device.draw = function (primitive, indexBuffer, instances, ...rest) {
    frameCounts.drawCalls++;
    if (primitive.type === pc.PRIMITIVE_TRIANGLES) frameCounts.submittedTriangles += primitive.count * (instances ?? 1) / 3;
    return originalDraw.call(this, primitive, indexBuffer, instances, ...rest);
  };
  app.on('prerender', () => { frameCounts = { drawCalls: 0, submittedTriangles: 0 }; });
  app.on('postrender', () => { lastFrame = { ...frameCounts }; frameNumber++; });
  app.on('update', (dt) => { frameMs += (dt * 1000 - frameMs) * .05; });
  const setProgress = (value) => {
    progress = clamp(value);
    const t = clamp((progress - .28) / .20), amount = t * t * (3 - 2 * t);
    cube.enabled = progress < .49; field.enabled = progress >= .49;
    cube.setLocalPosition(1.7 * (1 - amount), .1, 0);
    cameraEntity.setPosition(0, 0, BASE_CAMERA_Z * (controls.autoFrame ? 1 + controls.explode * .55 : 1));
    cube.setLocalRotation(quaternionXYZ(...controls.rotation.map((v) => v * (1 - amount))));
    cube.setLocalScale(1.08, 1.08, 1.08);
    pieces.forEach(({ group, base }, i) => {
      const position = base.clone().mulScalar(1 + controls.explode * .75 / .96);
      if (i === controls.selectedPiece) position.y += controls.pieceOffset;
      group.setLocalPosition(position);
    });
    floor.enabled = Boolean(controls.shadows && cube.enabled);
  };
  const setControls = (patch = {}) => {
    const oldDensity = controls.density;
    controls = { ...controls, ...patch, rotation: [...(patch.rotation || controls.rotation)] };
    controls.density = controls.density === 162 ? 162 : 432;
    controls.selectedPiece = Math.min(26, Math.max(0, Math.round(controls.selectedPiece)));
    camera.fov = controls.cameraFov;
    [ceramic, fieldCeramic].forEach((material) => {
      const clearcoatVariantChanged = Boolean(material.clearCoat) !== Boolean(controls.clearcoat);
      material.gloss = 1 - controls.roughness; material.metalness = controls.metalness; material.clearCoat = controls.clearcoat;
      // 2.22's generic float setter treats 0 and 1 as the same endpoint class.
      // Clearcoat changes shader topology at zero, so invalidate that transition.
      if (clearcoatVariantChanged) material.clearVariants();
      material.update();
    });
    [ink, fieldInk].forEach((material) => { material.diffuse = color(controls.glyphColor); material.update(); });
    [fieldCeramic, fieldInk].forEach((material) => {
      material.setParameter('kinetiWaveAmplitude', controls.waveAmplitude);
      material.setParameter('kinetiWavePhase', controls.wavePhase);
    });
    app.scene.skyboxIntensity = controls.environmentIntensity;
    app.scene.exposure = controls.exposure;
    key.light.intensity = controls.keyIntensity; key.light.castShadows = Boolean(controls.shadows);
    const enablePost = controls.postEffect > 0;
    if (postAttached !== enablePost) {
      if (enablePost) camera.postEffects.addEffect(postEffect); else camera.postEffects.removeEffect(postEffect);
      postAttached = enablePost;
    }
    if (oldDensity !== controls.density) buildField();
    setProgress(progress);
  };
  const getControls = () => structuredClone(controls);
  const getProbeState = () => {
    const describe = (i) => ({ index: i, local: array(pieces[i].group.getLocalPosition()), world: array(pieces[i].group.getPosition()) });
    return { selected: describe(controls.selectedPiece), other: describe((controls.selectedPiece + 1) % 27),
      cameraFov: camera.fov, material: { roughness: 1 - ceramic.gloss, metalness: ceramic.metalness, clearcoat: ceramic.clearCoat },
      density: controls.density, shadowEnabled: key.light.castShadows, instanceMatrixVersion: matrixRevision,
      gpuWave: { amplitude: fieldCeramic.getParameter('kinetiWaveAmplitude').data, phase: fieldCeramic.getParameter('kinetiWavePhase').data,
        path: `${device.isWebGPU ? 'WGSL' : 'GLSL'} transformInstancingVS / static per-instance matrices / matching body and glyph displacement` },
      postEffect: controls.postEffect, postAttached, exposure: app.scene.exposure,
    };
  };
  const runComputeProbe = async () => {
    if (!device.supportsCompute) return { supported: false, passed: false, backend,
      nativeCompute: false, limitation: 'PlayCanvas compute/storage buffers require WebGPU. WebGL2 transform feedback is available as a separate API, not executed by this compute probe.' };
    const storage = new pc.StorageBuffer(device, 64 * 4, pc.BUFFERUSAGE_COPY_SRC | pc.BUFFERUSAGE_COPY_DST);
    const shader = new pc.Shader(device, { name: 'KinetiComputeProbe', shaderLanguage: pc.SHADERLANGUAGE_WGSL,
      cshader: `var<storage, read_write> kinetiResults: array<f32>;
        @compute @workgroup_size(64, 1, 1)
        fn main(@builtin(global_invocation_id) id: vec3u) { kinetiResults[id.x] = f32(id.x) * 3.0 + 7.0; }` });
    const compute = new pc.Compute(device, shader, 'KinetiCompute64');
    compute.setParameter('kinetiResults', storage); compute.setupDispatch(1, 1, 1);
    try {
      const readback = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('GPU compute/readback exceeded 8 seconds.')), 8000);
        app.once('update', () => {
          try {
            device.computeDispatch([compute], 'KinetiComputeProbe');
            storage.read(0, 64 * 4, new Float32Array(64)).then((data) => { clearTimeout(timeout); resolve(data); },
              (error) => { clearTimeout(timeout); reject(error); });
          } catch (error) { clearTimeout(timeout); reject(error); }
        });
      });
      const values = Array.from(readback);
      return { supported: true, passed: values.length === 64 && values.every((v, i) => v === i * 3 + 7),
        count: 64, values, backend, nativeCompute: true, path: 'Native WGSL Compute + StorageBuffer readback, dispatched during application update' };
    } catch (error) { return { supported: true, passed: false, backend, nativeCompute: true, error: String(error) }; }
    finally { compute.destroy(); shader.destroy(); storage.destroy(); }
  };
  let probeNumber = 0;
  const probeNativeShaders = async () => {
    if (device.maxColorAttachments < 2) return { supported: false, passed: false, backend,
      limitation: 'The active graphics device exposes fewer than two color attachments.' };
    const textures = [0, 1].map((i) => new pc.Texture(device, { name: `kineti-mrt-${i}`,
      width: 4, height: 4, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
      minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST }));
    const target = new pc.RenderTarget({ colorBuffers: textures, depth: false, samples: 1 });
    const shader = pc.ShaderUtils.createShader(device, {
      uniqueName: `KinetiNativeMRT-${probeNumber++}`,
      attributes: { aPosition: pc.SEMANTIC_POSITION },
      vertexGLSL: `attribute vec2 aPosition; void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`,
      vertexWGSL: `attribute aPosition: vec2f;
        @vertex fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput; output.position = vec4f(input.aPosition, 0.0, 1.0); return output;
        }`,
      fragmentGLSL: `uniform vec3 kinetiMRTValue;
        void main() { pcFragColor0 = vec4(kinetiMRTValue, 1.0); pcFragColor1 = vec4(kinetiMRTValue.zxy, 1.0); }`,
      fragmentWGSL: `uniform kinetiMRTValue: vec3f;
        @fragment fn fragmentMain(input: FragmentInput) -> FragmentOutput {
          var output: FragmentOutput; output.color = vec4f(uniform.kinetiMRTValue, 1.0);
          output.color1 = vec4f(uniform.kinetiMRTValue.zxy, 1.0); return output;
        }`,
      fragmentOutputTypes: ['vec4', 'vec4'],
    });
    try {
      const buffers = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MRT draw/readback exceeded 8 seconds.')), 8000);
        app.once('update', () => {
          try {
            device.scope.resolve('kinetiMRTValue').setValue([.25, .5, .75]);
            device.setBlendState(pc.BlendState.NOBLEND);
            pc.drawQuadWithShader(device, target, shader);
            Promise.all(textures.map((texture) => texture.read(0, 0, 4, 4))).then((values) => {
              clearTimeout(timeout); resolve(values);
            }, (error) => { clearTimeout(timeout); reject(error); });
          } catch (error) { clearTimeout(timeout); reject(error); }
        });
      });
      const expected = [[64, 128, 191, 255], [191, 64, 128, 255]];
      const attachments = buffers.map((buffer, i) => ({ index: i, expected: expected[i], values: Array.from(buffer),
        passed: buffer.length === 64 && buffer.every((v, channel) => Math.abs(v - expected[i][channel % 4]) <= 1) }));
      return { supported: true, passed: attachments.every((attachment) => attachment.passed), backend,
        language: device.isWebGPU ? 'WGSL' : 'GLSL', sourceAuthorship: 'Full custom vertex and fragment shader sources',
        path: 'ShaderUtils + two RenderTarget color attachments + Texture.read from GPU', attachments };
    } catch (error) { return { supported: true, passed: false, backend, error: String(error) }; }
    finally { target.destroy(); textures.forEach((texture) => texture.destroy()); shader.destroy(); }
  };
  const getDiagnostics = () => ({
    ready: frameNumber > 0, engine: 'PlayCanvas', version: pc.version, backend, fallbackReason,
    progress, cubePieces: pieces.length, exteriorSymbols: glyphCount, tileCount: controls.density,
    activeTiles: field.enabled ? controls.density : 0, fieldBatches: fieldBatches.length,
    drawCalls: lastFrame?.drawCalls ?? 0, triangles: lastFrame?.submittedTriangles ?? 0, frame: lastFrame,
    frameMs, frameNumber, environmentLoaded: environment.status === 'loaded', environment: { ...environment },
    pixelRatio: device.maxPixelRatio, width: device.width, height: device.height,
    viewport: { width: device.width, height: device.height, pixelRatio: 1 },
    capabilities: { nativeCompute: device.supportsCompute, compute: device.supportsCompute,
      storageBuffers: device.supportsCompute, hardwareInstancing: true, pbr: true, clearcoat: true,
      nativeShaderLanguage: device.isWebGPU ? 'WGSL' : 'GLSL', customPost: true, maxColorAttachments: device.maxColorAttachments },
    controls: getControls(), probe: getProbeState(),
  });
  const resize = () => { app.setCanvasResolution(pc.RESOLUTION_FIXED, innerWidth, innerHeight); buildField(); setProgress(progress); };
  window.addEventListener('resize', resize);
  setControls(); setProgress(0); app.start();
  const runRawControlProbe = async () => {
    const result = await probeNativeShaders();
    return { backend, mrt: { ...result,
      actual: result.attachments?.map((attachment) => attachment.values),
      expected: result.attachments?.map((attachment) => attachment.expected),
    } };
  };
  return { app, device, scene: app.scene, setControls, getControls, setProgress, getDiagnostics, getProbeState, runComputeProbe, probeNativeShaders, runRawControlProbe,
    dispose() {
      if (disposed) return; disposed = true;
      window.removeEventListener('resize', resize);
      if (postAttached) camera.postEffects.removeEffect(postEffect);
      device.draw = originalDraw;
      cube.destroy(); field.destroy(); floor.destroy();
      fieldBuffers.forEach((buffer) => buffer.destroy());
      materials.forEach((material) => material.destroy()); postEffect.shader.destroy();
      app.scene.envAtlas = null;
      environmentResources.atlas?.destroy(); environmentResources.source?.destroy();
      environmentResources.asset.unload(); app.assets.remove(environmentResources.asset);
      app.destroy();
    },
  };
}
