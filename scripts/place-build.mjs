import { cpSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(repoRoot, 'dist');

rmSync(resolve(repoRoot, 'assets'), { recursive: true, force: true });

for (const name of readdirSync(dist)) {
  cpSync(resolve(dist, name), resolve(repoRoot, name), { recursive: true });
}
