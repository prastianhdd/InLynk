import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const root = new URL('../', import.meta.url);
const marker = 'INLYNK_SERVER_ONLY_AUDIT_KEY_74629';
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) scan(path);
    else if (/\.(js|json|map)$/.test(entry.name)) {
      const text = readFileSync(path, 'utf8');
      for (const secret of [marker, process.env.LLM_API_KEY].filter(Boolean)) assert(!text.includes(secret), `Key bocor di ${path}`);
      assert(!text.includes('LLM_API_KEY'), `Referensi env server di ${path}`);
    }
  }
}
scan(fileURLToPath(new URL('../.next/static/', import.meta.url)));
console.log('LULUS: bundle client bebas key penanda dan referensi LLM_API_KEY.');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3417'], { cwd: root, env: { ...process.env, LLM_API_KEY: '', LLM_BASE_URL: '', LLM_MODEL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server tidak siap.')), 30000);
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server berhenti: ${code}`)); });
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => process.stderr.write(chunk));
  });
  const base = 'http://localhost:3417';
  for (const path of ['/', '/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/icon-maskable.png', '/offline.html']) assert.equal((await fetch(base + path)).status, 200, path);
  const post = body => fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ mode: 'chat', targetLang: 'en-US', messages: [{ role: 'user', content: 'a'.repeat(501) }] })).status, 400);
  assert.equal((await post({ mode: 'chat', targetLang: 'en-US', messages: [{ role: 'user', content: 'Halo' }] })).status, 503);
  console.log('LULUS: shell, manifest, ikon, SW, validasi API, dan error env. Provider nyata tidak dipanggil.');
} finally { server.kill(); }
