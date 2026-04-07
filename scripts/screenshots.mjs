import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const SCREENSHOTS_DIR = 'screenshots/sequence';
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Suppress WebGL errors
  page.on('pageerror', () => {});
  page.on('console', (msg) => { if (msg.type() !== 'error') console.log(msg.text()); });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  const maxScroll = await page.evaluate(() =>
    document.documentElement.scrollHeight - window.innerHeight
  );
  console.log(`Max scroll: ${maxScroll}px`);

  // 30 frames from 0% to 100%
  const frames = 30;
  for (let i = 0; i <= frames; i++) {
    const pct = i / frames;
    const targetY = Math.round(maxScroll * pct);

    await page.evaluate(y => {
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    }, targetY);

    // Small delay between frames
    await new Promise(r => setTimeout(r, 300));

    const label = String(i).padStart(2, '0');
    const path = `${SCREENSHOTS_DIR}/frame_${label}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`  📸 frame_${label} — ${(pct * 100).toFixed(1)}% — scrollY=${targetY}`);
  }

  await browser.close();
  console.log(`\n✅ ${frames + 1} frames saved in ${SCREENSHOTS_DIR}/`);
}

main().catch(err => { console.error(err); process.exit(1); });
