import * as THREE from 'three/webgpu';
import { color, float, instancedBufferAttribute, mix, mrt, normalLocal, normalView, output, pass, positionLocal, rotate, screenUV, sin, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createPremiumBacking, createPremiumChassis, createPremiumGlyph as createCurrentPremiumGlyph, createPremiumPlate } from '../premiumGeometry.js';
import { createCompositeGrain, createPremiumMaterial, PREMIUM_PALETTE } from '../premiumMaterials.js';

import {createSymbolGeometry} from '../symbols.js';
function createPremiumGlyph(family,size=.435){if(new URLSearchParams(location.search).get('glyphs')!=='legacy')return createCurrentPremiumGlyph(family,size);const geometry=createSymbolGeometry(family,size);geometry.scale(1,1,.72);return geometry;}
const BREAKS = [0, .15, .35, .45, .65, .85, 1];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2, CELL = .96;

// Absolute scroll poses: no clock drift, per-frame randomness, accumulated
// rotations or temporal AO history. Direct and reverse navigation share data.
export function choreography(p, mobile = false) {
  const open = ease(.15, .235, p) * (1 - ease(.30, .405, p));
  const flatten = ease(.395, .49, p) * (1 - ease(.89, .975, p));
  const field = ease(.48, .61, p) * (1 - ease(.82, .93, p));
  const macro = ease(.66, .715, p) * (1 - ease(.79, .845, p));
  return {
    open, flatten, field, macro,
    x: mobile ? 0 : 1.7 * ease(.08, .15, p) * (1 - ease(.42, .495, p)) + 1.7 * ease(.92, .99, p),
    y: mobile ? lerp(-1.63, .08, flatten) : lerp(.80, .10, ease(.08, .15, p)),
    scale: mobile ? lerp(.76, .50, open) : lerp(.88, 1.08, ease(.08, .15, p)) * (1 - open * .18),
    rx: lerp(.30 + Math.sin(p * TAU) * .085, 0, flatten),
    ry: lerp(.53 + ease(.015, .13, p) * .18 - ease(.35, .435, p) * .18, 0, flatten),
    rz: lerp(-.045, 0, flatten),
    turn: ease(.035, .13, p) * (1 - ease(.35, .425, p)) * Math.PI / 2,
    final: ease(.955, .99, p),
  };
}

