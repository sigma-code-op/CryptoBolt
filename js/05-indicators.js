// ---------- Technical indicator math: SMA, Bollinger Bands, RSI, EMA, VWAP, MACD, Heikin Ashi. ----------
    function calculateSMA(data, count) {
        const result = [];
        if (data.length < count) return result;
        for (let i = 0; i < data.length; i++) {
            if (i < count - 1) continue;
            let sum = 0;
            for (let j = 0; j < count; j++) sum += data[i - j].close;
            result.push({ time: data[i].time, value: sum / count });
        }
        return result;
    }

    function calculateBollingerBands(data, period = 20, multiplier = 2) {
        const upperBand = [];
        const basisBand = [];
        const lowerBand = [];
        
        if (data.length < period) return { upper: [], basis: [], lower: [] };

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) continue;
            
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j].close;
            const mean = sum / period;
            
            let variance = 0;
            for (let j = 0; j < period; j++) variance += Math.pow(data[i - j].close - mean, 2);
            const stdDev = Math.sqrt(variance / period);
            
            basisBand.push({ time: data[i].time, value: mean });
            upperBand.push({ time: data[i].time, value: mean + (multiplier * stdDev) });
            lowerBand.push({ time: data[i].time, value: mean - (multiplier * stdDev) });
        }
        return { upper: upperBand, basis: basisBand, lower: lowerBand };
    }

    function calculateRSI(data, period = 14) {
        const result = [];
        if (data.length < period + 1) return result;
        let gains = 0, losses = 0;
        for (let i = 1; i <= period; i++) {
            const diff = data[i].close - data[i - 1].close;
            if (diff >= 0) gains += diff; else losses -= diff;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        result.push({ time: data[period].time, value: avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss))) });

        for (let i = period + 1; i < data.length; i++) {
            const diff = data[i].close - data[i - 1].close;
            const gain = diff > 0 ? diff : 0;
            const loss = diff < 0 ? -diff : 0;
            avgGain = ((avgGain * (period - 1)) + gain) / period;
            avgLoss = ((avgLoss * (period - 1)) + loss) / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsiVal = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
            result.push({ time: data[i].time, value: rsiVal });
        }
        return result;
    }

    // ---------- EMA / VWAP / MACD / Heikin Ashi ----------
    function calculateEMA(data, period) {
        const result = [];
        if (data.length < period) return result;
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[i].close;
        let ema = sum / period;
        result.push({ time: data[period - 1].time, value: ema });
        const k = 2 / (period + 1);
        for (let i = period; i < data.length; i++) {
            ema = data[i].close * k + ema * (1 - k);
            result.push({ time: data[i].time, value: ema });
        }
        return result;
    }

    function calculateVWAP(data) {
        const result = [];
        let cumPV = 0, cumVol = 0;
        data.forEach(c => {
            const typical = (c.high + c.low + c.close) / 3;
            cumPV += typical * c.volume;
            cumVol += c.volume;
            result.push({ time: c.time, value: cumVol > 0 ? cumPV / cumVol : typical });
        });
        return result;
    }

    // Index-aligned EMA over a plain number array — used internally by MACD so the fast/slow/
    // signal lines can be combined by array position without re-deriving time lookups.
    function emaSeriesAligned(values, period) {
        const out = new Array(values.length).fill(null);
        if (values.length < period) return out;
        let sum = 0;
        for (let i = 0; i < period; i++) sum += values[i];
        let ema = sum / period;
        out[period - 1] = ema;
        const k = 2 / (period + 1);
        for (let i = period; i < values.length; i++) {
            ema = values[i] * k + ema * (1 - k);
            out[i] = ema;
        }
        return out;
    }

    function calculateMACD(data, fast = 12, slow = 26, signalPeriod = 9) {
        const closes = data.map(c => c.close);
        const emaFast = emaSeriesAligned(closes, fast);
        const emaSlow = emaSeriesAligned(closes, slow);
        const macdRaw = closes.map((_, i) => (emaFast[i] !== null && emaSlow[i] !== null) ? emaFast[i] - emaSlow[i] : null);

        const macdValues = [];
        const macdValueDataIdx = [];
        macdRaw.forEach((v, i) => { if (v !== null) { macdValues.push(v); macdValueDataIdx.push(i); } });
        const signalDense = emaSeriesAligned(macdValues, signalPeriod);

        const macdLine = [], signalLine = [], histogram = [];
        macdRaw.forEach((v, i) => { if (v !== null) macdLine.push({ time: data[i].time, value: v }); });
        signalDense.forEach((v, j) => {
            if (v === null) return;
            const dataIdx = macdValueDataIdx[j];
            signalLine.push({ time: data[dataIdx].time, value: v });
            const hist = macdRaw[dataIdx] - v;
            histogram.push({ time: data[dataIdx].time, value: hist, color: hist >= 0 ? 'rgba(20, 211, 138, 0.6)' : 'rgba(255, 77, 106, 0.6)' });
        });
        return { macdLine, signalLine, histogram };
    }

    // Heikin Ashi candles are derived from real OHLC but smooth out noise. Indicators (MA/RSI/
    // MACD/etc.) still compute off the real cachedCandlesArray, matching how Binance's chart
    // behaves — only the candle body rendering changes, not the underlying math.
    function computeHeikinAshiSeries(candles) {
        const result = [];
        let prevHA = null;
        candles.forEach(c => {
            const haClose = (c.open + c.high + c.low + c.close) / 4;
            const haOpen = prevHA ? (prevHA.open + prevHA.close) / 2 : (c.open + c.close) / 2;
            const haHigh = Math.max(c.high, haOpen, haClose);
            const haLow = Math.min(c.low, haOpen, haClose);
            const ha = { time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose };
            result.push(ha);
            prevHA = ha;
        });
        return result;
    }

    // Shared by both the WebSocket kline handler and the REST polling fallback below, so a
    // live candle update always looks identical no matter which transport delivered it.

    // Average True Range: measures volatility (not direction) — the average of the "true range"
    // (the largest of high-low, |high-prevClose|, |low-prevClose|) over the period, smoothed
    // with Wilder's method (same smoothing RSI uses).
    function calculateATR(data, period = 14) {
        if (data.length < period + 1) return [];
        const trueRanges = [];
        for (let i = 1; i < data.length; i++) {
            const c = data[i], p = data[i - 1];
            const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
            trueRanges.push({ time: c.time, value: tr });
        }
        const result = [];
        let atr = trueRanges.slice(0, period).reduce((s, t) => s + t.value, 0) / period;
        result.push({ time: trueRanges[period - 1].time, value: atr });
        for (let i = period; i < trueRanges.length; i++) {
            atr = (atr * (period - 1) + trueRanges[i].value) / period;
            result.push({ time: trueRanges[i].time, value: atr });
        }
        return result;
    }

    // Stochastic RSI: applies the %K/%D stochastic formula to RSI values instead of price —
    // more sensitive than plain RSI, commonly used to spot momentum turns earlier.
    function calculateStochRSI(data, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
        const rsi = calculateRSI(data, rsiPeriod);
        if (rsi.length < stochPeriod) return { k: [], d: [] };

        const rawK = [];
        for (let i = stochPeriod - 1; i < rsi.length; i++) {
            const window = rsi.slice(i - stochPeriod + 1, i + 1).map(r => r.value);
            const lo = Math.min(...window), hi = Math.max(...window);
            const val = hi - lo === 0 ? 0 : ((rsi[i].value - lo) / (hi - lo)) * 100;
            rawK.push({ time: rsi[i].time, value: val });
        }

        function stochSma(series, n) {
            const out = [];
            for (let i = n - 1; i < series.length; i++) {
                const avg = series.slice(i - n + 1, i + 1).reduce((s, p) => s + p.value, 0) / n;
                out.push({ time: series[i].time, value: avg });
            }
            return out;
        }

        const k = stochSma(rawK, kSmooth);
        const d = stochSma(k, dSmooth);
        return { k, d };
    }
