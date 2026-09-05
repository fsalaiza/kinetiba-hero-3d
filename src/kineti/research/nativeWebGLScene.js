import { Color, Euler, FloatType, Matrix4, Quaternion, Vector3 } from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createCubeGeometry, createTileGeometry } from '../cubeGeometry.js';
import { createSymbolGeometry } from '../symbols.js';

// Three is used ONLY to author vertex data and perform matrix arithmetic.
// All shaders, buffers, framebuffers, shadow passes and draws below are WebGL2.
const DEFAULTS = {
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [.30, .53, -.045], cameraFov: 37,
  autoFrame: true, roughness: .27, metalness: .08, clearcoat: .46, environmentIntensity: .68,
  keyIntensity: 3.8, exposure: 1.06, glyphColor: '#354330', shadows: false,
  postEffect: 0, waveAmplitude: 0, wavePhase: 0, density: 432,
};
const BASE_CAMERA_Z = 7.05 / (2 * Math.tan(37 * Math.PI / 360));
const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aI0;
layout(location=3) in vec4 aI1;
layout(location=4) in vec4 aI2;
layout(location=5) in vec4 aI3;
uniform mat4 uVP,uWorld,uLightVP;
uniform bool uInstanced;
uniform float uWaveAmplitude,uWavePhase;
out vec3 vWorld,vNormal;
void main(){
  mat4 model=uInstanced?mat4(aI0,aI1,aI2,aI3):uWorld;
  vec4 world=model*vec4(aPosition,1.);
  if(uInstanced)world.z+=sin(model[3].x*1.3+model[3].y*.7-uWavePhase)*uWaveAmplitude;
  vWorld=world.xyz;
  vNormal=normalize(transpose(inverse(mat3(model)))*aNormal);
  gl_Position=uVP*world;
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vWorld,vNormal;
out vec4 outColor;
uniform vec3 uBase,uCamera;
uniform float uRoughness,uMetalness,uClearcoat,uEnvironment,uKey,uExposure,uMaxMip;
uniform sampler2D uHDR,uShadow;
uniform mat4 uLightVP;
uniform bool uShadows,uHasHDR;
const float PI=3.14159265359;
vec2 latlong(vec3 d){float c=cos(.4),s=sin(.4);d=vec3(c*d.x+s*d.z,d.y,-s*d.x+c*d.z);return vec2(atan(d.z,d.x)/(2.*PI)+.5,asin(clamp(d.y,-1.,1.))/PI+.5);}
vec3 env(vec3 d,float lod){return uHasHDR?textureLod(uHDR,latlong(d),lod).rgb:mix(vec3(.13,.17,.10),vec3(.50,.60,.40),d.y*.5+.5);}
vec3 fresnel(vec3 f,float h){return f+(1.-f)*pow(clamp(1.-h,0.,1.),5.);}
float ndf(float nh,float r){float a=r*r,a2=a*a;float d=nh*nh*(a2-1.)+1.;return a2/max(PI*d*d,.00001);}
float smith(float nv,float nl,float r){float k=(r+1.)*(r+1.)/8.;return nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);}
vec3 brdf(vec3 N,vec3 V,vec3 L,vec3 radiance){
  vec3 H=normalize(V+L);float nl=max(dot(N,L),0.),nv=max(dot(N,V),.001),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
  float r=clamp(uRoughness,.05,1.);vec3 F=fresnel(mix(vec3(.04),uBase,uMetalness),vh);
  vec3 spec=ndf(nh,r)*smith(nv,nl,r)*F/max(4.*nv*nl,.001);
  vec3 diffuse=(1.-F)*(1.-uMetalness)*uBase/PI;
  float coatF=.04+.96*pow(1.-vh,5.);
  float coat=ndf(nh,.26)*smith(nv,nl,.26)*coatF/max(4.*nv*nl,.001)*uClearcoat;
  return ((diffuse+spec)*(1.-uClearcoat*coatF)+vec3(coat))*radiance*nl;
}
float shadow(vec3 N){
  if(!uShadows)return 1.;vec4 q=uLightVP*vec4(vWorld+N*.035,1.);vec3 p=q.xyz/q.w*.5+.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z<0.||p.z>1.)return 1.;
  float total=0.;vec2 pixel=1./vec2(textureSize(uShadow,0));
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)total+=p.z-.0008<=texture(uShadow,p.xy+vec2(x,y)*pixel).r?1.:0.;
  return total/9.;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 srgb(vec3 x){return mix(12.92*x,1.055*pow(max(x,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),x));}
