import puppeteer from 'puppeteer';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';

// Uses an installed browser. It never installs or downloads Chrome, disables
// the GPU, substitutes a fake canvas, or mocks clipboard/download behavior.
const BASE_URL = process.env.KINETI_QA_URL || 'http://127.0.0.1:5173';
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT = path.resolve(process.env.KINETI_QA_OUTPUT || `docs/QA/run-${RUN_ID}`);
const PHASES = [0, 0.23, 0.40, 0.56, 0.74, 1];
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 1 };
const CANVAS = '[data-testid="kineti-canvas"], canvas';
const CONTACT = '[data-testid="contact-open"]';
const DIALOG = 'dialog[open], [role="dialog"]';
const report = {
  schema: 'kineti.browser-qa.v1', started: new Date().toISOString(), url: BASE_URL,
  output: OUTPUT, browser: null, checks: [], runs: [], errors: [],
};

function check(name, pass, detail = {}) {
  const item = { name, pass: Boolean(pass), ...detail };
  report.checks.push(item);
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${name}${item.pass ? '' : ` ${JSON.stringify(detail)}`}`);
  return item.pass;
}

async function existingBrowser() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next installed path */ }
  }
  throw new Error('No installed Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH to an existing browser.');
}

function decodePNG(buffer) {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Screenshot is not PNG');
  let width, height, channels;
  const chunks = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[12] !== 0)
        throw new Error(`Unsupported screenshot PNG: bit depth ${data[8]}, color type ${data[9]}, interlace ${data[12]}`);
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') chunks.push(data);
    offset += length + 12;
  }
  if (!width || !height || !channels) throw new Error('Missing PNG dimensions');
  const packed = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let source = 0;
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = packed[source++];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= channels ? pixels[index - channels] : 0;
      const up = y ? pixels[index - stride] : 0;
      const upperLeft = y && x >= channels ? pixels[index - stride - channels] : 0;
      const predictors = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)];
      if (filter > 4) throw new Error(`Invalid PNG filter ${filter}`);
      pixels[index] = (packed[source++] + predictors[filter]) & 255;
    }
  }
  return { width, height, channels, pixels };
}

function samplePNG(buffer) {
  const { width, height, channels, pixels } = decodePNG(buffer);
  const sample = [];
  let sum = 0, sumSquares = 0;
  const colors = new Set();
  for (let gy = 0; gy < 72; gy++) {
    const y = Math.min(height - 1, Math.floor((gy + 0.5) * height / 72));
    for (let gx = 0; gx < 96; gx++) {
      const x = Math.min(width - 1, Math.floor((gx + 0.5) * width / 96));
      const index = (y * width + x) * channels;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      sample.push(r, g, b);
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
      sum += luminance; sumSquares += luminance ** 2;
      colors.add(`${r >> 3},${g >> 3},${b >> 3}`);
    }
  }
  const count = sample.length / 3;
  return { width, height, sample, mean: sum / count,
    variance: Math.max(0, sumSquares / count - (sum / count) ** 2), quantizedColors: colors.size };
}

function difference(a, b) {
  if (a.length !== b.length) return { meanAbsolute: Infinity, changedFraction: 1 };
  let sum = 0, changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    sum += delta;
    if (delta > 15) changed++;
  }
  return { meanAbsolute: sum / a.length, changedFraction: changed / (a.length / 3) };
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const source = window.__KINETI__;
    if (!source) return null;
    const result = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== 'function' && (value === null || ['number', 'string', 'boolean'].includes(typeof value))) result[key] = value;
    }
    result.scrollY = window.scrollY;
    result.scrollMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    result.viewport = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio };
    return result;
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => window.__KINETI__?.ready === true, { timeout: 45000 });
  await page.waitForFunction(() => Number(window.__KINETI__?.drawCalls) > 0, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await delay(500);
}

async function scrollToProgress(page, progress, label) {
  // Exercise document scrolling; the renderer's optional goTo() is not used.
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo({ top: max * p, behavior: 'instant' });
  }, progress);
  let settled = true;
  try {
    await page.waitForFunction((p) => Math.abs(Number(window.__KINETI__?.progress) - p) < 0.018,
      { timeout: 10000 }, progress);
  } catch { settled = false; }
  await delay(550);
  const state = await diagnostics(page);
  const real = state?.scrollMax > 0 ? state.scrollY / state.scrollMax : 0;
  check(`${label}/native-scroll`, settled && Math.abs(real - progress) < 0.012,
    { requested: progress, nativeProgress: real, diagnosticProgress: state?.progress });
  return state;
}

async function visibleHandle(page, selector) {
  for (const handle of await page.$$(selector)) {
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (visible) return handle;
    await handle.dispose();
  }
  throw new Error(`No visible element matching ${selector}`);
}

async function captureCanvas(page, name) {
  const handle = await visibleHandle(page, CANVAS);
  const dimensions = await handle.evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { width: canvas.width, height: canvas.height, x: rect.x, y: rect.y,
      cssWidth: rect.width, cssHeight: rect.height };
  });
  check(`${name}/canvas-dimensions`, dimensions.width > 100 && dimensions.height > 100
    && dimensions.cssWidth > 100 && dimensions.cssHeight > 100, dimensions);
  // The production canvas fades over 650 ms. Disable only that transition in
  // this isolation test so its control capture actually contains no canvas.
  const hiddenUI = await page.addStyleTag({ content: 'body * { visibility:hidden !important; } body canvas { visibility:visible !important; transition:none !important; }' });
  let image, blank;
  try {
    await delay(90);
    // The scene canvas is fixed to the viewport. ElementHandle.screenshot may
    // capture a document-space region after native scroll on Chromium; a
    // viewport screenshot preserves the actual composited fixed canvas.
    image = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }));
    await handle.evaluate((el) => {
      el.dataset.qaPriorOpacity = el.style.getPropertyValue('opacity');
      el.dataset.qaPriorOpacityPriority = el.style.getPropertyPriority('opacity');
      el.style.setProperty('opacity', '0', 'important');
    });
    await page.waitForFunction((canvas) => getComputedStyle(canvas).opacity === '0', {}, handle);
    // Same CSS/page background with only the real GPU canvas hidden gives a
    // control image. A background gradient alone cannot satisfy this test.
    blank = Buffer.from(await page.screenshot({ type: 'png', fullPage: false }));
  } finally {
    await handle.evaluate((el) => {
      if ('qaPriorOpacity' in el.dataset) {
        if (el.dataset.qaPriorOpacity) el.style.setProperty('opacity', el.dataset.qaPriorOpacity, el.dataset.qaPriorOpacityPriority);
        else el.style.removeProperty('opacity');
        delete el.dataset.qaPriorOpacity; delete el.dataset.qaPriorOpacityPriority;
      }
    }).catch(() => {});
    await hiddenUI.evaluate((el) => el.remove()).catch(() => {});
    await handle.dispose();
  }
  await writeFile(path.join(OUTPUT, `${name}-canvas.png`), image);
  const rendered = samplePNG(image), control = samplePNG(blank);
  const change = difference(rendered.sample, control.sample);
  check(`${name}/real-rendered-pixels`, rendered.variance > 1 && rendered.quantizedColors > 12
    && change.changedFraction > 0.003 && change.meanAbsolute > 0.2,
  { variance: rendered.variance, quantizedColors: rendered.quantizedColors, canvasVsHidden: change });
  return { sample: rendered.sample, variance: rendered.variance, quantizedColors: rendered.quantizedColors,
    canvasVsHidden: change, dimensions };
}

async function capturePhase(page, run, sizeName, progress) {
  const name = `${run.name}-${sizeName}-${String(Math.round(progress * 100)).padStart(3, '0')}`;
  const state = await scrollToProgress(page, progress, name);
  check(`${name}/diagnostics`, state?.ready && state.cubePieces === 27 && state.tileCount >= 162
    && Number(state.drawCalls) > 0 && Number(state.triangles) > 0 && state.phase >= 0 && state.phase <= 5,
  { state });
  check(`${name}/phase-and-field`, state?.phase === PHASES.indexOf(progress)
    && ([0.56, 0.74].includes(progress) ? state.activeTiles > 0 : state.activeTiles === 0),
  { phase: state?.phase, activeTiles: state?.activeTiles, progress });
  check(`${name}/no-horizontal-overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await page.screenshot({ path: path.join(OUTPUT, `${name}.png`), fullPage: false });
  const pixels = await captureCanvas(page, name);
  const { sample, ...pixelSummary } = pixels;
  run.phases.push({ name, size: sizeName, progress, state, pixels: pixelSummary });
  return sample;
}