export async function createGhostExperience({ canvas, onProgress = () => {}, onReady = () => {}, onError = () => {}, reducedMotion = false }) {
  const query = new URLSearchParams(location.search);
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false,
    forceWebGL: query.get('renderer') === 'webgl', powerPreference: 'high-performance' });
  let destroyed = false, reduced = reducedMotion, hidden = document.hidden;
  let width = innerWidth, height = innerHeight, mobile = width < 760;
  let target = 0, progress = 0, lastTime = 0, frameMs = 16.67, cpuMs = 0;
  let frameNumber = 0, activeTiles = 0, lastUiTime = -100, currentPose, dirty = true;
  let DPR = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75);
  let overBudget = 0, adapted = false, inRenderError = false, environmentLoaded = false, renderError = null;
  const effects = { ambientOcclusion: query.get('ao') !== 'off', bloom: true, depthOfField: true };
  const resources = new Set();
  const own = (resource) => { resources.add(resource); return resource; };
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#19221a');
  const uAspect = uniform(width / height);
  const halo = screenUV.sub(vec2(.50, .51)).mul(vec2(uAspect.mul(.73), 1)).length();
  scene.backgroundNode = mix(color('#101812'), color('#42513b'), float(1).sub(smoothstep(float(.06), float(.77), halo)));
  scene.fog = new THREE.Fog('#243023', 20, 38);
  const camera = new THREE.PerspectiveCamera(37, width / height, .1, 60);
  const cameraHeight = () => mobile ? Math.max(9.3, 4.3 / camera.aspect) : 7.05;
  const setCamera = () => {
    camera.aspect = width / height;
    camera.position.set(0, 0, cameraHeight() / (2 * Math.tan(THREE.MathUtils.degToRad(37 / 2))));
    camera.updateProjectionMatrix();
  };
  setCamera(); renderer.setPixelRatio(DPR); renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .97;
  renderer.shadowMap.enabled = query.get('shadows') !== 'off'; renderer.shadowMap.type = THREE.PCFShadowMap;
  await renderer.init();
  if(renderer.backend.device && query.get('readGPU')==='1'){
    const device=renderer.backend.device,createBuffer=device.createBuffer.bind(device);
    device.createBuffer=(descriptor)=>createBuffer({...descriptor,usage:descriptor.usage|((descriptor.usage&GPUBufferUsage.UNIFORM)?GPUBufferUsage.COPY_SRC:0)});
  }
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  scene.add(new THREE.HemisphereLight('#e8eddf', '#48563e', .70));
  const key = new THREE.DirectionalLight('#fff7e9', 2.65);
  key.position.set(-3.5, 6, 7); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .1, far: 30 });
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.normalBias = .008; key.shadow.bias = -.00008; key.shadow.radius = 3; scene.add(key);
  const rim = new THREE.DirectionalLight('#dce8d0', 1.35); rim.position.set(4, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight('#e5e8ff', .64); fill.position.set(5, .5, 6); scene.add(fill);
  try {
    const environment = await new HDRLoader().loadAsync('/hdri/studio_small_09_1k.hdr');
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = own(environment); scene.environmentIntensity = .62; scene.environmentRotation.y = .4;
    environmentLoaded = true;
  } catch (error) { console.warn('Kineti studio environment unavailable:', error.message); }

  const grain = own(createCompositeGrain());
  // Restore the pre-fix material only in this explicit regression fixture.
  const material = (kind,tint) => {const value=own(createPremiumMaterial(kind,grain,tint));if(query.get('regression')==='1')value.positionNode=null;return value;};
  const cube = new THREE.Group(); cube.name = 'kineti-premium-assembly'; scene.add(cube);
  const chassisTemplate = own(createPremiumChassis(false, mobile ? 3 : 4));
  const plateTemplate = own(createPremiumPlate({ detail: mobile ? 3 : 4 }));
  const backingTemplate = own(createPremiumBacking(mobile ? 3 : 4));
  const glyphTemplates = Array.from({ length: 6 }, (_, family) => own(createPremiumGlyph(family)));
  const pieces = [], frontGlyphs = [];
  const baseColor = new THREE.Color(PREMIUM_PALETTE.face), selectedColor = new THREE.Color(PREMIUM_PALETTE.selected);
  const faces = [
    { axis: 0, sign: 1, rotation: [0, Math.PI / 2, 0] }, { axis: 0, sign: -1, rotation: [0, -Math.PI / 2, 0] },
    { axis: 1, sign: 1, rotation: [-Math.PI / 2, 0, 0] }, { axis: 1, sign: -1, rotation: [Math.PI / 2, 0, 0] },
    { axis: 2, sign: 1, rotation: [0, 0, 0] }, { axis: 2, sign: -1, rotation: [0, Math.PI, 0] },
  ];
  let index = 0, exteriorPlates = 0;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const group = new THREE.Group(); group.name = `premium-piece-${index}`;
    const isCore = x === 0 && y === 0 && z === 0, family = index % 6;
    // Each hero draw owns unique geometry and material objects. No shared glyph
    // geometry participates in visibility changes or cached world transforms.
    const body = new THREE.Mesh(own(chassisTemplate.clone()), material(isCore ? 'core' : 'shell'));
    body.castShadow = true; body.receiveShadow = true; group.add(body);
    const coords = [x, y, z], surfaces = [];
    for (const face of faces) {
      const front = face.axis === 2 && face.sign === 1, exterior = coords[face.axis] === face.sign;
      if (!exterior && !front) continue;
      if (exterior) exteriorPlates++;
      const mount = new THREE.Group(); mount.rotation.set(...face.rotation);
      const normal = new THREE.Vector3().setComponent(face.axis, face.sign);
      mount.position.copy(normal).multiplyScalar(.413); group.add(mount);
      const accent = family === 2 || family === 5 ? PREMIUM_PALETTE.periwinkle : PREMIUM_PALETTE.moss;
      const backing = new THREE.Mesh(own(backingTemplate.clone()), material('rim', accent));
      backing.castShadow = true; backing.receiveShadow = true; mount.add(backing);
      const carrier = new THREE.Group(); carrier.position.z = .023; mount.add(carrier);
      const faceMaterial = material('face');
      const plate = new THREE.Mesh(own(plateTemplate.clone()), faceMaterial);
      plate.castShadow = true; plate.receiveShadow = true; carrier.add(plate);
      const glyph = new THREE.Mesh(own(glyphTemplates[family].clone()), material('glyph'));
      glyph.position.z = .034; glyph.castShadow = true; glyph.receiveShadow = true;
      glyph.name = `premium-glyph-${index}-${face.axis}-${face.sign}`; carrier.add(glyph);
      if (front) frontGlyphs.push(glyph);
      surfaces.push({ mount, carrier, plate, glyph, normal, faceMaterial, front, exterior });
    }
    cube.add(group);
    pieces.push({ index, family, group, body, surfaces, isCore, coords: new THREE.Vector3(x, y, z), base: new THREE.Vector3(x * CELL, y * CELL, z * CELL) });
    index++;
  }
  const monogramMaterial = material('glyph'); monogramMaterial.transparent = true; monogramMaterial.depthWrite = false;
  const monogram = new THREE.Mesh(own(createPremiumGlyph('K', 1.93)), monogramMaterial);
  monogram.name = 'premium-final-monogram'; monogram.position.set(0, 0, CELL + .488); monogram.renderOrder = 4; cube.add(monogram);

  // Orthogonal routes and moving packets use scroll as their only time source.
  const connectionPositions = new Float32Array(26 * 18);
  const connectionsGeometry = own(new THREE.BufferGeometry());
  connectionsGeometry.setAttribute('position', new THREE.BufferAttribute(connectionPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const connectionsMaterial = own(new THREE.LineBasicNodeMaterial({ color: '#c8d9b9', transparent: true, opacity: 0, depthWrite: false }));
  const connections = new THREE.LineSegments(connectionsGeometry, connectionsMaterial); connections.frustumCulled = false; cube.add(connections);
  const packetMaterial = own(new THREE.MeshBasicNodeMaterial({ color: '#e0f0ba', transparent: true, opacity: .8, depthWrite: false }));
  const packets = new THREE.InstancedMesh(own(new THREE.SphereGeometry(.018, 8, 6)), packetMaterial, 26); packets.frustumCulled = false; cube.add(packets);
  const uProgress = uniform(0), uField = uniform(0), uUnit = uniform(.5), uZoom = uniform(1), uMacro = uniform(0);
  const fieldGroup = new THREE.Group(); fieldGroup.name = 'kineti-layered-mosaic'; scene.add(fieldGroup);
  let fieldObjects = [], fieldGeometryResources = [], tileCount = 0;
  const flatOrigin = (i) => mobile
    ? new THREE.Vector3(((i % 3) - 1) * .90, (4 - Math.floor(i / 3)) * .90, 0)
    : new THREE.Vector3(((i % 9) - 4) * .86, (1 - Math.floor(i / 9)) * .86, 0);

  function fieldMaterial(geometry, kind, family) {
    const origin = instancedBufferAttribute(geometry.getAttribute('aOrigin'));
    const destination = instancedBufferAttribute(geometry.getAttribute('aDestination'));
    const seed = instancedBufferAttribute(geometry.getAttribute('aSeed'));
    const arrival = smoothstep(seed.mul(.12), seed.mul(.12).add(.84), uField);
    const birth = smoothstep(float(0), float(.10), uField);
    const wave = sin(destination.x.mul(1.05).add(destination.y.mul(.66)).sub(uProgress.mul(39)));
    const crossWave = sin(destination.y.mul(.8).sub(destination.x.mul(.4)).add(uProgress.mul(17)));
    const pulse = smoothstep(float(.80), float(1), wave);
    const angles = vec3(crossWave.mul(.12).mul(arrival), wave.mul(.17).mul(arrival), wave.mul(.026).mul(uMacro));
    const scale = uUnit.mul(birth).mul(uZoom);
    const gridPosition = vec3(destination.x.mul(uZoom), destination.y.mul(uZoom), destination.z.add(wave.mul(float(.25).add(uMacro.mul(.75)))));
    const offset = mix(origin, gridPosition, arrival);
    const owner = material(kind, family === 2 || family === 5 ? PREMIUM_PALETTE.periwinkle : PREMIUM_PALETTE.moss);
    owner.positionNode = rotate(positionLocal, angles).mul(scale).add(offset);
    // Field and camera have identity rotation, so rotated local normals are
    // view-space normals. Clearcoat receives the same rotation as the mesh.
    owner.normalNode = rotate(normalLocal, angles).normalize(); owner.clearcoatNormalNode = owner.normalNode;
    if (kind === 'rim') owner.emissiveNode = color('#b8d091').mul(pulse.mul(.12).mul(arrival));
    return owner;
  }
  function buildField() {
    for (const object of fieldObjects) { fieldGroup.remove(object); object.material.dispose(); resources.delete(object.material); }
    for (const geometry of fieldGeometryResources) { geometry.dispose(); resources.delete(geometry); }
    fieldObjects = []; fieldGeometryResources = [];
    const columns = mobile ? 9 : 24, rows = 18; tileCount = columns * rows;
    const unit = Math.max(cameraHeight() * camera.aspect / columns, cameraHeight() / rows) * 1.06;
    uUnit.value = unit / .86 * .91;
    const groups = Array.from({ length: 6 }, () => ({ origins: [], destinations: [], seeds: [] }));
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const i = row * columns + col, parent = (i * 7) % 27, group = groups[parent % 6], origin = flatOrigin(parent);
      group.origins.push(origin.x, origin.y, origin.z);
      group.destinations.push((col - (columns - 1) / 2) * unit, ((rows - 1) / 2 - row) * unit, -.1);
      group.seeds.push(Math.hypot((col - columns / 2) / columns, (row - rows / 2) / rows));
    }
    groups.forEach((group, family) => {
      for (const kind of ['shell', 'rim', 'face', 'glyph']) {
        let geometry;
        if (kind === 'shell') geometry = createPremiumChassis(true, 2);
        else if (kind === 'rim') { geometry = createPremiumPlate({ size: .794, thickness: .012, detail: 2, bevel: .003 }); geometry.translate(0, 0, .064); }
        else if (kind === 'face') { geometry = createPremiumPlate({ detail: 2 }); geometry.translate(0, 0, .079); }
        else { geometry = createPremiumGlyph(family, .42); geometry.translate(0, 0, .113); }
        own(geometry); fieldGeometryResources.push(geometry);
        geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(group.origins), 3));
        geometry.setAttribute('aDestination', new THREE.InstancedBufferAttribute(new Float32Array(group.destinations), 3));
        geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(group.seeds), 1));
        const instanced = new THREE.InstancedMesh(geometry, fieldMaterial(geometry, kind, family), group.seeds.length);
        const identity = new THREE.Matrix4(); for (let i = 0; i < group.seeds.length; i++) instanced.setMatrixAt(i, identity);
        instanced.instanceMatrix.needsUpdate = true; instanced.frustumCulled = false;
        // The distant directional shadow map is reserved for the hero. GTAO
        // supplies local plate/glyph contact occlusion in the instanced field.
        instanced.castShadow = false; instanced.receiveShadow = false;
        instanced.name = `premium-field-${family}-${kind}`; fieldObjects.push(instanced); fieldGroup.add(instanced);
      }
    });
  }
  buildField();

  const uAO = uniform(effects.ambientOcclusion ? .74 : 0), uFocus = uniform(camera.position.z - .25), uBokeh = uniform(.42);
  const scenePass = own(pass(scene, camera)); scenePass.setMRT(mrt({ output, normal: normalView }));
  const sceneColor = scenePass.getTextureNode('output'), sceneDepth = scenePass.getTextureNode('depth'), sceneNormal = scenePass.getTextureNode('normal');
  const ambientOcclusion = own(ao(sceneDepth, sceneNormal, camera));
  ambientOcclusion.radius.value = .16; ambientOcclusion.thickness.value = .17;
  ambientOcclusion.distanceFallOff.value = .55; ambientOcclusion.scale.value = 1.1;
  ambientOcclusion.samples.value = mobile ? 8 : 16; ambientOcclusion.resolutionScale = .75; ambientOcclusion.useTemporalFiltering = false;
  const cleanAO = own(denoise(ambientOcclusion.getTextureNode(), sceneDepth, sceneNormal, camera));
  cleanAO.radius.value = 3; cleanAO.depthPhi.value = .16; cleanAO.normalPhi.value = 12;
  const shadedColor = sceneColor.mul(vec4(vec3(mix(float(1), cleanAO.r, uAO)), 1));
  const bloomPass = own(bloom(shadedColor, .055, .28, 1.5));
  const finishedColor = shadedColor.add(bloomPass);
  const renderPipeline = own(new THREE.RenderPipeline(renderer)); renderPipeline.outputNode = finishedColor;
  const macroDepth = own(dof(finishedColor, scenePass.getViewZNode(), uFocus, uniform(1.25), uBokeh));
  const macroPipeline = own(new THREE.RenderPipeline(renderer)); macroPipeline.outputNode = macroDepth;
  const pos = new THREE.Vector3(), rotated = new THREE.Vector3(), flat = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), identityQuaternion = new THREE.Quaternion(), packetObject = new THREE.Object3D();

  function updatePose(p) {
    const pose = choreography(p, mobile); currentPose = pose;
    cube.position.set(pose.x, pose.y, 0); cube.rotation.set(pose.rx, pose.ry, pose.rz); cube.scale.setScalar(pose.scale); cube.visible = pose.field < .97;
    const presence = 1 - ease(.50, .575, p) * (1 - ease(.85, .92, p)), symbolFocus = clamp((p - .17) / .15) * 5;
    let lineIndex = 0, packetIndex = 0;
    for (const piece of pieces) {
      q.setFromAxisAngle(axis, piece.coords.y === 1 ? pose.turn : 0);
      rotated.copy(piece.base).applyQuaternion(q); pos.copy(rotated).multiplyScalar(1 + pose.open * (mobile ? .52 : .78));
      if (!piece.isCore) pos.addScaledVector(rotated.clone().normalize(), pose.open * (mobile ? .14 : .20));
      flat.copy(flatOrigin(piece.index)); piece.group.position.copy(pos).lerp(flat, pose.flatten);
      piece.group.quaternion.copy(q).slerp(identityQuaternion, pose.flatten); piece.group.scale.setScalar(Math.max(.01, presence));
      piece.body.scale.set(1, 1, lerp(1, .17, pose.flatten));
      const focus = Math.exp(-Math.pow(piece.family - symbolFocus, 2) * 2) * pose.open;
      for (const surface of piece.surfaces) {
        surface.mount.position.copy(surface.normal).multiplyScalar(lerp(.413, .071, pose.flatten));
        surface.mount.visible = (surface.exterior || pose.open > .035 || pose.flatten > .02) && (surface.front || pose.flatten < .60);
        surface.mount.scale.setScalar(surface.front ? 1 : Math.max(.02, 1 - pose.flatten * 1.6));
        surface.carrier.position.z = .023 + pose.open * .063 * (1 - pose.flatten);
        surface.faceMaterial.color.copy(baseColor).lerp(selectedColor, focus * .38);
      }
      if (!piece.isCore) {
        const destination = piece.group.position;
        const route = [new THREE.Vector3(), new THREE.Vector3(destination.x, 0, 0), new THREE.Vector3(destination.x, destination.y, 0), destination];
        for (let segment = 0; segment < 3; segment++) { route[segment].toArray(connectionPositions, lineIndex); lineIndex += 3; route[segment + 1].toArray(connectionPositions, lineIndex); lineIndex += 3; }
        const flow = ((p * 12 + piece.index * .137) % 1) * 3, segment = Math.min(2, Math.floor(flow));
        packetObject.position.copy(route[segment]).lerp(route[segment + 1], flow - segment); packetObject.updateMatrix(); packets.setMatrixAt(packetIndex++, packetObject.matrix);
      }
    }
    // No almost-zero glyph scales. Final visibility is recomputed for every
    // navigation path, and hero geometry/transform ownership is independent.
    for (const glyph of frontGlyphs) glyph.visible = pose.final < .12;
    monogram.visible = pose.final > .001; monogramMaterial.opacity = pose.final;
    connectionsMaterial.opacity = pose.open * .16; connections.visible = pose.open > .01; packets.visible = connections.visible; packetMaterial.opacity = pose.open * .82;
    connectionsGeometry.attributes.position.needsUpdate = connections.visible; packets.instanceMatrix.needsUpdate = packets.visible;
    uProgress.value = p; uField.value = pose.field; uMacro.value = pose.macro; uZoom.value = 1 + pose.macro * (mobile ? .45 : 2.45);
    fieldGroup.visible = pose.field > .001; activeTiles = fieldGroup.visible ? tileCount : 0;
    // Preserve shadow resource ownership across the field interval. Toggling
    // castShadow disposes Three's map, leaving cached ShadowNodes without a
    // depthTexture when this assembly returns; pause updates instead.
    key.shadow.autoUpdate = cube.visible;
    uFocus.value = camera.position.z - .1; uBokeh.value = pose.macro * .42;
    scene.updateMatrixWorld(true);
  }
  const phaseAt = (p) => p >= 1 ? 5 : Math.max(0, BREAKS.findIndex((end, i) => i > 0 && p < end) - 1);
  const diagnostics = () => ({
    ready: frameNumber > 0 && !inRenderError, backend, progress, targetProgress: target, phase: phaseAt(progress),
    cubePieces: pieces.length, exteriorPlates, modeledPlates: pieces.reduce((count, piece) => count + piece.surfaces.length, 0), tileCount, activeTiles,
    drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles,
    frameMs, renderCpuMs: cpuMs, pixelRatio: DPR, adapted, reducedMotion: reduced, width, height, frameNumber,
    scrollRange: document.documentElement.scrollHeight - innerHeight,
    shaderAnimation: 'TSL instanced layered panels / GPU pose, normals and scroll wave; deterministic scroll choreography', threeRevision: THREE.REVISION,
    surface: 'Separate chamfered/notched composite plates, backing rings and support bosses; shallow porcelain relief; mipmapped deterministic grain',
    geometryDetail: 'Hero bevel segments 3/4 at creation; field 2; no virtualized geometry or Nanite implementation',
    environmentLoaded, ambientOcclusion: effects.ambientOcclusion, aoMethod: 'GTAO depth + normal MRT, spatial denoise, no temporal accumulation',
    depthOfField: Boolean(!mobile && effects.depthOfField && currentPose?.macro > .04), bloom: effects.bloom, choreographyDeterministic: true, renderError,
    renderOnDemand: true, idle: !dirty && progress === target,
  });
  const readScroll = () => { target = clamp(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)); dirty = true; };
  const resize = () => {
    width = innerWidth; height = innerHeight; mobile = width < 760;
    setCamera(); uAspect.value = width / height; DPR = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75, adapted ? 1 : 2);
    renderer.setPixelRatio(DPR); renderer.setSize(width, height, false); ambientOcclusion.samples.value = mobile ? 8 : 16;
    buildField(); readScroll(); updatePose(progress);
  };
  const visibility = () => { hidden = document.hidden; lastTime = 0; dirty = true; };
  window.addEventListener('scroll', readScroll, { passive: true }); window.addEventListener('resize', resize, { passive: true }); document.addEventListener('visibilitychange', visibility);
  readScroll(); progress = target;
  const api = {
    destroy() {
      if (destroyed) return; destroyed = true; renderer.setAnimationLoop(null);
      window.removeEventListener('scroll', readScroll); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      for (const resource of resources) resource.dispose?.(); resources.clear(); renderer.dispose();
      if (window.__KINETI__?.getDiagnostics === diagnostics) delete window.__KINETI__;
    },
    setReducedMotion(value) { reduced = Boolean(value); dirty = true; },
    goTo(value) { dirty = true; window.scrollTo({ top: clamp(value) * Math.max(1, document.documentElement.scrollHeight - innerHeight), behavior: reduced ? 'instant' : 'smooth' }); },
    setEffects(patch = {}) {
      for (const key of Object.keys(effects)) if (typeof patch[key] === 'boolean') effects[key] = patch[key];
      uAO.value = effects.ambientOcclusion ? .74 : 0; bloomPass.strength.value = effects.bloom ? .055 : 0;
      dirty = true;
    },
    getDiagnostics: diagnostics,
    getPoseState: () => ({ cube: { position: cube.position.toArray(), quaternion: cube.quaternion.toArray(), scale: cube.scale.toArray() },
      pieces: pieces.map((piece) => ({ index: piece.index, position: piece.group.position.toArray(), quaternion: piece.group.quaternion.toArray(),
        surfaces: piece.surfaces.map((surface) => ({ glyph: surface.glyph.name, visible: surface.glyph.visible && surface.mount.visible,
          world: surface.glyph.getWorldPosition(new THREE.Vector3()).toArray() })) })), monogramVisible: monogram.visible }),
  };
  window.__KINETI__ = { ...diagnostics(), ...api }; updatePose(progress);
  let debugMode = query.get('mode') || 'pipeline';
  const render = () => debugMode === 'direct' ? renderer.render(scene, camera) : (!mobile && effects.depthOfField && currentPose.macro > .04 ? macroPipeline : renderPipeline).render();
  const baseRefresh = renderer._nodes.needsRefresh.bind(renderer._nodes);
  let cacheTrace=[];
  const originalRefresh=(object)=>{
    const monitor=object.getMonitor(),data=monitor.renderObjects.get(object);
    const before={renderId:monitor.renderId,world:data?.worldMatrix.toArray()};
    const value=baseRefresh(object);
    if(captureDraws&&object.object.name==='premium-glyph-6-0--1')cacheTrace.push({progress,camera:object.camera.type,needsRefresh:value,hasNode:monitor.hasNode,
      before,after:{renderId:monitor.renderId,world:monitor.renderObjects.get(object)?.worldMatrix.toArray()},actual:object.object.matrixWorld.toArray()});
    return value;
  };
  const originalDraw = renderer.backend.draw.bind(renderer.backend);
  const originalMaterials = new Map(); scene.traverse((object) => { if(object.isMesh)originalMaterials.set(object,object.material); });
  const simpleMaterial = own(new THREE.MeshBasicNodeMaterial({color:'#eeeedd'}));
  let drawRecords = [], captureDraws = false;
  const readableBindings=new Map();
  renderer.backend.draw = (object, info) => {
    if(captureDraws && object.object.name.startsWith('premium-glyph')) {
      const uniformGroups=[];
      if(object.camera===camera)for(const group of object.getBindings())if(group.name==='object')for(const binding of group.bindings)if(binding.uniforms)readableBindings.set(object.object.name,{binding,object:object.object});
      for(const group of object.getBindings())for(const binding of group.bindings)if(binding.uniforms) {
        uniformGroups.push({group:group.name, shared:binding.groupNode?.shared, id:binding.id,
          matrices:binding.uniforms.filter(u=>u.isMatrix4Uniform).map(u=>({name:u.name, offset:u.offset,
            value:u.getValue()?.elements?.slice(),buffer:Array.from(binding.buffer.slice(u.offset,u.offset+16))}))});
      }
      drawRecords.push({name:object.object.name, world:object.object.matrixWorld.toArray(), camera:object.camera.type, context:object.context.id,uniformGroups});
    }
    return originalDraw(object,info);
  };
  api.debug = {
    sourceHash:'e88134c3b1c7d076d60d66bae9523b69822ca8a226e6625d81d6d7d775b04752',renderer,scene,camera,cube,pieces,
    pause(){renderer.setAnimationLoop(null);},
    async readGPUUniform(name='premium-glyph-6-0--1'){
      const {binding,object}=readableBindings.get(name),device=renderer.backend.device;
      const matrix=binding.uniforms.find(u=>u.isMatrix4Uniform),size=binding.buffer.byteLength;
      const readback=device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
      const encoder=device.createCommandEncoder();encoder.copyBufferToBuffer(renderer.backend.get(binding).buffer,0,readback,0,size);device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);const actual=Array.from(new Float32Array(readback.getMappedRange()).slice(matrix.offset,matrix.offset+16));
      const result={name,matrixOffset:matrix.offset,actualGPU:actual,stagingCPU:Array.from(binding.buffer.slice(matrix.offset,matrix.offset+16)),expectedWorld:object.matrixWorld.toArray(),method:'Real GPUBuffer copyBufferToBuffer to MAP_READ staging; no CPU substitution'};
      readback.unmap();readback.destroy();return result;
    },
    render(options={}) {
      renderer.setAnimationLoop(null);captureDraws=Boolean(options.capture);drawRecords=[];cacheTrace=[];
      progress=target=options.p ?? progress;updatePose(progress);
      debugMode=options.mode ?? debugMode;renderer.sortObjects=options.sort!==false;
      renderer._nodes.needsRefresh=options.forceRefresh ? ()=>true : originalRefresh;
      scene.overrideMaterial=options.basic?simpleMaterial:null;
      for(const [mesh,original]of originalMaterials){mesh.material=original;
        if(options.identityPositionNode&&!original.positionNode){original.positionNode=positionLocal;original.needsUpdate=true;}
        if(options.invalidateOnce&&!original.userData.invalidated){original.needsUpdate=true;original.userData.invalidated=true;}if(options.colorIDs&&mesh.name.startsWith('premium-glyph')) {
        mesh.material=own(new THREE.MeshBasicNodeMaterial({color:new THREE.Color().setHSL((mesh.id*.61803398875)%1,.8,.5)}));
      }}
      if(options.hidden)for(const name of options.hidden){const object=scene.getObjectByName(name);if(object)object.visible=false;}
      if(options.only)scene.traverse((object)=>{if(object.isMesh)object.visible=options.only.includes(object.name);});
      for(let i=0;i<(options.frames||3);i++)render();
      captureDraws=false;return api.debug.snapshot();
    },
    snapshot(){scene.updateMatrixWorld(true);return {sourceHash:'e88134c3b1c7d076d60d66bae9523b69822ca8a226e6625d81d6d7d775b04752',progress,drawRecords,cacheTrace,objects:pieces.flatMap(piece=>piece.surfaces.map(surface=>{
      const object=surface.glyph;object.geometry.computeBoundingBox();
      const position=object.getWorldPosition(new THREE.Vector3()), projected=position.clone().project(camera);
      let visible=true;for(let parent=object;parent;parent=parent.parent)visible=visible&&parent.visible;
      return {name:object.name,visible,world:position.toArray(),matrix:object.matrixWorld.toArray(),pixel:[(projected.x*.5+.5)*width,(-projected.y*.5+.5)*height],bounds:{min:object.geometry.boundingBox.min.toArray(),max:object.geometry.boundingBox.max.toArray()}};
    }))};}
  };
  try {
    cube.visible = true; fieldGroup.visible = true; await renderer.compileAsync(scene, camera); updatePose(progress);
    render(); frameNumber++; onReady({ backend });
  } catch (error) { inRenderError = true; onError(error); api.destroy(); throw error; }
  renderer.setAnimationLoop((timestamp) => {
    if (destroyed || hidden || inRenderError) return;
    const dt = lastTime ? Math.min((timestamp - lastTime) * .001, .08) : 1 / 60; lastTime = timestamp;
    // Scroll drives every visual quantity. Settled scenes need no geometry,
    // uniform, postprocessing or React updates; keep only this cheap scheduler.
    if (!dirty && progress === target) return;
    dirty = false; frameMs = lerp(frameMs, dt * 1000, .025);
    progress += (target - progress) * (reduced ? 1 : 1 - Math.exp(-dt * 10)); if (Math.abs(progress - target) < .00001) progress = target;
    updatePose(progress); const before = performance.now();
    try { render(); } catch (error) { inRenderError = true; renderError = String(error.stack || error); console.error('Kineti renderer:', error); onError(error); return; }
    cpuMs = lerp(cpuMs, performance.now() - before, .04); frameNumber++;
    if (frameNumber > 120 && dt > .028 && Math.abs(target - progress) > .001) overBudget++; else overBudget = Math.max(0, overBudget - 1);
    if (overBudget > 50 && DPR > 1 && !adapted) { DPR = 1; adapted = true; renderer.setPixelRatio(DPR); renderer.setSize(width, height, false); dirty = true; }
    const state = diagnostics(); Object.assign(window.__KINETI__, state);
    if (timestamp - lastUiTime > 30) { onProgress({ progress, phase: state.phase, phaseProgress: clamp((progress - BREAKS[state.phase]) / (BREAKS[state.phase + 1] - BREAKS[state.phase])) }); lastUiTime = timestamp; }
  });
  return api;
}
