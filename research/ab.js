const $ = (selector) => document.querySelector(selector);
const clone = (value) => structuredClone(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ENGINES = {
  three: { name: 'Three.js', factory: 'createThreeComparison', load: () => import('../src/kineti/research/threeScene.js') },
  babylon: { name: 'Babylon.js', factory: 'createBabylonComparison', load: () => import('../src/kineti/research/babylonScene.js') },
  playcanvas: { name: 'PlayCanvas', factory: 'createPlayCanvasComparison', load: () => import('../src/kineti/research/playcanvasScene.js') },
  native_webgpu: { name: 'WebGPU directo', backend: 'webgpu', factory: 'createNativeWebGPUComparison', load: () => import('../src/kineti/research/nativeWebGPUScene.js') },
  native_webgl: { name: 'WebGL2 directo', backend: 'webgl2', factory: 'createNativeWebGLComparison', load: () => import('../src/kineti/research/nativeWebGLScene.js') },
};
const ENGINE_KEYS = Object.keys(ENGINES);
const ENGINE_NAMES = Object.fromEntries(ENGINE_KEYS.map((key) => [key, ENGINES[key].name]));
const backendFor = (engine, requested) => ENGINES[engine].backend || (requested === 'webgl2' ? 'webgl2' : 'auto');
const DEFAULTS = {
  explode: 0, selectedPiece: 26, pieceOffset: 0, rotation: [0.30, 0.53, -0.045],
  cameraFov: 37, autoFrame: true, roughness: 0.27, metalness: 0.08, clearcoat: 0.46,
  environmentIntensity: 0.68, keyIntensity: 3.8, exposure: 1.06,
  glyphColor: '#354330', shadows: false, postEffect: 0,
  waveAmplitude: 0, wavePhase: 0, density: 432,
};
const GROUPS = [
  { title: 'Escena y pieza', tag: 'TRANSFORM', controls: [
    ['progress', 'Progreso', 0, 1, 0.01, '0 → 1'],
    ['explode', 'Separación de piezas', 0, 1, 0.01],
    ['selectedPiece', 'Pieza seleccionada', 0, 26, 1, 'índice'],
    ['pieceOffset', 'Desplazamiento de la pieza', -1, 1, 0.01],
    ['rotation.0', 'Rotación X', -Math.PI, Math.PI, 0.01, 'rad'],
    ['rotation.1', 'Rotación Y', -Math.PI, Math.PI, 0.01, 'rad'],
    ['rotation.2', 'Rotación Z', -Math.PI, Math.PI, 0.01, 'rad'],
    ['cameraFov', 'Campo de visión', 25, 60, 0.1, 'grados'],
    ['autoFrame', 'Encuadre automático', 'checkbox'],
  ] },
  { title: 'Material', tag: 'PBR', controls: [
    ['roughness', 'Rugosidad', 0.05, 1, 0.01],
    ['metalness', 'Metallic', 0, 1, 0.01],
    ['clearcoat', 'Clear coat', 0, 1, 0.01],
    ['glyphColor', 'Color de símbolos', 'color'],
  ] },
  { title: 'Luz y composición', tag: 'RENDER', controls: [
    ['environmentIntensity', 'Intensidad del entorno', 0, 2, 0.01],
    ['keyIntensity', 'Luz principal', 0, 6, 0.05],
    ['exposure', 'Exposición', 0.5, 2, 0.01],
    ['shadows', 'Sombras', 'checkbox'],
    ['postEffect', 'Aberración RGB', 0, 1, 0.01, 'multipass'],
  ] },
  { title: 'Mosaico', tag: 'INSTANCES', controls: [
    ['waveAmplitude', 'Amplitud de onda', 0, 0.8, 0.01],
    ['wavePhase', 'Fase de onda', 0, 6.28, 0.01, 'rad'],
    ['density', 'Densidad de piezas', 'select', [162, 432]],
  ] },
];

const query = new URLSearchParams(location.search);
let selectedEngine = Object.hasOwn(ENGINES, query.get('engine')) ? query.get('engine') : 'three';
let preferredBackend = query.get('renderer') === 'webgl' || query.get('backend') === 'webgl2' ? 'webgl2' : 'auto';
let selectedBackend = backendFor(selectedEngine, preferredBackend);
let controls = clone(DEFAULTS);
let initialDefaults = null;
let progress = clamp(Number(query.get('progress')) || 0, 0, 1);
let instance = null;
let instanceEngine = null;
let instanceBackend = null;
let instanceToken = 0;
let latestRequest = 0;
let loading = false;
let draining = false;
let pageDisposed = false;
let probePending = null;
const computeResults = [];
const rawControlResults = [];
const PROBES = {
  compute: { method: 'runComputeProbe', resultID: 'compute-result', contextID: 'compute-context', records: computeResults },
  raw: { method: 'runRawControlProbe', resultID: 'raw-control-result', contextID: 'raw-control-context', records: rawControlResults },
};
let lastDiagnostics = null;
let actionTimer = 0;
const inputRegistry = new Map();
const modifiedControls = new Set();
const downloadURLs = new Set();

const getValue = (key) => key === 'progress' ? progress : key.startsWith('rotation.') ? controls.rotation[Number(key.split('.')[1])] : controls[key];

function announce(message) {
  $('#action-status').textContent = message;
  clearTimeout(actionTimer);
  actionTimer = setTimeout(() => { $('#action-status').textContent = ''; }, 5500);
}

function setStatus(message, state = 'loading') {
  $('#engine-status').textContent = message;
  $('#status-light').dataset.state = state;
  $('#canvas-host').setAttribute('aria-busy', String(state === 'loading'));
  syncProbeButtons();
}

function syncProbeButtons() {
  const disabled = loading || !instance || Boolean(probePending) || pageDisposed;
  $('#compute-run').disabled = disabled;
  $('#raw-control-run').disabled = disabled;
}

function showProbeRecords() {
  for (const probe of Object.values(PROBES)) {
    const record = probe.records.findLast((entry) => entry.engine === instanceEngine && entry.requestedBackend === instanceBackend);
    $(`#${probe.contextID}`).textContent = record
      ? `${ENGINE_NAMES[record.engine]} · ${record.actualBackend} · ${record.capturedAt}`
      : `${ENGINE_NAMES[selectedEngine]} · sin ejecutar en esta ruta.`;
    $(`#${probe.resultID}`).textContent = record
      ? JSON.stringify(record.error ? { error: record.error } : record.result, null, 2)
      : 'Todavía no ejecutado en esta configuración.';
  }
}

function numberString(value, step = 0.01) {
  if (!Number.isFinite(Number(value))) return '0';
  return Number(value).toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
}

function syncInputs() {
  for (const [key, binding] of inputRegistry) {
    const value = getValue(key);
    if (binding.type === 'checkbox') binding.inputs[0].checked = Boolean(value);
    else for (const input of binding.inputs) input.value = binding.type === 'range' ? numberString(value, binding.step) : String(value);
  }
}

function applyControls() {
  if (!instance || loading) return;
  try {
    instance.setControls(clone(controls));
    instance.setProgress(progress);
  } catch (error) {
    announce(`El motor rechazó la actualización: ${error.message}`);
  }
}

function updateControl(key, value) {
  modifiedControls.add(key.startsWith('rotation.') ? 'rotation' : key);
  if (key === 'progress') progress = value;
  else if (key.startsWith('rotation.')) controls.rotation[Number(key.split('.')[1])] = value;
  else controls[key] = value;
  syncInputs();
  applyControls();
}

function createControl(definition) {
  const [key, title, minOrType, maxOrOptions, step = 0.01, unit] = definition;
  const id = `control-${key.replace('.', '-')}`;
  const row = document.createElement('div');
  row.className = 'control-row';
  const label = document.createElement('label');
  label.htmlFor = id;
  label.className = 'control-label';
  label.append(document.createTextNode(title));
  if (unit) { const suffix = document.createElement('small'); suffix.textContent = unit; label.append(suffix); }
  const type = typeof minOrType === 'string' ? minOrType : 'range';
  const input = document.createElement(type === 'select' ? 'select' : 'input');
  input.id = id;
  input.dataset.control = key;
  const inputs = [input];

  if (type === 'checkbox') {
    row.classList.add('check-row'); input.type = 'checkbox';
    input.addEventListener('change', () => updateControl(key, input.checked));
    row.append(label, input);
  } else if (type === 'select') {
    for (const value of maxOrOptions) { const option = document.createElement('option'); option.value = value; option.textContent = `${value} piezas`; input.append(option); }
    input.addEventListener('change', () => updateControl(key, Number(input.value)));
    row.append(label, input);
  } else if (type === 'color') {
    input.type = 'color';
    const wrapper = document.createElement('div'); wrapper.className = 'color-row';
    const text = document.createElement('input'); text.type = 'text'; text.maxLength = 7; text.pattern = '#[0-9a-fA-F]{6}'; text.setAttribute('aria-label', `${title}, hexadecimal`); text.spellcheck = false;
    input.addEventListener('input', () => updateControl(key, input.value));
    text.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) updateControl(key, text.value.toLowerCase()); else syncInputs(); });
    inputs.push(text); wrapper.append(input, text); row.append(label, wrapper);
  } else {
    input.type = 'range'; input.min = minOrType; input.max = maxOrOptions; input.step = step;
    const wrapper = document.createElement('div'); wrapper.className = 'range-row';
    const numeric = document.createElement('input'); numeric.type = 'number'; numeric.min = minOrType; numeric.max = maxOrOptions; numeric.step = step; numeric.setAttribute('aria-label', `${title}, valor numérico`);
    const update = (event) => {
      if (event.target.value === '') return;
      const raw = Number(event.target.value);
      if (!Number.isFinite(raw)) return;
      updateControl(key, clamp(step >= 1 ? Math.round(raw) : raw, minOrType, maxOrOptions));
    };
    input.addEventListener('input', update);
    numeric.addEventListener('change', update);
    inputs.push(numeric); wrapper.append(input, numeric); row.append(label, wrapper);
  }
  inputRegistry.set(key, { inputs, type, step });
  return row;
}

