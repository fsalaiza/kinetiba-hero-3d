import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const output = 'docs/QA/performance-preservation';
await mkdir(output, { recursive: true });
const report = { url: 'http://127.0.0.1:4174', checks: [], runs: [] };
const check = (name, passed, evidence) => { report.checks.push({ name, passed: Boolean(passed), evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const variant of ['grain=1', 'fx=rgb', 'hover=1', 'idle=1', 'hdr-fallback', 'webgl-fallback', 'static-fallback']) {
    const context = await browser.createBrowserContext(), page = await context.newPage();
    const run = { variant, errors: [], requests: [] }; report.runs.push(run);
    page.on('pageerror', (error) => run.errors.push(String(error)));
    page.on('request', (request) => run.requests.push(request.url()));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    try {
      if (variant === 'hdr-fallback') {
        await page.setRequestInterception(true);
        page.on('request', (request) => request.url().endsWith('.exr') ? request.respond({ status: 404, body: 'Intentional EXR failure' }) : request.continue());
      }
      if (variant.endsWith('fallback') && variant !== 'hdr-fallback') {
        await page.evaluateOnNewDocument((staticFallback) => {
          if (navigator.gpu) navigator.gpu.requestAdapter = async () => null;
          if (staticFallback) {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
          }
        }, variant === 'static-fallback');
      }
      await page.goto(`${report.url}/?${variant.includes('=') ? variant : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`[data-scene="${variant === 'static-fallback' ? 'error' : 'ready'}"]`, { timeout: 45000 });
      await delay(700);
      if (variant === 'static-fallback') {
        check('static-fallback/visible', await page.$eval('.kineti-scene-fallback', (el) => el.getBoundingClientRect().width > 0));
        await page.click('[data-testid="phase-nav"] [data-progress="0.23"]');
        await page.waitForSelector('[data-phase="1"][data-scene="error"]');
        check('static-fallback/navigation', await page.$eval('#capacidades', (el) => el.getAttribute('data-active') === 'true'));
      } else {
        const state = await page.evaluate(() => window.__KINETI__.getDiagnostics());
        run.diagnostics = state;
        check(`${variant}/ready`, state.ready && !state.renderError);
        if (variant === 'hdr-fallback') check('hdr-fallback/original-loaded', state.environmentLoaded && run.requests.some((url) => url.endsWith('.hdr')));
        if (variant === 'webgl-fallback') check('webgl-fallback/automatic', state.backend === 'WebGL2');
        if (variant === 'grain=1') check('grain/visible', await page.$eval('.kineti-film-grain', (el) => el.getBoundingClientRect().width > 0));
        if (variant === 'fx=rgb') {
          check('rgb/active', state.variants.chromaticAberration);
          await page.evaluate(() => { window.__KINETI__.setReducedMotion(true); window.__KINETI__.goTo(.56); });
          await page.waitForFunction(() => window.__KINETI__.getDiagnostics().idle);
          check('rgb/mosaic', await page.evaluate(() => window.__KINETI__.getDiagnostics().activeTiles === 432));
        }
        if (variant === 'hover=1') {
          const before = await page.evaluate(() => window.__KINETI__.getPoseState());
          await page.mouse.move(720, 390); await delay(300);
          const lifted = await page.evaluate(() => window.__KINETI__.getPoseState());
          check('hover/piece-lifts', lifted.pieces.some((piece, i) => piece.position[2] - before.pieces[i].position[2] > .20));
          await page.mouse.move(5, 5); await delay(300);
          check('hover/releases', await page.evaluate((before) => JSON.stringify(window.__KINETI__.getPoseState()) === JSON.stringify(before), before));
        }
        if (variant === 'idle=1') {
          const before = await page.evaluate(() => window.__KINETI__.getPoseState().cube.quaternion);
          await delay(400);
          check('idle/rotates', await page.evaluate((before) => JSON.stringify(window.__KINETI__.getPoseState().cube.quaternion) !== JSON.stringify(before), before));
        } else if (variant !== 'hdr-fallback') {
          check(`${variant}/single-environment-request`, run.requests.filter((url) => url.endsWith('.exr')).length === 1);
        }
      }
      await page.screenshot({ path: `${output}/${variant.replace('=', '-')}.png` });
    } catch (error) { run.errors.push(String(error.stack || error)); }
    check(`${variant}/no-page-errors`, run.errors.length === 0, run.errors);
    await context.close();
  }
} finally {
  await browser.close();
  report.summary = { passed: report.checks.filter((c) => c.passed).length, failed: report.checks.filter((c) => !c.passed).length };
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary));
  if (report.summary.failed) process.exitCode = 1;
}
