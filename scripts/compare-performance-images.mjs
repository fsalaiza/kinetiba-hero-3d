import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decodePNG } from './lib/png-metrics.mjs';

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error('Usage: node scripts/compare-performance-images.mjs before-directory after-directory');
const baseline = JSON.parse(await readFile(path.join(before, 'report.json')));
const candidate = JSON.parse(await readFile(path.join(after, 'report.json')));
const comparisons = [];
for (const run of candidate.runs) for (const pose of run.poses || []) {
  const original = baseline.runs.find((item) => item.name === run.name)?.poses?.find((item) => item.progress === pose.progress);
  if (!original) continue;
  const a = decodePNG(await readFile(path.join(before, original.file)));
  const b = decodePNG(await readFile(path.join(after, pose.file)));
  if (a.width !== b.width || a.height !== b.height) throw new Error('Viewport mismatch');
  let changed = 0, sum = 0, maxChannel = 0, above8 = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    let delta = 0, max = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a.pixels[i * a.channels + c] - b.pixels[i * b.channels + c]);
      delta += d; max = Math.max(max, d);
    }
    sum += delta; if (delta) changed++; if (max > 8) above8++; maxChannel = Math.max(maxChannel, max);
  }
  comparisons.push({ name: run.name, progress: pose.progress, changedPixels: changed, above8Pixels: above8,
    meanAbsoluteRGB: sum / (a.width * a.height * 3), maxChannel, before: original.file, after: pose.file });
}
const result = { before, after, comparison: 'Full-resolution RGB pixels, same seeded procedural noise and viewport; no image resizing.', comparisons };
await writeFile(path.join(after, 'image-comparison.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
