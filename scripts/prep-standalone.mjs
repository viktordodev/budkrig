import { existsSync } from "node:fs";
// After `next build` with output:"standalone", the standalone server needs
// .next/static and public/ beside it. The Docker image does this with COPY
// (docker/Dockerfile); this makes `pnpm start` work the same way locally.
import { cp, mkdir } from "node:fs/promises";

const root = process.cwd();
const dst = `${root}/.next/standalone`;

if (!existsSync(dst)) {
  console.error("prep-standalone: .next/standalone not found — run `next build` first.");
  process.exit(1);
}

await mkdir(`${dst}/.next`, { recursive: true });
await cp(`${root}/.next/static`, `${dst}/.next/static`, { recursive: true });
if (existsSync(`${root}/public`)) {
  await cp(`${root}/public`, `${dst}/public`, { recursive: true });
}

const withPublic = existsSync(`${root}/public`) ? " + public" : "";
console.log(`prep-standalone: copied .next/static${withPublic}`);