for (const group of GROUPS) {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'control-group';
  const legend = document.createElement('legend'); legend.textContent = group.title;
  const tag = document.createElement('span'); tag.textContent = group.tag; legend.append(tag); fieldset.append(legend);
  group.controls.forEach((definition) => fieldset.append(createControl(definition)));
  if (group.tag === 'INSTANCES') { const hint = document.createElement('p'); hint.className = 'control-hint'; hint.textContent = 'Usa el preset Mosaico para observar densidad y desplazamiento de instancias.'; fieldset.append(hint); }
  $('#control-groups').append(fieldset);
}
syncInputs();

function syncTabs() {
  for (const button of document.querySelectorAll('[data-engine]')) {
    const active = button.dataset.engine === selectedEngine;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
  }
  $('#canvas-host').setAttribute('aria-labelledby', `engine-${selectedEngine}`);
  const select = $('#backend-select');
  const fixed = ENGINES[selectedEngine].backend;
  select.replaceChildren();
  const options = fixed
    ? [[fixed, fixed === 'webgpu' ? 'WebGPU · implementación directa' : 'WebGL2 · implementación directa']]
    : [['auto', 'Automático · preferir WebGPU'], ['webgl2', 'Forzar WebGL2']];
  for (const [value, label] of options) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); }
  select.value = selectedBackend; select.disabled = Boolean(fixed);
  $('#backend-hint').textContent = fixed
    ? `Esta implementación utiliza ${fixed === 'webgpu' ? 'WebGPU' : 'WebGL2'} exclusivamente. Cambia de candidata para probar otra ruta.`
    : 'El backend real aparece en el diagnóstico. Automático puede seleccionar WebGL2 si WebGPU no está disponible.';
  $('#requested-mode').textContent = fixed ? `${fixed.toUpperCase()} DIRECTO` : selectedBackend === 'auto' ? 'AUTO' : 'WEBGL2 SOLICITADO';
}

