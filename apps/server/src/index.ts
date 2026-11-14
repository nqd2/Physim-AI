import { loadEnvFile } from 'node:process';
import path from 'node:path';
import os from 'node:os';
import { createApp } from './app.ts';
import { findWorkspaceRoot } from './core/workspaceRoot.ts';

const root = findWorkspaceRoot(import.meta.url);
try { loadEnvFile(path.join(root, '.env')); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Không đọc được cấu hình .env.');
}
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
const app = createApp({ storageDir: process.env.PHET_STORAGE_DIR, webDir: process.env.WEB_DIST_DIR });
const server = app.listen(port, host, () => {
  console.log(`Physim-AI: http://localhost:${port}`);
  if (host === '0.0.0.0') for (const addresses of Object.values(os.networkInterfaces())) for (const address of addresses ?? []) {
    if (address.family === 'IPv4' && !address.internal) console.log(`Thiết bị trong mạng: http://${address.address}:${port}`);
  }
  console.log(process.env.OPENAI_API_KEY ? 'OpenAI: đã cấu hình.' : 'OpenAI: chưa cấu hình; sáu bài mẫu vẫn hoạt động.');
});
server.on('error', error => { console.error(`Không khởi động được server (${(error as NodeJS.ErrnoException).code ?? 'UNKNOWN'}).`); process.exitCode = 1; });
