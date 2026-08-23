import test from 'node:test';
import assert from 'node:assert/strict';
import { loadIndicators } from './helpers/load-indicators.js';

const ind = loadIndicators();

function closesToCandles(closes) {
  return closes.map((close, i) => ({ time: i, close }));
}

// ---------------------------------------------------------------------------
// SMA
// ---------------------------------------------------------------------------

test('calculateSMA: simple 1..5 ramp, period 3', () => {
  const data = closesToCandles([1, 2, 3, 4, 5]);
  const result = ind.calculateSMA(data, 3);
  assert.deepEqual(
    result.map((r) => r.value),
    [2, 3, 4]
  );
});

test('calculateSMA: returns empty array when data is shorter than the period', () => {
  const data = closesToCandles([1, 2]);
  assert.deepEqual(ind.calculateSMA(data, 3), []);
});

// ---------------------------------------------------------------------------
// EMA
// ---------------------------------------------------------------------------

test('calculateEMA: period-3 EMA on a hand-verified series', () => {
  // closes: 10, 10, 10, 20, 10 — period 3
  // seed EMA (SMA of first 3) = (10+10+10)/3 = 10
  // k = 2/(3+1) = 0.5
  // i=3: ema = 20*0.5 + 10*0.5 = 15
  // i=4: ema = 10*0.5 + 15*0.5 = 12.5
  const data = closesToCandles([10, 10, 10, 20, 10]);
  const result = ind.calculateEMA(data, 3);
  assert.deepEqual(
    result.map((r) => r.value),
    [10, 15, 12.5]
  );
});

test('calculateEMA: returns empty array when data is shorter than the period', () => {
  const data = closesToCandles([1, 2]);
  assert.deepEqual(ind.calculateEMA(data, 3), []);
});

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------

test('calculateRSI: strictly increasing closes are always RSI 100 (avgLoss stays 0)', () => {
  const closes = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
  const data = closesToCandles(closes);
  const result = ind.calculateRSI(data, 14);
  assert.ok(result.length > 0);
  for (const point of result) {
    assert.equal(point.value, 100);
  }
});

test('calculateRSI: strictly decreasing closes are always RSI 0 (avgGain stays 0)', () => {
  const closes = Array.from({ length: 20 }, (_, i) => 20 - i); // 20..1
  const data = closesToCandles(closes);
  const result = ind.calculateRSI(data, 14);
  assert.ok(result.length > 0);
  for (const point of result) {
    assert.equal(point.value, 0);
  }
});

test('calculateRSI: returns empty array when data is period-or-shorter', () => {
  const data = closesToCandles(Array.from({ length: 10 }, (_, i) => i));
  assert.deepEqual(ind.calculateRSI(data, 14), []);
});

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------

test('calculateBollingerBands: a flat (zero-variance) series collapses all three bands to the mean', () => {
  const data = closesToCandles(Array(10).fill(5));
  const { upper, basis, lower } = ind.calculateBollingerBands(data, 5, 2);
  assert.ok(upper.length > 0);
  for (let i = 0; i < upper.length; i++) {
    assert.equal(upper[i].value, 5);
    assert.equal(basis[i].value, 5);
    assert.equal(lower[i].value, 5);
  }
});

test('calculateBollingerBands: hand-verified mean/stdDev on a 5-point alternating series', () => {
  // closes: 4, 6, 4, 6, 4 — period 5, multiplier 2
  // mean = 24/5 = 4.8
  // variance = ((-0.8)^2*3 + (1.2)^2*2) / 5 = (1.92 + 2.88) / 5 = 0.96
  // stdDev = sqrt(0.96) ≈ 0.9797958971132712
  // upper = 4.8 + 2*stdDev ≈ 6.759591794226542
  // lower = 4.8 - 2*stdDev ≈ 2.840408205773458
  const data = closesToCandles([4, 6, 4, 6, 4]);
  const { upper, basis, lower } = ind.calculateBollingerBands(data, 5, 2);
  assert.equal(upper.length, 1);
  assert.equal(basis[0].value, 4.8);
  assert.ok(Math.abs(upper[0].value - 6.759591794226542) < 1e-9);
  assert.ok(Math.abs(lower[0].value - 2.840408205773458) < 1e-9);
});

test('calculateBollingerBands: returns empty bands when data is shorter than the period', () => {
  const data = closesToCandles([1, 2]);
  const bands = ind.calculateBollingerBands(data, 5, 2);
  assert.deepEqual(bands, { upper: [], basis: [], lower: [] });
});

// ---------------------------------------------------------------------------
// VWAP
// ---------------------------------------------------------------------------

test('calculateVWAP: hand-verified two-bar cumulative volume-weighted average', () => {
  // bar1: typical = (10+8+9)/3 = 9,  cumPV=900,  cumVol=100 -> VWAP=9
  // bar2: typical = (12+10+11)/3=11, cumPV=900+2200=3100, cumVol=300 -> VWAP=3100/300
  const data = [
    { time: 0, high: 10, low: 8, close: 9, volume: 100 },
    { time: 1, high: 12, low: 10, close: 11, volume: 200 },
  ];
  const result = ind.calculateVWAP(data);
  assert.equal(result[0].value, 9);
  assert.ok(Math.abs(result[1].value - 3100 / 300) < 1e-9);
});

test('calculateVWAP: falls back to the typical price when cumulative volume is zero', () => {
  const data = [{ time: 0, high: 10, low: 8, close: 9, volume: 0 }];
  const result = ind.calculateVWAP(data);
  assert.equal(result[0].value, 9); // typical price = (10+8+9)/3 = 9
});

