/**
 * จุดเริ่มของ HTTP server
 *
 *   node server.ts
 *
 * ระบบยืนยันตัวตนอยู่นอกขอบเขต ทุก request ต้องส่ง header มาเอง:
 *   X-User-Id: u-pat
 *   X-User-Role: STUDENT
 */

import http from 'node:http';
import { router } from './src/api/routes.ts';

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer((req, res) => {
  router.handle(req, res).catch((e) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: String(e?.message ?? e) } }));
  });
});

server.listen(PORT, () => {
  console.log(`GPU booking API listening on http://localhost:${PORT}`);
});