async function checkNavigation(page, prefix) {
  const nav = '[data-testid="phase-nav"]';
  await page.waitForSelector(nav, { timeout: 5000 });
  for (const progress of [0.56, 0.23, 0]) {
    const button = await visibleHandle(page, `${nav} [data-progress="${progress}"]`);
    if (progress === 0.23) { await button.focus(); await page.keyboard.press('Enter'); }
    else await button.click();
    await button.dispose();
    let arrived = true;
    try { await page.waitForFunction((p) => Math.abs(Number(window.__KINETI__?.progress) - p) < 0.025, { timeout: 10000 }, progress); }
    catch { arrived = false; }
    const state = await diagnostics(page);
    check(`${prefix}/nav-${progress}-${progress === 0.23 ? 'keyboard' : 'click'}`,
      arrived && state?.scrollMax > 0 && Math.abs(state.scrollY / state.scrollMax - progress) < 0.025, { state });
  }
}

async function inspectDialog(page, prefix) {
  const details = await page.$eval(DIALOG, (dialog) => {
    const heading = dialog.getAttribute('aria-labelledby');
    const label = dialog.getAttribute('aria-label') || heading?.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
    const rect = dialog.getBoundingClientRect();
    const inputs = [...dialog.querySelectorAll('input:not([type="hidden"]),textarea,select')].map((input) => ({
      type: input.type, name: input.name, labelled: Boolean(input.getAttribute('aria-label')
        || input.getAttribute('aria-labelledby') || input.labels?.length),
    }));
    return { label, modal: dialog.getAttribute('aria-modal') === 'true' || dialog.matches(':modal'), inputs,
      visibleInViewport: rect.left >= -2 && rect.right <= innerWidth + 2 && rect.top >= -2 && rect.bottom <= innerHeight + 2,
      focusInside: dialog.contains(document.activeElement) };
  });
  check(`${prefix}/dialog-accessible`, Boolean(details.label) && details.modal
    && details.inputs.length > 0 && details.inputs.every((input) => input.labelled), details);
  check(`${prefix}/dialog-fits-and-focuses`, details.visibleInViewport && details.focusInside, details);
  let trapped = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    trapped &&= await page.$eval(DIALOG, (dialog) => dialog.contains(document.activeElement));
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    trapped &&= await page.$eval(DIALOG, (dialog) => dialog.contains(document.activeElement));
  }
  check(`${prefix}/dialog-focus-trap`, trapped);
}

