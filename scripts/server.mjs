import { createServer } from 'node:http';
import next from 'next';

process.env.INLYNK_API_SERVER = '1';
const port = Number(process.env.API_PORT || 3001);
const app = next({ dev: process.env.NODE_ENV !== 'production', hostname: '127.0.0.1', port });
await app.prepare();
const handle = app.getRequestHandler();
const server = createServer((request, response) => {
  const path = new URL(request.url || '/', 'http://localhost').pathname;
  if (path === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end('{"ok":true}'); return; }
  if (!path.startsWith('/api/')) { response.writeHead(404); response.end(); return; }
  handle(request, response);
});
server.listen(port, '127.0.0.1', () => console.log(`Server API siap: http://127.0.0.1:${port}`));
server.on('error', error => { console.error(`Server API gagal: ${error.message}`); process.exit(1); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); void app.close().finally(() => process.exit()); });
