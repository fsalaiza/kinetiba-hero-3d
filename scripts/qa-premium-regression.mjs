import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { decodePNG } from './lib/png-metrics.mjs';

// Regression for a real stale GPU matrix after 1 → 0 → .23 → 1.
// Compare rendered pixels, not just the CPU matrices that passed while broken.
const base = process.env.KINETI_QA_URL || 'http://127.0.0.1:5173';
const output = path.resolve(`docs/QA/premium-regression-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const report = { schema: 'kineti.premium-regression/v1', url: base, runs: [], checks: [] };
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};
function pixelDifference(a, b) {
  const left = decodePNG(a), right = decodePNG(b);
  if (left.width !== right.width || left.height !== right.height) throw Error('Image dimensions differ');
  let changed = 0, sum = 0;
  for (let i = 0; i < left.width * left.height; i++) {
    let delta = 0;
    for (let c = 0; c < 3; c++) delta += Math.abs(left.pixels[i * left.channels + c] - right.pixels[i * right.channels + c]);
    if (delta > 0) changed++;
    sum += delta;
  }
  return { changedPixels: changed, totalPixels: left.width * left.height, meanAbsoluteRGB: sum / (left.width * left.height * 3) };
}
async function move(page, progress) {
  await page.evaluate((p) => window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * p, behavior: 'instant' }), progress);
  await page.waitForFunction((p) => Math.abs(window.__KINETI__?.progress - p) < .0002 && window.__KINETI__?.idle, { timeout: 15000 }, progress);
  await delay(70);
}
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
report.browser = await browser.version();
try {
  for (const backend of ['webgpu', 'webgl']) for (const [size, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const name = `${backend}-${size}`, context = await browser.createBrowserContext(), page = await context.newPage();
    const run = { name, errors: [], diagnostics: null }; report.runs.push(run);
    page.on('pageerror', (error) => run.errors.push(String(error)));
    page.on('console', (message) => { if (message.type() === 'error') run.errors.push(message.text()); });
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.goto(`${base}/?renderer=${backend}`, { waitUntil: 'networkidle0', timeout: 45000 });
      await page.waitForFunction(() => window.__KINETI__?.ready && window.__KINETI__?.idle, { timeout: 45000 });
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: 'body * { visibility:hidden !important; } body canvas { visibility:visible !important; }' });
      await move(page, 1);
      const direct = Buffer.from(await page.screenshot({ path: path.join(output, `${name}-final-direct.png`) }));
      for (const p of [0, .23, 1]) await move(page, p);
      const sequential = Buffer.from(await page.screenshot({ path: path.join(output, `${name}-final-sequential.png`) }));
      const difference = pixelDifference(direct, sequential);
      check(`${name}/no-stale-glyph-after-open`, difference.changedPixels === 0, difference);
      const before = await page.evaluate(() => window.__KINETI__.getDiagnostics().frameNumber);
      await delay(1000);
      const after = await page.evaluate(() => window.__KINETI__.getDiagnostics().frameNumber);
      check(`${name}/zero-idle-gpu-frames`, before === after, { before, after });
      const firstFieldStarted = performance.now();
      await move(page, .74);
      const firstFieldMs = performance.now() - firstFieldStarted;
      // Local regression guard for the observed ~7s first-field compilation
      // stall. Includes automation/settling, and is not a frame-time benchmark.
      check(`${name}/no-multi-second-first-field-stall`, firstFieldMs < 2000, { automationObservedMs: firstFieldMs, localLimitMs: 2000 });
      await page.screenshot({ path: path.join(output, `${name}-macro.png`) });
      await move(page, 1);
      const returned = Buffer.from(await page.screenshot({ path: path.join(output, `${name}-final-after-field.png`) }));
      const restored = pixelDifference(direct, returned);
      check(`${name}/field-return-restores-image`, restored.changedPixels === 0, restored);
      run.diagnostics = await page.evaluate(() => window.__KINETI__.getDiagnostics());
      check(`${name}/requested-real-backend`, run.diagnostics.backend.toLowerCase().includes(backend), { actual: run.diagnostics.backend });
      check(`${name}/scroll-wakes-render`, run.diagnostics.frameNumber > after, { afterIdle: after, final: run.diagnostics.frameNumber });
    } catch (error) { run.errors.push(String(error.stack || error)); }
    finally { check(`${name}/no-errors`, run.errors.length === 0, run.errors); await context.close(); }
  }
} finally {
  await browser.close();
  report.summary = { passed: report.checks.filter((c) => c.passed).length, failed: report.checks.filter((c) => !c.passed).length };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ summary: report.summary, output }));
  if (report.summary.failed) process.exitCode = 1;
}