void main(){
  vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld);if(!gl_FrontFacing)N=-N;
  vec3 c=brdf(N,V,normalize(vec3(-3.,7.,9.)),vec3(1.,.906,.716)*uKey)*shadow(N);
  c+=brdf(N,V,normalize(vec3(5.,.5,6.)),vec3(.776,.823,1.)*.9);
  vec3 F=fresnel(mix(vec3(.04),uBase,uMetalness),max(dot(N,V),0.));
  vec3 hemi=mix(vec3(.10,.12,.066),vec3(.839,.896,.716),N.y*.5+.5)*.32*1.25;
  // Real HDR sampling with box-filtered mip levels. This deliberately does NOT
  // claim to reproduce Three/Babylon's GGX-prefiltered environment integration.
  vec3 ambientDiffuse=env(N,uMaxMip)*uBase*(1.-uMetalness)*.40;
  vec3 reflection=env(reflect(-V,N),uRoughness*uMaxMip)*F*(1.-uRoughness*.45);
  c+=hemi*uBase*(1.-uMetalness)+(ambientDiffuse+reflection)*uEnvironment;
  c+=env(reflect(-V,N),.26*uMaxMip)*(.04+.96*pow(1.-max(dot(N,V),0.),5.))*uClearcoat*uEnvironment*.18;
  outColor=vec4(srgb(aces(c*uExposure)),1.);
}`;
const QUAD_VERTEX = `#version 300 es
precision highp float;out vec2 vUV;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const POST_FRAGMENT = `#version 300 es
precision highp float;in vec2 vUV;out vec4 outColor;uniform sampler2D uScene;uniform float uStrength;
void main(){float d=.012*uStrength;vec3 c=vec3(texture(uScene,vUV+vec2(d,0.)).r,texture(uScene,vUV).g,texture(uScene,vUV-vec2(d,0.)).b);outColor=vec4(clamp((c-.5)*(1.+.18*uStrength)+.5,0.,1.),1.);}`;