async function checkContact(page, context, prefix, downloads) {
  await mkdir(downloads, { recursive: true });
  // Puppeteer maps read/write to the same CDP permission. writeText also needs
  // clipboardSanitizedWrite when the context overrides all other permissions.
  await context.overridePermissions(new URL(BASE_URL).origin,
    ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  const session = await page.createCDPSession();
  await session.send('Browser.setDownloadBehavior', {
    behavior: 'allow', downloadPath: downloads, eventsEnabled: true,
    ...(context.id ? { browserContextId: context.id } : {}),
  });
  const opener = await visibleHandle(page, CONTACT);
  await opener.click(); await opener.dispose();
  await page.waitForSelector(DIALOG, { visible: true, timeout: 5000 });
  await inspectDialog(page, prefix);
  const fields = await page.$$(`${DIALOG.split(',').map((selector) => `${selector} input`).join(',')}`);
  for (const input of fields) {
    const type = await input.evaluate((el) => el.type);
    if (['text', 'email'].includes(type)) await input.type(type === 'email' ? 'qa@example.test' : 'Prueba local Kineti');
    await input.dispose();
  }
  const message = `Verificación local ${prefix}: organizar datos y automatizar tareas.`;
  const textarea = await page.$(`${DIALOG.split(',').map((selector) => `${selector} textarea`).join(',')}`);
  if (!textarea) throw new Error('Contact dialog has no labelled brief textarea');
  await textarea.type(message); await textarea.dispose();
  await (await visibleHandle(page, '[data-testid="contact-copy"]')).click();
  let clipboardArrived = true;
  try {
    await page.waitForFunction(async (payload) => (await navigator.clipboard.readText()).includes(payload),
      { timeout: 5000, polling: 100 }, message);
  } catch { clipboardArrived = false; }
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const clipboardState = await page.evaluate(() => ({
    focused: document.hasFocus(), visibility: document.visibilityState,
    feedback: document.querySelector('.kineti-form-feedback')?.textContent,
    fallbackShown: Boolean(document.querySelector('#kineti-brief-preview')),
  }));
  check(`${prefix}/clipboard-real-payload`, clipboardArrived && copied.includes(message),
    { copiedLength: copied.length, ...clipboardState });
  const before = new Set(await readdir(downloads));
  await (await visibleHandle(page, '[data-testid="contact-download"]')).click();
  let file;
  for (let attempt = 0; attempt < 60; attempt++) {
    file = (await readdir(downloads)).find((name) => !before.has(name) && !name.endsWith('.crdownload') && !name.endsWith('.tmp'));
    if (file) break;
    await delay(100);
  }
  const downloaded = file ? await readFile(path.join(downloads, file), 'utf8') : '';
  check(`${prefix}/download-real-file`, Boolean(file) && downloaded.includes(message), { file, bytes: downloaded.length });
  await page.keyboard.press('Escape');
  await page.waitForFunction((selector) => ![...document.querySelectorAll(selector)].some((el) => el.getBoundingClientRect().height > 0), { timeout: 5000 }, DIALOG);
  check(`${prefix}/escape-restores-focus`, await page.evaluate((selector) => document.activeElement?.matches(selector), CONTACT));
  await (await visibleHandle(page, CONTACT)).click();
  await page.waitForSelector(DIALOG, { visible: true });
  await (await visibleHandle(page, '[data-testid="contact-close"]')).click();
  await delay(100);
  check(`${prefix}/close-button`, await page.evaluate((selector) => ![...document.querySelectorAll(selector)].some((el) => el.getBoundingClientRect().height > 0), DIALOG));
  await session.detach();
}

function trackErrors(page, run) {
  page.on('console', (message) => {
    if (!['error', 'warn'].includes(message.type())) return;
    const entry = { type: message.type(), text: message.text(), location: message.location() };
    run.console.push(entry);
    console.log(`[${run.name} console ${entry.type}] ${entry.text}`);
  });
  page.on('pageerror', (error) => { run.pageErrors.push(String(error.stack || error)); console.error(`[${run.name} pageerror] ${error}`); });
  page.on('requestfailed', (request) => run.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
  page.on('response', (response) => { if (response.status() >= 400) run.httpErrors.push({ url: response.url(), status: response.status() }); });
}

async function runRenderer(browser, mode) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const run = { name: mode, console: [], pageErrors: [], failedRequests: [], httpErrors: [], phases: [] };
  report.runs.push(run);
  trackErrors(page, run);
  try {
    await page.setViewport(DESKTOP);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    const url = new URL(BASE_URL);
    if (mode === 'webgl') url.searchParams.set('renderer', 'webgl');
    await page.goto(url.href, { waitUntil: 'networkidle0', timeout: 45000 });
    await waitReady(page);
    run.initial = await diagnostics(page);
    run.navigator = await page.evaluate(() => ({ gpuAPI: Boolean(navigator.gpu), userAgent: navigator.userAgent }));
    const backend = String(run.initial.backend).toLowerCase();
    check(`${mode}/backend`, mode === 'webgl' ? backend.includes('webgl') : backend.includes('webgl') || backend.includes('webgpu'),
      { actual: run.initial.backend, gpuAPI: run.navigator.gpuAPI });
    check(`${mode}/desktop-counts`, run.initial.cubePieces === 27 && run.initial.tileCount === 432, { state: run.initial });
    check(`${mode}/motion-enabled`, run.initial.reducedMotion === false, { reducedMotion: run.initial.reducedMotion });
    const samples = new Map();
    for (const progress of PHASES) samples.set(progress, await capturePhase(page, run, 'desktop', progress));
    for (const progress of [0.40, 0.74]) {
      const change = difference(samples.get(0), samples.get(progress));
      check(`${mode}/phase-image-changes-${progress}`, change.meanAbsolute > 0.35 && change.changedFraction > 0.008, change);
    }
    for (const progress of [0.74, 0.40, 0]) await scrollToProgress(page, progress, `${mode}/reverse-${progress}`);
    const reversed = await captureCanvas(page, `${mode}-reverse-start`);
    const reverseDifference = difference(samples.get(0), reversed.sample);
    check(`${mode}/reverse-restores-composition`, reverseDifference.meanAbsolute < 18, reverseDifference);
    await checkNavigation(page, `${mode}/desktop`);
    await scrollToProgress(page, 1, `${mode}/desktop-contact`);
    await checkContact(page, context, `${mode}/desktop`, path.join(OUTPUT, `${mode}-downloads`));
    // Keep the same page/context: this verifies a live resize, not just a mobile reload.
    await page.setViewport(MOBILE);
    await delay(400);
    for (const progress of PHASES) await capturePhase(page, run, 'mobile', progress);
    const mobile = await diagnostics(page);
    check(`${mode}/mobile-adaptive-density`, mobile.cubePieces === 27 && mobile.tileCount >= 162
      && mobile.tileCount <= 432, { state: mobile });
    await checkNavigation(page, `${mode}/mobile`);
    await (await visibleHandle(page, CONTACT)).click();
    await page.waitForSelector(DIALOG, { visible: true });
    await inspectDialog(page, `${mode}/mobile`);
    await page.screenshot({ path: path.join(OUTPUT, `${mode}-mobile-dialog.png`) });
    await page.keyboard.press('Escape');
    await page.setViewport(DESKTOP);
    await delay(300);
    await scrollToProgress(page, 0.40, `${mode}/resize-back`);
    await captureCanvas(page, `${mode}-resize-back`);
    run.final = await diagnostics(page);
  } catch (error) {
    run.fatal = String(error.stack || error);
    check(`${mode}/run-completed`, false, { error: run.fatal });
    await page.screenshot({ path: path.join(OUTPUT, `${mode}-failure.png`) }).catch(() => {});
  } finally {
    check(`${mode}/no-console-errors`, run.console.every((entry) => entry.type !== 'error'), { errors: run.console.filter((entry) => entry.type === 'error') });
    check(`${mode}/no-page-errors`, run.pageErrors.length === 0, { errors: run.pageErrors });
    check(`${mode}/no-http-errors`, run.httpErrors.length === 0, { errors: run.httpErrors });
    check(`${mode}/no-failed-requests`, run.failedRequests.length === 0, { errors: run.failedRequests });
    await context.close();
  }
}

async function runReducedMotion(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const run = { name: 'reduced-motion', console: [], pageErrors: [], failedRequests: [], httpErrors: [], phases: [] };
  report.runs.push(run); trackErrors(page, run);
  try {
    await page.setViewport(DESKTOP);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 45000 }); await waitReady(page);
    const toggle = await visibleHandle(page, '[data-testid="motion-toggle"]');
    check('reduced-motion/system-preference', await toggle.evaluate((el) => el.getAttribute('aria-pressed') === 'true'));
    await scrollToProgress(page, 0.40, 'reduced-motion/scroll');
    const first = await captureCanvas(page, 'reduced-motion-before');
    await delay(550);
    const second = await captureCanvas(page, 'reduced-motion-after');
    const idleDifference = difference(first.sample, second.sample);
    check('reduced-motion/idle-canvas-stable', idleDifference.meanAbsolute < 1.5, idleDifference);
    await toggle.click();
    check('reduced-motion/user-toggle', await toggle.evaluate((el) => el.getAttribute('aria-pressed') === 'false'));
    await toggle.dispose();
    await scrollToProgress(page, 1, 'reduced-motion/content-still-reachable');
    await page.screenshot({ path: path.join(OUTPUT, 'reduced-motion-outro.png') });
    run.final = await diagnostics(page);
  } catch (error) { run.fatal = String(error.stack || error); check('reduced-motion/run-completed', false, { error: run.fatal }); }
  finally {
    check('reduced-motion/no-runtime-errors', run.pageErrors.length === 0 && run.console.every((entry) => entry.type !== 'error'),
      { pageErrors: run.pageErrors, console: run.console });
    await context.close();
  }
}

