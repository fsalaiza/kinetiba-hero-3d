import {
  Color3, Color4, ComputeShader, Constants, DirectionalLight, Engine, FreeCamera,
  HDRCubeTexture, HemisphericLight, ImageProcessingConfiguration, Logger, Material, Matrix, Mesh,
  MaterialPluginBase, PBRMaterial, PostProcess, Quaternion, Scene, SceneInstrumentation,
  ShaderLanguage, ShaderStore, ShadowDepthWrapper, ShadowGenerator, StorageBuffer, TransformNode,
  Vector3, VertexData, WebGPUEngine,
} from '@babylonjs/core';
import { createCubeGeometry, createTileGeometry } from '../cubeGeometry.js';
import { createSymbolGeometry } from '../symbols.js';

// The engine prints its version banner at construction; keep it in dev builds
// only so the production console stays quiet.
if (import.meta.env.PROD) Logger.LogLevels = Logger.WarningLogLevel | Logger.ErrorLogLevel;

const CAMERA_HEIGHT = 7.05;
const FOV = 37 * Math.PI / 180;
const BASE_CAMERA_Z = CAMERA_HEIGHT / (2 * Math.tan(FOV / 2));
const CELL = 0.96;
const clamp = (n) => Math.min(1, Math.max(0, n));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
const linearColor = (hex) => Color3.FromHexString(hex).toLinearSpace();
const DEFAULT_CONTROLS = Object.freeze({
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [0.30, 0.53, -0.045], cameraFov: 37,
  autoFrame: true, roughness: 0.27, metalness: 0.08, clearcoat: 0.46, environmentIntensity: 0.68,
  keyIntensity: 3.8, exposure: 1.06, glyphColor: '#354330', shadows: false, postEffect: 0,
  waveAmplitude: 0, wavePhase: 0, density: 432,
});

class FieldWavePlugin extends MaterialPluginBase {
  constructor(owner, readControls) {
    super(owner, 'KinetiFieldWave', 200, {}, true, true);
    this.readControls = readControls;
  }
  isCompatible(language) { return language === ShaderLanguage.GLSL || language === ShaderLanguage.WGSL; }
  getUniforms() {
    return { ubo: [{ name: 'kinetiWaveAmplitude', size: 1, type: 'float' }, { name: 'kinetiWavePhase', size: 1, type: 'float' }] };
  }
  bindForSubMesh(buffer) {
    const controls = this.readControls();
    buffer.updateFloat('kinetiWaveAmplitude', controls.waveAmplitude);
    buffer.updateFloat('kinetiWavePhase', controls.wavePhase);
  }
  getCustomCode(shaderType, language) {
    if (shaderType !== 'vertex') return null;
    const wgsl = language === ShaderLanguage.WGSL;
    const u = wgsl ? 'uniforms.' : '';
    return { CUSTOM_VERTEX_UPDATE_WORLDPOS: `
      worldPos.z += sin(finalWorld[3].x * 1.3 + finalWorld[3].y * 0.7 - ${u}kinetiWavePhase) * ${u}kinetiWaveAmplitude;
      ${wgsl ? 'vertexOutputs.vPositionW = worldPos.xyz;' : 'vPositionW = worldPos.xyz;'}
    ` };
  }
}

