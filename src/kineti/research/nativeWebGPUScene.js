// Three is used only for CPU geometry authoring and matrix/number arithmetic.
// All GPU resources, WGSL, passes, bindings and submissions below are native WebGPU.
import { DataUtils, Euler, Matrix3, Matrix4, Quaternion, Vector3, WebGPUCoordinateSystem } from 'three/webgpu';
import { createCubeGeometry, createTileGeometry } from '../cubeGeometry.js';
import { createSymbolGeometry } from '../symbols.js';

export const DEFAULT_CONTROLS = Object.freeze({
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [.30, .53, -.045],
  cameraFov: 37, autoFrame: true, roughness: .27, metalness: .08, clearcoat: .46,
  environmentIntensity: .68, keyIntensity: 3.8, exposure: 1.06,
  glyphColor: '#354330', shadows: false, postEffect: 0,
  waveAmplitude: 0, wavePhase: 0, density: 432,
});

const CAMERA_HEIGHT = 7.05;
const CAMERA_Z = CAMERA_HEIGHT / (2 * Math.tan(37 * Math.PI / 360));
const INSTANCE_FLOATS = 32;
const UNIFORM_FLOATS = 96;
const SHADOW_SIZE = 1024;
const HDR_URL = '/hdri/studio_small_09_1k.hdr';
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const linear = (value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
const color = (hex) => [1, 3, 5].map((start) => linear(parseInt(hex.slice(start, start + 2), 16) / 255));

const SCENE_WGSL = /* wgsl */`
struct Scene {
  viewProjection: mat4x4f,
  lightViewProjection: mat4x4f,
  cameraExposure: vec4f,
  material: vec4f,
  key: vec4f,
  fill: vec4f,
  glyphColor: vec4f,
  wave: vec4f,
  viewport: vec4f,
  sh: array<vec4f, 9>,
};
@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var environmentMap: texture_2d<f32>;
@group(0) @binding(2) var environmentSampler: sampler;
@group(0) @binding(3) var shadowMap: texture_depth_2d;
@group(0) @binding(4) var shadowSampler: sampler_comparison;

struct VertexInput {
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) model0: vec4f,
  @location(3) model1: vec4f,
  @location(4) model2: vec4f,
  @location(5) model3: vec4f,
  @location(6) normal0: vec4f,
  @location(7) normal1: vec4f,
  @location(8) normal2: vec4f,
  @location(9) data: vec4f,
};
struct VertexOutput {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) @interpolate(flat) materialId: u32,
};
fn worldPosition(input: VertexInput) -> vec4f {
  let model = mat4x4f(input.model0, input.model1, input.model2, input.model3);
  var world = model * vec4f(input.position, 1.0);
  // Tile and glyph carry the SAME undeformed instance centre; their entire
  // rigid geometry receives the SAME world-space displacement, including shadows.
  world.z += sin(input.data.x * 1.3 + input.data.y * .7 - scene.wave.y) * scene.wave.x * input.data.z;
  return world;
}
@vertex fn vsMain(input: VertexInput) -> VertexOutput {
  let world = worldPosition(input);
  var output: VertexOutput;
  output.clip = scene.viewProjection * world;
  output.world = world.xyz;
  let normalMatrix = mat3x3f(input.normal0.xyz, input.normal1.xyz, input.normal2.xyz);
  output.normal = normalize(normalMatrix * input.normal);
  output.materialId = u32(input.data.w);
  return output;
}
@vertex fn vsShadow(input: VertexInput) -> @builtin(position) vec4f {
  return scene.lightViewProjection * worldPosition(input);
}
const PI: f32 = 3.14159265359;
fn fresnel(f0: vec3f, cosine: f32) -> vec3f {
  return f0 + (vec3f(1.0) - f0) * pow(1.0 - clamp(cosine, 0.0, 1.0), 5.0);
}
fn distributionGGX(ndh: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, .000001);
}
fn visibilitySmithGGX(ndv: f32, ndl: f32, roughness: f32) -> f32 {
  let a2 = pow(roughness, 4.0);
  let gv = ndl * sqrt(ndv * ndv * (1.0 - a2) + a2);
  let gl = ndv * sqrt(ndl * ndl * (1.0 - a2) + a2);
  return .5 / max(gv + gl, .00001);
}
fn directBRDF(n: vec3f, v: vec3f, l: vec3f, base: vec3f, rough: f32, metal: f32, coat: f32) -> vec3f {
  let h = normalize(v + l);
  let ndl = max(dot(n, l), 0.0);
  let ndv = max(dot(n, v), .0001);
  let ndh = max(dot(n, h), 0.0);
  let vdh = max(dot(v, h), 0.0);
  let f = fresnel(mix(vec3f(.04), base, metal), vdh);
  let specular = f * distributionGGX(ndh, rough) * visibilitySmithGGX(ndv, ndl, rough);
  let diffuse = (vec3f(1.0) - f) * (1.0 - metal) * base / PI;
  let coatF = fresnel(vec3f(.04), vdh).x;
  let coatLobe = coat * coatF * distributionGGX(ndh, .26) * visibilitySmithGGX(ndv, ndl, .26);
  return ((diffuse + specular) * (1.0 - coat * coatF) + vec3f(coatLobe)) * ndl;
}
fn environmentDirection(direction: vec3f) -> vec3f {
  // The fixture uses a Y rotation of 0.4 radians for the HDR environment.
  return vec3f(cos(.4) * direction.x + sin(.4) * direction.z, direction.y,
    -sin(.4) * direction.x + cos(.4) * direction.z);
}
fn environmentUV(direction: vec3f) -> vec2f {
  return vec2f(atan2(direction.z, direction.x) / (2.0 * PI) + .5,
    acos(clamp(direction.y, -1.0, 1.0)) / PI);
}
fn reflectionRadiance(direction: vec3f, roughness: f32) -> vec3f {
  return textureSampleLevel(environmentMap, environmentSampler, environmentUV(environmentDirection(direction)), roughness * scene.wave.w).rgb;
}
fn diffuseRadiance(direction: vec3f) -> vec3f {
  let n = environmentDirection(direction);
  // Real RGB spherical harmonics integrated from HDR texels on the CPU;
  // convolution coefficients already include the Lambert 1/PI normalization.
  let basis = array<f32, 9>(.282095, .488603*n.y, .488603*n.z, .488603*n.x,
    1.092548*n.x*n.y, 1.092548*n.y*n.z, .315392*(3.0*n.z*n.z-1.0),
    1.092548*n.x*n.z, .546274*(n.x*n.x-n.y*n.y));
  var result = vec3f(0.0);
  for (var i = 0u; i < 9u; i++) { result += scene.sh[i].rgb * basis[i]; }
  return max(result, vec3f(0.0));
}
fn environmentBRDF(ndv: f32, roughness: f32, f0: vec3f) -> vec3f {
  // Analytic split-sum BRDF approximation; the radiance itself is GGX filtered.
  let r = roughness * vec4f(-1.0, -.0275, -.572, .022) + vec4f(1.0, .0425, 1.04, -.04);
  let a004 = min(r.x * r.x, exp2(-9.28 * ndv)) * r.x + r.y;
  let ab = vec2f(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + vec3f(ab.y);
}
fn keyVisibility(world: vec3f, normal: vec3f) -> f32 {
  if (scene.glyphColor.w < .5) { return 1.0; }
  let clip = scene.lightViewProjection * vec4f(world + normal * .035, 1.0);
  let projected = clip.xyz / clip.w;
  let uv = projected.xy * vec2f(.5, -.5) + vec2f(.5);
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0)) || projected.z < 0.0 || projected.z > 1.0) { return 1.0; }
  var visibility = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      visibility += textureSampleCompareLevel(shadowMap, shadowSampler, uv + vec2f(f32(x), f32(y))/1024.0, projected.z - .00015);
    }
  }
  return visibility / 9.0;
}
fn aces(color: vec3f) -> vec3f {
  // ACES fitted curve, intentionally not claimed to match an engine's full
  // color-management implementation or its exposure calibration.
  return clamp((color * (2.51 * color + vec3f(.03))) /
    (color * (2.43 * color + vec3f(.59)) + vec3f(.14)), vec3f(0.0), vec3f(1.0));
}
fn linearToSRGB(value: vec3f) -> vec3f {
  return select(1.055 * pow(max(value, vec3f(0.0)), vec3f(1.0/2.4)) - vec3f(.055),
    12.92 * value, value <= vec3f(.0031308));
}
@fragment fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let n = normalize(input.normal);
  let v = normalize(scene.cameraExposure.xyz - input.world);
  let ink = input.materialId == 1u;
  let floor = input.materialId == 2u;
  var base = vec3f(.8148466, .8307699, .7156935);
  var rough = scene.material.x;
  var metal = scene.material.y;
  var coat = scene.material.z;
  if (ink) { base = scene.glyphColor.rgb; rough = .35; metal = .18; coat = .2; }
  if (floor) { base = vec3f(.0091341, .0144438, .0074990); rough = .9; metal = 0.0; coat = 0.0; }
  let keyColor = vec3f(1.0, .9046612, .7156935);
  let fillColor = vec3f(.7758222, .8227858, 1.0);
  var lighting = directBRDF(n, v, scene.key.xyz, base, rough, metal, coat) * keyColor * scene.key.w * keyVisibility(input.world, n);
  lighting += directBRDF(n, v, scene.fill.xyz, base, rough, metal, coat) * fillColor * scene.fill.w;
  let hemisphere = mix(vec3f(.0998987, .1195384, .0666259), vec3f(.8387990, .8962694, .7156935), .5 * n.y + .5) * 1.25;
  lighting += hemisphere * base * (1.0 - metal) / PI;
  let ndv = max(dot(n, v), .0001);
  let reflection = reflect(-v, n);
  let f0 = mix(vec3f(.04), base, metal);
  let coatF = fresnel(vec3f(.04), ndv).x;
  let diffuse = diffuseRadiance(n) * base * (1.0 - metal) * (vec3f(1.0) - fresnel(f0, ndv));
  let specular = reflectionRadiance(reflection, rough) * environmentBRDF(ndv, rough, f0);
  let coatReflection = reflectionRadiance(reflection, .26) * environmentBRDF(ndv, .26, vec3f(.04)) * coat;
  lighting += ((diffuse + specular) * (1.0 - coat * coatF) + coatReflection) * scene.material.w;
  return vec4f(linearToSRGB(aces(max(lighting, vec3f(0.0)) * scene.cameraExposure.w)), 1.0);
}
`;

const PREFILTER_WGSL = /* wgsl */`
struct Filter { roughness: f32, width: u32, height: u32, samples: u32 };
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
@group(0) @binding(2) var destination: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var<uniform> settings: Filter;
const PI: f32 = 3.14159265359;
fn radicalInverse(index: u32) -> f32 {
  return f32(reverseBits(index)) * 2.3283064365386963e-10;
}
fn uvFor(direction: vec3f) -> vec2f {
  return vec2f(atan2(direction.z, direction.x)/(2.0*PI)+.5, acos(clamp(direction.y,-1.0,1.0))/PI);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= settings.width || id.y >= settings.height) { return; }
  let uv = (vec2f(id.xy) + vec2f(.5)) / vec2f(f32(settings.width), f32(settings.height));
  let phi = (uv.x - .5) * 2.0 * PI;
  let theta = uv.y * PI;
  let n = vec3f(cos(phi)*sin(theta), cos(theta), sin(phi)*sin(theta));
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(n.y) > .999);
  let tangent = normalize(cross(up, n));
  let bitangent = cross(n, tangent);
  let a = settings.roughness * settings.roughness;
  var sum = vec3f(0.0);
  var weight = 0.0;
  for (var i = 0u; i < settings.samples; i++) {
    let xi = vec2f(f32(i)/f32(settings.samples), radicalInverse(i));
    let angle = 2.0 * PI * xi.x;
    let cosine = sqrt((1.0-xi.y)/(1.0+(a*a-1.0)*xi.y));
    let sine = sqrt(max(0.0, 1.0-cosine*cosine));
    let h = normalize(tangent*cos(angle)*sine + bitangent*sin(angle)*sine + n*cosine);
    let l = normalize(2.0*dot(n,h)*h-n);
    let ndl = max(dot(n,l), 0.0);
    sum += textureSampleLevel(source, sourceSampler, uvFor(l), 0.0).rgb * ndl;
    weight += ndl;
  }
  textureStore(destination, vec2i(id.xy), vec4f(sum/max(weight,.00001),1.0));
}
`;

const POST_WGSL = /* wgsl */`
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var imageSampler: sampler;
@group(0) @binding(2) var<uniform> parameters: vec4f;
struct Vertex { @builtin(position) clip: vec4f, @location(0) uv: vec2f };
@vertex fn vertex(@builtin(vertex_index) index: u32) -> Vertex {
  let positions = array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));
  let position = positions[index];
  var result: Vertex;
  result.clip = vec4f(position,0.0,1.0);
  result.uv = position*vec2f(.5,-.5)+vec2f(.5);
  return result;
}
@fragment fn fragment(input: Vertex) -> @location(0) vec4f {
  let offset = vec2f(parameters.x*.012,0.0);
  let r = textureSample(image,imageSampler,input.uv+offset).r;
  let g = textureSample(image,imageSampler,input.uv).g;
  let b = textureSample(image,imageSampler,input.uv-offset).b;
  return vec4f(clamp((vec3f(r,g,b)-vec3f(.5))*(1.0+parameters.x*.18)+vec3f(.5),vec3f(0.0),vec3f(1.0)),1.0);
}
`;

// The local fixture is a Radiance RGBE file with scanline RLE (-Y, +X).
// Unsupported encodings fail explicitly; no LDR surrogate is substituted.
function decodeRadiance(buffer) {
  const bytes = new Uint8Array(buffer);
  let cursor = 0;
  const line = () => {
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 10) cursor++;
    return new TextDecoder().decode(bytes.subarray(start, cursor++)).replace(/\r$/, '');
  };
  if (!/^#\?(RADIANCE|RGBE)/.test(line())) throw new Error('Invalid Radiance HDR header.');
  let header = '', format = false;
  while ((header = line()) !== '') {
    if (header === 'FORMAT=32-bit_rle_rgbe') format = true;
    if (cursor >= bytes.length) throw new Error('Truncated HDR header.');
  }
  if (!format) throw new Error('Unsupported HDR encoding; expected 32-bit_rle_rgbe.');
  const resolution = /^-Y (\d+) \+X (\d+)$/.exec(line());
  if (!resolution) throw new Error('Unsupported HDR orientation; expected -Y +X.');
  const height = Number(resolution[1]), width = Number(resolution[2]);
  const data = new Float32Array(width * height * 4);
  const scanline = new Uint8Array(width * 4);
  for (let y = 0; y < height; y++) {
    if (bytes[cursor++] !== 2 || bytes[cursor++] !== 2 || ((bytes[cursor++] << 8) | bytes[cursor++]) !== width) {
      throw new Error('Unsupported or malformed HDR scanline encoding.');
    }
    for (let channel = 0; channel < 4; channel++) {
      let x = 0;
      while (x < width) {
        const code = bytes[cursor++];
        if (!code || cursor >= bytes.length) throw new Error('Truncated HDR scanline.');
        const count = code > 128 ? code - 128 : code;
        if (x + count > width) throw new Error('Invalid HDR RLE run.');
        if (code > 128) { scanline.fill(bytes[cursor++], channel * width + x, channel * width + x + count); }
        else { scanline.set(bytes.subarray(cursor, cursor + count), channel * width + x); cursor += count; }
        x += count;
      }
    }
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const exponent = scanline[3 * width + x];
      // Keep the same RGBE radiance scaling as the fixture's Three HDRLoader
      // (255 denominator). RLE decoding and GPU upload remain independent.
      const multiplier = exponent ? 2 ** (exponent - 128) / 255 : 0;
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = scanline[channel * width + x] * multiplier;
      data[offset + 3] = 1;
    }
  }
  return { width, height, data };
}

