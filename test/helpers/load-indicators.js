// ---------------------------------------------------------------------------
// Loads the real, shipped js/05-indicators.js into a sandbox and returns its
// top-level functions for testing. This intentionally does NOT modify the
// production file (which stays dependency-free, plain-global-scope JS for
// the browser) — it just executes the exact same source Node-side via vm,
// so a test failure here means the actual shipped math is wrong.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(__dirname, '../../js/05-indicators.js');

export function loadIndicators() {
  const source = readFileSync(SOURCE_PATH, 'utf8');

  // Deliberately run in *this* context (not a fresh vm.createContext sandbox) so arrays/objects
  // created by the loaded source are the same realm as the test file's — otherwise
  // assert.deepEqual reports structurally-identical objects as unequal because they come from
  // different Array/Object constructors.
  const wrapped = `
    (function () {
      ${source}
      return {
        calculateSMA, calculateBollingerBands, calculateRSI, calculateEMA,
        calculateVWAP, emaSeriesAligned, calculateMACD, computeHeikinAshiSeries,
        calculateATR, calculateStochRSI,
      };
    })();
  `;

  return vm.runInThisContext(wrapped, { filename: SOURCE_PATH });
}