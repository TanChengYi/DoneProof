import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2]);
const root = dirname(fileURLToPath(import.meta.url));
const page = await readFile(join(root, 'index.html'));
const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ready');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(page);
});

server.listen(port, '127.0.0.1');
const close = () => server.close(() => process.exit(0));
process.on('SIGTERM', close);
process.on('SIGINT', close);
