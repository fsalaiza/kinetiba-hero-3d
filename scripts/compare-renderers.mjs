import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const output = `docs/QA/comparison-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const session = await browser.target().createCDPSession();
const system = await session.send('SystemInfo.getInfo');
const report = { browser: await browser.version(), headless: true, gpu: system.gpu, runs: [],
  limits: 'Same authored geometry, camera and counts. Different PBR shaders, environment filtering and draw submission. RAF intervals measure browser cadence under this local workload, not isolated GPU time or a universal engine ranking. Desktop viewport, not a physical phone.' };
try {
  for (const engine of ['three', 'babylon']) for (const backend of ['webgpu', 'webgl']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    const run = { engine, requestedBackend: backend, errors: [], warnings: [], phases: [] };
    report.runs.push(run);
    page.on('pageerror', (e) => run.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') run.errors.push(m.text()); else if (m.type() === 'warn') run.warnings.push(m.text()); });
    const query = backend === 'webgl' ? (engine === 'babylon' ? '?backend=webgl2' : '?renderer=webgl') : '';
    const started = Date.now();
    try {
      await page.goto(`http://127.0.0.1:5173/research/${engine}.html${query}`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => Boolean(window.__COMPARISON__?.getDiagnostics()), { timeout: 45000 });
      await delay(1800);
      run.navigationAndSettlingMs = Date.now() - started;
      for (const progress of [0, .6]) {
        await page.evaluate((p) => window.__COMPARISON__.setProgress(p), progress);
        await delay(1600);
        const diagnostics = await page.evaluate(() => window.__COMPARISON__.getDiagnostics());
        const cadence = await page.evaluate(() => new Promise((resolve) => {
          const intervals = []; let previous;
          const frame = (time) => {
            if (previous !== undefined) intervals.push(time - previous);
            previous = time;
            if (intervals.length < 120) requestAnimationFrame(frame);
            else { intervals.sort((a, b) => a - b); resolve({ samples: intervals.length, medianMs: intervals[60], p95Ms: intervals[114], maxMs: intervals[119] }); }
          }; requestAnimationFrame(frame);
        }));
        // Keep only the actual canvas visible, at the original fixed viewport.
        const style = await page.addStyleTag({ content: 'body>*:not(canvas):not(script){visibility:hidden!important}' });
        const screenshot = `${engine}-${backend}-${progress === 0 ? 'cube' : 'field'}.png`;
        await page.screenshot({ path: `${output}/${screenshot}` });
        await style.evaluate((node) => node.remove());
        run.phases.push({ progress, diagnostics, cadence, screenshot });
        console.log(JSON.stringify({ engine, backend, progress, diagnostics, cadence }));
      }
    } catch (error) { run.errors.push(error.stack); console.error(engine, backend, error.message); }
    await page.close();
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(`Report: ${output}/report.json`);
  await browser.close();
}
if (report.runs.some((r) => r.errors.length)) process.exitCode = 1;