async function runLoadingNavigation(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const run = { name: 'slow-asset-navigation', console: [], pageErrors: [], failedRequests: [], httpErrors: [], phases: [] };
  report.runs.push(run); trackErrors(page, run);
  let releaseAsset;
  const assetGate = new Promise((resolve) => { releaseAsset = resolve; });
  let assetHeld = false;
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    if (/\/hdri\/studio_small_09_1k\.(?:exr|hdr)(?:\?|$)/.test(request.url())) {
      assetHeld = true;
      await assetGate;
    }
    if (!request.isInterceptResolutionHandled()) await request.continue().catch(() => {});
  });
  try {
    await page.setViewport(MOBILE);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.kineti[data-scene="loading"]', { timeout: 10000 });
    await page.click('[data-testid="phase-nav"] [data-progress="0.23"]');
    await page.waitForSelector('.kineti[data-phase="1"]', { timeout: 10000 });
    check('slow-asset-navigation/content-before-3d', assetHeld && await page.$eval('.kineti', (element) => element.dataset.scene === 'loading'), { deliberatelyDelayedEnvironment: assetHeld });
    await page.screenshot({ path: path.join(OUTPUT, 'content-while-graphics-load.png') });
    releaseAsset();
    await waitReady(page);
    await page.waitForFunction(() => Math.abs(window.__KINETI__?.progress - .23) < .02, { timeout: 10000 });
    const state = await diagnostics(page);
    check('slow-asset-navigation/ready-at-current-scroll', state?.phase === 1 && Math.abs(state.progress - .23) < .02, { state });
    check('slow-asset-navigation/public-copy', await page.evaluate(() => !/\berp\b/i.test(document.body.textContent)
      && document.body.textContent.includes('determinista') && document.body.textContent.includes('agéntica')));
  } catch (error) {
    run.fatal = String(error.stack || error);
    check('slow-asset-navigation/completed', false, { error: run.fatal });
  } finally {
    releaseAsset();
    check('slow-asset-navigation/no-runtime-errors', run.pageErrors.length === 0 && run.console.every((entry) => entry.type !== 'error'), { errors: run.pageErrors });
    await context.close();
  }
}

