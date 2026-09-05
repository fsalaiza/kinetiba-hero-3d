import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { samplePNG, difference } from '../../scripts/lib/png-metrics.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'evidence');
await mkdir(output, { recursive: true });
const report = {
  testedAt: new Date().toISOString(), engine: 'Unreal Engine 5.7.4 / PixelStreaming2',
  delivery: 'Real H.264 video over loopback WebRTC; custom minimal loopback signalling',
  scene: '27 engine cubes, two directional lights, floor, 5 controls; different fixture from browser engines',
  limitations: 'Functional smoke checks on Windows RTX 5080. Concurrent GPU work; no fair FPS comparison. Control ACK round trip is not input-to-visible-pixel latency. No Internet/mobile/scaling test.',
  checks: [], errors: [], states: [], screenshots: [],
};
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
page.on('pageerror', (error) => report.errors.push(error.message));
const check = (name, passed, evidence) => { report.checks.push({ name, passed: Boolean(passed), evidence }); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const near = (a, b, epsilon = 0.0001) => Math.abs(a - b) < epsilon;
const same = (a, b) => a.length === b.length && a.every((value, i) => near(value, b[i]));
try {
  report.browser = await browser.version();
  await page.goto('http://127.0.0.1:8899', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__UNREAL_PROBE__?.getState().ack?.pieces === 27 && window.__UNREAL_PROBE__.getState().frames >= 10, { timeout: 60000 });
  const control = async (patch) => {
    const sequence = await page.evaluate((patch) => window.__UNREAL_PROBE__.setControls(patch), patch);
    await page.waitForFunction((sequence) => window.__UNREAL_PROBE__.getState().ack?.sequence >= sequence, { timeout: 15000 }, sequence);
    await delay(500);
    const state = await page.evaluate(() => window.__UNREAL_PROBE__.getState());
    report.states.push(state);
    return state.ack;
  };
  const capture = async (name) => {
    const video = await page.$('#video');
    const filename = `${name}.png`;
    const buffer = await video.screenshot({ path: path.join(output, filename) });
    report.screenshots.push(filename);
    return samplePNG(buffer);
  };
  const defaults = { progress: 0, explode: 0, selectedPiece: 26, pieceOffset: 0, cameraFov: 38 };
  const baseline = await control(defaults);
  const baselinePixels = await capture('unreal-assembled');
  check('real-video-frames-and-engine-state', baseline.pieces === 27 && baselinePixels.variance > 10, { baseline, raster: { variance: baselinePixels.variance, quantizedColors: baselinePixels.quantizedColors } });
  const selected = await control({ pieceOffset: .625 });
  const selectedPixels = await capture('unreal-one-piece');
  check('single-piece-isolation-confirmed-by-unreal', near(selected.selected[2] - baseline.selected[2], 62.5) && same(selected.other, baseline.other), { baseline, selected });
  check('single-piece-changes-video-pixels', difference(baselinePixels.sample, selectedPixels.sample).meanAbsolute > .15, difference(baselinePixels.sample, selectedPixels.sample));
  const exploded = await control({ ...defaults, explode: .7 });
  await capture('unreal-exploded');
  check('separation-confirmed-by-unreal', exploded.selected.every((value) => near(value, 150.5)), exploded);
  await control({ ...defaults, progress: .5 });
  const middlePixels = await capture('unreal-progress-050');
  check('progress-midpoint-changes-video-pixels', difference(baselinePixels.sample, middlePixels.sample).meanAbsolute > 1, difference(baselinePixels.sample, middlePixels.sample));
  const end = await control({ progress: 1 });
  await capture('unreal-progress-100');
  check('progress-endpoint-confirmed-by-unreal', near(end.progress, 1), end);
  await page.evaluate(() => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * .45, behavior: 'instant' }));
  await page.waitForFunction(() => Math.abs(window.__UNREAL_PROBE__.getState().ack?.progress - .45) < .005, { timeout: 15000 });
  const scrollState = await page.evaluate(() => ({ scrollY, dom: Number(document.querySelector('#progress').value), engine: window.__UNREAL_PROBE__.getState().ack }));
  check('native-scroll-controls-unreal', Math.abs(scrollState.dom - scrollState.engine.progress) < .002 && scrollState.scrollY > 0, scrollState);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => window.__UNREAL_PROBE__.getState().ack?.progress === 0, { timeout: 15000 });
  const restored = await control(defaults);
  const restoredPixels = await capture('unreal-restored');
  check('progress-is-reversible-in-unreal-state', same(restored.selected, baseline.selected) && same(restored.other, baseline.other), { baseline, restored });
  check('restored-video-matches-baseline-with-compression-tolerance', difference(baselinePixels.sample, restoredPixels.sample).meanAbsolute < 3, difference(baselinePixels.sample, restoredPixels.sample));
  const camera = await control({ cameraFov: 52 });
  const cameraPixels = await capture('unreal-camera');
  check('camera-control-changes-video', near(camera.cameraFov, 52) && difference(baselinePixels.sample, cameraPixels.sample).meanAbsolute > .5, camera);
  await control(defaults);
  const scrubStart = await page.evaluate(() => ({ sequence: window.__UNREAL_PROBE__.getState().ack.sequence, frames: window.__UNREAL_PROBE__.getState().frames }));
  await page.evaluate(async () => {
    const extent = document.documentElement.scrollHeight - innerHeight;
    for (const direction of [1, -1]) {
      for (let step = 0; step <= 24; ++step) {
        const progress = direction > 0 ? step / 24 : 1 - step / 24;
        scrollTo({ top: extent * progress, behavior: 'instant' });
        await new Promise(requestAnimationFrame);
      }
    }
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await page.waitForFunction((sequence) => window.__UNREAL_PROBE__.getState().ack.sequence > sequence && window.__UNREAL_PROBE__.getState().ack.progress === 0, { timeout: 15000 }, scrubStart.sequence);
  const scrubEnd = await page.evaluate(() => window.__UNREAL_PROBE__.getState());
  report.continuousScrub = await page.evaluate((sequence) => window.__UNREAL_PROBE__.getAcknowledgements().filter((ack) => ack.sequence > sequence), scrubStart.sequence);
  const progresses = report.continuousScrub.map((ack) => ack.progress);
  check('continuous-native-scroll-forward-and-reverse', progresses.length >= 20 && progresses.some((p) => p > .95) && progresses.some((p) => p > .1 && p < .9) && progresses.at(-1) === 0 && progresses.some((p, i) => i > 0 && p < progresses[i - 1]) && scrubEnd.frames > scrubStart.frames + 5, { samples: progresses.length, progress: progresses, videoFrames: scrubEnd.frames - scrubStart.frames });
  await delay(500);
  report.webrtc = await page.evaluate(() => window.__UNREAL_PROBE__.getStats());
  report.finalState = await page.evaluate(() => window.__UNREAL_PROBE__.getState());
  report.errors.push(...report.finalState.errors);
  const acknowledgements = await page.evaluate(() => window.__UNREAL_PROBE__.getAcknowledgements());
  const rtts = acknowledgements.map((ack) => ack.ackMs).filter(Number.isFinite).sort((a, b) => a - b);
  report.controlAck = { samples: rtts.length, medianMs: rtts[Math.floor(rtts.length / 2)], minMs: rtts[0], maxMs: rtts.at(-1), measurement: 'JS command sent -> Unreal handler applies state -> JSON acknowledgement returns; excludes video path' };
  check('webrtc-video-decoded', report.webrtc.some((row) => row.type === 'inbound-rtp' && row.framesDecoded > 10 && row.frameWidth > 0), report.webrtc);
  await page.screenshot({ path: path.join(output, 'unreal-browser-controls.png') });
  report.screenshots.push('unreal-browser-controls.png');
} catch (error) {
  report.errors.push(error.stack || error.message);
  try { report.failureState = await page.evaluate(() => window.__UNREAL_PROBE__?.getState()); } catch {}
  await page.screenshot({ path: path.join(output, 'unreal-failure.png') }).catch(() => {});
} finally {
  report.pass = report.errors.length === 0 && report.checks.length > 0 && report.checks.every((entry) => entry.passed);
  await writeFile(path.join(output, 'qa-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
  console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, errors: report.errors, state: report.failureState, report: path.join(output, 'qa-report.json') }, null, 2));
  if (!report.pass) process.exitCode = 1;
}
