/* =========================================================
   CryptoBolt AI Research — transparency, history & education
   ---------------------------------------------------------
   Loaded after js/ai-chat.js on ai.html. ai-chat.js calls into window.cwAiResearch:
     • onInsight(parsed, ctx, meta)  → after every analysis is rendered
     • chatSourcesHtml(data, meta)   → "what this answer was based on" for a chat reply

   Three jobs, all client-side and deterministic (no extra AI calls):

   1. SOURCE TRANSPARENCY — lists which measured data (market snapshot + timestamp, indicators,
      headlines with publish times, Fear & Greed reading) went into a read, and separately which
      statements are the AI model's interpretation. "Measured" = fetched or computed by code;
      "AI" = written by the model.
   2. RESEARCH HISTORY — saves each read in this browser (localStorage) together with the data
      that existed when it was created, and lets a visitor compare two saved reports.
      Nothing here is ever sent to a server, and API keys are never stored in a report.
   3. EDUCATION — plain-language "how to read this number" explanations, including the current
      value, so the numbers can be understood without trusting the AI's conclusion.
   ========================================================= */

(() => {
    "use strict";

    const $ = (id) => document.getElementById(id);

    const HISTORY_KEY = "cw_ai_research_history_v1";
    const HISTORY_LIMIT = 20;

    /* -----------------------------
       Small helpers
    ----------------------------- */
    const esc = (s) =>
        String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    const isNum = (n) => typeof n === "number" && Number.isFinite(n);

    function fmtPrice(v) {
        if (!isNum(v)) return "—";
        if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
        if (v >= 1) return v.toFixed(3);
        return v.toPrecision(5);
    }
    function fmtCompact(v) {
        if (!isNum(v)) return "—";
        if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
        if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
        if (v >= 1e3) return (v / 1e3).toFixed(2) + "K";
        return v.toFixed(0);
    }
    function fmtPct(v, digits = 2) {
        return isNum(v) ? `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%` : "—";
    }
    function fmtTime(iso) {
        const t = Date.parse(iso);
        if (!Number.isFinite(t)) return "unknown time";
        return new Date(t).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    function fmtDuration(ms) {
        const mins = Math.round(Math.abs(ms) / 60000);
        if (mins < 1) return "under a minute";
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 48) return `${hrs}h ${mins % 60}m`;
        return `${Math.round(hrs / 24)} days`;
    }
    const cap = (s) => (typeof s === "string" && s ? s[0].toUpperCase() + s.slice(1) : "—");

    /* -----------------------------
       Measured-data catalogue: one row per number the AI is given. `kind` says who produced it
       ('exchange' = reported by Binance, 'calc' = computed by CryptoBolt's code from candles).
    ----------------------------- */
    const MEASURED = [
        { key: "price", label: "Price", kind: "exchange", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "change24hPct", label: "24h change", kind: "exchange", fmt: (v) => fmtPct(v), delta: "abs", unit: "pp" },
        { key: "high24h", label: "24h high", kind: "exchange", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "low24h", label: "24h low", kind: "exchange", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "volume24hUSDT", label: "24h volume (USDT)", kind: "exchange", fmt: (v) => "$" + fmtCompact(v), delta: "pct" },
        { key: "ma7", label: "MA(7)", kind: "calc", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "ma25", label: "MA(25)", kind: "calc", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "rsi14", label: "RSI(14)", kind: "calc", fmt: (v) => v.toFixed(1), delta: "abs", unit: "pts" },
        { key: "atrPct", label: "ATR(14) as % of price", kind: "calc", fmt: (v) => v.toFixed(2) + "%", delta: "abs", unit: "pp" },
        { key: "volumeTrend", label: "Volume trend (last 10 vs prior 10 candles)", kind: "calc", fmt: (v) => cap(v), delta: "text" },
        { key: "recentSwingHigh", label: "Highest high, last 60 candles", kind: "calc", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "recentSwingLow", label: "Lowest low, last 60 candles", kind: "calc", fmt: (v) => "$" + fmtPrice(v), delta: "pct" },
        { key: "fundingRatePct", label: "Funding rate (perpetual futures)", kind: "exchange", fmt: (v) => fmtPct(v, 4), delta: "abs", unit: "pp" },
    ];

    // The AI-written fields a report can contain, in display order.
    const AI_FIELDS = [
        { key: "trend", label: "Trend" },
        { key: "momentum", label: "Momentum" },
        { key: "confidence", label: "Confidence" },
        { key: "setupType", label: "Setup shape" },
        { key: "summary", label: "Summary" },
        { key: "outlook", label: "Next-move outlook" },
        { key: "reasoningSteps", label: "Reasoning steps" },
        { key: "keyRisk", label: "Key risk" },
        { key: "newsContext", label: "News interpretation" },
        { key: "catalystWatch", label: "What to watch" },
        { key: "fundingContext", label: "Funding interpretation" },
    ];

    const SETUP_LABELS = {
        "breakout-continuation": "Breakout continuation",
        "pullback-entry": "Pullback entry",
        "range-fade": "Range fade",
        "no-setup": "No clean setup",
    };

    function marketSourceLabel(meta, ctx) {
        const fut = ctx?.market === "perpetual futures" || meta?.isFutures;
        return fut ? "Binance USDⓈ-M perpetual futures" : "Binance spot";
    }

    /* =========================================================
       1. SOURCE TRANSPARENCY
    ========================================================= */

    function headlinesHtml(sources) {
        if (!Array.isArray(sources) || !sources.length) {
            return `<p class="rs-muted">No recent headlines were available, so none were used. Any news commentary the AI gives in this case is not grounded in a source.</p>`;
        }
        return `<ul class="rs-headlines">${sources
            .map((s) => {
                const when = s.publishedAt ? fmtTime(s.publishedAt) : `${esc(String(s.hoursAgo))}h ago`;
                const title = esc(s.title);
                const link =
                    typeof s.url === "string" && /^https:\/\//i.test(s.url)
                        ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer nofollow">${title}</a>`
                        : title;
                return `<li>${link}<span class="rs-meta"> — ${esc(s.source)} · ${esc(when)}${s.publishedAt ? ` (${esc(String(s.hoursAgo))}h before this read)` : ""}</span></li>`;
            })
            .join("")}</ul>`;
    }

    function fearGreedLine(fg) {
        if (!fg || !isNum(fg.value)) return `<p class="rs-muted">No Fear &amp; Greed reading was available.</p>`;
        return `<p>Fear &amp; Greed Index: <strong>${esc(fg.value)}/100 (${esc(fg.classification || "—")})</strong>${
            fg.timestamp ? ` <span class="rs-meta">— published ${esc(fmtTime(fg.timestamp))}; updates once a day</span>` : ""
        }</p>`;
    }

    function measuredRowsHtml(measured) {
        return MEASURED.filter((m) => measured[m.key] !== null && measured[m.key] !== undefined)
            .map(
                (m) => `<tr>
                    <th scope="row">${esc(m.label)}</th>
                    <td class="rs-num">${esc(m.fmt(measured[m.key]))}</td>
                    <td><span class="src-tag src-measured">${m.kind === "exchange" ? "Exchange data" : "Calculated"}</span></td>
                </tr>`
            )
            .join("");
    }

    function buildTransparencyHtml(report) {
        const p = report.data;
        const isLocal = report.kind === "local";
        const aiFieldsPresent = AI_FIELDS.filter((f) => {
            const v = report.ai?.[f.key];
            return Array.isArray(v) ? v.length : v !== null && v !== undefined && v !== "";
        });

        const measuredRows = measuredRowsHtml(report.measured);
        const absent = MEASURED.filter((m) => report.measured[m.key] === null || report.measured[m.key] === undefined)
            .filter((m) => !(m.key === "fundingRatePct" && report.market !== "perpetual futures"))
            .map((m) => m.label);

        return `
        <details class="rs-panel" open>
            <summary><i data-lucide="shield-check" width="14" height="14" stroke-width="2.1" style="vertical-align:-2px;"></i> Where this read came from</summary>
            <div class="rs-body">
                <p class="rs-legend">
                    <span class="src-tag src-measured">Measured</span> fetched from an exchange or computed by CryptoBolt's code from exchange candles &nbsp;·&nbsp;
                    <span class="src-tag src-ai">AI</span> written by the model from that data — an interpretation, and it can be wrong.
                </p>

                <h4>Measured data <span class="src-tag src-measured">Measured</span></h4>
                <p class="rs-meta">${esc(marketSourceLabel(p, { market: report.market }))} · ${esc(report.timeframe)} candles${isNum(p.candleCount) ? ` (${esc(p.candleCount)} loaded)` : ""} · snapshot taken ${esc(fmtTime(p.fetchedAt))}</p>
                <div class="rs-table-wrap"><table class="rs-table"><tbody>${measuredRows}</tbody></table></div>
                ${absent.length ? `<p class="rs-muted">Not available for this read: ${esc(absent.join(", "))}.</p>` : ""}

                <h4>Headlines checked, last 72h <span class="src-tag src-measured">Measured</span></h4>
                ${headlinesHtml(p.headlines)}

                <h4>Market sentiment <span class="src-tag src-measured">Measured</span></h4>
                ${fearGreedLine(p.fearGreed)}

                <h4>${isLocal ? "Interpretation (simple rules, no AI)" : "AI interpretation"} <span class="src-tag ${isLocal ? "src-rule" : "src-ai"}">${isLocal ? "Rule-based" : "AI"}</span></h4>
                ${
                    isLocal
                        ? `<p>No AI model was used. Trend is read from whether MA(7) is above or below MA(25); momentum is "strong" only when RSI is at an extreme (30 or below / 70 or above). No news or sentiment research went into it.</p>`
                        : `<p>These parts of the read are the model's own judgement, produced from the measured data above: <strong>${esc(aiFieldsPresent.map((f) => f.label).join(", ") || "—")}</strong>. Support and resistance levels are rounded from the measured swing high/low rather than invented.</p>
                           <p class="rs-meta">Model: ${esc(p.model || "unknown")}${p.passes ? ` · ${esc(p.passes)}-pass (research notes, then structured read)` : ""} · generated ${esc(fmtTime(p.generatedAt))}${
                              Array.isArray(p.inputs) && p.inputs.length ? ` · ${esc(p.inputs.length)} data fields supplied to the model` : ""
                          }</p>`
                }
            </div>
        </details>`;
    }

    // Chips next to existing headings/boxes so the measured/AI split is visible at a glance.
    function tagSections(isLocal) {
        document.querySelectorAll("#analysis-result .src-tag.src-inline").forEach((n) => n.remove());

        const chip = (cls, text) => {
            const s = document.createElement("span");
            s.className = `src-tag src-inline ${cls}`;
            s.textContent = text;
            return s;
        };
        const aiChip = () => (isLocal ? chip("src-rule", "Rule-based") : chip("src-ai", "AI"));
        const measuredChip = () => chip("src-measured", "Measured");

        const boxLabel = (valueId) => $(valueId)?.parentElement?.querySelector("span");
        boxLabel("result-trend")?.after(aiChip());
        boxLabel("result-momentum")?.after(aiChip());
        boxLabel("result-rsi")?.after(measuredChip());
        const sentiment = boxLabel("result-sentiment");
        if (sentiment) {
            // Shows the measured F&G value when available, otherwise the AI's confidence label.
            const fgShown = /\/100/.test($("result-sentiment")?.textContent || "");
            sentiment.after(fgShown ? measuredChip() : aiChip());
        }
        ["result-summary", "result-outlook", "result-reasoning", "result-risk", "result-news", "result-catalyst"].forEach((id) => {
            const h = $(id)?.parentElement?.querySelector("h3");
            if (h && !(isLocal && id === "result-outlook")) h.appendChild(aiChip());
        });
    }

    /* =========================================================
       3. EDUCATION — deterministic "how to read this number" notes
    ========================================================= */

    function explainerItems(ctx) {
        const items = [];

        if (isNum(ctx.rsi14)) {
            const v = ctx.rsi14;
            const zone =
                v >= 70 ? "above 70, the zone traders call “overbought”: gains have been outpacing losses unusually strongly"
                : v >= 55 ? "between 55 and 70: buyers have had the upper hand recently, but it isn't stretched"
                : v > 45 ? "between 45 and 55: gains and losses have been roughly balanced"
                : v > 30 ? "between 30 and 45: sellers have had the upper hand recently, but it isn't stretched"
                : "below 30, the zone traders call “oversold”: losses have been outpacing gains unusually strongly";
            items.push({
                title: `RSI(14) is ${v.toFixed(1)}`,
                body: `The Relative Strength Index compares the size of recent up-moves to recent down-moves over the last 14 candles and squeezes the result onto a 0–100 scale. Right now it is ${zone}. “Overbought” and “oversold” are not sell and buy signals — in a strong trend RSI can stay extreme for a long time.`,
            });
        }

        if (isNum(ctx.ma7) && isNum(ctx.ma25)) {
            const above = ctx.ma7 > ctx.ma25;
            const gapPct = ((ctx.ma7 - ctx.ma25) / ctx.ma25) * 100;
            items.push({
                title: `MA(7) ${above ? "above" : "below"} MA(25) (${fmtPct(gapPct)} gap)`,
                body: `A moving average (MA) is the average closing price over the last N candles — MA(7) reacts quickly, MA(25) reacts slowly. When the fast one sits ${above ? "above" : "below"} the slow one, recent prices are ${above ? "higher" : "lower"} than the longer-run average, which is the simple rule behind a “${above ? "bullish" : "bearish"}” label. Averages lag price, so they confirm what already happened rather than predict what comes next.`,
            });
        }

        if (isNum(ctx.atrPct)) {
            const v = ctx.atrPct;
            const level = v < 1 ? "low" : v < 2.5 ? "normal" : v < 5 ? "elevated" : "high";
            items.push({
                title: `Volatility (ATR) is ${v.toFixed(2)}% of price — ${level}`,
                body: `Average True Range (ATR) is the average distance price travels in one candle, including gaps. Expressed as a percent of price it lets you compare coins of very different prices. At ${v.toFixed(2)}%, a typical ${esc(ctx.interval || "")} candle moves about ${v.toFixed(2)}% — ${level} compared with usual crypto conditions. Higher volatility means wider swings in both directions, so stops placed too tight get hit by noise and leverage becomes riskier.`,
            });
        }

        if (ctx.volumeTrend) {
            items.push({
                title: `Volume is ${ctx.volumeTrend}`,
                body: `Volume is how much was traded. CryptoBolt compares the last 10 candles with the 10 before them (more than 15% change counts as rising or falling). Moves on rising volume have more participation behind them; moves on falling volume are often less reliable. Volume says how many traders agree, not which direction is right.`,
            });
        }

        if (isNum(ctx.fundingRatePct) && ctx.market === "perpetual futures") {
            const r = ctx.fundingRatePct;
            const who = r > 0.01 ? "longs are paying shorts" : r < -0.01 ? "shorts are paying longs" : "payments are roughly balanced";
            const annual = r * 3 * 365;
            items.push({
                title: `Funding rate is ${fmtPct(r, 4)} — ${who}`,
                body: `Perpetual futures never expire, so exchanges use a funding payment, usually every 8 hours, to keep the contract price near the spot price. A positive rate means traders betting on a rise (longs) pay those betting on a fall (shorts); a negative rate is the reverse. Right now ${who}. If it stayed at this level it would add up to roughly ${fmtPct(annual, 1)} per year on a position's size, which is why persistently high funding makes crowded trades expensive. It reflects positioning, not a prediction. See <a href="funding-rate-explained.html">funding rates explained</a>.`,
            });
        }

        if (isNum(ctx.recentSwingHigh) && isNum(ctx.recentSwingLow) && ctx.recentSwingHigh > ctx.recentSwingLow && isNum(ctx.price)) {
            const pos = ((ctx.price - ctx.recentSwingLow) / (ctx.recentSwingHigh - ctx.recentSwingLow)) * 100;
            items.push({
                title: `Price sits ${Math.max(0, Math.min(100, pos)).toFixed(0)}% of the way up its recent range`,
                body: `The recent range is the lowest low ($${fmtPrice(ctx.recentSwingLow)}) to the highest high ($${fmtPrice(ctx.recentSwingHigh)}) over the last 60 candles. Traders watch these edges as rough support (a floor where buyers previously stepped in) and resistance (a ceiling where sellers did). They are reference points from history, not guarantees — price can and does break through them.`,
            });
        }

        return items;
    }

    function explainersHtml(ctx, fearGreed) {
        const items = explainerItems(ctx);

        if (fearGreed && isNum(fearGreed.value)) {
            const v = fearGreed.value;
            items.push({
                title: `Fear & Greed is ${v}/100 (${fearGreed.classification || "—"})`,
                body: `A daily 0–100 gauge of overall crypto-market mood from alternative.me, built from factors like volatility, momentum and social activity. Low numbers mean fear, high numbers mean greed. Some traders treat extremes as a contrarian warning, but sentiment can stay extreme for weeks and it says nothing about one specific coin. It updates once per day.`,
            });
        }

        if (!items.length) return "";
        return `
        <details class="rs-panel">
            <summary><i data-lucide="graduation-cap" width="14" height="14" stroke-width="2.1" style="vertical-align:-2px;"></i> Understand these numbers (not just the AI's conclusion)</summary>
            <div class="rs-body">
                <p class="rs-muted">Plain-language notes, written by CryptoBolt (not the AI), using the values from this read.</p>
                ${items.map((i) => `<details class="rs-item"><summary>${esc(i.title)}</summary><p>${i.body}</p></details>`).join("")}
            </div>
        </details>`;
    }

    /* =========================================================
       2. RESEARCH HISTORY & COMPARISON
    ========================================================= */

    function loadHistory() {
        try {
            const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
            return Array.isArray(raw) ? raw.filter((r) => r && typeof r === "object" && r.id && r.savedAt) : [];
        } catch {
            return [];
        }
    }

    function persistHistory(list) {
        let items = list.slice(0, HISTORY_LIMIT);
        // Storage can be full or blocked; shed the oldest reports until it fits, else give up quietly
        // (the live analysis still works — history is a convenience).
        while (items.length) {
            try {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
                return items;
            } catch {
                items = items.slice(0, -1);
            }
        }
        try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
        return [];
    }

    function buildReport(parsed, ctx, meta) {
        const isLocal = Boolean(parsed.isLocalCalculation);
        const prov = parsed.provenance || {};

        const measured = {};
        MEASURED.forEach((m) => {
            const v = ctx[m.key];
            measured[m.key] = m.key === "volumeTrend" ? (typeof v === "string" ? v : null) : isNum(v) ? v : null;
        });

        const ai = {};
        AI_FIELDS.forEach((f) => {
            const v = parsed[f.key];
            if (Array.isArray(v)) ai[f.key] = v.map((x) => String(x).slice(0, 400)).slice(0, 8);
            else ai[f.key] = typeof v === "string" ? v.slice(0, 1500) : null;
        });
        ai.support = isNum(parsed.support) ? parsed.support : null;
        ai.resistance = isNum(parsed.resistance) ? parsed.resistance : null;

        return {
            id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            savedAt: new Date().toISOString(),
            asset: String(ctx.asset || "").slice(0, 15),
            market: ctx.market,
            timeframe: ctx.interval,
            kind: isLocal ? "local" : "ai",
            measured,
            ai,
            data: {
                fetchedAt: meta?.fetchedAt || new Date().toISOString(),
                candleCount: isNum(meta?.candleCount) ? meta.candleCount : null,
                isFutures: Boolean(meta?.isFutures),
                headlines: (Array.isArray(parsed.sources) ? parsed.sources : []).slice(0, 8).map((s) => ({
                    title: String(s.title || "").slice(0, 180),
                    source: String(s.source || "").slice(0, 40),
                    hoursAgo: isNum(s.hoursAgo) ? s.hoursAgo : null,
                    publishedAt: typeof s.publishedAt === "string" ? s.publishedAt : null,
                    url: typeof s.url === "string" && /^https:\/\//i.test(s.url) ? s.url.slice(0, 400) : null,
                })),
                fearGreed:
                    parsed.fearGreed && isNum(parsed.fearGreed.value)
                        ? {
                              value: parsed.fearGreed.value,
                              classification: String(parsed.fearGreed.classification || "").slice(0, 30),
                              timestamp: typeof parsed.fearGreed.timestamp === "string" ? parsed.fearGreed.timestamp : null,
                          }
                        : null,
                model: isLocal ? null : prov.model || null,
                passes: isLocal ? null : prov.passes || null,
                generatedAt: isLocal ? null : prov.generatedAt || null,
                inputs: Array.isArray(prov.inputs) ? prov.inputs.slice(0, 40) : [],
            },
        };
    }

    // Transparency panel reads the same shape as a saved report, so one renderer serves both.
    function onInsight(parsed, ctx, meta) {
        let report;
        try {
            report = buildReport(parsed, ctx, meta);
        } catch (err) {
            console.warn("[CryptoBolt AI] couldn't build research report:", err);
            return;
        }

        const host = $("result-transparency");
        if (host) host.innerHTML = buildTransparencyHtml(report);
        const learn = $("result-explainers");
        if (learn) learn.innerHTML = explainersHtml(ctx, parsed.fearGreed);
        tagSections(report.kind === "local");

        const previous = loadHistory().find(
            (r) => r.asset === report.asset && r.market === report.market && r.timeframe === report.timeframe
        );

        const history = persistHistory([report, ...loadHistory()]);
        const saved = history.some((r) => r.id === report.id);

        const note = $("result-history-note");
        if (note) {
            note.innerHTML = saved
                ? `<span class="rs-meta">Saved to your research history (this browser only).</span>${
                      previous
                          ? ` <button type="button" class="rs-btn" data-rs-compare-new="${esc(previous.id)}|${esc(report.id)}">Compare with ${esc(fmtTime(previous.savedAt))} report</button>`
                          : ""
                  }`
                : `<span class="rs-meta">Couldn't save this read to history (browser storage is full or blocked).</span>`;
        }

        renderHistory();
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    /* ---------- history list ---------- */

    let compareState = { a: null, b: null };

    function trendBadge(report) {
        const t = report.ai?.trend;
        if (!t) return "";
        return `<span class="rh-trend rh-trend-${esc(t)}">${esc(cap(t))}</span>`;
    }

    function renderHistory() {
        const host = $("research-history");
        if (!host) return;
        const list = loadHistory();
        const clearBtn = $("rh-clear");
        if (clearBtn) clearBtn.classList.toggle("hidden", !list.length);

        if (!list.length) {
            host.innerHTML = `<p class="rs-muted">No saved research yet. Each time you press <strong>Analyze Market</strong>, the read is saved here with the data that existed at that moment, so you can compare it against a newer one later.</p>`;
            $("research-compare")?.classList.add("hidden");
            return;
        }

        host.innerHTML = `<ul class="rh-list">${list
            .map(
                (r) => `<li class="rh-row" data-id="${esc(r.id)}">
                    <div class="rh-main">
                        <strong>${esc(r.asset)}/USDT</strong>
                        <span class="rs-meta">${esc(r.market === "perpetual futures" ? "Perp" : "Spot")} · ${esc(r.timeframe)} · ${esc(fmtTime(r.savedAt))}</span>
                        <span class="rs-meta">$${esc(fmtPrice(r.measured?.price))}</span>
                        ${trendBadge(r)}
                        <span class="src-tag ${r.kind === "local" ? "src-rule" : "src-ai"}">${r.kind === "local" ? "Rule-based" : "AI read"}</span>
                    </div>
                    <div class="rh-actions">
                        <button type="button" class="rs-btn" data-rh-compare="${esc(r.id)}">Compare</button>
                        <button type="button" class="rs-btn rs-btn-danger" data-rh-delete="${esc(r.id)}" aria-label="Delete this saved report">Delete</button>
                    </div>
                </li>`
            )
            .join("")}</ul>`;

        // Keep an open comparison in sync with the list (e.g. after a delete).
        if (compareState.a && compareState.b) {
            const ids = new Set(list.map((r) => r.id));
            if (!ids.has(compareState.a) || !ids.has(compareState.b)) {
                compareState = { a: null, b: null };
                $("research-compare")?.classList.add("hidden");
            } else {
                renderCompare();
            }
        }
    }

    /* ---------- comparison ---------- */

    function openCompare(aId, bId) {
        const list = loadHistory();
        const a = list.find((r) => r.id === aId);
        let b = list.find((r) => r.id === bId);
        if (!a) return;
        if (!b) {
            // Default partner: the nearest other report of the same asset/market/timeframe, else the newest other one.
            b =
                list.find((r) => r.id !== a.id && r.asset === a.asset && r.market === a.market && r.timeframe === a.timeframe) ||
                list.find((r) => r.id !== a.id);
        }
        if (!b) {
            const el = $("research-compare");
            if (el) {
                el.classList.remove("hidden");
                el.innerHTML = `<p class="rs-muted">You need at least two saved reports to compare. Run another analysis, then come back.</p>`;
            }
            return;
        }
        compareState = { a: a.id, b: b.id };
        renderCompare();
        $("research-compare")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function deltaCell(m, oldV, newV) {
        if (m.delta === "text") {
            return oldV === newV ? `<span class="rs-muted">no change</span>` : `<span class="rs-changed">${esc(cap(oldV))} → ${esc(cap(newV))}</span>`;
        }
        if (!isNum(oldV) || !isNum(newV)) return `<span class="rs-muted">—</span>`;
        const diff = newV - oldV;
        if (diff === 0) return `<span class="rs-muted">no change</span>`;
        const arrow = diff > 0 ? "▲" : "▼";
        if (m.delta === "pct") {
            if (oldV === 0) return `<span class="rs-changed">${arrow}</span>`;
            return `<span class="rs-changed">${arrow} ${fmtPct((diff / Math.abs(oldV)) * 100)}</span>`;
        }
        const digits = m.key === "fundingRatePct" ? 4 : m.key === "rsi14" ? 1 : 2;
        return `<span class="rs-changed">${arrow} ${Math.abs(diff).toFixed(digits)} ${m.unit || ""}</span>`;
    }

    function dataColumnHtml(r) {
        const d = r.data || {};
        const heads = Array.isArray(d.headlines) ? d.headlines : [];
        return `
            <div class="rc-col">
                <h5>${esc(fmtTime(r.savedAt))} <span class="src-tag ${r.kind === "local" ? "src-rule" : "src-ai"}">${r.kind === "local" ? "Rule-based" : "AI read"}</span></h5>
                <ul class="rc-facts">
                    <li>Market snapshot: ${esc(fmtTime(d.fetchedAt))}${isNum(d.candleCount) ? `, ${esc(d.candleCount)} candles` : ""}</li>
                    <li>Source: ${esc(d.isFutures || r.market === "perpetual futures" ? "Binance perpetual futures" : "Binance spot")}</li>
                    <li>Headlines available: ${esc(heads.length)}</li>
                    <li>Fear &amp; Greed: ${d.fearGreed ? `${esc(d.fearGreed.value)}/100 (${esc(d.fearGreed.classification)})${d.fearGreed.timestamp ? `, published ${esc(fmtTime(d.fearGreed.timestamp))}` : ""}` : "not available"}</li>
                    <li>${r.kind === "local" ? "No AI model used" : `Model: ${esc(d.model || "unknown")}${isNum(d.passes) ? `, ${esc(d.passes)} passes` : ""}`}</li>
                    ${Array.isArray(d.inputs) && d.inputs.length ? `<li>${esc(d.inputs.length)} data fields supplied to the model</li>` : ""}
                </ul>
                ${
                    heads.length
                        ? `<details class="rs-item"><summary>Headlines at the time</summary>${headlinesHtml(heads)}</details>`
                        : ""
                }
            </div>`;
    }

    function aiColumnHtml(r) {
        const ai = r.ai || {};
        const label = r.kind === "local" ? "Rule-based read" : "AI-generated";
        const steps = Array.isArray(ai.reasoningSteps) && ai.reasoningSteps.length
            ? `<ul>${ai.reasoningSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "";
        return `
            <div class="rc-col">
                <h5>${esc(fmtTime(r.savedAt))} <span class="src-tag ${r.kind === "local" ? "src-rule" : "src-ai"}">${esc(label)}</span></h5>
                ${ai.summary ? `<p>${esc(ai.summary)}</p>` : `<p class="rs-muted">No summary.</p>`}
                ${ai.outlook ? `<p><strong>Outlook:</strong> ${esc(ai.outlook)}</p>` : ""}
                ${ai.keyRisk ? `<p><strong>Key risk:</strong> ${esc(ai.keyRisk)}</p>` : ""}
                ${steps}
            </div>`;
    }

    function renderCompare() {
        const host = $("research-compare");
        if (!host) return;
        const list = loadHistory();
        let first = list.find((r) => r.id === compareState.a);
        let second = list.find((r) => r.id === compareState.b);
        if (!first || !second) { host.classList.add("hidden"); return; }

        // Older always on the left so "change" reads forward in time.
        const [older, newer] = Date.parse(first.savedAt) <= Date.parse(second.savedAt) ? [first, second] : [second, first];

        const optionList = (selected) =>
            list
                .map(
                    (r) => `<option value="${esc(r.id)}"${r.id === selected ? " selected" : ""}>${esc(r.asset)} ${esc(r.market === "perpetual futures" ? "perp" : "spot")} ${esc(r.timeframe)} — ${esc(fmtTime(r.savedAt))}</option>`
                )
                .join("");

        const mismatch =
            older.asset !== newer.asset || older.market !== newer.market || older.timeframe !== newer.timeframe;

        const rows = MEASURED.filter((m) => older.measured?.[m.key] != null || newer.measured?.[m.key] != null)
            .map((m) => {
                const o = older.measured?.[m.key];
                const n = newer.measured?.[m.key];
                return `<tr>
                    <th scope="row">${esc(m.label)}</th>
                    <td class="rs-num">${o == null ? "—" : esc(m.fmt(o))}</td>
                    <td class="rs-num">${n == null ? "—" : esc(m.fmt(n))}</td>
                    <td>${deltaCell(m, o, n)}</td>
                </tr>`;
            })
            .join("");

        const aiRows = ["trend", "momentum", "confidence", "setupType"]
            .filter((k) => older.ai?.[k] || newer.ai?.[k])
            .map((k) => {
                const label = AI_FIELDS.find((f) => f.key === k).label;
                const show = (v) => (v ? esc(k === "setupType" ? SETUP_LABELS[v] || v : cap(v)) : "—");
                const changed = (older.ai?.[k] || null) !== (newer.ai?.[k] || null);
                return `<tr>
                    <th scope="row">${esc(label)}</th>
                    <td>${show(older.ai?.[k])}</td>
                    <td>${show(newer.ai?.[k])}</td>
                    <td>${changed ? `<span class="rs-changed">changed</span>` : `<span class="rs-muted">same</span>`}</td>
                </tr>`;
            })
            .join("");

        host.classList.remove("hidden");
        host.innerHTML = `
            <div class="rc-head">
                <h3>Compare reports</h3>
                <button type="button" class="rs-btn" data-rc-close>Close</button>
            </div>
            <div class="rc-pickers">
                <label>Report A<select data-rc-pick="a">${optionList(compareState.a)}</select></label>
                <label>Report B<select data-rc-pick="b">${optionList(compareState.b)}</select></label>
            </div>
            <p class="rs-meta">Older: ${esc(fmtTime(older.savedAt))} · Newer: ${esc(fmtTime(newer.savedAt))} · ${esc(fmtDuration(Date.parse(newer.savedAt) - Date.parse(older.savedAt)))} apart</p>
            ${mismatch ? `<p class="rs-warn">These reports cover different assets, markets or timeframes, so the changes below aren't like-for-like.</p>` : ""}

            <h4>Measured data <span class="src-tag src-measured">Measured</span></h4>
            <div class="rs-table-wrap"><table class="rs-table rc-table">
                <thead><tr><th></th><th>Older</th><th>Newer</th><th>Change</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>

            <h4>Readings at each time <span class="src-tag src-ai">AI</span></h4>
            <div class="rs-table-wrap"><table class="rs-table rc-table">
                <thead><tr><th></th><th>Older</th><th>Newer</th><th></th></tr></thead>
                <tbody>${aiRows || `<tr><td colspan="4" class="rs-muted">No labelled readings.</td></tr>`}</tbody>
            </table></div>
            <div class="rc-cols">${aiColumnHtml(older)}${aiColumnHtml(newer)}</div>

            <h4>Data available when each report was created</h4>
            <div class="rc-cols">${dataColumnHtml(older)}${dataColumnHtml(newer)}</div>
            <p class="rs-muted">A newer read can differ because the market moved, because new headlines arrived, or simply because AI wording varies between runs — compare the measured numbers first.</p>`;
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    /* ---------- events (delegated; elements are re-rendered often) ---------- */

    document.addEventListener("click", (e) => {
        const t = e.target.closest?.("[data-rh-compare],[data-rh-delete],[data-rc-close],[data-rs-compare-new],#rh-clear");
        if (!t) return;

        if (t.hasAttribute("data-rh-compare")) {
            openCompare(t.getAttribute("data-rh-compare"), null);
        } else if (t.hasAttribute("data-rs-compare-new")) {
            const [a, b] = t.getAttribute("data-rs-compare-new").split("|");
            openCompare(a, b);
            $("research-history-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (t.hasAttribute("data-rh-delete")) {
            const id = t.getAttribute("data-rh-delete");
            persistHistory(loadHistory().filter((r) => r.id !== id));
            renderHistory();
        } else if (t.hasAttribute("data-rc-close")) {
            compareState = { a: null, b: null };
            $("research-compare")?.classList.add("hidden");
        } else if (t.id === "rh-clear") {
            if (window.confirm("Delete all saved research from this browser?")) {
                try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
                compareState = { a: null, b: null };
                renderHistory();
            }
        }
    });

    document.addEventListener("change", (e) => {
        const sel = e.target.closest?.("[data-rc-pick]");
        if (!sel) return;
        compareState[sel.getAttribute("data-rc-pick")] = sel.value;
        if (compareState.a === compareState.b) {
            const other = loadHistory().find((r) => r.id !== compareState.a);
            if (other) compareState[sel.getAttribute("data-rc-pick") === "a" ? "b" : "a"] = other.id;
        }
        renderCompare();
    });

    /* =========================================================
       Chat: "what was this answer based on?"
    ========================================================= */

    function chatSourcesHtml(data, meta) {
        const prov = data?.provenance;
        const sources = Array.isArray(data?.sources) ? data.sources : [];
        const parts = [];

        if (meta?.fetchedAt) {
            parts.push(
                `<p><span class="src-tag src-measured">Measured</span> ${esc(meta.asset)} ${esc(meta.isFutures ? "perpetual futures" : "spot")} snapshot from Binance, taken ${esc(fmtTime(meta.fetchedAt))}: price, 24h change/high/low/volume, MA(7), MA(25), RSI(14) and recent closes.</p>`
            );
        } else {
            parts.push(`<p class="rs-muted">The live market snapshot wasn't available when this was asked, so the answer wasn't grounded in current prices.</p>`);
        }

        parts.push(`<div><span class="src-tag src-measured">Measured</span> Headlines (last 72h)${headlinesHtml(sources)}</div>`);
        parts.push(`<div><span class="src-tag src-measured">Measured</span> ${fearGreedLine(data?.fearGreed)}</div>`);
        if (prov?.paperTradesProvided) {
            parts.push(`<p><span class="src-tag src-measured">Measured</span> A snapshot of your practice (paper) account was included.</p>`);
        }
        parts.push(
            `<p><span class="src-tag src-ai">AI</span> The wording, explanations and any opinions in the answer are the model's interpretation of the data above${prov?.model ? ` (${esc(prov.model)}, ${esc(fmtTime(prov.generatedAt))})` : ""}. It can be wrong or out of date — check the numbers.</p>`
        );

        return `<details class="rs-chat-sources"><summary>What this answer was based on</summary>${parts.join("")}</details>`;
    }

    /* ---------- boot ---------- */
    renderHistory();

    window.cwAiResearch = { onInsight, chatSourcesHtml, loadHistory };
})();