function updateBackendURL(engine, backend) {
  const url = new URL(location.href);
  url.searchParams.set('engine', engine);
  if (backend === 'webgl2') { url.searchParams.set('renderer', 'webgl'); url.searchParams.set('backend', 'webgl2'); }
  else { url.searchParams.delete('renderer'); if (backend === 'webgpu') url.searchParams.set('backend', 'webgpu'); else url.searchParams.delete('backend'); }
  history.replaceState(history.state, '', url);
}

async function disposeCurrent() {
  const old = instance;
  instance = null; instanceEngine = null; instanceBackend = null;
  window.__COMPARISON__ = null;
  if (old) {
    try { await old.dispose(); } catch (error) { console.warn('A/B dispose:', error); }
  }
  $('#canvas-host').replaceChildren();
}

function showSceneError(error) {
  const panel = document.createElement('div'); panel.className = 'lab-error';
  const heading = document.createElement('strong'); heading.textContent = 'No se pudo iniciar esta configuración.';
  const text = document.createElement('p'); text.textContent = error.message || String(error);
  const help = document.createElement('p'); help.textContent = 'Puedes elegir otra candidata o una ruta WebGL2. Los parámetros siguen conservados.';
  panel.append(heading, text, help); $('#canvas-host').append(panel);
}

// A serial queue is essential: stale asynchronous factories are awaited and
// disposed before another engine can create its GPU device or render loop.
async function drainSwitches() {
  if (draining || pageDisposed) return;
  draining = true;
  try {
    while (!pageDisposed && latestRequest !== instanceToken) {
      const token = latestRequest;
      const engine = selectedEngine;
      const backend = selectedBackend;
      if (probePending) { try { await probePending; } catch { /* Probe reports its own failure. */ } }
      await disposeCurrent();
      if (pageDisposed || token !== latestRequest) continue;
      let created = null;
      try {
        const module = await ENGINES[engine].load();
        if (pageDisposed || token !== latestRequest) continue;
        updateBackendURL(engine, backend);
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-label', `Escena de comparación ${ENGINE_NAMES[engine]}`);
        canvas.dataset.engine = engine; canvas.id = 'comparison-canvas';
        $('#canvas-host').replaceChildren(canvas);
        const factory = module[ENGINES[engine].factory];
        created = await factory(canvas);
        if (pageDisposed || token !== latestRequest) {
          await created.dispose(); created = null; $('#canvas-host').replaceChildren(); continue;
        }
        for (const method of ['setControls', 'getControls', 'setProgress', 'getDiagnostics', 'getProbeState', 'runComputeProbe', 'dispose']) {
          if (typeof created[method] !== 'function') throw new Error(`La API de ${ENGINE_NAMES[engine]} todavía no implementa ${method}().`);
        }
        if (!initialDefaults) {
          const engineDefaults = created.getControls();
          initialDefaults = clone(DEFAULTS);
          for (const key of Object.keys(DEFAULTS)) if (engineDefaults[key] !== undefined) initialDefaults[key] = clone(engineDefaults[key]);
          // Keep any adjustments made while the first renderer was loading.
          for (const key of Object.keys(DEFAULTS)) {
            if (!modifiedControls.has(key)) controls[key] = clone(initialDefaults[key]);
          }
          syncInputs();
        }
        instance = created; created = null;
        instanceEngine = engine; instanceBackend = backend; instanceToken = token;
        instance.setControls(clone(controls)); instance.setProgress(progress);
        window.__COMPARISON__ = instance;
        loading = false;
        const diagnostics = instance.getDiagnostics();
        setStatus(`${ENGINE_NAMES[engine]} ${diagnostics.version ?? ''} · escena activa`, 'ready');
        showProbeRecords();
        updateDiagnostics();
      } catch (error) {
        if (created) { try { await created.dispose(); } catch { /* Preserve the initialization error. */ } }
        if (instance && instanceToken === token) await disposeCurrent();
        if (pageDisposed || token !== latestRequest) continue;
        instanceToken = token; loading = false;
        setStatus(`${ENGINE_NAMES[engine]} · error de inicialización`, 'error');
        lastDiagnostics = { initializationError: error.message || String(error), engine, requestedBackend: backend };
        $('#diagnostics-json').textContent = JSON.stringify(lastDiagnostics, null, 2);
        showSceneError(error);
      }
    }
  } finally {
    draining = false;
    if (!pageDisposed && latestRequest !== instanceToken) drainSwitches();
  }
}

