import * as THREE from 'three/webgpu';
import { attribute, color, float, mix, mrt, normalLocal, normalView, output, pass, positionLocal, rotate, screenUV, sin, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createPremiumBacking, createPremiumChassis, createPremiumGlyph, createPremiumPlate } from './premiumGeometry.js';
import { createCompositeGrain, createPremiumMaterial, PREMIUM_PALETTE } from './premiumMaterials.js';

const BREAKS = [0, .15, .35, .45, .65, .85, 1];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = THREE.MathUtils.lerp;
const TAU = Math.PI * 2, CELL = .96;

// Absolute scroll poses: no clock drift, per-frame randomness, accumulated
// rotations or temporal AO history. Direct and reverse navigation share data.
export function choreography(p, mobile = false) {
  const open = ease(.15, .235, p) * (1 - ease(.30, .405, p));
  // On mobile the flattened sheet would cover the "Conectar" copy while the
  // phase is still active; flatten only once its panel has handed over.
  const flatten = ease(mobile ? .44 : .395, mobile ? .52 : .49, p) * (1 - ease(.885, .94, p));
  // The mosaic must finish retreating as the "Integrar" copy appears at .85,
  // not trail behind it until .93 and cover the headline.
  const field = ease(.48, .61, p) * (1 - ease(.79, .855, p));
  const macro = ease(.66, .715, p) * (1 - ease(.79, .845, p));
  return {
    open, flatten, field, macro,
    x: mobile ? 0 : 1.7 * ease(.08, .15, p) * (1 - ease(.42, .495, p)) + 1.7 * ease(.92, .99, p),
    y: mobile ? lerp(-1.63, .08, flatten) : lerp(.80, .10, ease(.08, .15, p)) + open * .25,
    scale: mobile ? lerp(.76, .50, open) : lerp(.88, 1.08, ease(.08, .15, p)) * (1 - open * .28),
    rx: lerp(.30 + Math.sin(p * TAU) * .085, 0, flatten),
    ry: lerp(.53 + ease(.015, .13, p) * .18 - ease(.35, .435, p) * .18, 0, flatten),
    rz: lerp(-.045, 0, flatten),
    turn: ease(.035, .13, p) * (1 - ease(.35, .425, p)) * Math.PI / 2,
    final: ease(.955, .99, p),
  };
}

