// Precompresses text assets in dist-lab as .br (brotli, max quality) and .gz.
// serve-dist.mjs serves these precompressed variants when the client accepts them.
// Run after `npm run build:lab`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { constants, brotliCompress, gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { join, extname } from 'node:path';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
const TEXT = new Set(['.js', '.mjs', '.css', '.html', '.svg', '.json', '.md', '.txt']);
const root = process.argv[2] || 'dist-lab';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

let count = 0, saved = 0;
for await (const file of walk(root)) {
  if (!TEXT.has(extname(file))) continue;
  const source = await readFile(file);
  const [br, gzipped] = await Promise.all([
    brotli(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
    gz(source, { level: 9 }),
  ]);
  await writeFile(`${file}.br`, br);
  await writeFile(`${file}.gz`, gzipped);
  count++;
  saved += source.length - br.length;
}
console.log(`precompress: ${count} archivos, ahorro brotli ~${Math.round(saved / 1024)} KB`);
