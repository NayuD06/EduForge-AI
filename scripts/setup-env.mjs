// Copy mọi file .env.example thành .env (nếu .env chưa tồn tại). Chạy được trên Windows/macOS/Linux.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['.', 'apps/api', 'apps/web', 'apps/admin', 'apps/mobile'];

for (const dir of targets) {
  const example = join(root, dir, '.env.example');
  const env = join(root, dir, '.env');
  if (!existsSync(example)) continue;
  if (existsSync(env)) {
    console.log(`• Bỏ qua ${relative(root, env) || '.env'} (đã tồn tại)`);
    continue;
  }
  copyFileSync(example, env);
  console.log(`✓ Tạo ${relative(root, env)}`);
}