function createPostEffects(camera, engine, readControls) {
  ShaderStore.ShadersStore.kinetiRGBPixelShader = `precision highp float;varying vec2 vUV;uniform sampler2D textureSampler;uniform float strength;
    void main(){float d=.012*strength;vec4 c=texture2D(textureSampler,vUV);c.r=texture2D(textureSampler,vUV+vec2(d,0.)).r;c.b=texture2D(textureSampler,vUV-vec2(d,0.)).b;gl_FragColor=vec4(clamp((c.rgb-.5)*(1.+.18*strength)+.5,0.,1.),c.a);}`;
  ShaderStore.ShadersStoreWGSL.kinetiRGBPixelShader = `varying vUV: vec2f;var textureSamplerSampler:sampler;var textureSampler:texture_2d<f32>;uniform strength:f32;
    @fragment fn main(input:FragmentInputs)->FragmentOutputs {let d=.012*uniforms.strength;var c=textureSample(textureSampler,textureSamplerSampler,input.vUV);c.r=textureSample(textureSampler,textureSamplerSampler,input.vUV+vec2f(d,0.)).r;c.b=textureSample(textureSampler,textureSamplerSampler,input.vUV-vec2f(d,0.)).b;fragmentOutputs.color=vec4f(clamp((c.rgb-vec3f(.5))*(1.+.18*uniforms.strength)+vec3f(.5),vec3f(0.),vec3f(1.)),c.a);}`;
  const shaderLanguage = engine.isWebGPU ? ShaderLanguage.WGSL : ShaderLanguage.GLSL;
  const passes = ['kinetiRGB'].map((name) => {
    const post = new PostProcess(name, name, { uniforms: ['strength'], size: 1, camera: null, engine, shaderLanguage,
      samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE });
    post.onApply = (effect) => effect.setFloat('strength', readControls().postEffect);
    return post;
  });
  let attached = false;
  return {
    setEnabled(enabled) {
      if (attached === enabled) return;
      attached = enabled;
      passes.forEach((post) => enabled ? camera.attachPostProcess(post) : camera.detachPostProcess(post));
    },
    get enabled() { return attached; },
    get passes() { return passes; },
    dispose() { passes.forEach((post) => post.dispose(camera)); },
  };
}

// Match Three's Euler XYZ convention explicitly; Babylon's Euler helper uses
// yaw/pitch/roll ordering. Geometry authoring is shared; rendering is Babylon.
function quaternionXYZ(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return new Quaternion(s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3);
}

function fromBufferGeometry(name, geometry, scene) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = new Float32Array(geometry.getAttribute('position').array);
  data.normals = new Float32Array(geometry.getAttribute('normal').array);
  if (geometry.getAttribute('uv')) data.uvs = new Float32Array(geometry.getAttribute('uv').array);
  data.indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : Uint32Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i);
  data.applyToMesh(mesh, false);
  mesh.overrideMaterialSideOrientation = Material.CounterClockWiseSideOrientation;
  mesh.isPickable = false;
  geometry.dispose();
  return mesh;
}

function material(name, hex, scene, ink = false) {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = linearColor(hex);
  result.metallic = ink ? 0.18 : 0.08;
  result.roughness = ink ? 0.35 : 0.27;
  result.clearCoat.isEnabled = true;
  result.clearCoat.intensity = ink ? 0.2 : 0.46;
  result.clearCoat.roughness = ink ? 0.3 : 0.26;
  result.backFaceCulling = true;
  result.environmentIntensity = 0.68;
  return result;
}

async function loadEnvironment(scene, state) {
  await new Promise((resolve) => {
    let done = false;
    let texture;
    const finish = (status, error = null) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      state.status = status;
      state.error = error;
      if (status === 'loaded') { texture.rotationY = 0.4; scene.environmentTexture = texture; }
      else texture?.dispose();
      resolve();
    };
    const timeout = setTimeout(() => finish('unavailable', 'HDR loading exceeded 8 seconds.'), 8000);
    try {
      texture = new HDRCubeTexture('/hdri/studio_small_09_1k.hdr', scene, 128,
        false, true, false, true,
        () => queueMicrotask(() => finish('loaded')),
        (message) => finish('unavailable', String(message || 'HDR load failed.')));
    } catch (error) { finish('unavailable', String(error)); }
  });
}

/**
 * Independent Babylon renderer using the same authored mesh vertices as Three.
 * p=0: fixed 27-cubie hero. p=.6: fixed 432-tile mosaic. No post FX or shadows.
 * Lighting units, environment convolution and ACES implementation remain engine
 * specific: equal settings do not imply identical pixels or an isolated benchmark.
 */
