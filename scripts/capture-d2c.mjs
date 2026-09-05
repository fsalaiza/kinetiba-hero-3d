import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const output = `docs/QA/d2c-live-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
const report = { url: 'https://www.d2c-lifescience.com/', capturedAt: new Date().toISOString(), errors: [], console: [], stages: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => { if (['error', 'warn'].includes(message.type())) report.console.push({ type: message.type(), text: message.text() }); });
try {
  await page.goto(report.url, { waitUntil: 'networkidle0', timeout: 90000 });
  await delay(5000);
  report.initial = await page.evaluate(() => ({ title: document.title, url: location.href, text: document.body.innerText,
    viewport: [innerWidth, innerHeight], scrollHeight: document.documentElement.scrollHeight,
    canvases: [...document.querySelectorAll('canvas')].map((c) => ({ width: c.width, height: c.height, className: c.className })),
    globals: { threeRevision: window.__THREE__ ?? null, gsapVersion: window.gsap?.version ?? null },
    scripts: [...document.scripts].map((s) => s.src).filter(Boolean),
  }));
  for (const p of [0, .06, .12, .20, .28, .36, .44, .52, .60, .68, .76, .84, .92, 1]) {
    await page.evaluate((value) => scrollTo(0, value * (document.documentElement.scrollHeight - innerHeight)), p);
    await delay(1700);
    const filename = `scroll-${String(Math.round(p * 100)).padStart(3, '0')}.png`;
    await page.screenshot({ path: `${output}/${filename}` });
    report.stages.push({ requestedProgress: p, actual: await page.evaluate(() => ({ scrollY, range: document.documentElement.scrollHeight - innerHeight, text: document.body.innerText.slice(0, 1800) })), screenshot: filename });
  }
  report.resources = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => ({ name: r.name, type: r.initiatorType, duration: r.duration, transferSize: r.transferSize })));
  console.log(JSON.stringify({ initial: report.initial, resources: report.resources.filter((r) => /\.(glb|gltf|hdr|exr|ktx|wasm|js)(\?|$)/.test(r.name)), errors: report.errors }, null, 2));
} catch (error) { report.errors.push(error.stack); console.error(error.message); }
finally { await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); console.log(output); }