function switchEngine(engine = selectedEngine, backend = preferredBackend) {
  if (!Object.hasOwn(ENGINES, engine) || !['auto', 'webgpu', 'webgl2'].includes(backend)) throw new Error('Candidata o backend no válido.');
  if (!ENGINES[engine].backend) preferredBackend = backend === 'webgl2' ? 'webgl2' : 'auto';
  selectedEngine = engine; selectedBackend = backendFor(engine, backend); latestRequest++;
  loading = true; syncTabs();
  setStatus(`Preparando ${ENGINE_NAMES[engine]}…`, 'loading');
  for (const probe of Object.values(PROBES)) {
    $(`#${probe.contextID}`).textContent = `Preparando ${ENGINE_NAMES[engine]}…`;
    $(`#${probe.resultID}`).textContent = 'Los resultados anteriores se conservan en el reporte.';
  }
  for (const id of ['backend', 'viewport', 'drawcalls', 'frame']) $(`#metric-${id}`).textContent = '—';
  drainSwitches();
}

function updateDiagnostics() {
  if (!instance || loading || pageDisposed) return;
  try {
    const diagnostics = instance.getDiagnostics();
    lastDiagnostics = diagnostics;
    const width = diagnostics.viewport?.width ?? diagnostics.width;
    const height = diagnostics.viewport?.height ?? diagnostics.height;
    const calls = diagnostics.frame?.drawCalls ?? diagnostics.drawCalls;
    const frameMs = diagnostics.timing?.averageFrameMs ?? diagnostics.frameMs;
    $('#metric-backend').textContent = diagnostics.backend ?? 'Sin informar';
    $('#metric-viewport').textContent = Number.isFinite(width) && Number.isFinite(height) ? `${width} × ${height}` : '—';
    $('#metric-drawcalls').textContent = Number.isFinite(calls) ? String(calls) : '—';
    $('#metric-frame').textContent = Number.isFinite(frameMs) ? `${frameMs.toFixed(2)} ms` : 'Midiendo…';
    if ($('#diagnostics-details').open) $('#diagnostics-json').textContent = JSON.stringify({ diagnostics, probeState: instance.getProbeState() }, null, 2);
  } catch (error) { $('#diagnostics-json').textContent = `Error al leer diagnóstico: ${error.message}`; }
}