export async function createExperience({ canvas, onProgress = () => {}, onReady = () => {}, onError = () => {}, reducedMotion = false }) {
  const initializationStarted = performance.now();
  const startupTimings = {};
  const recordStartup = (name, start) => {
    startupTimings[name] = performance.now() - start;
    performance.measure(`kineti:${name}`, { start, duration: startupTimings[name] });
  };
  const query = new URLSearchParams(location.search);
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false,
    forceWebGL: query.get('renderer') === 'webgl' });
  if (query.get('profile') === '1') {
    // Exclusive CPU/submission time, including synchronous driver waits; not
    // GPU execution time. This hook is removed before the interactive frame loop.
    const stack = [];
    startupTimings.renderObjects = {};
    renderer.setRenderObjectFunction((...args) => {
      const item = { start: performance.now(), children: 0 }; stack.push(item);
      try { renderer.renderObject(...args); }
      finally {
        const total = performance.now() - item.start; stack.pop();
        if (stack.length) stack[stack.length - 1].children += total;
        const name = args[4]?.name || args[4]?.type || 'unknown';
        const timing = startupTimings.renderObjects[name] ||= { calls: 0, exclusiveMs: 0, maxMs: 0 };
        timing.calls++; timing.exclusiveMs += total - item.children; timing.maxMs = Math.max(timing.maxMs, total - item.children);
      }
    });
  }
  let destroyed = false, reduced = reducedMotion, hidden = document.hidden;
  let width = innerWidth, height = innerHeight, mobile = width < 760;
  let target = 0, progress = 0, lastTime = 0, frameMs = 16.67, cpuMs = 0;
  let frameNumber = 0, activeTiles = 0, lastUiTime = -100, lastUiProgress = -1, lastUiPhase = -1, currentPose, dirty = true, settleFrames = 2;
  let lastDrawCalls = 0, lastTriangles = 0, initialLoadMs = 0, precompiledPasses = false;
  let DPR = Math.min(devicePixelRatio, mobile ? 1.5 : 1.75);
  let overBudget = 0, adapted = false, inRenderError = false, environmentLoaded = false, renderError = null;
  // Optional visual variants, all disabled unless explicitly requested:
  // ?idle=1 slow continuous rotation, ?fx=rgb subtle chromatic aberration,
  // ?hover=1 pointer lift + highlight on individual pieces.
  const idleSpin = query.get('idle') === '1', fxRgb = query.get('fx') === 'rgb', hoverLift = query.get('hover') === '1';
  let idleAngle = 0, hoveredPiece = -1, hoverDirty = false;
  const effects = { ambientOcclusion: query.get('ao') !== 'off', bloom: true, depthOfField: true };
  const resources = new Set();
  const own = (resource) => { resources.add(resource); return resource; };
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#19221a');
  // Fetch/decode the unchanged IBL alongside device initialization and geometry.
  // Keep the original Radiance asset as a fallback if EXR loading fails.
  const environmentStarted = performance.now();
  const environmentPromise = new EXRLoader().loadAsync('/hdri/studio_small_09_1k.exr')
    .catch(() => new HDRLoader().loadAsync('/hdri/studio_small_09_1k.hdr'))
    .then((environment) => {
      environment.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = own(environment); scene.environmentIntensity = .62; scene.environmentRotation.y = .4;
      environmentLoaded = true;
    }).catch((error) => { console.warn('Kineti studio environment unavailable:', error.message); })
    .finally(() => recordStartup('environmentFetchDecodeMs', environmentStarted));
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
  const rendererStarted = performance.now();
  await renderer.init();
  recordStartup('rendererInitMs', rendererStarted);
  const backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  scene.add(new THREE.HemisphereLight('#e8eddf', '#48563e', .70));
  const key = new THREE.DirectionalLight('#fff7e9', 2.65);
  key.position.set(-3.5, 6, 7); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .1, far: 30 });
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  key.shadow.normalBias = .008; key.shadow.bias = -.00008; key.shadow.radius = 3; scene.add(key);
  const rim = new THREE.DirectionalLight('#dce8d0', 1.35); rim.position.set(4, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight('#e5e8ff', .64); fill.position.set(5, .5, 6); scene.add(fill);
  const geometryStarted = performance.now();
  const grain = own(createCompositeGrain());
  const material = (kind, tint) => own(createPremiumMaterial(kind, grain, tint));
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
    // The visible 3x3 face carries all six capabilities. A linear index modulo
    // six would accidentally repeat only two families on every front panel.
    const isCore = x === 0 && y === 0 && z === 0, family = ((x + 1) * 2 + (y + 1) * 3 + z + 1) % 6;
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
  const fieldObjects = [];
  const familySizes = Array.from({ length: 6 }, (_, family) => pieces.filter((piece) => piece.family === family).length);
  const fieldCapacity = Math.ceil(432 / pieces.length) * Math.max(...familySizes);
  let tileCount = 0;
  const sharedFieldMaterials = new Map();
  const flatOrigin = (i) => mobile
    ? new THREE.Vector3(((i % 3) - 1) * .90, (4 - Math.floor(i / 3)) * .90, 0)
    : new THREE.Vector3(((i % 9) - 4) * .86, (1 - Math.floor(i / 9)) * .86, 0);

  function fieldMaterial(kind, family) {
    // Resolve each mesh's instance attributes by name. Families share five
    // shaders/materials instead of rebuilding the same graph 24 times.
    const origin = attribute('aOrigin', 'vec3');
    const destination = attribute('aDestination', 'vec3');
    const seed = attribute('aSeed', 'float');
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
    const columns = mobile ? 9 : 24, rows = 18; tileCount = columns * rows;
    const unit = Math.max(cameraHeight() * camera.aspect / columns, cameraHeight() / rows) * 1.06;
    uUnit.value = unit / .86 * .91;
    const groups = Array.from({ length: 6 }, () => ({ origins: [], destinations: [], seeds: [] }));
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const i = row * columns + col, parent = (i * 7) % 27, group = groups[pieces[parent].family], origin = flatOrigin(parent);
      group.origins.push(origin.x, origin.y, origin.z);
      group.destinations.push((col - (columns - 1) / 2) * unit, ((rows - 1) / 2 - row) * unit, -.1);
      group.seeds.push(Math.hypot((col - columns / 2) / columns, (row - rows / 2) / rows));
    }
    const writeInstances = (object, group) => {
      if (group.seeds.length > fieldCapacity) throw new Error('Kineti field instance capacity exceeded.');
      for (const [name, values] of [['aOrigin', group.origins], ['aDestination', group.destinations], ['aSeed', group.seeds]]) {
        const instanceAttribute = object.geometry.getAttribute(name);
        instanceAttribute.array.set(values); instanceAttribute.needsUpdate = true;
      }
      object.geometry.instanceCount = group.seeds.length;
    };
    if (fieldObjects.length) {
      // Keep geometry, attributes and render objects alive
      // across responsive layouts. Only buffer values and draw counts change.
      for (const object of fieldObjects) writeInstances(object, groups[object.userData.family]);
      return;
    }
    groups.forEach((group, family) => {
      for (const kind of ['shell', 'rim', 'face', 'glyph']) {
        let geometry;
        if (kind === 'shell') geometry = createPremiumChassis(true, 2);
        else if (kind === 'rim') { geometry = createPremiumPlate({ size: .794, thickness: .012, detail: 2, bevel: .003 }); geometry.translate(0, 0, .064); }
        else if (kind === 'face') { geometry = createPremiumPlate({ detail: 2 }); geometry.translate(0, 0, .079); }
        else { geometry = createPremiumGlyph(family, .42, 'field'); geometry.translate(0, 0, .113); }
        const sourceGeometry = geometry;
        geometry = own(new THREE.InstancedBufferGeometry().copy(sourceGeometry));
        sourceGeometry.dispose();
        geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(fieldCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('aDestination', new THREE.InstancedBufferAttribute(new Float32Array(fieldCapacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(fieldCapacity), 1).setUsage(THREE.DynamicDrawUsage));
        const materialKey = kind === 'rim' ? `${kind}-${family === 2 || family === 5 ? 'periwinkle' : 'moss'}` : kind;
        if (!sharedFieldMaterials.has(materialKey)) sharedFieldMaterials.set(materialKey, fieldMaterial(kind, family));
        // TSL defines the complete instance pose. InstancedMesh would inject
        // redundant identity-matrix buffers with unique shader names per
        // mesh/build in r185. Geometry instancing preserves the GPU draws.
        const instanced = new THREE.Mesh(geometry, sharedFieldMaterials.get(materialKey));
        instanced.frustumCulled = false;
        instanced.userData.family = family; writeInstances(instanced, group);
        // The distant directional shadow map is reserved for the hero. GTAO
        // supplies local plate/glyph contact occlusion in the instanced field.
        instanced.castShadow = false; instanced.receiveShadow = false;
        instanced.name = `premium-field-${family}-${kind}`; fieldObjects.push(instanced); fieldGroup.add(instanced);
      }
    });
  }
  buildField();
  recordStartup('geometryMs', geometryStarted);
  await environmentPromise;

  const uAO = uniform(effects.ambientOcclusion ? .74 : 0), uFocus = uniform(camera.position.z - .25), uBokeh = uniform(.42);
  const scenePass = own(pass(scene, camera, { samples: renderer.samples })); scenePass.setMRT(mrt({ output, normal: normalView }));
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
  // ?fx=rgb: subtle chromatic aberration variant, sampled around the shaded pass.
  let rgbPipeline = null, rgbBloomPass = null;
  if (fxRgb) {
    const rgbOffset = vec2(.0035, 0);
    const aberrated = vec4(vec3(sceneColor.sample(screenUV.add(rgbOffset)).r, sceneColor.sample(screenUV).g, sceneColor.sample(screenUV.sub(rgbOffset)).b).mul(mix(float(1), cleanAO.r, uAO)), 1);
    rgbBloomPass = own(bloom(aberrated, .055, .28, 1.5));
    rgbPipeline = own(new THREE.RenderPipeline(renderer)); rgbPipeline.outputNode = aberrated.add(rgbBloomPass);
  }
  const pos = new THREE.Vector3(), rotated = new THREE.Vector3(), flat = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), identityQuaternion = new THREE.Quaternion(), packetObject = new THREE.Object3D();
  // ?hover=1: pointer raycast that lifts and highlights the piece under the cursor.
  const raycaster = new THREE.Raycaster(), pointerNdc = new THREE.Vector2();
  const bodyMeshes = pieces.map((piece) => piece.body);
  const onPointerMove = hoverLift ? (event) => { pointerNdc.set((event.clientX / width) * 2 - 1, -(event.clientY / height) * 2 + 1); hoverDirty = true; } : null;

  function updatePose(p) {
    const pose = choreography(p, mobile); currentPose = pose;
    cube.position.set(pose.x, pose.y, 0); cube.rotation.set(pose.rx, pose.ry + idleAngle, pose.rz); cube.scale.setScalar(pose.scale); cube.visible = pose.field < .97;
    const presence = 1 - ease(.50, .575, p) * (1 - ease(.905, .955, p)), symbolFocus = clamp((p - .17) / .15) * 5;
    let lineIndex = 0, packetIndex = 0;
    for (const piece of pieces) {
      q.setFromAxisAngle(axis, piece.coords.y === 1 ? pose.turn : 0);
      rotated.copy(piece.base).applyQuaternion(q); pos.copy(rotated).multiplyScalar(1 + pose.open * (mobile ? .52 : .78));
      if (!piece.isCore) pos.addScaledVector(rotated.clone().normalize(), pose.open * (mobile ? .14 : .20));
      flat.copy(flatOrigin(piece.index)); piece.group.position.copy(pos).lerp(flat, pose.flatten);
      if (hoverLift && piece.index === hoveredPiece) piece.group.position.z += .22;
      piece.group.quaternion.copy(q).slerp(identityQuaternion, pose.flatten); piece.group.scale.setScalar(Math.max(.01, presence));
      piece.body.scale.set(1, 1, lerp(1, .17, pose.flatten));
      const focus = Math.exp(-Math.pow(piece.family - symbolFocus, 2) * 2) * pose.open;
      for (const surface of piece.surfaces) {
        surface.mount.position.copy(surface.normal).multiplyScalar(lerp(.413, .071, pose.flatten));
        surface.mount.visible = (surface.exterior || pose.open > .035 || pose.flatten > .02) && (surface.front || pose.flatten < .60);
        surface.mount.scale.setScalar(surface.front ? 1 : Math.max(.02, 1 - pose.flatten * 1.6));
        surface.carrier.position.z = .023 + pose.open * .063 * (1 - pose.flatten);
        surface.faceMaterial.color.copy(baseColor).lerp(selectedColor, Math.min(1, focus * .38 + (hoverLift && piece.index === hoveredPiece ? .3 : 0)));
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
    cubePieces: pieces.length, exteriorPlates, modeledPlates: pieces.reduce((count, piece) => count + piece.surfaces.length, 0), tileCount, activeTiles, fieldMaterials: sharedFieldMaterials.size,
    drawCalls: lastDrawCalls, triangles: lastTriangles,
    frameMs, renderCpuMs: cpuMs, pixelRatio: DPR, adapted, reducedMotion: reduced, width, height, frameNumber,
    scrollRange: document.documentElement.scrollHeight - innerHeight,
    shaderAnimation: 'TSL instanced layered panels / GPU pose, normals and scroll wave; deterministic scroll choreography', threeRevision: THREE.REVISION,
    surface: 'Separate chamfered/notched composite plates, backing rings and support bosses; shallow porcelain relief; mipmapped deterministic grain',
    geometryDetail: 'Hero bevel segments 3/4 at creation; field 2; no virtualized geometry or Nanite implementation',
    environmentLoaded, ambientOcclusion: effects.ambientOcclusion, aoMethod: 'GTAO depth + normal MRT, spatial denoise, no temporal accumulation',
    depthOfField: Boolean(!mobile && effects.depthOfField && currentPose?.macro > .04), bloom: effects.bloom, choreographyDeterministic: true, renderError,
    renderOnDemand: true, idle: !dirty && progress === target && settleFrames === 0,
    variants: { idleSpin, chromaticAberration: fxRgb, hoverLift },
    precompiledPasses, initialLoadMs, startupTimings,
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
  if (onPointerMove) window.addEventListener('pointermove', onPointerMove, { passive: true });
  readScroll(); progress = target;
  const api = {
    destroy() {
      if (destroyed) return; destroyed = true; renderer.setAnimationLoop(null);
      window.removeEventListener('scroll', readScroll); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      if (onPointerMove) window.removeEventListener('pointermove', onPointerMove);
      for (const resource of resources) resource.dispose?.(); resources.clear(); renderer.dispose();
      if (window.__KINETI__?.getDiagnostics === diagnostics) delete window.__KINETI__;
    },
    setReducedMotion(value) { reduced = Boolean(value); dirty = true; },
    goTo(value) { dirty = true; window.scrollTo({ top: clamp(value) * Math.max(1, document.documentElement.scrollHeight - innerHeight), behavior: reduced ? 'instant' : 'smooth' }); },
    setEffects(patch = {}) {
      for (const key of Object.keys(effects)) if (typeof patch[key] === 'boolean') effects[key] = patch[key];
      uAO.value = effects.ambientOcclusion ? .74 : 0; bloomPass.strength.value = effects.bloom ? .055 : 0;
      if (rgbBloomPass) rgbBloomPass.strength.value = bloomPass.strength.value;
      dirty = true;
    },
    getDiagnostics: diagnostics,
    getPoseState: () => ({ cube: { position: cube.position.toArray(), quaternion: cube.quaternion.toArray(), scale: cube.scale.toArray() },
      pieces: pieces.map((piece) => ({ index: piece.index, position: piece.group.position.toArray(), quaternion: piece.group.quaternion.toArray(),
        surfaces: piece.surfaces.map((surface) => ({ glyph: surface.glyph.name, visible: surface.glyph.visible && surface.mount.visible,
          world: surface.glyph.getWorldPosition(new THREE.Vector3()).toArray() })) })), monogramVisible: monogram.visible }),
  };
  window.__KINETI__ = { ...diagnostics(), ...api }; updatePose(progress);
  const render = () => {
    (!mobile && effects.depthOfField && currentPose.macro > .04 ? macroPipeline : (rgbPipeline || renderPipeline)).render();
    lastDrawCalls = renderer.info.render.drawCalls; lastTriangles = renderer.info.render.triangles;
  };
  try {
    cube.visible = true; fieldGroup.visible = true; monogram.visible = true;
    for (const piece of pieces) for (const surface of piece.surfaces) { surface.mount.visible = true; surface.glyph.visible = true; }
    // Compile against the real normal/color MRT and MSAA configuration. A
    // default-framebuffer compile leaves the field shaders cold on WebGL.
    scenePass.setSize(Math.round(width * DPR), Math.round(height * DPR));
    const outputToneMapping = renderer.toneMapping, outputColorSpace = renderer.outputColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const compileStarted = performance.now();
    await scenePass.compileAsync(renderer);
    recordStartup('sceneCompileMs', compileStarted);
    renderer.toneMapping = outputToneMapping; renderer.outputColorSpace = outputColorSpace;
    let warmStarted = performance.now();
    updatePose(.56); (rgbPipeline || renderPipeline).render();
    recordStartup('fieldFirstRenderMs', warmStarted); await new Promise(requestAnimationFrame);
    (rgbPipeline || renderPipeline).render(); await new Promise(requestAnimationFrame);
    if (!mobile && effects.depthOfField) {
      // Allocate and warm the selective-focus chain under the loading state,
      // so its first macro does not compile several full-screen passes during
      // a scroll interaction. The second frame resolves its sized RTT input.
      warmStarted = performance.now();
      updatePose(.74); macroPipeline.render();
      recordStartup('macroFirstRenderMs', warmStarted); await new Promise(requestAnimationFrame);
      macroPipeline.render(); await new Promise(requestAnimationFrame);
    }
    readScroll(); progress = target; updatePose(progress);
    precompiledPasses = true;
    const firstRenderStarted = performance.now();
    render(); recordStartup('heroFirstRenderMs', firstRenderStarted);
    if (query.get('profile') === '1') renderer.setRenderObjectFunction(null);
    initialLoadMs = performance.now() - initializationStarted;
    frameNumber++; onReady({ backend });
  } catch (error) { inRenderError = true; onError(error); api.destroy(); throw error; }
  renderer.setAnimationLoop((timestamp) => {
    if (destroyed || hidden || inRenderError) return;
    const dt = lastTime ? Math.min((timestamp - lastTime) * .001, .08) : 1 / 60; lastTime = timestamp;
    // Scroll drives every visual quantity. Settled scenes need no geometry,
    // uniform, postprocessing or React updates; keep only this cheap scheduler.
    if (hoverDirty) {
      hoverDirty = false;
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = cube.visible && raycaster.intersectObjects(bodyMeshes, false)[0];
      const next = hit ? pieces.findIndex((piece) => piece.body === hit.object) : -1;
      if (next !== hoveredPiece) { hoveredPiece = next; dirty = true; }
    }
    if (!idleSpin && !dirty && progress === target && settleFrames === 0) return;
    if (idleSpin) idleAngle += dt * .06;
    // Newly activated offscreen effects allocate their sized textures on the
    // first frame. One final presentation frame resolves that dependency, then
    // the entire GPU pipeline sleeps again.
    if (dirty || progress !== target) settleFrames = 2;
    dirty = false; frameMs = lerp(frameMs, dt * 1000, .025);
    progress += (target - progress) * (reduced ? 1 : 1 - Math.exp(-dt * 10)); if (Math.abs(progress - target) < .00001) progress = target;
    updatePose(progress); const before = performance.now();
    try { render(); } catch (error) { inRenderError = true; renderError = String(error.stack || error); console.error('Kineti renderer:', error); onError(error); return; }
    cpuMs = lerp(cpuMs, performance.now() - before, .04); frameNumber++; settleFrames = Math.max(0, settleFrames - 1);
    if (frameNumber > 120 && dt > .028 && Math.abs(target - progress) > .001) overBudget++; else overBudget = Math.max(0, overBudget - 1);
    if (overBudget > 50 && DPR > 1 && !adapted) { DPR = 1; adapted = true; renderer.setPixelRatio(DPR); renderer.setSize(width, height, false); dirty = true; }
    const state = diagnostics(); Object.assign(window.__KINETI__, state);
    if (progress !== lastUiProgress && (timestamp - lastUiTime > 30 || progress === target || state.phase !== lastUiPhase)) {
      onProgress({ progress, phase: state.phase, phaseProgress: clamp((progress - BREAKS[state.phase]) / (BREAKS[state.phase + 1] - BREAKS[state.phase])) });
      lastUiTime = timestamp; lastUiProgress = progress; lastUiPhase = state.phase;
    }
  });
  return api;
}
