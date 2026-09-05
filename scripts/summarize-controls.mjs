import { readFile, writeFile } from 'node:fs/promises';

// Select completed runs explicitly. Interrupted attempts remain in their source reports.
const sources = [
  ['controls-2026-09-05T03-31-14-881Z/report.json', ['three/webgpu', 'babylon/webgpu', 'babylon/webgl']],
  ['controls-2026-09-05T03-33-54-866Z/report.json', ['three/webgl']],
  ['controls-2026-09-05T04-04-46-301Z/report.json', ['playcanvas/webgpu', 'playcanvas/webgl']],
  ['controls-2026-09-05T04-04-07-104Z/report.json', ['native_webgpu/webgpu']],
  ['controls-2026-09-05T04-10-52-769Z/report.json', ['native_webgl/webgl']],
];
const runs = [];
for (const [source, wanted] of sources) {
  const report = JSON.parse(await readFile(`docs/QA/${source}`, 'utf8'));
  for (const key of wanted) {
    const run = report.runs.find((entry) => `${entry.engine}/${entry.requestedBackend}` === key);
    if (!run) throw new Error(`Missing completed run: ${key} in ${source}`);
    const passed = run.checks.filter((entry) => entry.passed).length;
    runs.push({ route: key, source, passed, total: run.checks.length,
      errors: run.errors.length, compute: run.compute, rawControl: run.rawControl ?? null });
  }
}
const result = { schema: 'kineti.control-summary/v2', runs,
  passed: runs.reduce((sum, run) => sum + run.passed, 0),
  total: runs.reduce((sum, run) => sum + run.total, 0),
  limits: 'Functional controls, not a score of all APIs, image quality or GPU performance. Explicit unsupported results may pass a truthful capability check. Unreal has separate non-equivalent scene tests.' };
await writeFile('docs/QA/control-summary.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, runs: runs.map(({ route, source, passed, total, errors }) => ({ route, source, passed, total, errors })) }, null, 2));
if (result.passed !== result.total || runs.some((run) => run.errors)) process.exitCode = 1;
