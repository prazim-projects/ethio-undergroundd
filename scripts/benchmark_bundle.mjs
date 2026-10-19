import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const files = await readdir(resolve(root, 'apps/web/dist/assets'));
const chunks = await Promise.all(files.filter((name) => /\.(js|css)$/.test(name)).map(async (name) => {
  const bytes = await readFile(resolve(root, 'apps/web/dist/assets', name));
  return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}));
const jsGzip = chunks.filter((chunk) => chunk.name.endsWith('.js')).reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
const cssGzip = chunks.filter((chunk) => chunk.name.endsWith('.css')).reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
const budget = { totalJsGzip: 450 * 1024, totalCssGzip: 50 * 1024 };
const passed = jsGzip <= budget.totalJsGzip && cssGzip <= budget.totalCssGzip;
const report = { passed, jsGzip, cssGzip, budget, chunks };
await mkdir(resolve(root, '.tmp/audit'), { recursive: true });
await writeFile(resolve(root, '.tmp/audit/bundle.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed, jsGzip, cssGzip, budget }, null, 2));
if (!passed) process.exitCode = 1;
