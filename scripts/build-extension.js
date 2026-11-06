// Copies the shared rating code into the extension and zips it for the Chrome Web Store.
//   node scripts/build-extension.js
// Load unpacked from extension/ for testing; upload dist/fullstackjobbies-extension.zip to the store.
import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('extension/lib', { recursive: true });
for (const f of ['extract.js', 'score.js']) await cp(`src/${f}`, `extension/lib/${f}`);

await mkdir('dist', { recursive: true });
await rm('dist/fullstackjobbies-extension.zip', { force: true });
execFileSync('zip', ['-qr', '../dist/fullstackjobbies-extension.zip', '.', '-x', '.*'], { cwd: 'extension', stdio: 'inherit' });
console.log('extension ready: dist/fullstackjobbies-extension.zip');