function sphericalHarmonics({ width, height, data }) {
  const sh = new Float32Array(36);
  let totalWeight = 0;
  // One radiance sample per 4x4 texel cell, solid-angle weighted. The stride is
  // explicit so this is not represented as an exact full-resolution integral.
  for (let py = 2; py < height; py += 4) for (let px = 2; px < width; px += 4) {
    const theta = (py + .5) / height * Math.PI;
    const phi = ((px + .5) / width - .5) * Math.PI * 2;
    const weight = Math.sin(theta), x = Math.cos(phi) * weight, y = Math.cos(theta), z = Math.sin(phi) * weight;
    const basis = [.282095, .488603*y, .488603*z, .488603*x, 1.092548*x*y,
      1.092548*y*z, .315392*(3*z*z-1), 1.092548*x*z, .546274*(x*x-y*y)];
    const offset = (py * width + px) * 4;
    for (let i = 0; i < 9; i++) for (let channel = 0; channel < 3; channel++) {
      sh[i * 4 + channel] += data[offset + channel] * basis[i] * weight;
    }
    totalWeight += weight;
  }
  for (let i = 0; i < 9; i++) for (let channel = 0; channel < 3; channel++) {
    sh[i * 4 + channel] *= 4 * Math.PI / totalWeight * (i === 0 ? 1 : i <= 3 ? 2 / 3 : 1 / 4);
  }
  return sh;
}