function configSnapshot() {
  return { schema: 'kineti-ab-controls/v1', engine: selectedEngine, requestedBackend: selectedBackend, progress, controls: clone(controls) };
}

function reportSnapshot() {
  let diagnostics = lastDiagnostics;
  let probeState = null;
  if (instance && !loading) {
    try { diagnostics = instance.getDiagnostics(); probeState = instance.getProbeState(); } catch (error) { probeState = { error: error.message }; }
  }
  return {
    schema: 'kineti-ab-report/v2', capturedAt: new Date().toISOString(), configuration: configSnapshot(),
    sceneState: { loading, activeEngine: instanceEngine, activeRequestedBackend: instanceBackend, requestToken: latestRequest, activeToken: instanceToken, probePending: Boolean(probePending) },
    browser: { userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio },
    diagnostics, probeState, computeResults: clone(computeResults), rawControlResults: clone(rawControlResults),
    comparisonLimits: [
      'Solo un motor se crea y ejecuta a la vez. Los cambios de motor se serializan y descartan inicializaciones obsoletas.',
      'Geometría y valores nominales compartidos; unidades de luz, filtrado del entorno, PBR y posprocesado dependen del motor.',
      'El intervalo de fotogramas incluye programación del navegador. No equivale al tiempo GPU ni demuestra superioridad universal.',
      'Los resultados compute se conservan tal como los devuelve la sonda, incluidos estados no soportados y rutas de fallback.',
      'Las sondas avanzadas conservan sus campos MRT, atomics y timestamp sin convertir una ausencia de prueba en incapacidad del motor.',
      'Las implementaciones directas usan una única API: WebGPU o WebGL2. El selector se fija a esa API y no promete un fallback.',
    ],
  };
}

function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  downloadURLs.add(url);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => { URL.revokeObjectURL(url); downloadURLs.delete(url); }, 10_000);
  announce(`${filename} preparado para descargar.`);
}