// ---------------------------------------------------------------------------
// MACD
// ---------------------------------------------------------------------------

test('calculateMACD: a perfectly flat price series produces a zero MACD line, signal, and histogram', () => {
  // EMA of a constant series equals that constant exactly, at every step, for both the fast
  // and slow EMA — so macd = fast - slow = 0 everywhere both are defined, and the signal
  // (an EMA of an all-zero series) is 0 too.
  const closes = Array(40).fill(100);
  const data = closesToCandles(closes);
  const { macdLine, signalLine, histogram } = ind.calculateMACD(data, 12, 26, 9);

  // macdLine starts as soon as both EMAs are defined (from index slow-1); signalLine/histogram
  // start signalPeriod-1 points later than that, once the signal's own EMA warms up — so
  // signalLine is shorter than macdLine by design, not a bug.
  assert.equal(macdLine.length, closes.length - (26 - 1)); // 40 - 25 = 15
  assert.equal(signalLine.length, macdLine.length - (9 - 1)); // 15 - 8 = 7
  assert.equal(signalLine.length, histogram.length);

  for (const point of macdLine) assert.equal(point.value, 0);
  for (const point of signalLine) assert.equal(point.value, 0);
  for (const point of histogram) assert.equal(point.value, 0);
});

test('calculateMACD: histogram is always macdLine minus signalLine, index for index', () => {
  // Regression guard for the histogram computation itself, on a non-trivial series where
  // macd/signal aren't both zero — checks internal consistency of the three outputs.
  // histogram/signalLine are aligned to each other (both start once the signal EMA warms up),
  // so they're compared against the *tail* of macdLine, not macdLine's full length.
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10);
  const data = closesToCandles(closes);
  const { macdLine, signalLine, histogram } = ind.calculateMACD(data, 12, 26, 9);

  assert.equal(signalLine.length, histogram.length);
  const offset = macdLine.length - signalLine.length;

  for (let i = 0; i < histogram.length; i++) {
    const expected = macdLine[i + offset].value - signalLine[i].value;
    assert.ok(Math.abs(histogram[i].value - expected) < 1e-9);
    assert.equal(histogram[i].color, expected >= 0 ? 'rgba(20, 211, 138, 0.6)' : 'rgba(255, 77, 106, 0.6)');
  }
});

// ---------------------------------------------------------------------------
// Heikin Ashi
// ---------------------------------------------------------------------------

test('computeHeikinAshiSeries: hand-verified two-candle sequence', () => {
  const candles = [
    { time: 0, open: 10, high: 12, low: 9, close: 11 },
    { time: 1, open: 11, high: 13, low: 10, close: 12 },
  ];
  const result = ind.computeHeikinAshiSeries(candles);

  // ha1: haClose=(10+12+9+11)/4=10.5, haOpen (no prev)=(10+11)/2=10.5,
  //      haHigh=max(12,10.5,10.5)=12, haLow=min(9,10.5,10.5)=9
  assert.deepEqual(result[0], { time: 0, open: 10.5, high: 12, low: 9, close: 10.5 });

  // ha2: haClose=(11+13+10+12)/4=11.5, haOpen=(prevHA.open+prevHA.close)/2=(10.5+10.5)/2=10.5,
  //      haHigh=max(13,10.5,11.5)=13, haLow=min(10,10.5,11.5)=10
  assert.deepEqual(result[1], { time: 1, open: 10.5, high: 13, low: 10, close: 11.5 });
});

// ---------------------------------------------------------------------------
// ATR
// ---------------------------------------------------------------------------

test('calculateATR: a constant-true-range series stays flat under Wilder smoothing', () => {
  // Every bar: high=10, low=8, close=9 -> true range is always high-low=2
  // (|high-prevClose|=1 and |low-prevClose|=1 are both smaller). Wilder smoothing of a
  // constant input series stays exactly that constant.
  const data = Array.from({ length: 16 }, (_, i) => ({ time: i, high: 10, low: 8, close: 9 }));
  const result = ind.calculateATR(data, 14);
  assert.ok(result.length > 0);
  for (const point of result) {
    assert.equal(point.value, 2);
  }
});

test('calculateATR: returns empty array when data is period-or-shorter', () => {
  const data = Array.from({ length: 10 }, (_, i) => ({ time: i, high: 10, low: 8, close: 9 }));
  assert.deepEqual(ind.calculateATR(data, 14), []);
});

// ---------------------------------------------------------------------------
// Stochastic RSI
// ---------------------------------------------------------------------------

test('calculateStochRSI: a strictly increasing series (constant RSI=100) yields k/d of exactly 0', () => {
  // RSI is constant 100 the whole way for a monotonic increasing series (see RSI test above),
  // so every stochastic window is perfectly flat (hi - lo === 0), which the implementation
  // explicitly maps to 0 rather than dividing by zero.
  const closes = Array.from({ length: 50 }, (_, i) => i + 1);
  const data = closesToCandles(closes);
  const { k, d } = ind.calculateStochRSI(data, 14, 14, 3, 3);

  assert.ok(k.length > 0);
  assert.ok(d.length > 0);
  for (const point of k) assert.equal(point.value, 0);
  for (const point of d) assert.equal(point.value, 0);
});

test('calculateStochRSI: returns empty k/d when there is not enough RSI history for one stochastic window', () => {
  const closes = Array.from({ length: 20 }, (_, i) => i + 1); // RSI length = 20-14 = 6 < stochPeriod(14)
  const data = closesToCandles(closes);
  const { k, d } = ind.calculateStochRSI(data, 14, 14, 3, 3);
  assert.deepEqual(k, []);
  assert.deepEqual(d, []);
});