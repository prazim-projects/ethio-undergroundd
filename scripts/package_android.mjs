import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'apps/web/android');
if (!process.argv.includes('--skip-build')) {
  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat :app:assembleRelease -PpreviewBuild --no-daemon --max-workers=1'], { cwd: android, stdio: 'inherit' });
  } else {
    execFileSync('bash', ['gradlew', ':app:assembleRelease', '-PpreviewBuild', '--no-daemon'], { cwd: android, stdio: 'inherit' });
  }
}
const source = join(android, 'app/build/outputs/apk/release/app-release.apk');
const downloads = join(root, 'apps/web/public/downloads');
mkdirSync(downloads, { recursive: true });
const filename = 'ethio-underground.apk';
copyFileSync(source, join(downloads, filename));
const sha256 = createHash('sha256').update(readFileSync(source)).digest('hex');
writeFileSync(join(downloads, `${filename}.sha256`), `${sha256}  ${filename}\n`);
writeFileSync(join(downloads, 'android.json'), JSON.stringify({ version: '1.0-preview', package: 'et.ethiounderground.app', filename, size: statSync(source).size, sha256 }, null, 2) + '\n');
console.log(`Packaged ${filename}: ${statSync(source).size} bytes; SHA-256 ${sha256}`);
