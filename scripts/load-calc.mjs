// Loads a browser calculator file (IIFE that sets a global) in a vm sandbox and returns the global.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function loadCalc(file, globalName) {
  const ctx = vm.createContext({ Number, Math, Infinity, isFinite, Array, Object });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  return ctx[globalName];
}