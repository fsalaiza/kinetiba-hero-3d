import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

// Bundler metadata, not guesses based on a generated chunk's filename.
const result = await build({ configFile: 'vite.research.config.js', logLevel: 'silent', build: { write: false, minify: false } });
const chunks = (Array.isArray(result) ? result.flatMap((item) => item.output) : result.output).filter((item) => item.type === 'chunk');
const entry = chunks.find((item) => item.facadeModuleId?.endsWith('/index.html'));
const initial = new Set();
const visit = (chunk) => { if (!chunk || initial.has(chunk.fileName)) return; initial.add(chunk.fileName); chunk.imports.forEach((file) => visit(chunks.find((item) => item.fileName === file))); };
visit(entry);
const report = { note: 'Rendered module lengths before minification. Initial import graph excludes dynamic laboratory imports.',
  initial: chunks.filter((chunk) => initial.has(chunk.fileName)).map((chunk) => ({ file: chunk.fileName,
    modules: Object.entries(chunk.modules).map(([file, value]) => ({ file, renderedLength: value.renderedLength, removedExports: value.removedExports })).sort((a, b) => b.renderedLength - a.renderedLength) })),
  deferred: chunks.filter((chunk) => !initial.has(chunk.fileName)).map((chunk) => chunk.fileName) };
await mkdir('docs/QA/performance-bundle', { recursive: true });
await writeFile('docs/QA/performance-bundle/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.initial.map((chunk) => ({ file: chunk.file, largest: chunk.modules.slice(0, 8).map(({ file, renderedLength }) => ({ file, renderedLength })) })), null, 2));