async function runProbe(kind) {
  if (!instance || loading || probePending || pageDisposed) return;
  const probe = PROBES[kind];
  const current = instance;
  const engine = instanceEngine;
  const backend = instanceBackend;
  const actualBackend = current.getDiagnostics().backend;
  const token = instanceToken;
  $(`#${probe.resultID}`).textContent = 'Ejecutando la sonda…';
  $(`#${probe.contextID}`).textContent = `${ENGINE_NAMES[engine]} · ${actualBackend}`;
  // Defer the body by one microtask so even a synchronous probe is protected by
  // the same pending promise used by the engine-switch and disposal queue.
  const work = Promise.resolve().then(async () => {
    const capturedAt = new Date().toISOString();
    const context = { capturedAt, engine, requestedBackend: backend, actualBackend };
    try {
      const result = typeof current[probe.method] === 'function'
        ? await current[probe.method]()
        : { supported: false, implemented: false, scope: 'fixture', reason: `Este fixture no implementa ${probe.method}(). La ausencia de sonda no establece un límite del motor.` };
      probe.records.push({ ...context, result });
      if (!pageDisposed && token === latestRequest) showProbeRecords();
      if (!pageDisposed) announce(`Sonda completada en ${ENGINE_NAMES[engine]}. Revisa la respuesta exacta.`);
      return result;
    } catch (error) {
      const failure = { ...context, error: error.message || String(error) };
      probe.records.push(failure);
      if (!pageDisposed && token === latestRequest) showProbeRecords();
      if (!pageDisposed) announce(`La sonda devolvió un error: ${failure.error}`);
      return failure;
    }
  });
  probePending = work;
  syncProbeButtons();
  try { return await work; } finally { probePending = null; syncProbeButtons(); }
}

for (const button of document.querySelectorAll('[data-engine]')) {
  button.addEventListener('click', () => { if (button.dataset.engine !== selectedEngine || !instance) switchEngine(button.dataset.engine); });
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = ENGINE_KEYS.indexOf(button.dataset.engine);
    const next = event.key === 'Home' ? ENGINE_KEYS[0] : event.key === 'End' ? ENGINE_KEYS.at(-1)
      : ENGINE_KEYS[(index + (event.key === 'ArrowRight' ? 1 : -1) + ENGINE_KEYS.length) % ENGINE_KEYS.length];
    $(`#engine-${next}`).focus(); switchEngine(next);
  });
}
$('#backend-select').addEventListener('change', (event) => switchEngine(selectedEngine, event.target.value));
$('#compute-run').addEventListener('click', () => runProbe('compute'));
$('#raw-control-run').addEventListener('click', () => runProbe('raw'));
$('#export-config').addEventListener('click', () => downloadJSON(configSnapshot(), `kineti-ab-${selectedEngine}-config.json`));
$('#export-report').addEventListener('click', () => downloadJSON(reportSnapshot(), `kineti-ab-${selectedEngine}-report.json`));
$('#diagnostics-details').addEventListener('toggle', updateDiagnostics);
$('#panel-toggle').addEventListener('click', () => {
  const panel = $('#control-panel'); panel.hidden = !panel.hidden;
  $('#panel-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  $('#panel-toggle').textContent = panel.hidden ? 'Mostrar controles' : 'Ocultar controles';
});
for (const [id, nextProgress] of [['preset-hero', 0], ['preset-mosaic', 0.6]]) {
  $(`#${id}`).addEventListener('click', () => {
    controls = clone(initialDefaults || DEFAULTS); progress = nextProgress;
    modifiedControls.clear();
    syncInputs(); applyControls(); announce(`Preset ${nextProgress ? 'Mosaico' : 'Hero'} aplicado; parámetros restablecidos.`);
  });
}

window.__KINETI_AB__ = {
  getConfiguration: configSnapshot, getReport: reportSnapshot,
  switchEngine: (engine, backend = preferredBackend) => switchEngine(engine, backend),
  runComputeProbe: () => runProbe('compute'), runRawControlProbe: () => runProbe('raw'),
  get loading() { return loading; },
};
const diagnosticTimer = setInterval(updateDiagnostics, 500);
addEventListener('pagehide', () => {
  pageDisposed = true; latestRequest++; clearInterval(diagnosticTimer); clearTimeout(actionTimer);
  for (const url of downloadURLs) URL.revokeObjectURL(url);
  if (probePending) probePending.finally(disposeCurrent); else disposeCurrent();
}, { once: true });
switchEngine();
