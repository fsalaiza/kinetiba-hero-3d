import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { samplePNG, difference } from './lib/png-metrics.mjs';

const output = `docs/QA/controls-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const session = await browser.target().createCDPSession();
const report = { browser: await browser.version(), headless: true, gpu: (await session.send('SystemInfo.getInfo')).gpu,
  viewport: { width: 1440, height: 900, dpr: 1 }, runs: [],
  limits: 'Functional control probes and raster changes, not subjective beauty scores or proof of all engine capabilities. Same control values need not produce identical PBR lighting. Browser on Windows RTX5080, not a physical mobile device.' };
const close = (a, b, tolerance = 1e-5) => Math.abs(a - b) <= tolerance;
const same = (a, b) => a.length === b.length && a.every((v, i) => close(v, b[i]));
const candidates = {
  three: { page: 'three', backends: ['webgpu', 'webgl'], computeWebGL: true },
  babylon: { page: 'babylon', backends: ['webgpu', 'webgl'], computeWebGL: false },
  playcanvas: { page: 'playcanvas', backends: ['webgpu', 'webgl'], computeWebGL: false },
  native_webgpu: { page: 'native-webgpu', backends: ['webgpu'] },
  native_webgl: { page: 'native-webgl', backends: ['webgl'], computeWebGL: true },
};
try {
  for (const engine of (process.env.KINETI_QA_ENGINE ? [process.env.KINETI_QA_ENGINE] : Object.keys(candidates))) for (const backend of (process.env.KINETI_QA_BACKEND ? [process.env.KINETI_QA_BACKEND] : candidates[engine].backends)) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const run = { engine, requestedBackend: backend, checks: [], errors: [], warnings: [] };
    report.runs.push(run);
    const check = (name, passed, evidence) => { run.checks.push({ name, passed: Boolean(passed), evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${engine}/${backend}/${name}`); };
    page.on('pageerror', (e) => run.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') run.errors.push(m.text()); if (m.type() === 'warn') run.warnings.push(m.text()); });
    const query = backend === 'webgl' ? '?backend=webgl2&renderer=webgl' : '';
    try {
      await page.goto(`http://127.0.0.1:5173/research/${candidates[engine].page}.html${query}`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => Boolean(window.__COMPARISON__?.runComputeProbe && window.__COMPARISON__?.getProbeState), { timeout: 45000 });
      await delay(1000);
      await page.addStyleTag({ content: 'body>*:not(canvas):not(script){visibility:hidden!important}' });
      const defaults = await page.evaluate(() => window.__COMPARISON__.getControls());
      const control = async (patch, progress = 0) => {
        await page.evaluate(({ patch, progress }) => { window.__COMPARISON__.setControls(patch); window.__COMPARISON__.setProgress(progress); }, { patch, progress });
        await delay(650);
        return page.evaluate(() => window.__COMPARISON__.getProbeState());
      };
      const capture = async (name, save = false) => {
        const screenshot = `${engine}-${backend}-${name}.png`;
        const pixels = await page.screenshot(save ? { path: `${output}/${screenshot}` } : {});
        return samplePNG(pixels);
      };
      const baseline = await control(defaults);
      const baselineImage = await capture('baseline', true);
      check('visible-cube', baselineImage.variance > 10 && baselineImage.quantizedColors > 10, { variance: baselineImage.variance, colors: baselineImage.quantizedColors });
      const selected = await control({ selectedPiece: 26, pieceOffset: .625 });
      check('individual-piece-isolation', close(selected.selected.local[1] - baseline.selected.local[1], .625) && same(selected.other.local, baseline.other.local), { baseline, selected });
      const exploded = await control({ ...defaults, explode: .7 });
      check('independent-axis-positions', exploded.selected.local.every((v) => close(v, .96 + .75 * .7)), exploded);
      await capture('exploded', true);
      const camera = await control({ ...defaults, cameraFov: 52, rotation: [.7, -.35, .1] });
      const cameraImage = await capture('camera', true);
      check('camera-and-absolute-rotation', close(camera.cameraFov, 52) && !same(camera.selected.world, baseline.selected.world) && difference(baselineImage.sample, cameraImage.sample).meanAbsolute > .3, camera);
      const probes = [
        ['roughness', { roughness: .06 }, { roughness: .88 }],
        ['metalness', { metalness: 0 }, { metalness: .95 }],
        ['clearcoat', { clearcoat: 0 }, { clearcoat: 1 }],
        ['environment', { environmentIntensity: .05 }, { environmentIntensity: 1.8 }],
        ['light', { keyIntensity: .05 }, { keyIntensity: 5.5 }],
        ['exposure', { exposure: .6 }, { exposure: 1.6 }],
        ['glyph-color', { glyphColor: '#354330' }, { glyphColor: '#ff3d81' }],
        ['shadows', { shadows: false }, { shadows: true }],
        ['custom-post', { postEffect: 0 }, { postEffect: .8 }],
      ];
      for (const [name, from, to] of probes) {
        await control({ ...defaults, ...from }); const first = await capture(`${name}-from`);
        const state = await control(to); const second = await capture(name, ['shadows', 'custom-post', 'glyph-color'].includes(name));
        // The control may be deliberately subtle (e.g. clearcoat). Count every
        // quantized RGB change; still require a nonzero average over the image.
        const pixels = difference(first.sample, second.sample, 0);
        check(`${name}-changes-rendered-pixels`, pixels.meanAbsolute > .015 && pixels.changedFraction > 0, { state, pixels });
      }
      await control(defaults, .6);
      const grid = await capture('field', true);
      const beforeWave = await page.evaluate(() => window.__COMPARISON__.getProbeState());
      const afterWave = await control({ waveAmplitude: .6, wavePhase: 1.8 }, .6);
      const wave = await capture('gpu-wave', true);
      const waveDifference = difference(grid.sample, wave.sample);
      check('gpu-wave-without-matrix-upload', close(afterWave.gpuWave.amplitude, .6) && beforeWave.instanceMatrixVersion === afterWave.instanceMatrixVersion && waveDifference.meanAbsolute > .3, { beforeWave, afterWave, pixels: waveDifference });
      const sparse = await control({ density: 162, waveAmplitude: 0 }, .6);
      const sparseImage = await capture('density-162', true);
      check('instance-count-and-visible-density', sparse.density === 162 && difference(grid.sample, sparseImage.sample).meanAbsolute > .3, sparse);
      await control(defaults, 0); const restored = await capture('restored', true);
      const restoredPixels = difference(baselineImage.sample, restored.sample);
      check('reversible-exact-pose', restoredPixels.meanAbsolute < .15, restoredPixels);
      const compute = await page.evaluate(() => window.__COMPARISON__.runComputeProbe());
      run.compute = compute;
      check('compute-result-or-explicit-limit', backend === 'webgl' && !candidates[engine].computeWebGL
        ? compute.supported === false
        : compute.supported && compute.passed && compute.values.length === 64 && compute.values.every((v, i) => v === i * 3 + 7), compute);
      run.final = await page.evaluate(() => window.__COMPARISON__.getDiagnostics());
      if (await page.evaluate(() => typeof window.__COMPARISON__.runRawControlProbe === 'function')) {
        run.rawControl = await page.evaluate(() => window.__COMPARISON__.runRawControlProbe());
        check('raw-control-mrt', run.rawControl.mrt?.passed === true, run.rawControl);
        if (run.rawControl.atomics?.supported) check('raw-control-atomics', run.rawControl.atomics.passed === true, run.rawControl.atomics);
      }
      check('no-render-errors', run.errors.length === 0, run.errors);
    } catch (error) { run.errors.push(error.stack); check('completed', false, String(error)); }
    await page.close();
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`Report: ${output}/report.json`);
  await browser.close();
}
if (report.runs.some((run) => run.errors.length || run.checks.some((c) => !c.passed))) process.exitCode = 1;