export async function createBabylonComparison(canvas) {
  let engine;
  let backend;
  let fallbackReason = null;
  const query = new URLSearchParams(globalThis.location?.search || '');
  const forceWebGL = query.get('backend') === 'webgl2';
  if (!forceWebGL) {
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: false, stencil: false });
        await engine.initAsync();
        backend = 'WebGPU';
      } else fallbackReason = 'WebGPU is unavailable in this browser.';
    } catch (error) {
      engine?.dispose();
      engine = null;
      fallbackReason = String(error);
    }
  }
  if (!engine) {
    engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: true, disableWebGL2Support: false }, false);
    if (engine.webGLVersion < 2) { engine.dispose(); throw new Error('This comparison requires WebGPU or WebGL2.'); }
    backend = 'WebGL2';
  }
  engine.setHardwareScalingLevel(1);
  const scene = new Scene(engine);
  const controls = { ...DEFAULT_CONTROLS, rotation: [...DEFAULT_CONTROLS.rotation] };
  scene.useRightHandedSystem = true;
  scene.clearColor = Color4.FromHexString('#10130fff');
  scene.shadowsEnabled = false;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.06;
  scene.imageProcessingConfiguration.contrast = 1;
  scene.imageProcessingConfiguration.applyByPostProcess = false;
  const camera = new FreeCamera('comparison-camera', new Vector3(0, 0, BASE_CAMERA_Z), scene);
  camera.fov = FOV;
  camera.minZ = 0.1;
  camera.maxZ = 60;
  camera.setTarget(Vector3.Zero());
  scene.activeCamera = camera;
  const key = new DirectionalLight('warm-key', new Vector3(3, -7, -9).normalize(), scene);
  key.position.set(-3, 7, 9);
  key.diffuse = linearColor('#fff4dc');
  key.intensity = 3.8;
  const fill = new DirectionalLight('cool-fill', new Vector3(-5, -0.5, -6).normalize(), scene);
  fill.position.set(5, 0.5, 6);
  fill.diffuse = linearColor('#e4eaff');
  fill.intensity = 0.9;
  const ambient = new HemisphericLight('hemisphere', Vector3.Up(), scene);
  ambient.diffuse = linearColor('#ecf3dc');
  ambient.groundColor = linearColor('#596149');
  ambient.intensity = 1.25;
  const environment = { status: 'loading', error: null, rotationY: 0.4, url: '/hdri/studio_small_09_1k.hdr' };
  await loadEnvironment(scene, environment);

  const ceramic = material('ceramic', '#e9ebdc', scene);
  const ink = material('ink', '#354330', scene, true);
  const fieldCeramic = material('field-ceramic', '#e9ebdc', scene);
  const fieldInk = material('field-ink', '#354330', scene, true);
  new FieldWavePlugin(fieldCeramic, () => controls);
  new FieldWavePlugin(fieldInk, () => controls);
  // Reuse the modified PBR vertex program when rendering wave-displaced shadows.
  fieldCeramic.shadowDepthWrapper = new ShadowDepthWrapper(fieldCeramic, scene, { standalone: true });
  fieldInk.shadowDepthWrapper = new ShadowDepthWrapper(fieldInk, scene, { standalone: true });
  const cube = new TransformNode('hero-27-cubies', scene);
  const cubieSource = fromBufferGeometry('cubie-source', createCubeGeometry(), scene);
  cubieSource.material = ceramic;
  cubieSource.setEnabled(false);
  const symbolSources = Array.from({ length: 6 }, (_, i) => {
    const source = fromBufferGeometry(`symbol-source-${i}`, createSymbolGeometry(i, 0.43), scene);
    source.material = ink;
    source.setEnabled(false);
    return source;
  });
  const faces = [
    { axis: 0, sign: 1, rotation: [0, Math.PI / 2, 0] },
    { axis: 0, sign: -1, rotation: [0, -Math.PI / 2, 0] },
    { axis: 1, sign: 1, rotation: [-Math.PI / 2, 0, 0] },
    { axis: 1, sign: -1, rotation: [Math.PI / 2, 0, 0] },
    { axis: 2, sign: 1, rotation: [0, 0, 0] },
    { axis: 2, sign: -1, rotation: [0, Math.PI, 0] },
  ];
  let index = 0;
  let exteriorSymbols = 0;
  const pieces = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const piece = new TransformNode(`cubie-${index}`, scene);
    piece.parent = cube;
    piece.position.set(x * CELL, y * CELL, z * CELL);
    pieces.push({ node: piece, coordinates: new Vector3(x, y, z) });
    const body = cubieSource.clone(`cubie-body-${index}`, piece, true);
    body.setEnabled(true);
    const coordinates = [x, y, z];
    for (const face of faces) {
      if (coordinates[face.axis] !== face.sign) continue;
      const symbol = symbolSources[index % 6].clone(`face-symbol-${index}-${face.axis}-${face.sign}`, piece, true);
      symbol.setEnabled(true);
      const offset = [0, 0, 0]; offset[face.axis] = face.sign * 0.4305;
      symbol.position.set(...offset);
      symbol.rotationQuaternion = quaternionXYZ(...face.rotation);
      exteriorSymbols++;
    }
    index++;
  }

  const field = new TransformNode('mosaic-432-tiles', scene);
  const fieldBatches = [];
  for (let family = 0; family < 6; family++) {
    const tiles = [];
    for (let i = 0; i < 432; i++) if (((i * 7) % 27) % 6 === family) tiles.push(i);
    for (const isSymbol of [false, true]) {
      const geometry = isSymbol ? createSymbolGeometry(family, 0.4) : createTileGeometry(0.78, 0.15, 0.055);
      if (isSymbol) geometry.translate(0, 0, 0.077);
      const mesh = fromBufferGeometry(`mosaic-${family}-${isSymbol ? 'symbol' : 'body'}`, geometry, scene);
      mesh.parent = field;
      mesh.material = isSymbol ? fieldInk : fieldCeramic;
      mesh.alwaysSelectAsActiveMesh = true;
      const matrices = new Float32Array(tiles.length * 16);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      fieldBatches.push({ mesh, family, tiles, matrices });
    }
  }
  const shadow = new ShadowGenerator(1024, key);
  shadow.usePercentageCloserFiltering = true;
  shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  shadow.bias = 0.00015;
  shadow.normalBias = 0.035;
  const renderMeshes = scene.meshes.filter((mesh) => !mesh.name.includes('source'));
  shadow.getShadowMap().renderList = renderMeshes;
  renderMeshes.forEach((mesh) => { mesh.receiveShadows = true; });
  const postEffects = createPostEffects(camera, engine, () => controls);
  let instanceMatrixVersion = 0;
  const instrumentation = new SceneInstrumentation(scene);
  instrumentation.captureFrameTime = true;
  instrumentation.captureRenderTime = true;
  let progress = 0;
  let disposed = false;
  let frames = 0;
  let lastTime = null;
  let intervals = [];
  let frameCounts = { drawCalls: 0, submittedTriangles: 0 };
  let lastFrame = null;
  const originalElements = engine.drawElementsType;
  const originalArrays = engine.drawArraysType;
  const countSubmission = (mode, count, instances) => {
    frameCounts.drawCalls++;
    if (mode === Constants.MATERIAL_TriangleFillMode) frameCounts.submittedTriangles += count * (instances ?? 1) / 3;
  };
  engine.drawElementsType = function (mode, start, count, instances) {
    countSubmission(mode, count, instances);
    return originalElements.call(this, mode, start, count, instances);
  };
  engine.drawArraysType = function (mode, start, count, instances) {
    countSubmission(mode, count, instances);
    return originalArrays.call(this, mode, start, count, instances);
  };

  function updateGrid() {
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const columns = controls.density === 162 ? 9 : 24;
    const unit = Math.max(CAMERA_HEIGHT * aspect / columns, CAMERA_HEIGHT / 18) * 1.06;
    const scale = unit / 0.86 * 0.91;
    const scaling = new Vector3(scale, scale, scale);
    for (const batch of fieldBatches) {
      const tiles = [];
      for (let i = 0; i < controls.density; i++) if (((i * 7) % 27) % 6 === batch.family) tiles.push(i);
      if (tiles.length !== batch.tiles.length) {
        batch.tiles = tiles;
        batch.matrices = new Float32Array(tiles.length * 16);
        batch.mesh.thinInstanceSetBuffer('matrix', batch.matrices, 16, false);
      }
      batch.tiles.forEach((i, slot) => {
        const column = i % columns;
        const row = Math.floor(i / columns);
        Matrix.Compose(scaling, Quaternion.Identity(), new Vector3((column - (columns - 1) / 2) * unit, (8.5 - row) * unit, -0.1)).copyToArray(batch.matrices, slot * 16);
      });
      batch.mesh.thinInstanceBufferUpdated('matrix');
      batch.mesh.thinInstanceRefreshBoundingInfo(true);
    }
    instanceMatrixVersion++;
  }
  function setProgress(value) {
    const next = clamp(Number.isFinite(Number(value)) ? Number(value) : 0);
    if (Math.abs(next - progress) > 0.001) { intervals = []; lastTime = null; }
    progress = next;
    const flatten = smooth(0.28, 0.48, next);
    cube.position.set(mix(1.7, 0, flatten), 0.1, 0);
    camera.position.z = BASE_CAMERA_Z * (controls.autoFrame ? 1 + controls.explode * 0.55 : 1);
    cube.rotationQuaternion = quaternionXYZ(...controls.rotation.map((value) => mix(value, 0, flatten)));
    cube.scaling.setAll(1.08);
    pieces.forEach(({ node, coordinates }, i) => {
      node.position.copyFrom(coordinates.scale(CELL + 0.75 * controls.explode));
      if (i === controls.selectedPiece) node.position.y += controls.pieceOffset;
    });
    cube.setEnabled(next < 0.49);
    field.setEnabled(next >= 0.49);
  }
  function getControls() { return { ...controls, rotation: [...controls.rotation] }; }
  function setControls(patch = {}) {
    const ranges = { explode: [0, 1], pieceOffset: [-1, 1], cameraFov: [25, 60], roughness: [0.05, 1],
      metalness: [0, 1], clearcoat: [0, 1], environmentIntensity: [0, 2], keyIntensity: [0, 6],
      exposure: [0.5, 2], postEffect: [0, 1], waveAmplitude: [0, 0.8], wavePhase: [0, Math.PI * 2] };
    const oldDensity = controls.density;
    for (const [name, [min, max]] of Object.entries(ranges)) {
      if (patch[name] !== undefined && Number.isFinite(Number(patch[name]))) controls[name] = Math.min(max, Math.max(min, Number(patch[name])));
    }
    if (patch.selectedPiece !== undefined && Number.isFinite(Number(patch.selectedPiece))) controls.selectedPiece = Math.min(26, Math.max(0, Math.round(Number(patch.selectedPiece))));
    if (Array.isArray(patch.rotation) && patch.rotation.length === 3 && patch.rotation.every(Number.isFinite)) controls.rotation = [...patch.rotation];
    if (typeof patch.glyphColor === 'string' && /^#[0-9a-f]{6}$/i.test(patch.glyphColor)) controls.glyphColor = patch.glyphColor;
    if (typeof patch.shadows === 'boolean') controls.shadows = patch.shadows;
    if (typeof patch.autoFrame === 'boolean') controls.autoFrame = patch.autoFrame;
    if ([162, 432].includes(Number(patch.density))) controls.density = Number(patch.density);
    [ceramic, fieldCeramic].forEach((owner) => {
      owner.roughness = controls.roughness;
      owner.metallic = controls.metalness;
      owner.clearCoat.intensity = controls.clearcoat;
    });
    [ceramic, fieldCeramic, ink, fieldInk].forEach((owner) => { owner.environmentIntensity = controls.environmentIntensity; });
    [ink, fieldInk].forEach((owner) => { owner.albedoColor = linearColor(controls.glyphColor); });
    key.intensity = controls.keyIntensity;
    camera.fov = controls.cameraFov * Math.PI / 180;
    scene.imageProcessingConfiguration.exposure = controls.exposure;
    scene.shadowsEnabled = controls.shadows;
    postEffects.setEnabled(controls.postEffect > 0);
    if (controls.density !== oldDensity) updateGrid();
    setProgress(progress);
    intervals = [];
    lastTime = null;
    return getControls();
  }
  function getProbeState() {
    cube.computeWorldMatrix(true);
    const probe = (index) => {
      const node = pieces[index].node;
      node.computeWorldMatrix(true);
      return { index, local: node.position.asArray(), world: node.getAbsolutePosition().asArray() };
    };
    return { selected: probe(controls.selectedPiece), other: probe(controls.selectedPiece === 0 ? 1 : 0),
      cameraFov: camera.fov * 180 / Math.PI, material: { roughness: ceramic.roughness, metalness: ceramic.metallic, clearcoat: ceramic.clearCoat.intensity },
      density: fieldBatches.filter((batch) => batch.mesh.material === fieldCeramic).reduce((sum, batch) => sum + batch.mesh.thinInstanceCount, 0),
      shadowEnabled: scene.shadowsEnabled, instanceMatrixVersion,
      gpuWave: { amplitude: controls.waveAmplitude, phase: controls.wavePhase,
        path: backend === 'WebGPU' ? 'MaterialPluginBase / WGSL vertex / finalWorld instance center' : 'MaterialPluginBase / GLSL vertex / finalWorld instance center' } };
  }
  async function runComputeProbe() {
    if (!engine.isWebGPU || !engine.getCaps().supportComputeShaders) return { supported: false, passed: false, count: 64, values: [], backend,
      path: 'unsupported', reason: 'Native compute shaders require the WebGPU backend; no CPU simulation is used.' };
    const storage = new StorageBuffer(engine, 64 * Float32Array.BYTES_PER_ELEMENT);
    const source = `@group(0) @binding(0) var<storage,read_write> output: array<f32>;
      @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
        if (id.x < 64u) { output[id.x] = f32(id.x) * 3.0 + 7.0; }
      }`;
    const compute = new ComputeShader('kineti-native-compute-probe', engine, { computeSource: source },
      { bindingsMapping: { output: { group: 0, binding: 0 } } });
    compute.setStorageBuffer('output', storage);
    try {
      await compute.dispatchWhenReady(1, 1, 1);
      const readback = await storage.read();
      const values = Array.from(new Float32Array(readback.buffer, readback.byteOffset, 64));
      return { supported: true, passed: values.length === 64 && values.every((value, i) => value === i * 3 + 7),
        count: 64, values, backend, path: 'Babylon ComputeShader / native WGSL / StorageBuffer GPU readback' };
    } catch (error) {
      return { supported: true, passed: false, count: 64, values: [], backend,
        path: 'Babylon ComputeShader / native WGSL', error: String(error) };
    } finally { storage.dispose(); }
  }
  function resize() {
    engine.resize();
    updateGrid();
  }
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  resizeObserver?.observe(canvas);
  globalThis.addEventListener?.('resize', resize);
  resize();
  setProgress(0);
  setControls({});
  const render = () => {
    if (disposed) return;
    const now = performance.now();
    if (lastTime !== null) { intervals.push(now - lastTime); if (intervals.length > 240) intervals.shift(); }
    lastTime = now;
    frameCounts = { drawCalls: 0, submittedTriangles: 0 };
    scene.render();
    frames++;
    lastFrame = { ...frameCounts, babylonDrawCalls: instrumentation.drawCallsCounter.current,
      activeIndices: scene.getActiveIndices(), cpuSceneRenderMs: instrumentation.renderTimeCounter.current };
  };
  engine.runRenderLoop(render);
  function getDiagnostics() {
    const sorted = [...intervals].sort((a, b) => a - b);
    const average = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
    return {
      engine: 'Babylon.js', version: Engine.Version, backend, fallbackReason, progress,
      stage: progress < 0.49 ? 'hero' : 'mosaic', referenceViewport: [1440, 900],
      viewport: { width: engine.getRenderWidth(), height: engine.getRenderHeight(), hardwareScalingLevel: engine.getHardwareScalingLevel() },
      camera: { perspective: true, verticalFovDegrees: controls.cameraFov, positionZ: camera.position.z },
      geometry: { cubies: 27, exteriorSymbols, mosaicTiles: controls.density, mosaicSymbolInstances: controls.density, mosaicDrawBatches: 12 },
      effects: { bloom: false, ssao: false, shadows: scene.shadowsEnabled, toneMapping: 'Babylon ACES', exposure: controls.exposure,
        customPostPasses: postEffects.enabled ? 1 : 0, postPath: `${backend === 'WebGPU' ? 'WGSL' : 'GLSL'} fullscreen RGB separation + contrast after scene tone mapping` },
      controls: getControls(), probe: getProbeState(), missingFeatures: backend === 'WebGL2' ? ['native-compute-shaders'] : [],
      environment: { ...environment }, frames, frame: lastFrame,
      timing: { samples: intervals.length, averageFrameMs: average, fps: average ? 1000 / average : null,
        p95FrameMs: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null, gpuFrameMs: null,
        method: 'Measured render-loop intervals, latest 240 samples; includes browser scheduling. CPU scene time is not GPU time.' },
      comparisonLimits: 'Shared geometry, camera, counts and nominal PBR settings. Babylon and Three use different light units, environment filtering and tone mapping; this is not a pixel-identical or isolated engine benchmark.',
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    engine.stopRenderLoop(render);
    resizeObserver?.disconnect();
    globalThis.removeEventListener?.('resize', resize);
    engine.drawElementsType = originalElements;
    engine.drawArraysType = originalArrays;
    instrumentation.dispose();
    postEffects.dispose();
    shadow.dispose();
    scene.dispose();
    engine.dispose();
  }
  return { engine, scene, setProgress, getDiagnostics, setControls, getControls, getProbeState, runComputeProbe, dispose };
}
