// ---------------------------------------------------------------------------
// Loads the real, shipped js/16-paper-trading.js into a sandbox and returns its
// top-level pure math functions for testing. Mirrors load-indicators.js: this intentionally
// does NOT modify or duplicate the production formulas — it executes the exact same source
// Node-side via vm, so a test failure here means the actual shipped math is wrong.
//
// Only the functions declared OUTSIDE the file's big IIFE (see the top of
// js/16-paper-trading.js) are reachable this way — that's deliberate: those are the pure,
// side-effect-free functions, kept out of the closure specifically so they can be tested here.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(__dirname, '../../js/16-paper-trading.js');

const IIFE_MARKER = '\n(function () {';

export function loadPaperTradingMath() {
  const fullSource = readFileSync(SOURCE_PATH, 'utf8');

  // Only the pure math above the file's big page-boot IIFE is needed (and safe to run) here —
  // that IIFE touches `document`/`localStorage` on load, which don't exist under plain Node.
  // If this marker ever stops matching, the file's structure changed and this loader (and the
  // "pure math lives outside the IIFE" comment at the top of the source file) need updating.
  const cutIndex = fullSource.indexOf(IIFE_MARKER);
  if (cutIndex === -1) {
    throw new Error(
      `load-paper-trading.js: could not find the boot IIFE in ${SOURCE_PATH} — has the file been restructured?`
    );
  }
  const pureMathSource = fullSource.slice(0, cutIndex);

  // Run in this realm (not a fresh vm.createContext) so plain objects created by the loaded
  // source compare correctly with assert.deepEqual against objects built in the test file.
  const wrapped = `
    (function () {
      ${pureMathSource}
      return {
        estimateLiqPrice, futuresPnl, computeFee, computeBuyAvgCost, computeRealizedPnl,
        computeSlippageBps, estimateFillPrice,
      };
    })();
  `;

  return vm.runInThisContext(wrapped, { filename: SOURCE_PATH });
}