export async function createNativeWebGLComparison(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available. This prototype does not substitute a different renderer.');
  const controls = structuredClone(DEFAULTS);
  let progress = 0, disposed = false, frameNumber = 0, frameMs = 16.67, cpuMs = 0, previous = 0, raf;
  let width = innerWidth, height = innerHeight, matrixRevision = 0, environmentLoaded = false, maxMip = 0;
  let draws = 0, triangles = 0;
  const ownedPrograms = [], ownedShaders = [], ownedBuffers = [], ownedVAOs = [], ownedTextures = [], ownedFBOs = [], ownedRBOs = [];
  const uniformCache = new Map();
  const shader = (type, source) => {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    ownedShaders.push(s); return s;
  };
  const program = (vertex, fragment, varyings = null) => {
    const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fragment));
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    ownedPrograms.push(p); uniformCache.set(p, new Map()); return p;
  };
  const location = (p, name) => { const cache = uniformCache.get(p); if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name)); return cache.get(name); };
  const f = (p, n, v) => gl.uniform1f(location(p, n), v);
  const i = (p, n, v) => gl.uniform1i(location(p, n), v);
  const v3 = (p, n, v) => gl.uniform3fv(location(p, n), v);
  const m4 = (p, n, m) => gl.uniformMatrix4fv(location(p, n), false, m.elements);
  const surface = program(VERTEX, FRAGMENT);
  const depthProgram = program(VERTEX, '#version 300 es\nprecision highp float;void main(){}');
  const post = program(QUAD_VERTEX, POST_FRAGMENT);
  const texture = () => { const t = gl.createTexture(); ownedTextures.push(t); return t; };
  const buffer = () => { const b = gl.createBuffer(); ownedBuffers.push(b); return b; };
  const fbo = () => { const b = gl.createFramebuffer(); ownedFBOs.push(b); return b; };
  const vao = () => { const v = gl.createVertexArray(); ownedVAOs.push(v); return v; };
  const color = (hex) => new Color(hex).toArray();
  const ceramicColor = color('#e9ebdc');
  const environment = texture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, environment);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array([.3, .4, .2, 1]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.getExtension('EXT_color_buffer_float');
  try {
    const hdr = await new HDRLoader().setDataType(FloatType).loadAsync('/hdri/studio_small_09_1k.hdr');
    gl.bindTexture(gl.TEXTURE_2D, environment);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, hdr.image.width, hdr.image.height, 0, gl.RGBA, gl.FLOAT, hdr.image.data);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    maxMip = Math.floor(Math.log2(Math.max(hdr.image.width, hdr.image.height)));
    environmentLoaded = true; hdr.dispose();
  } catch (error) { console.warn('Native WebGL HDR:', error.message); }

  const geometry = (source) => {
    const va = vao(), vertices = buffer(), indices = source.index ? buffer() : null;
    const positions = source.getAttribute('position'), normals = source.getAttribute('normal');
    const interleaved = new Float32Array(positions.count * 6);
    for (let n = 0; n < positions.count; n++) {
      interleaved.set([positions.getX(n), positions.getY(n), positions.getZ(n), normals.getX(n), normals.getY(n), normals.getZ(n)], n * 6);
    }
    gl.bindVertexArray(va); gl.bindBuffer(gl.ARRAY_BUFFER, vertices); gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    if (indices) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(source.index.array), gl.STATIC_DRAW); }
    const count = indices ? source.index.count : positions.count;
    source.dispose(); return { vao: va, count, indexed: Boolean(indices) };
  };
  const cubie = geometry(createCubeGeometry());
  const glyphs = Array.from({ length: 6 }, (_, n) => geometry(createSymbolGeometry(n, .43)));
  const planeGeo = createTileGeometry(50, .01, 0);
  const floor = geometry(planeGeo);
  const field = [];
  for (let family = 0; family < 6; family++) for (const glyph of [false, true]) {
    const source = glyph ? createSymbolGeometry(family, .40) : createTileGeometry(.78, .15, .055);
    if (glyph) source.translate(0, 0, .077);
    const geo = geometry(source), instances = buffer();
    gl.bindVertexArray(geo.vao); gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    for (let n = 0; n < 4; n++) { gl.enableVertexAttribArray(2 + n); gl.vertexAttribPointer(2 + n, 4, gl.FLOAT, false, 64, n * 16); gl.vertexAttribDivisor(2 + n, 1); }
    field.push({ geo, instances, family, glyph, count: 0 });
  }
  const compose = (position, rotation = [0, 0, 0], scale = 1) => new Matrix4().compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...rotation, 'XYZ')), new Vector3(scale, scale, scale));
  const faces = [[0, 1, 0, Math.PI / 2, 0], [0, -1, 0, -Math.PI / 2, 0], [1, 1, -Math.PI / 2, 0, 0], [1, -1, Math.PI / 2, 0, 0], [2, 1, 0, 0, 0], [2, -1, 0, Math.PI, 0]];
  const pieces = [], hero = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const index = pieces.length, coords = [x, y, z];
    const piece = { index, coords, local: new Vector3(), world: new Matrix4() }; pieces.push(piece);
    hero.push({ piece, geo: cubie, glyph: false, relative: new Matrix4(), model: new Matrix4() });
    for (const [axis, sign, rx, ry, rz] of faces) {
      if (coords[axis] !== sign) continue;
      const pos = [0, 0, 0]; pos[axis] = sign * .4305;
      hero.push({ piece, geo: glyphs[index % 6], glyph: true, relative: compose(pos, [rx, ry, rz]), model: new Matrix4() });
    }
  }
  const floorWorld = compose([0, -2.1, 0], [-Math.PI / 2, 0, 0]);
  const cameraPosition = new Vector3(0, 0, BASE_CAMERA_Z);
  const view = new Matrix4().makeTranslation(0, 0, -cameraPosition.z), projection = new Matrix4(), vp = new Matrix4();
  const lightWorld = new Matrix4().lookAt(new Vector3(-3, 7, 9), new Vector3(), new Vector3(0, 1, 0));
  lightWorld.setPosition(-3, 7, 9);
  const lightVP = new Matrix4().makeOrthographic(-7, 7, 7, -7, .1, 30).multiply(lightWorld.clone().invert());
  const shadowTexture = texture(), shadowFBO = fbo();
  gl.bindTexture(gl.TEXTURE_2D, shadowTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 1024, 1024, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  for (const key of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, key, gl.NEAREST);
  for (const key of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Native shadow framebuffer incomplete');
  const sceneFBO = fbo(), sceneTexture = texture(), sceneDepth = gl.createRenderbuffer(); ownedRBOs.push(sceneDepth);
  const emptyVAO = vao();
  const resize = () => {
    width = innerWidth; height = innerHeight; canvas.width = width; canvas.height = height;
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER, sceneDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, sceneDepth);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Native scene framebuffer incomplete');
    updateCamera(); updateField(); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  function updateCamera() {
    cameraPosition.z = BASE_CAMERA_Z * (controls.autoFrame ? 1 + controls.explode * .55 : 1);
    view.makeTranslation(0, 0, -cameraPosition.z);
    const top = .1 * Math.tan(controls.cameraFov * Math.PI / 360), right = top * width / height;
    projection.makePerspective(-right, right, top, -top, .1, 60); vp.multiplyMatrices(projection, view);
  }
  function updateField() {
    const cols = controls.density === 162 ? 9 : 24, rows = 18, unit = Math.max(7.05 * width / height / cols, 7.05 / rows) * 1.06;
    const groups = Array.from({ length: 6 }, () => []);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      groups[((index * 7) % 27) % 6].push(compose([(col - (cols - 1) / 2) * unit, ((rows - 1) / 2 - row) * unit, -.1], [0, 0, 0], unit / .86 * .91));
    }
    for (const batch of field) {
      const matrices = groups[batch.family]; batch.count = matrices.length;
      const data = new Float32Array(matrices.length * 16); matrices.forEach((m, n) => m.toArray(data, n * 16));
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.instances); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
    matrixRevision++;
  }
  function setProgress(value) {
    progress = Math.max(0, Math.min(1, Number(value) || 0));
    const t = Math.max(0, Math.min(1, (progress - .28) / .2)), flatten = t * t * (3 - 2 * t);
    const parent = compose([1.7 * (1 - flatten), .1, 0], controls.rotation.map((n) => n * (1 - flatten)), 1.08);
    for (const piece of pieces) {
      piece.local.set(...piece.coords.map((v) => v * (.96 + .75 * controls.explode)));
      if (piece.index === controls.selectedPiece) piece.local.y += controls.pieceOffset;
      piece.world.multiplyMatrices(parent, new Matrix4().makeTranslation(...piece.local.toArray()));
    }
    for (const object of hero) object.model.multiplyMatrices(object.piece.world, object.relative);
  }
  function setControls(patch = {}) {
    const oldDensity = controls.density; Object.assign(controls, patch);
    controls.rotation = [...controls.rotation]; controls.selectedPiece = Math.min(26, Math.max(0, Math.round(controls.selectedPiece)));
    controls.density = controls.density === 162 ? 162 : 432;
    updateCamera(); if (controls.density !== oldDensity) updateField(); setProgress(progress);
  }
  const draw = (geo, count = 1) => {
    gl.bindVertexArray(geo.vao);
    if (geo.indexed) gl.drawElementsInstanced(gl.TRIANGLES, geo.count, gl.UNSIGNED_INT, 0, count);
    else gl.drawArraysInstanced(gl.TRIANGLES, 0, geo.count, count);
    draws++; triangles += geo.count * count / 3;
  };
  const material = (glyph, floorMaterial = false) => {
    v3(surface, 'uBase', floorMaterial ? color('#182015') : glyph ? color(controls.glyphColor) : ceramicColor);
    f(surface, 'uRoughness', floorMaterial ? .9 : glyph ? .35 : controls.roughness);
    f(surface, 'uMetalness', floorMaterial ? 0 : glyph ? .18 : controls.metalness);
    f(surface, 'uClearcoat', floorMaterial ? 0 : glyph ? .2 : controls.clearcoat);
  };
  function drawScene(p, shadowPass) {
    const grid = progress >= .49; i(p, 'uInstanced', grid ? 1 : 0);
    f(p, 'uWaveAmplitude', controls.waveAmplitude); f(p, 'uWavePhase', controls.wavePhase);
    if (grid) {
      for (const batch of field) { if (!shadowPass) material(batch.glyph); draw(batch.geo, batch.count); }
    } else {
      for (const object of hero) { m4(p, 'uWorld', object.model); if (!shadowPass) material(object.glyph); draw(object.geo); }
      if (!shadowPass && controls.shadows) { m4(p, 'uWorld', floorWorld); material(false, true); draw(floor); }
    }
  }
  function render(time) {
    if (disposed) return;
    const started = performance.now(); if (previous) frameMs += ((time - previous) - frameMs) * .05; previous = time;
    draws = 0; triangles = 0;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    if (controls.shadows) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO); gl.viewport(0, 0, 1024, 1024); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depthProgram); m4(depthProgram, 'uVP', lightVP);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2); drawScene(depthProgram, true); gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, controls.postEffect > 0 ? sceneFBO : null); gl.viewport(0, 0, width, height);
    gl.clearColor(16 / 255, 19 / 255, 15 / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(surface); m4(surface, 'uVP', vp); m4(surface, 'uLightVP', lightVP); v3(surface, 'uCamera', cameraPosition.toArray());
    f(surface, 'uEnvironment', controls.environmentIntensity); f(surface, 'uKey', controls.keyIntensity); f(surface, 'uExposure', controls.exposure); f(surface, 'uMaxMip', maxMip);
    i(surface, 'uShadows', controls.shadows ? 1 : 0); i(surface, 'uHasHDR', environmentLoaded ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, environment); i(surface, 'uHDR', 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowTexture); i(surface, 'uShadow', 1);
    drawScene(surface, false);
    if (controls.postEffect > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(post);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTexture); i(post, 'uScene', 0); f(post, 'uStrength', controls.postEffect);
      gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); draws++; triangles++;
    }
    frameNumber++; cpuMs += (performance.now() - started - cpuMs) * .05;
    raf = requestAnimationFrame(render);
  }
  const getProbeState = () => {
    const describe = (n) => ({ index: n, local: pieces[n].local.toArray(), world: new Vector3().setFromMatrixPosition(pieces[n].world).toArray() });
    return { selected: describe(controls.selectedPiece), other: describe((controls.selectedPiece + 1) % 27), cameraFov: controls.cameraFov,
      material: { roughness: controls.roughness, metalness: controls.metalness, clearcoat: controls.clearcoat }, density: controls.density,
      shadowEnabled: controls.shadows, instanceMatrixVersion: matrixRevision, gpuWave: { amplitude: controls.waveAmplitude, phase: controls.wavePhase, path: 'Native GLSL vertex / instanced matrix center' } };
  };
  async function runComputeProbe() {
    const tfProgram = program(`#version 300 es\nprecision highp float;out float outputValue;void main(){outputValue=float(gl_VertexID)*3.+7.;gl_Position=vec4(0.,0.,0.,1.);gl_PointSize=1.;}`, '#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(0.);}', ['outputValue']);
    const result = buffer(), tf = gl.createTransformFeedback();
    gl.useProgram(tfProgram); gl.bindVertexArray(emptyVAO); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, result); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, 64 * 4, gl.STREAM_READ);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, result);
    gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, 64); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
    const values = new Float32Array(64); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, values);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null); gl.deleteTransformFeedback(tf);
    return { supported: true, passed: values.every((v, n) => v === n * 3 + 7), count: 64, values: Array.from(values), backend: 'WebGL2', path: 'Native transform feedback + getBufferSubData; not native compute shader' };
  }
  async function runRawControlProbe() {
    const target = fbo(), attachments = [texture(), texture()]; gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    attachments.forEach((t, n) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + n, gl.TEXTURE_2D, t, 0); });
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const p = program(QUAD_VERTEX, '#version 300 es\nprecision highp float;layout(location=0)out vec4 a;layout(location=1)out vec4 b;void main(){a=vec4(.25,.5,.75,1.);b=vec4(.8,.6,.4,1.);}');
    gl.viewport(0, 0, 4, 4); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(p); gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const actual = [];
    for (let n = 0; n < 2; n++) { const bytes = new Uint8Array(4); gl.readBuffer(gl.COLOR_ATTACHMENT0 + n); gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes); actual.push(Array.from(bytes)); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const expected = [[64, 128, 191, 255], [204, 153, 102, 255]];
    return { mrt: { supported: true, passed: complete && actual.every((a, n) => a.every((v, c) => Math.abs(v - expected[n][c]) <= 1)), attachments: 2, actual, expected },
      atomics: { supported: false, reason: 'Storage-buffer atomics and native compute are not in WebGL2.' },
      timestamp: { available: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')), measured: false },
      limits: { maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS), maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) } };
  }
  function getDiagnostics() { return {
    ready: frameNumber > 0, engine: 'Native WebGL2', version: 'WebGL 2 / GLSL ES 3.00', backend: 'WebGL2',
    progress, width, height, pixelRatio: 1, cubePieces: 27, tileCount: controls.density, activeTiles: progress >= .49 ? controls.density : 0,
    drawCalls: draws, triangles, frameNumber, frameMs, renderCpuMs: cpuMs, environmentLoaded,
    controls: structuredClone(controls), probe: getProbeState(), nativeRenderer: true,
    limits: 'Custom GGX and clearcoat with box-filtered HDR mipmaps, not an engine-identical PBR implementation. FX target is single-sample. No native compute shader; transform feedback probe is labelled separately.',
  }; }
  resize(); setProgress(0); window.addEventListener('resize', resize); raf = requestAnimationFrame(render);
  return { setControls, getControls: () => structuredClone(controls), setProgress, getProbeState, getDiagnostics, runComputeProbe, runRawControlProbe,
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      ownedPrograms.forEach((p) => gl.deleteProgram(p)); ownedShaders.forEach((s) => gl.deleteShader(s)); ownedBuffers.forEach((b) => gl.deleteBuffer(b));
      ownedVAOs.forEach((v) => gl.deleteVertexArray(v)); ownedTextures.forEach((t) => gl.deleteTexture(t)); ownedFBOs.forEach((b) => gl.deleteFramebuffer(b)); ownedRBOs.forEach((b) => gl.deleteRenderbuffer(b));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } };
}
