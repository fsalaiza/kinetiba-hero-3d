import puppeteer from 'puppeteer';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

const baseURL = process.env.KINETI_LAB_URL || 'http://127.0.0.1:4174';
const output = path.resolve(`docs/QA/lab-${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
const report = {
  baseURL, checks: [], routes: [], errors: [], warnings: [],
  scope: 'Functional production-build QA: five candidates, eight backend routes, real GPU probes, controls, lifecycle, keyboard, exports and local reference images. Frame cadence is not a GPU performance comparison.',
};
const check = (name, pass, evidence) => {
  report.checks.push({ name, pass: Boolean(pass), ...(evidence === undefined ? {} : { evidence }) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
};
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') report.errors.push(message.text());
  if (message.type() === 'warn') report.warnings.push(message.text());
});
const names = { three: 'Three.js', babylon: 'Babylon.js', playcanvas: 'PlayCanvas', native_webgpu: 'WebGPU directo', native_webgl: 'Native WebGL2' };
const routes = [
  ['three', 'auto', 'WebGPU'], ['three', 'webgl2', 'WebGL2'],
  ['babylon', 'auto', 'WebGPU'], ['babylon', 'webgl2', 'WebGL2'],
  ['playcanvas', 'auto', 'WebGPU'], ['playcanvas', 'webgl2', 'WebGL2'],
  ['native_webgpu', 'webgpu', 'WebGPU'], ['native_webgl', 'webgl2', 'WebGL2'],
];
const ready = async (engine, backend) => {
  await page.waitForFunction(({ engine, backend, name }) => {
    const lab = window.__KINETI_AB__, app = window.__COMPARISON__, diagnostics = app?.getDiagnostics();
    return !lab?.loading && lab?.getConfiguration().engine === engine && diagnostics?.engine === name
      && diagnostics.backend === backend && (diagnostics.ready || (diagnostics.frameNumber ?? diagnostics.frames) > 0)
      && (diagnostics.environmentLoaded || diagnostics.environment?.status === 'loaded')
      && document.querySelector('#status-light')?.dataset.state === 'ready';
  }, { timeout: 45000 }, { engine, backend, name: names[engine] });
  await delay(200);
};
const setControl = (id, value, event = 'input') => page.$eval(`#control-${id}`, (element, { value, event }) => {
  element.value = value; element.dispatchEvent(new Event(event, { bubbles: true }));
}, { value: String(value), event });
const runProbe = async (kind) => {
  const key = kind === 'compute' ? 'computeResults' : 'rawControlResults';
  const prefix = kind === 'compute' ? 'compute' : 'raw-control';
  const before = await page.evaluate((key) => window.__KINETI_AB__.getReport()[key].length, key);
  await page.$eval(`#${prefix}-run`, (element) => element.click());
  await page.waitForFunction(({ key, before }) => window.__KINETI_AB__.getReport()[key].length === before + 1
    && !window.__KINETI_AB__.getReport().sceneState.probePending, { timeout: 30000 }, { key, before });
  return page.evaluate(({ key, prefix }) => {
    const record = window.__KINETI_AB__.getReport()[key].at(-1);
    const displayed = JSON.parse(document.querySelector(`#${prefix}-result`).textContent);
    return { record, exactDisplay: JSON.stringify(displayed) === JSON.stringify(record.result) };
  }, { key, prefix });
};
const watchDisposal = () => page.evaluate(() => {
  const app = window.__COMPARISON__;
  if (!app) return;
  const observations = window.__LAB_DISPOSALS__ ||= [];
  const observation = { engine: app.getDiagnostics().engine, calls: 0, framesAtDispose: null, app };
  observations.push(observation);
  const dispose = app.dispose.bind(app);
  app.dispose = async () => {
    observation.calls++;
    await dispose();
    try { const diagnostics = app.getDiagnostics(); observation.framesAtDispose = diagnostics.frameNumber ?? diagnostics.frames ?? null; } catch { /* Some engines clear diagnostic resources on disposal. */ }
  };
});

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseURL}/research/ab.html`, { waitUntil: 'networkidle0' });
  await ready('three', 'WebGPU');
  check('five-candidate-tabs', await page.$$eval('[role=tab]', (tabs) => tabs.length === 5));
  const links = await page.$$eval('.lab-header nav a', (anchors) => anchors.map((anchor) => anchor.href));
  check('reference-and-unreal-links', links.includes(`${baseURL}/research/reference.html`) && links.some((url) => url === 'http://127.0.0.1:8899/'), links);

  await setControl('roughness', .77);
  await setControl('rotation-1', .91);
  await setControl('pieceOffset', .23);
  await setControl('progress', .6);
  await setControl('density', 162, 'change');
  const shared = await page.evaluate(() => window.__KINETI_AB__.getConfiguration());

  for (const [engine, requestedBackend, actualBackend] of routes) {
    const key = `${engine}-${actualBackend.toLowerCase()}`;
    if (!(engine === 'three' && requestedBackend === 'auto')) {
      await watchDisposal();
      await page.evaluate(({ engine, requestedBackend }) => window.__KINETI_AB__.switchEngine(engine, requestedBackend), { engine, requestedBackend });
      await ready(engine, actualBackend);
    }
    const state = await page.evaluate(() => ({
      configuration: window.__KINETI_AB__.getConfiguration(), controls: window.__COMPARISON__.getControls(),
      diagnostics: window.__COMPARISON__.getDiagnostics(),
      canvasCount: document.querySelectorAll('canvas').length,
      backendSelector: { disabled: document.querySelector('#backend-select').disabled, value: document.querySelector('#backend-select').value },
    }));
    check(`${key}: controls-preserved`, JSON.stringify(state.controls) === JSON.stringify(shared.controls) && state.configuration.progress === .6);
    check(`${key}: one-active-canvas`, state.canvasCount === 1 && state.diagnostics.backend === actualBackend);
    const fixed = engine.startsWith('native_');
    check(`${key}: backend-selector`, state.backendSelector.disabled === fixed && state.backendSelector.value === requestedBackend, state.backendSelector);
    const compute = await runProbe('compute');
    const expectedUnsupported = actualBackend === 'WebGL2' && ['babylon', 'playcanvas'].includes(engine);
    check(`${key}: compute-semantics`, compute.exactDisplay && !compute.record.error && (expectedUnsupported
      ? compute.record.result.supported === false : compute.record.result.supported === true && compute.record.result.passed === true), compute.record.result);
    if (actualBackend === 'WebGL2' && !expectedUnsupported) check(`${key}: transform-feedback-labelled`, /transform feedback/i.test(compute.record.result.path));
    const advanced = await runProbe('raw');
    const missing = ['three', 'babylon'].includes(engine);
    check(`${key}: advanced-semantics`, advanced.exactDisplay && !advanced.record.error && (missing
      ? advanced.record.result.supported === false && advanced.record.result.implemented === false && advanced.record.result.scope === 'fixture'
      : advanced.record.result.mrt?.passed === true), advanced.record.result);
    if (engine === 'native_webgpu') check(`${key}: atomic-readback`, advanced.record.result.atomics?.passed === true && JSON.stringify(advanced.record.result.atomics.actual) === '[64,2016]');
    if (engine === 'native_webgl') check(`${key}: atomic-limit-preserved`, advanced.record.result.atomics?.supported === false);
    report.routes.push({ engine, requestedBackend, actualBackend, diagnostics: state.diagnostics, compute: compute.record, advanced: advanced.record });
  }

  // The fixed route ignores an incompatible backend request and makes that
  // forced API explicit in both the selector and the exported configuration.
  await watchDisposal();
  await page.evaluate(() => window.__KINETI_AB__.switchEngine('native_webgpu', 'webgl2'));
  await ready('native_webgpu', 'WebGPU');
  check('native-webgpu-does-not-claim-webgl-fallback', await page.evaluate(() => window.__KINETI_AB__.getConfiguration().requestedBackend === 'webgpu'
    && document.querySelector('#backend-select').value === 'webgpu' && document.querySelector('#backend-select').disabled));

  // Start a real asynchronous GPU readback and request several renderers in the
  // same event turn. The queue must preserve its result before disposing it.
  const beforeRace = await page.evaluate(() => window.__KINETI_AB__.getReport().computeResults.length);
  await watchDisposal();
  await page.evaluate(() => {
    document.querySelector('#compute-run').click();
    document.querySelector('#engine-playcanvas').click();
    document.querySelector('#engine-native_webgl').click();
    document.querySelector('#engine-babylon').click();
    document.querySelector('#engine-three').click();
    document.querySelector('#engine-playcanvas').click();
    const input = document.querySelector('#control-roughness'); input.value = '.66'; input.dispatchEvent(new Event('input'));
  });
  await ready('playcanvas', 'WebGL2');
  check('rapid-switch-settles-on-last-request', await page.evaluate(() => window.__KINETI_AB__.getReport().sceneState.activeEngine === 'playcanvas' && document.querySelectorAll('canvas').length === 1));
  check('edit-during-switch-preserved', await page.evaluate(() => window.__COMPARISON__.getControls().roughness === .66));
  check('pending-gpu-probe-preserved-before-disposal', await page.evaluate((before) => {
    const records = window.__KINETI_AB__.getReport().computeResults;
    return records.length === before + 1 && records.at(-1).engine === 'native_webgpu' && records.at(-1).result.passed === true;
  }, beforeRace));
  const disposals = await page.evaluate(() => window.__LAB_DISPOSALS__.map(({ app, ...observation }) => {
    let laterFrames = null;
    try { const diagnostics = app.getDiagnostics(); laterFrames = diagnostics.frameNumber ?? diagnostics.frames ?? null; } catch { /* Diagnostic resources may have been released. */ }
    return { ...observation, laterFrames };
  }));
  check('previous-scenes-disposed-once', disposals.every((item) => item.calls === 1), disposals);
  check('disposed-readable-frame-counters-stop', disposals.every((item) => item.framesAtDispose === null || item.laterFrames === null || item.framesAtDispose === item.laterFrames));

  await page.focus('#engine-playcanvas');
  await page.keyboard.press('Home'); await ready('three', 'WebGL2');
  check('keyboard-home', await page.evaluate(() => document.activeElement.id === 'engine-three'));
  for (const [engine, backend] of [['babylon', 'WebGL2'], ['playcanvas', 'WebGL2'], ['native_webgpu', 'WebGPU'], ['native_webgl', 'WebGL2'], ['three', 'WebGL2']]) {
    await page.keyboard.press('ArrowRight'); await ready(engine, backend);
    check(`keyboard-right-${engine}`, await page.evaluate((engine) => document.activeElement.id === `engine-${engine}`
      && document.querySelectorAll('[role=tab][tabindex="0"]').length === 1, engine));
  }
  await page.keyboard.press('ArrowLeft'); await ready('native_webgl', 'WebGL2');
  check('keyboard-left-wrap', await page.evaluate(() => document.activeElement.id === 'engine-native_webgl'));
  await page.keyboard.press('Home'); await ready('three', 'WebGL2');
  await page.keyboard.press('End'); await ready('native_webgl', 'WebGL2');
  check('keyboard-end', await page.evaluate(() => document.activeElement.id === 'engine-native_webgl'));

  await page.click('#preset-hero');
  check('hero-preset', await page.evaluate(() => window.__COMPARISON__.getDiagnostics().progress === 0));
  await page.click('#preset-mosaic');
  check('mosaic-preset', await page.evaluate(() => window.__COMPARISON__.getDiagnostics().progress === .6 && window.__COMPARISON__.getControls().density === 432));

  const session = await page.createCDPSession();
  await session.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
  await page.$eval('#export-config', (element) => element.click());
  await page.$eval('#export-report', (element) => element.click());
  let downloaded = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    downloaded = (await readdir(output)).filter((name) => /^kineti-ab-.*-(config|report)\.json$/.test(name));
    if (downloaded.length === 2) break;
    await delay(100);
  }
  const configName = downloaded.find((name) => name.endsWith('-config.json'));
  const reportName = downloaded.find((name) => name.endsWith('-report.json'));
  const config = configName ? JSON.parse(await readFile(path.join(output, configName), 'utf8')) : null;
  const payload = reportName ? JSON.parse(await readFile(path.join(output, reportName), 'utf8')) : null;
  check('configuration-download-identifies-fixed-backend', config?.engine === 'native_webgl' && config?.requestedBackend === 'webgl2' && config?.progress === .6);
  check('report-download-has-real-diagnostics-and-both-probes', payload?.diagnostics?.backend === 'WebGL2' && payload?.computeResults?.length === 9 && payload?.rawControlResults?.length === 8);
  check('report-preserves-unsupported-and-unimplemented', payload?.computeResults?.some((entry) => entry.engine === 'playcanvas' && entry.result.supported === false)
    && payload?.rawControlResults?.some((entry) => entry.result.scope === 'fixture' && entry.result.implemented === false)
    && payload?.rawControlResults?.some((entry) => entry.engine === 'native_webgl' && entry.result.atomics.supported === false));

  await page.$eval('#control-panel', (element) => { element.scrollTop = 0; });
  await page.screenshot({ path: path.join(output, 'laboratory-five-candidates.png') });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.waitForFunction(() => document.querySelector('#metric-viewport').textContent === '390 × 844');
  check('mobile-render-and-diagnostics-resize', await page.evaluate(() => {
    const diagnostics = window.__COMPARISON__.getDiagnostics();
    return (diagnostics.viewport?.width ?? diagnostics.width) === 390 && (diagnostics.viewport?.height ?? diagnostics.height) === 844;
  }));
  check('mobile-tabs-fit-viewport', await page.$$eval('[role=tab]', (tabs) => tabs.every((tab) => { const box = tab.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.width > 0; })));
  await page.click('#panel-toggle');
  check('panel-can-be-hidden', await page.$eval('#control-panel', (panel) => panel.hidden));
  await page.screenshot({ path: path.join(output, 'laboratory-mobile.png') });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await page.evaluate(async () => {
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  check('pagehide-disposes-active-canvas', await page.evaluate(() => window.__COMPARISON__ === null && document.querySelectorAll('canvas').length === 0));
  await page.goto(`${baseURL}/research/reference.html?frame=188`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#primary').complete && document.querySelector('#primary').naturalWidth === 1280);
  check('compiled-reference-viewer-and-original-load', await page.$eval('#title', (element) => element.textContent.includes('Doble hélice')));
  let referenceCount = 0;
  for (const start of [1, 25, 49, 73, 97, 121, 145, 169]) {
    await page.goto(`${baseURL}/research/reference.html?sheet=1&start=${start}&count=24`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => [...document.querySelectorAll('#grid img')].every((image) => image.complete && image.naturalWidth === 1280));
    referenceCount += await page.$$eval('#grid img', (images) => images.length);
  }
  check('compiled-reference-all-188-load', referenceCount === 188);
  check('no-browser-errors', report.errors.length === 0, report.errors);
} catch (error) {
  report.errors.push(error.stack);
  check('completed', false, error.message);
  try { await page.screenshot({ path: path.join(output, 'failure.png') }); } catch { /* Preserve the original failure. */ }
} finally {
  report.summary = { passed: report.checks.filter((item) => item.pass).length, failed: report.checks.filter((item) => !item.pass).length, routes: report.routes.length };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(output);
  console.log(JSON.stringify(report.summary));
}
if (report.errors.length || report.checks.some((item) => !item.pass)) process.exitCode = 1;
