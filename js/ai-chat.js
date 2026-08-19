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
    ----------------------------- */

    const getKey = () => localStorage.getItem("cw_groq_api_key") || "";

    $("ai-key-button")?.addEventListener("click", () => {
        const panel = $("api-panel");
        if (!panel) return;
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) {
            $("groq-key").value = getKey();
            $("groq-key")?.focus();
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
        const key = getKey();
        if (!key) {
            return "Please add your Groq API key first using the ⚙ API Key button.";
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

            const response = await fetch(AI_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-groq-key": key,
                },
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

    function addMessage(type, text) {
        const container = $("chat-messages");
        if (!container) return null;

        const wrapper = document.createElement("div");
        wrapper.className = `chat-message ${type}`;
        wrapper.innerHTML = `
            <div class="message-avatar">${type === "ai" ? "⚡" : "👤"}</div>
            <div class="message-body">
                <strong>${type === "ai" ? "CryptoBolt AI" : "You"}</strong>
                <p></p>
            </div>
        `;
        wrapper.querySelector("p").textContent = text;
        container.appendChild(wrapper);
        container.scrollTop = container.scrollHeight;
        return wrapper;
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
            thinking.querySelector("p").textContent = answer;
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
                    <p>Chat cleared. Ask me another market research question.</p>
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