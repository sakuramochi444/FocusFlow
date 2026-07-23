import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const source = resolve(root, "drizzle");
const target = resolve(root, "dist", "server", "migrations");

if (!existsSync(source)) {
  throw new Error("D1 migrations source folder was not found: drizzle");
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });

