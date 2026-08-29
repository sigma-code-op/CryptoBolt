/* =========================================================
   CryptoBolt AI Research + Market Chat
   ========================================================= */

(() => {
    "use strict";

    const API_BASE =
        (typeof CW_CONFIG !== "undefined" && CW_CONFIG?.apiBaseUrl) ||
        window.CW_CONFIG?.apiBaseUrl ||
        "https://api.cryptobolt.io";

    const AI_ENDPOINT = `${String(API_BASE).replace(/\/$/, "")}/api/ai-chat`;

    const $ = (id) => document.getElementById(id);

    let marketData = null;

    /* -----------------------------
       API KEY
       Two modes, same idea as the app.html AI panel: 'own' (classic BYOK, key stays in
       this browser's localStorage) or 'house' (no key needed — the request is flagged
       with x-use-house-key and the backend's own shared Groq key is used instead, if the
       deployment has one configured).
    ----------------------------- */

    const getKey = () => localStorage.getItem("cw_groq_api_key") || "";

    const getKeyMode = () => (localStorage.getItem("cw_ai_key_mode") === "house" ? "house" : "own");
    const setKeyMode = (mode) => localStorage.setItem("cw_ai_key_mode", mode === "house" ? "house" : "own");

    function syncKeyModeUI() {
        const mode = getKeyMode();
        const ownBtn = $("ai-mode-own");
        const houseBtn = $("ai-mode-house");
        const ownRow = $("ai-own-key-row");
        const houseRow = $("ai-house-key-row");
        ownBtn?.classList.toggle("active", mode === "own");
        houseBtn?.classList.toggle("active", mode === "house");
        ownRow?.classList.toggle("hidden", mode !== "own");
        houseRow?.classList.toggle("hidden", mode !== "house");
    }

    $("ai-mode-own")?.addEventListener("click", () => {
        setKeyMode("own");
        syncKeyModeUI();
    });

    $("ai-mode-house")?.addEventListener("click", () => {
        setKeyMode("house");
        syncKeyModeUI();
    });

    $("ai-key-button")?.addEventListener("click", () => {
        const panel = $("api-panel");
        if (!panel) return;
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            $("groq-key").value = getKey();
            if (getKeyMode() === "own") $("groq-key")?.focus();
        }
    });

    $("save-key")?.addEventListener("click", () => {
        const key = ($("groq-key")?.value || "").trim();
        if (!key.startsWith("gsk_")) {
            alert("Please enter a valid Groq API key (starts with gsk_).");
            return;
        }
        localStorage.setItem("cw_groq_api_key", key);
        alert("API key saved to this browser.");
        $("api-panel")?.classList.add("hidden");
    });

    $("clear-key")?.addEventListener("click", () => {
        localStorage.removeItem("cw_groq_api_key");
        if ($("groq-key")) $("groq-key").value = "";
    });

    syncKeyModeUI();

    // Hide the "Use CryptoBolt's key" option if this deployment hasn't configured one
    // server-side, so nobody switches to a mode that just 503s.
    (async () => {
        try {
            const res = await fetch(`${String(API_BASE).replace(/\/$/, "")}/api/health`);
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (!data?.houseKeyEnabled) {
                $("ai-mode-house")?.classList.add("hidden");
                if (getKeyMode() === "house") {
                    setKeyMode("own");
                    syncKeyModeUI();
                }
            }
        } catch {
            /* backend unreachable — leave as-is, askAI()'s own error handling covers it */
        }
    })();

    /* -----------------------------
       BINANCE MARKET DATA
    ----------------------------- */

    function symbol() {
        const raw = ($("asset-input")?.value || "BTC")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 15);
        return (raw || "BTC") + "USDT";
    }

    function timeframe() {
        return $("timeframe")?.value || "1h";
    }

    function isFutures() {
        return $("market-type")?.value === "futures";
    }

    /**
     * Try primary + fallback hosts. Some regions block api.binance.com
     * but data-api.binance.vision still works (and vice versa).
     */
    function tickerCandidates(sym) {
        if (isFutures()) {
            return [
                `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`,
                `https://fstream.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`,
            ];
        }
        return [
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`,
            `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${sym}`,
        ];
    }

    function klinesCandidates(sym, interval) {
        if (isFutures()) {
            return [
                `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=100`,
                `https://fstream.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=100`,
            ];
        }
        return [
            `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=100`,
            `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${interval}&limit=100`,
        ];
    }

    async function fetchFirstOk(urls) {
        let lastErr = null;
        for (const url of urls) {
            try {
                const r = await fetch(url);
                if (!r.ok) {
                    lastErr = new Error(`HTTP ${r.status}`);
                    continue;
                }
                return await r.json();
            } catch (e) {
                lastErr = e;
            }
        }
        throw lastErr || new Error("All market data endpoints failed");
    }

    async function fetchMarket() {
        const sym = symbol();

        const ticker = await fetchFirstOk(tickerCandidates(sym));

        let candles = [];
        try {
            candles = await fetchFirstOk(klinesCandidates(sym, timeframe()));
            if (!Array.isArray(candles)) candles = [];
        } catch {
            candles = [];
        }

        marketData = {
            symbol: sym,
            asset: sym.replace(/USDT$/, ""),
            price: Number(ticker.lastPrice),
            change24h: Number(ticker.priceChangePercent),
            high24h: Number(ticker.highPrice),
            low24h: Number(ticker.lowPrice),
            volume: Number(ticker.quoteVolume),
            candles,
            isFutures: isFutures(),
            timeframe: timeframe(),
        };

        updateMarketUI();
        return marketData;
    }

    function updateMarketUI() {
        if (!marketData) return;

        if ($("market-asset")) $("market-asset").textContent = marketData.asset;

        if ($("market-price")) {
            $("market-price").textContent = "$" + formatPrice(marketData.price);
        }

        if ($("market-change")) {
            $("market-change").textContent =
                `${marketData.change24h >= 0 ? "+" : ""}${Number(marketData.change24h).toFixed(2)}%`;
            $("market-change").style.color =
                marketData.change24h >= 0 ? "#14d38a" : "#ff4d6a";
        }

        if ($("market-high")) {
            $("market-high").textContent = "$" + formatPrice(marketData.high24h);
        }
        if ($("market-low")) {
            $("market-low").textContent = "$" + formatPrice(marketData.low24h);
        }
        if ($("market-volume")) {
            $("market-volume").textContent = "$" + formatCompact(marketData.volume);
        }
    }

    function formatPrice(value) {
        if (!Number.isFinite(value)) return "—";
        if (value >= 1000) {
            return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        if (value >= 1) return value.toFixed(3);
        return value.toPrecision(5);
    }

    function formatCompact(value) {
        if (!Number.isFinite(value)) return "—";
        if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
        if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
        if (value >= 1e3) return (value / 1e3).toFixed(2) + "K";
        return value.toFixed(0);
    }

    /* -----------------------------
       TECHNICAL DATA
    ----------------------------- */

    function closes() {
        return (marketData?.candles || [])
            .map((c) => Number(c[4]))
            .filter(Number.isFinite);
    }

    function sma(values, length) {
        if (values.length < length) return null;
        const slice = values.slice(-length);
        return slice.reduce((a, b) => a + b, 0) / length;
    }

    function rsi(values, length = 14) {
        if (values.length <= length) return null;
        let gains = 0;
        let losses = 0;
        for (let i = values.length - length; i < values.length; i++) {
            const change = values[i] - values[i - 1];
            if (change >= 0) gains += change;
            else losses += Math.abs(change);
        }
        if (losses === 0) return 100;
        const rs = gains / losses;
        return 100 - 100 / (1 + rs);
    }

    function technicalContext() {
        const values = closes();
        return {
            ma7: sma(values, 7),
            ma25: sma(values, 25),
            rsi14: rsi(values),
            recentCloses: values.slice(-30),
        };
    }

    /* -----------------------------
       AI CHAT
       Server contract: { message, context }
    ----------------------------- */

    async function askAI(question) {
        const useHouseKey = getKeyMode() === "house";
        const key = getKey();
        if (!useHouseKey && !key) {
            return 'Please add your Groq API key first using the ⚙ API Key button — or switch it to "Use CryptoBolt\'s key".';
        }

        try {
            if (!marketData) {
                try {
                    await fetchMarket();
                } catch {
                    /* still allow chat without live ticks */
                }
            }

            const technical = technicalContext();

            const payload = {
                message: question,
                context: {
                    selectedAsset: marketData?.asset || symbol().replace("USDT", ""),
                    asset: marketData?.asset || symbol().replace("USDT", ""),
                    symbol: marketData?.symbol || symbol(),
                    price: marketData?.price ?? null,
                    change24h: marketData?.change24h ?? null,
                    high24h: marketData?.high24h ?? null,
                    low24h: marketData?.low24h ?? null,
                    volume24h: marketData?.volume ?? null,
                    market: isFutures() ? "futures" : "spot",
                    timeframe: timeframe(),
                    ma7: technical.ma7,
                    ma25: technical.ma25,
                    rsi14: technical.rsi14,
                    recentCloses: technical.recentCloses,
                },
            };

            const headers = { "Content-Type": "application/json" };
            if (useHouseKey) {
                headers["x-use-house-key"] = "1";
            } else {
                headers["x-groq-key"] = key;
            }

            const response = await fetch(AI_ENDPOINT, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || `AI request failed (${response.status}).`);
            }

            return data.answer || "No answer returned.";
        } catch (error) {
            console.error("[CryptoBolt AI]", error);
            return "I couldn't complete the market research right now. " + (error.message || error);
        }
    }

    /* -----------------------------
       CHAT UI
    ----------------------------- */

    function escapeHtmlChat(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    /**
     * Minimal markdown -> HTML for chat replies. The AI backend answers in
     * plain markdown (bold, bullet/numbered lists, headings, pipe tables),
     * but the chat bubble used to insert that text with textContent + CSS
     * white-space:pre-wrap — which preserves markdown syntax and source
     * line breaks literally instead of rendering them, producing raw
     * "**bold**" / "| a | b |" text with ragged, seemingly-random line
     * wrapping. This renders the handful of markdown constructs the model
     * actually uses into real HTML (escaping first, so nothing from the
     * model can inject markup).
     */
    function renderMarkdownLite(raw) {
        const text = escapeHtmlChat(raw).replace(/\r\n/g, "\n");
        const lines = text.split("\n");
        const html = [];
        let list = null; // 'ul' | 'ol' | null
        let tableRows = null;

        const closeList = () => {
            if (list) { html.push(`</${list}>`); list = null; }
        };
        const inline = (s) =>
            s
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
        const flushTable = () => {
            if (!tableRows || !tableRows.length) { tableRows = null; return; }
            const [headerRow, ...bodyRows] = tableRows;
            html.push('<div class="chat-table-wrap"><table class="chat-table"><thead><tr>');
            headerRow.forEach((cell) => html.push(`<th>${inline(cell.trim())}</th>`));
            html.push("</tr></thead><tbody>");
            bodyRows.forEach((row) => {
                html.push("<tr>");
                row.forEach((cell) => html.push(`<td>${inline(cell.trim())}</td>`));
                html.push("</tr>");
            });
            html.push("</tbody></table></div>");
            tableRows = null;
        };
        const isTableSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
        const splitRow = (line) =>
            line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Pipe table: a "| a | b |" row followed by a "|---|---|" separator
            if (trimmed.startsWith("|") && isTableSeparator(lines[i + 1] || "")) {
                closeList();
                tableRows = [splitRow(trimmed)];
                i++; // skip the separator line
                while (i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
                    i++;
                    tableRows.push(splitRow(lines[i]));
                }
                flushTable();
                continue;
            }

            if (!trimmed) { closeList(); continue; }

            const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
            if (heading) {
                closeList();
                html.push(`<p class="chat-heading">${inline(heading[2])}</p>`);
                continue;
            }

            const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
            if (bullet) {
                if (list !== "ul") { closeList(); html.push("<ul>"); list = "ul"; }
                html.push(`<li>${inline(bullet[1])}</li>`);
                continue;
            }

            const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
            if (numbered) {
                if (list !== "ol") { closeList(); html.push("<ol>"); list = "ol"; }
                html.push(`<li>${inline(numbered[1])}</li>`);
                continue;
            }

            closeList();
            html.push(`<p>${inline(trimmed)}</p>`);
        }
        closeList();
        flushTable();
        return html.join("");
    }

    function addMessage(type, text) {
        const container = $("chat-messages");
        if (!container) return null;

        const wrapper = document.createElement("div");
        wrapper.className = `chat-message ${type}`;
        wrapper.innerHTML = `
            <div class="message-avatar">${type === "ai" ? "⚡" : "👤"}</div>
            <div class="message-body">
                <strong>${type === "ai" ? "CryptoBolt AI" : "You"}</strong>
                <div class="message-text"></div>
            </div>
        `;
        wrapper.querySelector(".message-text").innerHTML =
            type === "ai" ? renderMarkdownLite(text) : `<p>${escapeHtmlChat(text)}</p>`;
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;
        return wrapper;
    }

    function setMessageText(wrapper, type, text) {
        const el = wrapper?.querySelector(".message-text");
        if (!el) return;
        el.innerHTML = type === "ai" ? renderMarkdownLite(text) : `<p>${escapeHtmlChat(text)}</p>`;
    }

    $("chat-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const input = $("chat-input");
        const question = (input?.value || "").trim();
        if (!question) return;

        if (input) input.value = "";
        addMessage("user", question);

        const thinking = addMessage("ai", "Researching the current market...");
        const answer = await askAI(question);
        if (thinking) {
            setMessageText(thinking, "ai", answer);
        }
    });

    /* -----------------------------
       QUICK QUESTIONS
    ----------------------------- */

    document
        .querySelectorAll(".question-chip, .chat-suggestions button")
        .forEach((button) => {
            button.addEventListener("click", () => {
                if ($("chat-input")) {
                    $("chat-input").value = button.textContent.trim();
                    $("chat-input").focus();
                }
            });
        });

    /* -----------------------------
       CLEAR CHAT
    ----------------------------- */

    $("clear-chat")?.addEventListener("click", () => {
        if (!$("chat-messages")) return;
        $("chat-messages").innerHTML = `
            <div class="chat-message ai">
                <div class="message-avatar">⚡</div>
                <div class="message-body">
                    <strong>CryptoBolt AI</strong>
                    <div class="message-text"><p>Chat cleared. Ask me another market research question.</p></div>
                </div>
            </div>
        `;
    });

    /* -----------------------------
       ANALYZE BUTTON
    ----------------------------- */

    function setLoading(on) {
        $("analysis-loading")?.classList.toggle("hidden", !on);
    }

    $("analyze-button")?.addEventListener("click", async () => {
        $("analysis-empty")?.classList.add("hidden");
        $("analysis-result")?.classList.add("hidden");
        setLoading(true);
        if ($("analysis-status")) $("analysis-status").textContent = "RESEARCHING";

        try {
            await fetchMarket();
            const tech = technicalContext();

            const trend =
                tech.ma7 != null && tech.ma25 != null
                    ? tech.ma7 > tech.ma25
                        ? "Bullish"
                        : tech.ma7 < tech.ma25
                          ? "Bearish"
                          : "Neutral"
                    : "—";

            if ($("result-trend")) $("result-trend").textContent = trend;

            if ($("result-momentum")) {
                $("result-momentum").textContent =
                    tech.rsi14 == null
                        ? "—"
                        : tech.rsi14 >= 70
                          ? "Strong / Overbought"
                          : tech.rsi14 <= 30
                            ? "Strong / Oversold"
                            : "Moderate";
            }

            if ($("result-rsi")) {
                $("result-rsi").textContent =
                    tech.rsi14 != null ? tech.rsi14.toFixed(1) : "—";
            }

            if ($("result-sentiment")) $("result-sentiment").textContent = "Ask AI in chat";

            if ($("analysis-title")) {
                $("analysis-title").textContent = `${marketData.asset} Market Read`;
            }

            if ($("result-summary")) {
                $("result-summary").textContent =
                    `Price is currently $${formatPrice(marketData.price)}. ` +
                    `The 24-hour move is ${Number(marketData.change24h).toFixed(2)}%. ` +
                    (tech.ma7 != null && tech.ma25 != null
                        ? `MA(7) is ${tech.ma7 > tech.ma25 ? "above" : "below"} MA(25), `
                        : "") +
                    `while RSI(14) is ${tech.rsi14?.toFixed(1) ?? "unavailable"}.`;
            }

            if ($("result-reasoning")) {
                $("result-reasoning").innerHTML = `
                    <li>Current price: $${formatPrice(marketData.price)}</li>
                    <li>MA(7): ${tech.ma7 != null ? "$" + formatPrice(tech.ma7) : "—"}</li>
                    <li>MA(25): ${tech.ma25 != null ? "$" + formatPrice(tech.ma25) : "—"}</li>
                    <li>24h change: ${Number(marketData.change24h).toFixed(2)}%</li>
                `;
            }

            if ($("result-risk")) {
                $("result-risk").textContent =
                    "Technical indicators can disagree and sudden news can invalidate a market read. Treat this as research, not a prediction.";
            }

            $("analysis-result")?.classList.remove("hidden");
            if ($("analysis-status")) $("analysis-status").textContent = "READY";
        } catch (error) {
            if ($("analysis-title")) $("analysis-title").textContent = "Research unavailable";
            $("analysis-empty")?.classList.remove("hidden");
            const p = $("analysis-empty")?.querySelector("p");
            if (p) {
                p.textContent =
                    error.message ||
                    "Could not load market data. Check your connection or try another asset.";
            }
            if ($("analysis-status")) $("analysis-status").textContent = "ERROR";
        } finally {
            setLoading(false);
        }
    });

    /* -----------------------------
       Ensure loading is hidden on boot
    ----------------------------- */
    setLoading(false);
    $("analysis-result")?.classList.add("hidden");

    /* -----------------------------
       Initial market load
    ----------------------------- */
    fetchMarket().catch((err) => {
        console.warn("[CryptoBolt AI] initial market load failed:", err);
    });
})();