let browser;
try {
  await mkdir(OUTPUT, { recursive: true });
  const executablePath = await existingBrowser();
  console.log(`Using installed browser: ${executablePath}`);
  browser = await puppeteer.launch({ executablePath, headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    protocolTimeout: 60000 });
  report.browser = { executablePath, version: await browser.version(), userAgent: await browser.userAgent(), headless: true, gpuDisabled: false };
  const gpuSession = await browser.target().createCDPSession();
  try {
    const { gpu } = await gpuSession.send('SystemInfo.getInfo');
    report.browser.gpu = { devices: gpu.devices, featureStatus: gpu.featureStatus, auxAttributes: gpu.auxAttributes };
  } catch (error) {
    report.browser.gpuInspectionError = String(error);
    console.warn(`GPU metadata unavailable: ${error}`);
  } finally { await gpuSession.detach(); }
  await runRenderer(browser, 'default');
  await runRenderer(browser, 'webgl');
  await runReducedMotion(browser);
  await runLoadingNavigation(browser);
} catch (error) {
  report.errors.push(String(error.stack || error));
  console.error(error);
} finally {
  if (browser) await browser.close();
  report.finished = new Date().toISOString();
  report.success = report.errors.length === 0 && report.checks.length > 0 && report.checks.every((item) => item.pass);
  report.summary = { passed: report.checks.filter((item) => item.pass).length,
    failed: report.checks.filter((item) => !item.pass).length, runs: report.runs.length };
  await mkdir(OUTPUT, { recursive: true });
  await writeFile(path.join(OUTPUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`QA ${report.success ? 'PASSED' : 'FAILED'}: ${JSON.stringify(report.summary)}\nReport: ${path.join(OUTPUT, 'report.json')}`);
  if (!report.success) process.exitCode = 1;
}