function matrix(position = [0, 0, 0], rotation = [0, 0, 0], scale = 1) {
  return new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation, 'XYZ')),
    new Vector3(scale, scale, scale));
}

export async function createNativeWebGPUComparison(canvas) {
  if (!navigator.gpu) throw new Error('WebGPU directo no está disponible: navigator.gpu ausente. Requiere navegador compatible y contexto seguro.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('WebGPU directo: el navegador no proporcionó un GPUAdapter.');
  const timestampSupported = adapter.features.has('timestamp-query');
  const device = await adapter.requestDevice({ label: 'Kineti raw GPUDevice', requiredFeatures: timestampSupported ? ['timestamp-query'] : [] });
  const context = canvas.getContext('webgpu');
  if (!context) { device.destroy(); throw new Error('No se pudo crear GPUCanvasContext.'); }
  const format = navigator.gpu.getPreferredCanvasFormat();
  const resources = new Set();
  const track = (resource) => { resources.add(resource); return resource; };
  const release = (resource) => { resource?.destroy(); resources.delete(resource); };
  let disposed = false, frameRequest = 0, controls = structuredClone(DEFAULT_CONTROLS), progress = 0;
  let frames = 0, previous = null, intervals = [], lastFrame = null, width = 0, height = 0;
  let matrixRevision = 0, heroMatrixRevision = 0, instanceBytesUploaded = 0, uniformsDirty = true;
  let colorMSAA, depthMSAA, sceneColor, postBindGroup;
  const errors = [];
  device.addEventListener('uncapturederror', (event) => { errors.push(String(event.error)); console.error('Kineti native WebGPU:', event.error); });
  device.lost.then((info) => {
    if (!disposed) { errors.push(`GPUDevice lost: ${info.reason}: ${info.message}`); cancelAnimationFrame(frameRequest); }
  });
  context.configure({ device, format, alphaMode: 'opaque', colorSpace: 'srgb' });
  const makeBuffer = (label, data, usage) => {
    const buffer = track(device.createBuffer({ label, size: Math.max(4, (data.byteLength + 3) & ~3), usage, mappedAtCreation: true }));
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    buffer.unmap();
    return buffer;
  };
  const shader = async (label, code) => {
    const module = device.createShaderModule({ label, code });
    const info = await module.getCompilationInfo();
    const failures = info.messages.filter((message) => message.type === 'error');
    if (failures.length) throw new Error(`${label}: ${failures.map((message) => `${message.lineNum}:${message.linePos} ${message.message}`).join('\n')}`);
    return module;
  };
  const uniformData = new Float32Array(UNIFORM_FLOATS);
  const uniformBuffer = makeBuffer('Scene uniforms / no per-instance wave uploads', uniformData, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  const postUniform = makeBuffer('Optional RGB post strength', new Float32Array(4), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
  const linearSampler = device.createSampler({ label: 'HDR equirect sampler', minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' });
  const shadowSampler = device.createSampler({ label: 'PCF comparison sampler', compare: 'less-equal', minFilter: 'linear', magFilter: 'linear' });
  const shadowTexture = track(device.createTexture({ label: 'Directional PCF depth', size: [SHADOW_SIZE, SHADOW_SIZE], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
  const shadowView = shadowTexture.createView();
  let environmentTexture, sh = new Float32Array(36);
  const environment = { url: HDR_URL, status: 'pending', width: 0, height: 0, mipLevels: 1,
    specular: 'Native WGSL GGX importance sampling, 128 samples per texel per roughness mip; analytic split-sum BRDF',
    diffuse: '9 RGB spherical harmonics, HDR sample stride 4, solid-angle weighted Lambert convolution' };

  async function loadEnvironment() {
    try {
      const response = await fetch(HDR_URL);
      if (!response.ok) throw new Error(`HDR HTTP ${response.status}`);
      const hdr = decodeRadiance(await response.arrayBuffer());
      sh = sphericalHarmonics(hdr);
      const half = new Uint16Array(hdr.data.length);
      for (let i = 0; i < half.length; i++) half[i] = DataUtils.toHalfFloat(Math.min(65504, hdr.data[i]));
      const mipLevels = Math.floor(Math.log2(Math.max(hdr.width, hdr.height))) + 1;
      const source = track(device.createTexture({ label: 'Decoded HDR RGBA16F source', size: [hdr.width, hdr.height], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }));
      environmentTexture = track(device.createTexture({ label: 'GGX filtered HDR roughness mip chain', size: [hdr.width, hdr.height], mipLevelCount: mipLevels, format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST }));
      for (const texture of [source, environmentTexture]) device.queue.writeTexture({ texture }, half, { bytesPerRow: hdr.width * 8 }, [hdr.width, hdr.height]);
      const module = await shader('Native HDR GGX prefilter WGSL', PREFILTER_WGSL);
      const layout = device.createBindGroupLayout({ label: 'Explicit HDR compute bindings', entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', minBindingSize: 16 } },
      ] });
      const pipeline = await device.createComputePipelineAsync({ label: 'Native GGX HDR filtering', layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module, entryPoint: 'main' } });
      const encoder = device.createCommandEncoder({ label: 'HDR prefilter command encoder' });
      const parameterBuffers = [];
      for (let level = 1; level < mipLevels; level++) {
        const mipWidth = Math.max(1, hdr.width >> level), mipHeight = Math.max(1, hdr.height >> level);
        const bytes = new ArrayBuffer(16), floats = new Float32Array(bytes), integers = new Uint32Array(bytes);
        floats[0] = level / (mipLevels - 1); integers[1] = mipWidth; integers[2] = mipHeight; integers[3] = 128;
        const parameters = makeBuffer(`GGX mip ${level} parameters`, new Uint8Array(bytes), GPUBufferUsage.UNIFORM);
        parameterBuffers.push(parameters);
        const bindGroup = device.createBindGroup({ layout, entries: [
          { binding: 0, resource: source.createView() }, { binding: 1, resource: linearSampler },
          { binding: 2, resource: environmentTexture.createView({ baseMipLevel: level, mipLevelCount: 1 }) },
          { binding: 3, resource: { buffer: parameters } },
        ] });
        const pass = encoder.beginComputePass({ label: `GGX mip ${level}, roughness ${floats[0]}` });
        pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(Math.ceil(mipWidth / 8), Math.ceil(mipHeight / 8)); pass.end();
      }
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      release(source); parameterBuffers.forEach(release);
      Object.assign(environment, { status: 'loaded', width: hdr.width, height: hdr.height, mipLevels });
    } catch (error) {
      if (environmentTexture) release(environmentTexture);
      environmentTexture = track(device.createTexture({ label: 'Explicit unavailable HDR black texture', size: [1, 1], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }));
      device.queue.writeTexture({ texture: environmentTexture }, new Uint16Array([0, 0, 0, 0x3c00]), { bytesPerRow: 8 }, [1, 1]);
      sh.fill(0);
      environment.status = 'failed'; environment.error = String(error);
      console.warn('Kineti native HDR unavailable:', error);
    }
  }

  function uploadGeometry(geometry) {
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    const vertices = new Float32Array(positions.count * 6);
    for (let i = 0; i < positions.count; i++) {
      vertices.set([positions.getX(i), positions.getY(i), positions.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)], i * 6);
    }
    const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: positions.count }, (_, index) => index);
    const result = { label: geometry.name, vertex: makeBuffer(`${geometry.name} positions + creased/bevel normals`, vertices, GPUBufferUsage.VERTEX),
      index: makeBuffer(`${geometry.name} triangle indices`, indices, GPUBufferUsage.INDEX), indexCount: indices.length, vertexCount: positions.count };
    geometry.dispose();
    return result;
  }
  function batch(geometry, count, label) {
    return { geometry, count, label, data: new Float32Array(count * INSTANCE_FLOATS),
      instances: track(device.createBuffer({ label, size: Math.max(INSTANCE_FLOATS * 4, count * INSTANCE_FLOATS * 4), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })) };
  }
  function writeInstance(destination, slot, model, meta) {
    const offset = slot * INSTANCE_FLOATS;
    destination.set(model.elements, offset);
    const normal = new Matrix3().getNormalMatrix(model).elements;
    for (let column = 0; column < 3; column++) destination.set(normal.slice(column * 3, column * 3 + 3), offset + 16 + column * 4);
    destination.set(meta, offset + 28);
  }
  function submitInstances(owner) {
    device.queue.writeBuffer(owner.instances, 0, owner.data);
    instanceBytesUploaded += owner.data.byteLength;
  }
  const heroMatrix = new Matrix4(), piecePositions = [], pieceCoordinates = [], heroGlyphRecords = Array.from({ length: 6 }, () => []);
  const faces = [[0, 1, 0, Math.PI / 2, 0], [0, -1, 0, -Math.PI / 2, 0],
    [1, 1, -Math.PI / 2, 0, 0], [1, -1, Math.PI / 2, 0, 0], [2, 1, 0, 0, 0], [2, -1, 0, Math.PI, 0]];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const piece = pieceCoordinates.length, coordinates = [x, y, z];
    pieceCoordinates.push(coordinates); piecePositions.push(new Vector3());
    for (const [axis, sign, rx, ry, rz] of faces) if (coordinates[axis] === sign) {
      const translation = [0, 0, 0]; translation[axis] = sign * .4305;
      heroGlyphRecords[piece % 6].push({ piece, face: matrix(translation, [rx, ry, rz]) });
    }
  }
  let heroBatches = [], fieldBatches = [], floorBatch, tileGeometry, fieldGlyphGeometry;
  function updateHero() {
    const t = clamp((progress - .28) / .20), amount = t * t * (3 - 2 * t);
    heroMatrix.copy(matrix([1.7 * (1 - amount), .1, 0], controls.rotation.map((v) => v * (1 - amount)), 1.08));
    const pieceMatrices = pieceCoordinates.map((coordinates, index) => {
      const position = piecePositions[index].set(...coordinates).multiplyScalar(.96 + .75 * controls.explode);
      if (index === controls.selectedPiece) position.y += controls.pieceOffset;
      const world = heroMatrix.clone().multiply(new Matrix4().makeTranslation(...position.toArray()));
      writeInstance(heroBatches[0].data, index, world, [0, 0, 0, 0]);
      return world;
    });
    heroGlyphRecords.forEach((records, family) => {
      records.forEach((record, index) => writeInstance(heroBatches[family + 1].data, index,
        pieceMatrices[record.piece].clone().multiply(record.face), [0, 0, 0, 1]));
    });
    heroBatches.forEach(submitInstances); heroMatrixRevision++;
  }
  function updateField() {
    fieldBatches.forEach((owner) => release(owner.instances)); fieldBatches = [];
    const columns = controls.density === 162 ? 9 : 24, rows = 18;
    const unit = Math.max(CAMERA_HEIGHT * width / height / columns, CAMERA_HEIGHT / rows) * 1.06;
    const scale = unit / .86 * .91;
    for (let family = 0; family < 6; family++) {
      const indices = Array.from({ length: controls.density }, (_, index) => index).filter((index) => ((index * 7) % 27) % 6 === family);
      for (const glyph of [false, true]) {
        const owner = batch(glyph ? fieldGlyphGeometry[family] : tileGeometry, indices.length, `Field ${family} ${glyph ? 'glyphs' : 'tiles'} instance matrices`);
        indices.forEach((index, slot) => {
          const x = (index % columns - (columns - 1) / 2) * unit;
          const y = ((rows - 1) / 2 - Math.floor(index / columns)) * unit;
          writeInstance(owner.data, slot, matrix([x, y, -.1], [0, 0, 0], scale), [x, y, 1, glyph ? 1 : 0]);
        });
        submitInstances(owner); fieldBatches.push(owner);
      }
    }
    matrixRevision++;
  }
  let scenePipeline, shadowPipeline, postPipeline, sceneBindGroup, shadowBindGroup, postLayout;
  const keyDirection = new Vector3(-3, 7, 9).normalize(), fillDirection = new Vector3(5, .5, 6).normalize();
  const lightEye = new Vector3(-3, 7, 9);
  const lightView = new Matrix4().lookAt(lightEye, new Vector3(), new Vector3(0, 1, 0)).setPosition(lightEye).invert();
  const lightVP = new Matrix4().makeOrthographic(-7, 7, 7, -7, .1, 30, WebGPUCoordinateSystem).multiply(lightView);

  async function initialize() {
    await loadEnvironment();
    const module = await shader('Kineti native scene WGSL', SCENE_WGSL);
    const postModule = await shader('Kineti native RGB post WGSL', POST_WGSL);
    const vertexBuffers = [
      { arrayStride: 24, stepMode: 'vertex', attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }] },
      { arrayStride: INSTANCE_FLOATS * 4, stepMode: 'instance', attributes: Array.from({ length: 8 }, (_, index) => ({ shaderLocation: 2 + index, offset: index * 16, format: 'float32x4' })) },
    ];
    const sceneLayout = device.createBindGroupLayout({ label: 'Explicit camera + PBR + HDR + PCF bindings', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', minBindingSize: UNIFORM_FLOATS * 4 } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
    ] });
    sceneBindGroup = device.createBindGroup({ layout: sceneLayout, entries: [
      { binding: 0, resource: { buffer: uniformBuffer } }, { binding: 1, resource: environmentTexture.createView() },
      { binding: 2, resource: linearSampler }, { binding: 3, resource: shadowView }, { binding: 4, resource: shadowSampler },
    ] });
    // A separate shadow layout avoids binding a depth texture while writing it.
    const shadowLayout = device.createBindGroupLayout({ label: 'Shadow vertex-only uniform layout', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform', minBindingSize: UNIFORM_FLOATS * 4 } },
    ] });
    shadowBindGroup = device.createBindGroup({ layout: shadowLayout, entries: [{ binding: 0, resource: { buffer: uniformBuffer } }] });
    scenePipeline = await device.createRenderPipelineAsync({ label: 'Native GGX ceramic / glyphs / floor', layout: device.createPipelineLayout({ bindGroupLayouts: [sceneLayout] }),
      vertex: { module, entryPoint: 'vsMain', buffers: vertexBuffers }, fragment: { module, entryPoint: 'fsMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'back' }, depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' }, multisample: { count: 4 } });
    shadowPipeline = await device.createRenderPipelineAsync({ label: 'Native PCF shadow caster', layout: device.createPipelineLayout({ bindGroupLayouts: [shadowLayout] }),
      vertex: { module, entryPoint: 'vsShadow', buffers: vertexBuffers }, primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'back' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2 } });
    postLayout = device.createBindGroupLayout({ label: 'Optional screen pass layout', entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', minBindingSize: 16 } },
    ] });
    postPipeline = await device.createRenderPipelineAsync({ label: 'Native RGB separation and contrast', layout: device.createPipelineLayout({ bindGroupLayouts: [postLayout] }),
      vertex: { module: postModule, entryPoint: 'vertex' }, fragment: { module: postModule, entryPoint: 'fragment', targets: [{ format }] } });
    heroBatches = [batch(uploadGeometry(createCubeGeometry()), 27, '27 cubie transforms')];
    heroGlyphRecords.forEach((records, family) => heroBatches.push(batch(uploadGeometry(createSymbolGeometry(family, .43)), records.length, `Hero glyph family ${family} transforms`)));
    tileGeometry = uploadGeometry(createTileGeometry(.78, .15, .055));
    fieldGlyphGeometry = Array.from({ length: 6 }, (_, family) => {
      const geometry = createSymbolGeometry(family, .40); geometry.translate(0, 0, .077); return uploadGeometry(geometry);
    });
    const floorVertices = new Float32Array([-25, -2.1, -25, 0, 1, 0, -25, -2.1, 25, 0, 1, 0, 25, -2.1, 25, 0, 1, 0, 25, -2.1, -25, 0, 1, 0]);
    floorBatch = batch({ vertex: makeBuffer('Floor vertices and upward normals', floorVertices, GPUBufferUsage.VERTEX),
      index: makeBuffer('Floor triangle indices', new Uint32Array([0, 1, 2, 0, 2, 3]), GPUBufferUsage.INDEX), indexCount: 6, vertexCount: 4 }, 1, 'Floor instance');
    writeInstance(floorBatch.data, 0, new Matrix4(), [0, 0, 0, 2]); submitInstances(floorBatch);
    resize(); updateHero(); updateUniforms();
  }
  function resize() {
    const nextWidth = Math.max(1, Math.round(canvas.clientWidth || innerWidth));
    const nextHeight = Math.max(1, Math.round(canvas.clientHeight || innerHeight));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight; canvas.width = width; canvas.height = height;
    [colorMSAA, depthMSAA, sceneColor].forEach((resource) => { if (resource) release(resource); });
    colorMSAA = track(device.createTexture({ label: '4x MSAA scene color', size: [width, height], sampleCount: 4, format, usage: GPUTextureUsage.RENDER_ATTACHMENT }));
    depthMSAA = track(device.createTexture({ label: '4x MSAA scene depth', size: [width, height], sampleCount: 4, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT }));
    sceneColor = track(device.createTexture({ label: 'Optional post input', size: [width, height], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }));
    postBindGroup = device.createBindGroup({ layout: postLayout, entries: [{ binding: 0, resource: sceneColor.createView() },
      { binding: 1, resource: device.createSampler({ minFilter: 'linear', magFilter: 'linear' }) }, { binding: 2, resource: { buffer: postUniform } }] });
    updateField(); uniformsDirty = true;
  }
  function updateUniforms() {
    const near = .1, top = near * Math.tan(controls.cameraFov * Math.PI / 360), right = top * width / height;
    const cameraZ = CAMERA_Z * (controls.autoFrame ? 1 + controls.explode * .55 : 1);
    const projection = new Matrix4().makePerspective(-right, right, top, -top, near, 60, WebGPUCoordinateSystem);
    projection.multiply(new Matrix4().makeTranslation(0, 0, -cameraZ));
    uniformData.set(projection.elements, 0); uniformData.set(lightVP.elements, 16);
    uniformData.set([0, 0, cameraZ, controls.exposure], 32);
    uniformData.set([controls.roughness, controls.metalness, controls.clearcoat, controls.environmentIntensity], 36);
    uniformData.set([...keyDirection.toArray(), controls.keyIntensity], 40);
    uniformData.set([...fillDirection.toArray(), .9], 44);
    uniformData.set([...color(controls.glyphColor), controls.shadows ? 1 : 0], 48);
    uniformData.set([controls.waveAmplitude, controls.wavePhase, controls.postEffect, environment.mipLevels - 1], 52);
    uniformData.set([width, height, environment.status === 'loaded' ? 1 : 0, 0], 56);
    uniformData.set(sh, 60);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeBuffer(postUniform, 0, new Float32Array([controls.postEffect, 0, 0, 0]));
    uniformsDirty = false;
  }
  function setProgress(value) {
    const next = clamp(Number.isFinite(Number(value)) ? Number(value) : 0);
    if (next === progress) return;
    progress = next; updateHero(); intervals = []; previous = null;
  }
  function getControls() { return structuredClone(controls); }
  function setControls(patch = {}) {
    const prior = getControls();
    const ranges = { explode: [0, 1], pieceOffset: [-1, 1], cameraFov: [25, 60], roughness: [.05, 1], metalness: [0, 1],
      clearcoat: [0, 1], environmentIntensity: [0, 2], keyIntensity: [0, 6], exposure: [.5, 2], postEffect: [0, 1], waveAmplitude: [0, .8], wavePhase: [0, Math.PI * 2] };
    for (const [name, [min, max]] of Object.entries(ranges)) if (patch[name] !== undefined && Number.isFinite(Number(patch[name]))) controls[name] = clamp(Number(patch[name]), min, max);
    if (patch.selectedPiece !== undefined && Number.isFinite(Number(patch.selectedPiece))) controls.selectedPiece = clamp(Math.round(Number(patch.selectedPiece)), 0, 26);
    if (Array.isArray(patch.rotation) && patch.rotation.length === 3 && patch.rotation.every(Number.isFinite)) controls.rotation = [...patch.rotation];
    if (typeof patch.glyphColor === 'string' && /^#[0-9a-f]{6}$/i.test(patch.glyphColor)) controls.glyphColor = patch.glyphColor;
    if (typeof patch.shadows === 'boolean') controls.shadows = patch.shadows;
    if (typeof patch.autoFrame === 'boolean') controls.autoFrame = patch.autoFrame;
    if ([162, 432].includes(Number(patch.density))) controls.density = Number(patch.density);
    if (prior.density !== controls.density) updateField();
    if (['explode', 'pieceOffset', 'selectedPiece'].some((name) => prior[name] !== controls[name]) || prior.rotation.some((value, index) => value !== controls.rotation[index])) updateHero();
    uniformsDirty = true; intervals = []; previous = null;
    return getControls();
  }
  function getProbeState() {
    const describe = (index) => ({ index, local: piecePositions[index].toArray(), world: piecePositions[index].clone().applyMatrix4(heroMatrix).toArray() });
    return { selected: describe(controls.selectedPiece), other: describe((controls.selectedPiece + 1) % 27),
      cameraFov: controls.cameraFov, material: { roughness: controls.roughness, metalness: controls.metalness, clearcoat: controls.clearcoat },
      density: fieldBatches.filter((_, index) => index % 2 === 0).reduce((sum, owner) => sum + owner.count, 0), shadowEnabled: controls.shadows,
      instanceMatrixVersion: matrixRevision, heroMatrixVersion: heroMatrixRevision, instanceBytesUploaded,
      gpuWave: { amplitude: controls.waveAmplitude, phase: controls.wavePhase, path: 'Own WGSL vertex shader; shared per-instance world centre; uniform-only changes; same displacement in shadow caster' },
      postEffect: controls.postEffect, exposure: controls.exposure, normals: 'Per-instance inverse-transpose 3x3; normalized per fragment',
      alphaMode: 'opaque', clearcoatRoughness: .26 };
  }
  function draw(pass, batches, counts, kind) {
    for (const owner of batches) {
      pass.setVertexBuffer(0, owner.geometry.vertex); pass.setVertexBuffer(1, owner.instances);
      pass.setIndexBuffer(owner.geometry.index, 'uint32'); pass.drawIndexed(owner.geometry.indexCount, owner.count);
      counts.drawCalls++; counts.submittedTriangles += owner.geometry.indexCount * owner.count / 3;
      counts[`${kind}DrawCalls`]++;
    }
  }
  function render(time) {
    if (disposed) return;
    if (previous !== null) { intervals.push(time - previous); if (intervals.length > 240) intervals.shift(); }
    previous = time;
    const cpuStart = performance.now();
    if (uniformsDirty) updateUniforms();
    const counts = { drawCalls: 0, submittedTriangles: 0, sceneDrawCalls: 0, shadowDrawCalls: 0, postDrawCalls: 0 };
    const batches = progress < .49 ? heroBatches : fieldBatches;
    const encoder = device.createCommandEncoder({ label: `Kineti native frame ${frames}` });
    if (controls.shadows) {
      const pass = encoder.beginRenderPass({ label: 'Directional shadow depth / same GPU wave', colorAttachments: [],
        depthStencilAttachment: { view: shadowView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
      pass.setPipeline(shadowPipeline); pass.setBindGroup(0, shadowBindGroup); draw(pass, batches, counts, 'shadow'); pass.end();
    }
    const canvasView = context.getCurrentTexture().createView();
    const scenePass = encoder.beginRenderPass({ label: 'PBR opaque scene / explicit color and depth clears',
      colorAttachments: [{ view: colorMSAA.createView(), resolveTarget: controls.postEffect > 0 ? sceneColor.createView() : canvasView,
        clearValue: { r: 16 / 255, g: 19 / 255, b: 15 / 255, a: 1 }, loadOp: 'clear', storeOp: 'discard' }],
      depthStencilAttachment: { view: depthMSAA.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' } });
    scenePass.setPipeline(scenePipeline); scenePass.setBindGroup(0, sceneBindGroup);
    draw(scenePass, batches, counts, 'scene');
    if (controls.shadows && progress < .49) draw(scenePass, [floorBatch], counts, 'scene');
    scenePass.end();
    if (controls.postEffect > 0) {
      const pass = encoder.beginRenderPass({ label: 'Optional RGB separation + contrast', colorAttachments: [{ view: canvasView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      pass.setPipeline(postPipeline); pass.setBindGroup(0, postBindGroup); pass.draw(3); pass.end();
      counts.drawCalls++; counts.postDrawCalls++; counts.submittedTriangles++;
    }
    device.queue.submit([encoder.finish()]); frames++;
    lastFrame = { ...counts, cpuEncodeSubmitMs: performance.now() - cpuStart };
    frameRequest = requestAnimationFrame(render);
  }

  async function runComputeProbe() {
    if (disposed) return { supported: false, passed: false, backend: 'WebGPU', error: 'Renderer disposed.' };
    const storage = track(device.createBuffer({ label: '64 actual GPU compute float results', size: 256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }));
    const readback = track(device.createBuffer({ label: '64 float GPU map-read staging', size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }));
    device.pushErrorScope('validation');
    try {
      const module = await shader('Native compute i*3+7', `@group(0) @binding(0) var<storage, read_write> output: array<f32>;
        @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
          if (id.x < 64u) { output[id.x] = f32(id.x)*3.0+7.0; }
        }`);
      const layout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', minBindingSize: 256 } }] });
      const pipeline = await device.createComputePipelineAsync({ label: 'Raw 64-value compute probe', layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module, entryPoint: 'main' } });
      const group = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: storage } }] });
      const encoder = device.createCommandEncoder({ label: 'Native compute + copy to readback' });
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(1); pass.end();
      encoder.copyBufferToBuffer(storage, 0, readback, 0, 256); device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const values = Array.from(new Float32Array(readback.getMappedRange())); readback.unmap();
      const error = await device.popErrorScope();
      return { supported: true, passed: !error && values.length === 64 && values.every((value, index) => value === index * 3 + 7),
        backend: 'WebGPU', path: 'Raw GPUDevice + own WGSL compute + dispatchWorkgroups + copyBufferToBuffer + mapAsync; no engine and no CPU evaluation',
        count: 64, values, ...(error ? { error: String(error) } : {}) };
    } catch (error) {
      await device.popErrorScope();
      return { supported: true, passed: false, backend: 'WebGPU', count: 64, values: [], error: String(error) };
    } finally { release(storage); release(readback); }
  }

  async function runRawControlProbe() {
    if (disposed) return { supported: false, passed: false, error: 'Renderer disposed.' };
    const owned = [];
    const own = (resource) => { owned.push(resource); return resource; };
    device.pushErrorScope('validation');
    try {
      const outputTextures = [0, 1].map((index) => own(device.createTexture({ label: `Raw MRT output ${index}`, size: [4, 4], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC })));
      const pixelReadback = own(device.createBuffer({ label: 'MRT padded GPU readback', size: 2048, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }));
      const atomics = own(device.createBuffer({ label: 'Native storage atomics', size: 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }));
      const atomicReadback = own(device.createBuffer({ label: 'Atomic counter and sum readback', size: 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }));
      const atomicModule = await shader('Native storage atomic probe', `struct Counters { count: atomic<u32>, sum: atomic<u32> };
        @group(0) @binding(0) var<storage, read_write> counters: Counters;
        @compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) { atomicAdd(&counters.count,1u); atomicAdd(&counters.sum,id.x); }`);
      const atomicLayout = device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', minBindingSize: 8 } }] });
      const atomicPipeline = await device.createComputePipelineAsync({ layout: device.createPipelineLayout({ bindGroupLayouts: [atomicLayout] }), compute: { module: atomicModule, entryPoint: 'main' } });
      const atomicGroup = device.createBindGroup({ layout: atomicLayout, entries: [{ binding: 0, resource: { buffer: atomics } }] });
      const mrtModule = await shader('Native MRT and alpha blend probe', `struct Outputs { @location(0) first: vec4f, @location(1) second: vec4f };
        @vertex fn vertex(@builtin(vertex_index) index:u32)->@builtin(position) vec4f {
          let points=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0)); return vec4f(points[index],0.0,1.0);
        }
        @fragment fn fragment()->Outputs { var result:Outputs; result.first=vec4f(.25,.5,.75,.5); result.second=vec4f(.8,.2,.1,1.0); return result; }`);
      const mrtPipeline = await device.createRenderPipelineAsync({ label: 'Explicit independent MRT target states', layout: device.createPipelineLayout({ bindGroupLayouts: [] }),
        vertex: { module: mrtModule, entryPoint: 'vertex' }, fragment: { module: mrtModule, entryPoint: 'fragment', targets: [
          { format: 'rgba8unorm', blend: { color: { operation: 'add', srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } },
          { format: 'rgba8unorm' },
        ] } });
      const querySet = timestampSupported ? own(device.createQuerySet({ type: 'timestamp', count: 2 })) : null;
      const timestampResolve = timestampSupported ? own(device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC })) : null;
      const timestampReadback = timestampSupported ? own(device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ })) : null;
      const encoder = device.createCommandEncoder({ label: 'Raw MRT, atomics, optional timestamp probe' });
      const compute = encoder.beginComputePass(); compute.setPipeline(atomicPipeline); compute.setBindGroup(0, atomicGroup); compute.dispatchWorkgroups(1); compute.end();
      encoder.copyBufferToBuffer(atomics, 0, atomicReadback, 0, 8);
      const pass = encoder.beginRenderPass({ label: '2 real color attachments with independent blending',
        colorAttachments: outputTextures.map((texture) => ({ view: texture.createView(), clearValue: { r: .1, g: .2, b: .3, a: 1 }, loadOp: 'clear', storeOp: 'store' })),
        ...(querySet ? { timestampWrites: { querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}) });
      pass.setPipeline(mrtPipeline); pass.draw(3); pass.end();
      outputTextures.forEach((texture, index) => encoder.copyTextureToBuffer({ texture }, { buffer: pixelReadback, offset: index * 1024, bytesPerRow: 256, rowsPerImage: 4 }, [4, 4]));
      if (querySet) { encoder.resolveQuerySet(querySet, 0, 2, timestampResolve, 0); encoder.copyBufferToBuffer(timestampResolve, 0, timestampReadback, 0, 16); }
      device.queue.submit([encoder.finish()]);
      await Promise.all([pixelReadback.mapAsync(GPUMapMode.READ), atomicReadback.mapAsync(GPUMapMode.READ), ...(timestampReadback ? [timestampReadback.mapAsync(GPUMapMode.READ)] : [])]);
      const pixels = new Uint8Array(pixelReadback.getMappedRange());
      const actual = [Array.from(pixels.slice(0, 4)), Array.from(pixels.slice(1024, 1028))];
      const expected = [[45, 89, 134, 255], [204, 51, 26, 255]];
      const counters = Array.from(new Uint32Array(atomicReadback.getMappedRange()));
      const timestamps = timestampReadback ? new BigUint64Array(timestampReadback.getMappedRange()) : null;
      const timing = timestamps ? { supported: true, elapsedNanoseconds: Number(timestamps[1] - timestamps[0]),
        method: 'GPU timestamp-query around the isolated 4x4 MRT pass; browser may quantize timestamps; not a scene performance benchmark' } : { supported: false, reason: 'Adapter does not advertise optional timestamp-query.' };
      pixelReadback.unmap(); atomicReadback.unmap(); timestampReadback?.unmap();
      const error = await device.popErrorScope();
      const mrtPassed = actual.every((rgba, index) => rgba.every((value, channel) => Math.abs(value - expected[index][channel]) <= 1));
      const atomicPassed = counters[0] === 64 && counters[1] === 2016;
      return { supported: true, passed: !error && mrtPassed && atomicPassed, backend: 'WebGPU',
        mrt: { passed: mrtPassed, attachments: 2, actual, expected, firstTarget: 'src-alpha / one-minus-src-alpha over explicit clear RGBA', secondTarget: 'replacement; independent attachment state' },
        atomics: { passed: atomicPassed, actual: counters, expected: [64, 2016], path: '64 GPU invocations atomicAdd(storage count,1) and atomicAdd(storage sum,id)' },
        timestamp: timing, ...(error ? { error: String(error) } : {}) };
    } catch (error) {
      await device.popErrorScope(); return { supported: true, passed: false, error: String(error) };
    } finally { owned.forEach((resource) => resource.destroy()); }
  }

  function getDiagnostics() {
    const sorted = [...intervals].sort((a, b) => a - b);
    const average = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
    return { ready: frames > 0 && errors.length === 0, engine: 'WebGPU directo', version: 'custom WGSL fixture v1', backend: 'WebGPU',
      progress, stage: progress < .49 ? 'hero' : 'mosaic', referenceViewport: [1440, 900],
      viewport: { width, height, pixelRatio: 1 }, camera: { perspective: true, verticalFovDegrees: controls.cameraFov, positionZ: CAMERA_Z * (controls.autoFrame ? 1 + controls.explode * .55 : 1) },
      geometry: { cubies: 27, exteriorSymbols: 54, mosaicTiles: controls.density, mosaicSymbolInstances: controls.density, heroDrawBatches: 7, mosaicDrawBatches: 12,
        source: 'Shared BufferGeometry authoring; uploaded to native GPU vertex/index buffers; no engine renderer' },
      effects: { shadows: controls.shadows, shadowMapSize: SHADOW_SIZE, shadowFilter: '3x3 PCF plus hardware bilinear depth comparisons',
        customPostPasses: controls.postEffect > 0 ? 1 : 0, bloom: false, ssao: false, antialiasing: '4x MSAA', toneMapping: 'Own ACES fitted curve + explicit linear-to-sRGB', exposure: controls.exposure },
      controls: getControls(), probe: getProbeState(), environment: { ...environment }, environmentLoaded: environment.status === 'loaded',
      rawControl: { device: 'GPUDevice returned by API', commandEncoding: 'Explicit native render and compute passes', shaderLanguage: 'WGSL',
        bindGroupLayouts: 'Explicit', normalMatrices: 'CPU inverse-transpose per instance', alphaMode: 'opaque scene; independent alpha blending measured by runRawControlProbe',
        optionalTimestampQuery: timestampSupported, features: [...device.features],
        limits: { maxTextureDimension2D: device.limits.maxTextureDimension2D, maxColorAttachments: device.limits.maxColorAttachments,
          maxVertexAttributes: device.limits.maxVertexAttributes, maxComputeInvocationsPerWorkgroup: device.limits.maxComputeInvocationsPerWorkgroup },
        adapter: { vendor: adapter.info?.vendor ?? '', architecture: adapter.info?.architecture ?? '', device: adapter.info?.device ?? '', description: adapter.info?.description ?? '' } },
      frames, frameNumber: frames, frame: lastFrame, drawCalls: lastFrame?.drawCalls ?? 0, triangles: lastFrame?.submittedTriangles ?? 0,
      errors: [...errors], missingFeatures: environment.status === 'loaded' ? [] : ['HDR environment failed to load; direct and hemisphere lighting remain active'],
      timing: { samples: intervals.length, averageFrameMs: average, fps: average ? 1000 / average : null,
        p95FrameMs: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null, gpuFrameMs: null,
        method: 'Latest 240 requestAnimationFrame intervals, including browser scheduling. cpuEncodeSubmitMs is CPU encoding/submission time, not GPU time.' },
      comparisonLimits: 'Shared meshes, pose, camera, counts and control values; custom GGX, HDR integration and tone mapping differ from Three/Babylon/PlayCanvas. This is a functional rendering prototype, not identical pixels or an isolated speed benchmark.',
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(frameRequest); window.removeEventListener('resize', resize);
    resources.forEach((resource) => resource.destroy()); resources.clear(); context.unconfigure(); device.destroy();
  }
  device.pushErrorScope('validation');
  try {
    await initialize();
    const error = await device.popErrorScope();
    if (error) throw new Error(`Native WebGPU initialization validation failed: ${error.message}`);
  } catch (error) { dispose(); throw error; }
  window.addEventListener('resize', resize);
  frameRequest = requestAnimationFrame(render);
  return { device, context, setControls, getControls, setProgress, getDiagnostics, getProbeState, runComputeProbe, runRawControlProbe, dispose };
}
