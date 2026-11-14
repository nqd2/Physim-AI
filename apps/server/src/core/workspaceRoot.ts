import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Works from source and from TypeScript's emitted monorepo directory layout. */
export function findWorkspaceRoot(moduleUrl: string): string {
  if (process.env.PHYSIM_WORKSPACE_ROOT) return path.resolve(process.env.PHYSIM_WORKSPACE_ROOT);
  let candidate = path.dirname(fileURLToPath(moduleUrl));
  for (;;) {
    if (existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error('Không tìm thấy workspace Physim-AI. Hãy chạy server từ checkout hoặc đặt PHYSIM_WORKSPACE_ROOT.');
    candidate = parent;
  }
}
