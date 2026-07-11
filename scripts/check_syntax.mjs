#!/usr/bin/env node
// Cross-platform syntax check (replaces the bash-only `for f in …` loop that
// broke `npm run check` on Windows cmd.exe). Runs `node --check` on every app
// module. CI is unaffected (js-checks.yml runs its own loop on Linux), but this
// makes `npm run check` work identically on Windows/macOS/Linux.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const files = [
  'app.js',
  'sw.js',
  ...readdirSync('js')
    .filter((f) => f.endsWith('.js'))
    .map((f) => join('js', f)),
];

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    process.stderr.write(`FAIL ${f}\n${err.stderr?.toString() || err.message}\n`);
  }
}

if (failed) {
  console.error(`\n${failed} file(s) failed syntax check.`);
  process.exit(1);
}
console.log(`All ${files.length} JS modules parsed cleanly.`);
