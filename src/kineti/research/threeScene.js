import * as THREE from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createCubeGeometry, createTileGeometry } from '../cubeGeometry.js';
import { createSymbolGeometry } from '../symbols.js';
import { Fn, float, glslFn, instancedArray, instancedBufferAttribute, instanceIndex, pass, positionLocal, sin, uniform, uv, vec2, vec3, vec4, wgslFn } from 'three/tsl';

export const DEFAULT_CONTROLS = Object.freeze({
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [.30, .53, -.045],
  cameraFov: 37, autoFrame: true, roughness: .27, metalness: .08, clearcoat: .46,
  environmentIntensity: .68, keyIntensity: 3.8, exposure: 1.06,
  glyphColor: '#354330', shadows: false, postEffect: 0,
  waveAmplitude: 0, wavePhase: 0, density: 432,
});

// Shared by every comparison fixture: autoFrame dollies the camera out as the
// pieces separate, so an exploded cube stays inside the viewport instead of
// clipping behind the diagnostic dock. Disable it for a fixed camera when
// comparing engines under identical framing.
const BASE_CAMERA_Z = 7.05 / (2 * Math.tan(37 * Math.PI / 360));
const frameDolly = (controls) => (controls.autoFrame ? 1 + controls.explode * .55 : 1);

// A deliberately small fixture: same source geometry and object counts as
// babylonScene. Engine lighting models still differ; this is not a benchmark
// of identical shaders, nor evidence of a universal winner.
export async function createThreeComparison(canvas) {
  let controls = structuredClone(DEFAULT_CONTROLS);
  let disposed = false;
  const forceWebGL = new URLSearchParams(location.search).get('renderer') === 'webgl';
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#10130f');
  const camera = new THREE.PerspectiveCamera(37, innerWidth / innerHeight, .1, 60);
  camera.position.z = BASE_CAMERA_Z;
  scene.add(new THREE.HemisphereLight('#ecf3dc', '#596149', 1.25));
  const key = new THREE.DirectionalLight('#fff4dc', 3.8);
  key.position.set(-3, 7, 9); scene.add(key);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .1, far: 30 });
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .035;
  const fill = new THREE.DirectionalLight('#e4eaff', .9);
  fill.position.set(5, .5, 6); scene.add(fill);
  let environmentLoaded = false;
  try {
    const hdr = await new HDRLoader().loadAsync('/hdri/studio_small_09_1k.hdr');
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
    scene.environmentIntensity = .68;
    scene.environmentRotation.y = .4;
    environmentLoaded = true;
  } catch (e) { console.warn('Comparison HDR:', e.message); }
  const ceramic = new THREE.MeshPhysicalNodeMaterial({ color: '#e9ebdc', roughness: .27, metalness: .08, clearcoat: .46, clearcoatRoughness: .26 });
  const ink = new THREE.MeshPhysicalNodeMaterial({ color: '#354330', metalness: .18, roughness: .35, clearcoat: .2 });
  const cube = new THREE.Group();
  cube.position.set(1.7, .1, 0); cube.rotation.set(.30, .53, -.045); cube.scale.setScalar(1.08);
  scene.add(cube);
  const cubeGeo = createCubeGeometry();
  const pieces = [];
  const glyphs = Array.from({ length: 6 }, (_, i) => createSymbolGeometry(i, .43));
  const faces = [
    [0, 1, 0, Math.PI / 2, 0], [0, -1, 0, -Math.PI / 2, 0],
    [1, 1, -Math.PI / 2, 0, 0], [1, -1, Math.PI / 2, 0, 0],
    [2, 1, 0, 0, 0], [2, -1, 0, Math.PI, 0],
  ];
  let pieceIndex = 0;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const group = new THREE.Group(); group.position.set(x * .96, y * .96, z * .96);
    const body = new THREE.Mesh(cubeGeo, ceramic);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    const coords = [x, y, z];
    for (const [axis, sign, rx, ry, rz] of faces) {
      if (coords[axis] !== sign) continue;
      const glyph = new THREE.Mesh(glyphs[pieceIndex % 6], ink);
      glyph.position.setComponent(axis, sign * .4305); glyph.rotation.set(rx, ry, rz);
      glyph.castShadow = true;
      group.add(glyph);
    }
    cube.add(group); pieces.push({ group, base: group.position.clone() }); pieceIndex++;
  }
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardNodeMaterial({ color: '#182015', roughness: .9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.1; floor.receiveShadow = true;
  floor.visible = false; scene.add(floor);
  const field = new THREE.Group(); scene.add(field);
  const fieldResources = [];
  const amplitude = uniform(0), phase = uniform(0);
  let matrixRevision = 0;
  const buildField = () => {
    field.clear(); fieldResources.splice(0).forEach((r) => r.dispose());
    const cols = controls.density === 162 ? 9 : 24, rows = 18;
    const unit = Math.max(7.05 * camera.aspect / cols, 7.05 / rows) * 1.06;
    const groups = Array.from({ length: 6 }, () => []);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      groups[((i * 7) % 27) % 6].push([(col - (cols - 1) / 2) * unit, ((rows - 1) / 2 - row) * unit, -.1]);
    }
    const object = new THREE.Object3D();
    groups.forEach((positions, family) => {
      for (const symbol of [false, true]) {
        const geometry = symbol ? createSymbolGeometry(family, .40) : createTileGeometry(.78, .15, .055);
        if (symbol) geometry.translate(0, 0, .077);
        fieldResources.push(geometry);
        const centre = new Float32Array(positions.flat());
        geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centre, 3));
        const centreNode = instancedBufferAttribute(geometry.getAttribute('aCentre'));
        const material = (symbol ? ink : ceramic).clone();
        // No matrix upload as the wave changes: one pair of uniforms updates
        // vertex displacement identically for a tile and its embossed glyph.
        const wave = sin(centreNode.x.mul(1.3).add(centreNode.y.mul(.7)).sub(phase)).mul(amplitude);
        material.positionNode = positionLocal.add(vec3(0, 0, wave.div(unit / .86 * .91)));
        fieldResources.push(material);
        const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
        mesh.userData.isGlyph = symbol;
        mesh.frustumCulled = false;
        positions.forEach((xyz, i) => {
          object.position.set(...xyz); object.scale.setScalar(unit / .86 * .91); object.updateMatrix();
          mesh.setMatrixAt(i, object.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        field.add(mesh);
      }
    });
    matrixRevision++;
  };
  buildField();
  const effect = uniform(0);
  const pipeline = new THREE.RenderPipeline(renderer);
  const sceneTexture = pass(scene, camera).getTextureNode('output');
  const offset = vec2(effect.mul(.012), 0);
  const channels = vec3(sceneTexture.sample(uv().add(offset)).r, sceneTexture.sample(uv()).g, sceneTexture.sample(uv().sub(offset)).b);
  pipeline.outputNode = vec4(channels.sub(.5).mul(float(1).add(effect.mul(.18))).add(.5), 1);
  let progress = 0, frameNumber = 0, frameMs = 16.67, previous = 0;
  const setProgress = (value) => {
    progress = Math.min(1, Math.max(0, value));
    const t = Math.min(1, Math.max(0, (progress - .28) / .20));
    const amount = t * t * (3 - 2 * t);
    cube.visible = progress < .49; field.visible = progress >= .49;
    cube.position.set(1.7 * (1 - amount), .1, 0);
    camera.position.z = BASE_CAMERA_Z * frameDolly(controls);
    cube.rotation.set(...controls.rotation.map((v) => v * (1 - amount)));
    cube.scale.setScalar(1.08);
    pieces.forEach(({ group, base }, i) => {
      group.position.copy(base).multiplyScalar(1 + controls.explode * .75 / .96);
      if (i === controls.selectedPiece) group.position.y += controls.pieceOffset;
    });
    floor.visible = controls.shadows && cube.visible;
  };
  const setControls = (patch = {}) => {
    const oldDensity = controls.density;
    controls = { ...controls, ...patch, rotation: [...(patch.rotation || controls.rotation)] };
    controls.density = controls.density === 162 ? 162 : 432;
    controls.selectedPiece = Math.min(26, Math.max(0, Math.round(controls.selectedPiece)));
    camera.fov = controls.cameraFov; camera.updateProjectionMatrix();
    ceramic.roughness = controls.roughness; ceramic.metalness = controls.metalness; ceramic.clearcoat = controls.clearcoat;
    ceramic.needsUpdate = true;
    ink.color.set(controls.glyphColor);
    scene.environmentIntensity = controls.environmentIntensity;
    key.intensity = controls.keyIntensity; key.castShadow = Boolean(controls.shadows);
    renderer.toneMappingExposure = controls.exposure;
    effect.value = controls.postEffect;
    amplitude.value = controls.waveAmplitude; phase.value = controls.wavePhase;
    if (oldDensity !== controls.density) buildField();
    field.children.forEach((mesh) => {
      if (mesh.userData.isGlyph) mesh.material.color.set(controls.glyphColor);
      else { mesh.material.roughness = controls.roughness; mesh.material.metalness = controls.metalness; mesh.material.clearcoat = controls.clearcoat; }
      mesh.material.needsUpdate = true;
    });
    setProgress(progress);
  };
  const getControls = () => structuredClone(controls);
  const getProbeState = () => {
    scene.updateMatrixWorld(true);
    const describe = (i) => ({ index: i, local: pieces[i].group.position.toArray(), world: pieces[i].group.getWorldPosition(new THREE.Vector3()).toArray() });
    return { selected: describe(controls.selectedPiece), other: describe((controls.selectedPiece + 1) % 27),
      cameraFov: camera.fov, material: { roughness: ceramic.roughness, metalness: ceramic.metalness, clearcoat: ceramic.clearcoat },
      density: controls.density, shadowEnabled: key.castShadow, instanceMatrixVersion: matrixRevision,
      gpuWave: { amplitude: amplitude.value, phase: phase.value, path: 'TSL vertex shader / per-instance centre attribute' },
      postEffect: effect.value, exposure: renderer.toneMappingExposure,
    };
  };
  const runComputeProbe = async () => {
    const native = renderer.backend.isWebGPUBackend;
    const values = instancedArray(64, 'float');
    const evaluate = native
      ? wgslFn('fn kinetiEvaluate(index: u32) -> f32 { return f32(index) * 3.0 + 7.0; }')
      : glslFn('float kinetiEvaluate(uint index) { return float(index) * 3.0 + 7.0; }');
    const compute = Fn(() => { values.element(instanceIndex).assign(evaluate(instanceIndex)); })().compute(64);
    try {
      await renderer.computeAsync(compute);
      const readback = Array.from(new Float32Array(await renderer.getArrayBufferAsync(values.value)));
      return { supported: true, passed: readback.length === 64 && readback.every((v, i) => v === i * 3 + 7), count: 64, values: readback,
        backend: native ? 'WebGPU' : 'WebGL2', path: native ? 'Native WGSL function + TSL compute + storage readback' : 'GLSL function + transform feedback emulation + readback; not native compute' };
    } catch (error) { return { supported: false, passed: false, error: String(error), backend: native ? 'WebGPU' : 'WebGL2' }; }
    finally { compute.dispose(); }
  };
  const getDiagnostics = () => ({
    ready: frameNumber > 0, engine: 'Three.js', version: THREE.REVISION,
    backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
    progress, cubePieces: 27, tileCount: controls.density, activeTiles: field.visible ? controls.density : 0,
    drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles,
    frameMs, frameNumber, environmentLoaded, pixelRatio: renderer.getPixelRatio(),
    width: innerWidth, height: innerHeight,
    controls: getControls(), probe: getProbeState(),
  });
  const resize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false); buildField();
  };
  window.addEventListener('resize', resize);
  cube.visible = true; field.visible = true;
  await renderer.compileAsync(scene, camera);
  setProgress(0);
  renderer.setAnimationLoop((time) => {
    if (disposed) return;
    if (previous) frameMs += ((time - previous) - frameMs) * .05;
    previous = time;
    if (controls.postEffect > 0) pipeline.render(); else renderer.render(scene, camera);
    frameNumber++;
  });
  return { renderer, scene, setProgress, getDiagnostics, setControls, getControls, getProbeState, runComputeProbe, dispose() {
    if (disposed) return; disposed = true;
    renderer.setAnimationLoop(null); window.removeEventListener('resize', resize);
    fieldResources.forEach((g) => g.dispose()); glyphs.forEach((g) => g.dispose());
    cubeGeo.dispose(); ceramic.dispose(); ink.dispose(); floorGeo.dispose(); floorMat.dispose();
    pipeline.dispose(); scene.environment?.dispose(); renderer.dispose();
  } };
}
