#!/usr/bin/env node
// Entry point of the language-file command (specs/usage.md, "Language files"). Plain
// JavaScript on purpose: Node strips TypeScript types, but not from files inside
// node_modules, where this package lives in an app. So the TypeScript tool and the
// sources it uses are copied to a new temporary folder, run from there, and the folder
// is removed. Node 23.6 or later; nothing is installed.

import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const work = mkdtempSync(join(tmpdir(), "ks-utility-lang-"));
try {
  cpSync(join(root, "typescript/src/lang"), join(work, "typescript/src/lang"), { recursive: true });
  cpSync(join(root, "typescript/tools/lang.ts"), join(work, "typescript/tools/lang.ts"));
  const tool = await import(pathToFileURL(join(work, "typescript/tools/lang.ts")).href);
  process.exitCode = tool.main(process.argv.slice(2), root);
} finally {
  rmSync(work, { recursive: true, force: true });
}
