import puppeteer from 'puppeteer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';

// Fresh Chrome process/profile per case: cold HTTP and browser shader cache.
// CPU/network emulation is not an emulation of a phone GPU.
const base = process.env.KINETI_QA_URL || 'http://127.0.0.1:4174';
const output = path.resolve(process.env.KINETI_PERF_OUT || `docs/QA/startup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const names = (process.env.KINETI_PERF_CASES || 'desktop,mobile,mobile-slow,desktop-webgl,mobile-webgl').split(',');
const suffix = process.env.KINETI_PERF_QUERY || '';
const snapshots = process.env.KINETI_PERF_CAPTURES !== '0';
const report = { url: base, query: suffix, coldBrowserCache: true, physicalMobile: false, runs: [] };
await mkdir(output, { recursive: true });
for (const name of names) {
  const mobile = name.includes('mobile'), slow = name.includes('slow'), webgl = name.includes('webgl');
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--disable-gpu-shader-disk-cache', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage();
  const run = { name, errors: [], browser: await browser.version(), viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 900, deviceScaleFactor: Number(process.env.KINETI_PERF_DPR || 1) }, cpuRate: slow ? 6 : 1 };
  report.runs.push(run);
  page.on('pageerror', (error) => run.errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') run.errors.push(message.text()); });
  try {
    await page.setViewport(run.viewport);
    await page.setCacheEnabled(false);
    if (process.env.KINETI_PERF_ENV) {
      const environment = await readFile(process.env.KINETI_PERF_ENV);
      run.environmentOverride = { file: process.env.KINETI_PERF_ENV, bytes: environment.length, intercepted: true };
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url().endsWith('/studio_small_09_1k.exr')) request.respond({ status: 200, contentType: 'application/octet-stream', body: environment });
        else request.continue();
      });
    }
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: run.cpuRate });
    if (slow) {
      run.network = { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' };
      await cdp.send('Network.emulateNetworkConditions', run.network);
    }
    await page.evaluateOnNewDocument(() => {
      // Reproducible procedural noise for pixel comparisons only, never shipped.
      let seed = 0x19740905;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const stats = window.__STARTUP_PROFILE__ = { readyMs: null, longTasks: [], gpu: [], webgl: {} };
      new PerformanceObserver((list) => { for (const entry of list.getEntries()) stats.longTasks.push({ start: entry.startTime, duration: entry.duration }); }).observe({ type: 'longtask', buffered: true });
      const observer = new MutationObserver(() => {
        if (document.querySelector('[data-scene="ready"]') && stats.readyMs === null) { stats.readyMs = performance.now(); observer.disconnect(); }
      });
      observer.observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ['data-scene'] });
      if (globalThis.GPUDevice) {
        const sources = new WeakMap(), prototype = GPUDevice.prototype, originalModule = prototype.createShaderModule;
        prototype.createShaderModule = function (descriptor) {
          const result = originalModule.call(this, descriptor);
          let hash = 2166136261;
          for (const character of descriptor.code) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
          if (descriptor.label?.includes('vertex_Kineti premium glyph')) (stats.shaderSources ||= {})[hash >>> 0] = descriptor.code;
          sources.set(result, { label: descriptor.label, bytes: descriptor.code.length, hash: hash >>> 0 }); return result;
        };
        for (const method of ['createRenderPipeline', 'createRenderPipelineAsync']) {
          const original = prototype[method];
          prototype[method] = function (descriptor) {
            const item = { method, label: descriptor.label, vertex: sources.get(descriptor.vertex.module), fragment: sources.get(descriptor.fragment?.module), start: performance.now(),
              targets: descriptor.fragment?.targets, primitive: descriptor.primitive, samples: descriptor.multisample?.count, depthStencil: descriptor.depthStencil };
            stats.gpu.push(item);
            const result = original.call(this, descriptor);
            item.callMs = performance.now() - item.start;
            if (method.endsWith('Async')) result.then(() => { item.completeMs = performance.now() - item.start; }, (error) => { item.error = String(error); });
            return result;
          };
        }
      }
      if (globalThis.WebGL2RenderingContext) for (const method of ['compileShader', 'linkProgram', 'getProgramParameter', 'getUniformLocation', 'getAttribLocation', 'drawElements', 'drawArrays', 'drawElementsInstanced']) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args) {
          const start = performance.now(), result = original.apply(this, args), elapsed = performance.now() - start;
          const item = stats.webgl[method] ||= { calls: 0, totalMs: 0, maxMs: 0 };
          item.calls++; item.totalMs += elapsed; item.maxMs = Math.max(item.maxMs, elapsed); return result;
        };
      }
    });
    await page.goto(`${base}/?renderer=${webgl ? 'webgl' : 'webgpu'}&${suffix}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('[data-scene="ready"]'), { timeout: 180000 });
    await page.waitForFunction(() => window.__KINETI__?.getDiagnostics().idle, { timeout: 30000 });
    run.startup = await page.evaluate(() => ({ ...window.__STARTUP_PROFILE__, diagnostics: window.__KINETI__.getDiagnostics(),
      resources: performance.getEntriesByType('resource').map(({ name, startTime, responseEnd, duration, transferSize, encodedBodySize, decodedBodySize, initiatorType }) => ({ name, startTime, responseEnd, duration, transferSize, encodedBodySize, decodedBodySize, initiatorType })),
      navigation: performance.getEntriesByType('navigation')[0].toJSON(), paints: performance.getEntriesByType('paint').map((entry) => entry.toJSON()), marks: performance.getEntriesByType('measure').map((entry) => entry.toJSON()) }));
    run.startup.bodyBytes = run.startup.resources.reduce((sum, entry) => sum + entry.encodedBodySize, run.startup.navigation.encodedBodySize);
    if (process.env.KINETI_PERF_MOTION === '1') {
      run.motion = await page.evaluate(async () => {
        const frames = [];
        window.__KINETI__.setReducedMotion(true);
        for (let i = 0; i < 180; i++) {
          const before = performance.now();
          window.scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * (.65 + Math.sin(i * .075) * .10), behavior: 'instant' });
          await new Promise(requestAnimationFrame);
          const { renderCpuMs, frameNumber, pixelRatio } = window.__KINETI__.getDiagnostics();
          frames.push({ interval: performance.now() - before, renderCpuMs, frameNumber, pixelRatio });
        }
        return frames.slice(60);
      });
    }
    if (snapshots) {
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      await page.evaluate(() => window.__KINETI__.setReducedMotion(true));
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      run.poses = [];
      for (const progress of [0, .23, .4, .56, .74, .88, 1]) {
        const start = performance.now();
        await page.evaluate((p) => window.__KINETI__.goTo(p), progress);
        await page.waitForFunction((p) => Math.abs(window.__KINETI__.getDiagnostics().progress - p) < .0002 && window.__KINETI__.getDiagnostics().idle, { timeout: 45000 }, progress);
        await delay(80);
        const file = `${name}-${String(Math.round(progress * 100)).padStart(3, '0')}.png`;
        run.poses.push({ progress, settledMs: performance.now() - start, file, diagnostics: await page.evaluate(() => window.__KINETI__.getDiagnostics()) });
        await page.screenshot({ path: path.join(output, file) });
      }
      const before = await page.evaluate(() => window.__KINETI__.getDiagnostics().frameNumber);
      await delay(1000);
      run.idleFrames = await page.evaluate((before) => window.__KINETI__.getDiagnostics().frameNumber - before, before);
    }
  } catch (error) { run.errors.push(String(error.stack || error)); }
  finally { await browser.close(); }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, readyMs: run.startup?.readyMs, initialLoadMs: run.startup?.diagnostics.initialLoadMs, bodyBytes: run.startup?.bodyBytes, errors: run.errors, output }));
}
if (report.runs.some((run) => run.errors.length)) process.exitCode = 1;
