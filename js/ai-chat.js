/* =========================================================
   CryptoBolt AI Research + Market Chat
   ========================================================= */

(() => {
    "use strict";

    const API_BASE =
        (typeof CW_CONFIG !== "undefined" && CW_CONFIG?.apiBaseUrl) ||
        window.CW_CONFIG?.apiBaseUrl ||
        "https://api.cryptobolt.io";

    const AI_ENDPOINT = `${API_BASE.replace(/\/$/, "")}/api/ai-chat`;

    const $ = id => document.getElementById(id);

    let marketData = null;

    /* -----------------------------
       API KEY
    ----------------------------- */

    const getKey = () =>
        localStorage.getItem("cw_groq_api_key") || "";

    $("ai-key-button")?.addEventListener("click", () => {
        $("api-panel").classList.toggle("hidden");

        if (!$("api-panel").classList.contains("hidden")) {
            $("groq-key").value = getKey();
        }
    });

    $("save-key")?.addEventListener("click", () => {
        const key = $("groq-key").value.trim();

        if (!key.startsWith("gsk_")) {
            alert("Please enter a valid Groq API key.");
            return;
        }

        localStorage.setItem("cw_groq_api_key", key);

        alert("API key saved to this browser.");
    });

    $("clear-key")?.addEventListener("click", () => {
        localStorage.removeItem("cw_groq_api_key");
        $("groq-key").value = "";
    });

    /* -----------------------------
       BINANCE MARKET DATA
    ----------------------------- */

    function symbol() {
        return (
            $("asset-input").value
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 15) || "BTC"
        ) + "USDT";
    }

    function timeframe() {
        return $("timeframe").value;
    }

    function isFutures() {
        return $("market-type").value === "futures";
    }

    /** Spot uses /api/v3, futures uses /fapi/v1 */
    function tickerUrl(sym) {
        if (isFutures()) {
            return `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`;
        }
        return `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`;
    }

    function klinesUrl(sym, interval) {
        if (isFutures()) {
            return `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=100`;
        }
        return `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=100`;
    }

    async function fetchMarket() {

        const sym = symbol();

        const ticker = await fetch(tickerUrl(sym)).then(r => {
            if (!r.ok) throw new Error("Asset not found on Binance");
            return r.json();
        });

        let candles;

        try {
            candles = await fetch(klinesUrl(sym, timeframe())).then(r => {
                if (!r.ok) throw new Error("klines failed");
                return r.json();
            });
        } catch {
            candles = [];
        }

        marketData = {
            symbol: sym,
            asset: sym.replace("USDT", ""),
            price: Number(ticker.lastPrice),
            change24h: Number(ticker.priceChangePercent),
            high24h: Number(ticker.highPrice),
            low24h: Number(ticker.lowPrice),
            volume: Number(ticker.quoteVolume),
            candles,
            isFutures: isFutures(),
            timeframe: timeframe()
        };

        updateMarketUI();

        return marketData;
    }

    function updateMarketUI() {

        if (!marketData) return;

        $("market-asset").textContent = marketData.asset;

        $("market-price").textContent =
            "$" + formatPrice(marketData.price);

        $("market-change").textContent =
            `${marketData.change24h >= 0 ? "+" : ""}${marketData.change24h.toFixed(2)}%`;

        $("market-change").style.color =
            marketData.change24h >= 0
                ? "#14d38a"
                : "#ff4d6a";

        $("market-high").textContent =
            "$" + formatPrice(marketData.high24h);

        $("market-low").textContent =
            "$" + formatPrice(marketData.low24h);

        $("market-volume").textContent =
            "$" + formatCompact(marketData.volume);
    }

    function formatPrice(value) {

        if (!Number.isFinite(value)) return "—";

        if (value >= 1000)
            return value.toLocaleString(undefined, {
                maximumFractionDigits: 2
            });

        if (value >= 1)
            return value.toFixed(3);

        return value.toPrecision(5);
    }

    function formatCompact(value) {

        if (value >= 1e9)
            return (value / 1e9).toFixed(2) + "B";

        if (value >= 1e6)
            return (value / 1e6).toFixed(2) + "M";

        if (value >= 1e3)
            return (value / 1e3).toFixed(2) + "K";

        return value.toFixed(0);
    }

    /* -----------------------------
       TECHNICAL DATA
    ----------------------------- */

    function closes() {

        return (marketData?.candles || [])
            .map(c => Number(c[4]))
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

            const change =
                values[i] - values[i - 1];

            if (change >= 0)
                gains += change;
            else
                losses += Math.abs(change);
        }

        if (losses === 0) return 100;

        const rs = gains / losses;

        return 100 - (100 / (1 + rs));
    }

    function technicalContext() {

        const values = closes();

        const ma7 = sma(values, 7);
        const ma25 = sma(values, 25);
        const rsi14 = rsi(values);

        const recent = values.slice(-30);

        return {
            ma7,
            ma25,
            rsi14,
            recentCloses: recent
        };
    }

    /* -----------------------------
       AI CHAT
       Server expects: { message, context }
       Client previously sent: { question, market }  ← bug
    ----------------------------- */

    async function askAI(question) {

        const key = getKey();

        if (!key) {

            addMessage(
                "ai",
                "Please add your Groq API key first using the ⚙ API Key button."
            );

            return;
        }

        try {

            if (!marketData)
                await fetchMarket();

            const technical = technicalContext();

            // Match server contract in server/src/server.js (/api/ai-chat):
            //   body.message  = user question
            //   body.context  = market snapshot object
            const payload = {

                message: question,

                context: {
                    selectedAsset: marketData.asset,
                    asset: marketData.asset,
                    symbol: marketData.symbol,
                    price: marketData.price,
                    change24h: marketData.change24h,
                    high24h: marketData.high24h,
                    low24h: marketData.low24h,
                    volume24h: marketData.volume,
                    market: marketData.isFutures ? "futures" : "spot",
                    timeframe: marketData.timeframe || timeframe(),
                    ma7: technical.ma7,
                    ma25: technical.ma25,
                    rsi14: technical.rsi14,
                    recentCloses: technical.recentCloses
                }

            };

            const response = await fetch(AI_ENDPOINT, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-groq-key": key
                },

                body: JSON.stringify(payload)

            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok)
                throw new Error(
                    data.error || `AI request failed (${response.status}).`
                );

            return data.answer;

        } catch (error) {

            console.error(error);

            return (
                "I couldn't complete the market research right now. " +
                error.message
            );
        }
    }

    /* -----------------------------
       CHAT UI
    ----------------------------- */

    function addMessage(type, text) {

        const container = $("chat-messages");

        const wrapper =
            document.createElement("div");

        wrapper.className =
            `chat-message ${type}`;

        wrapper.innerHTML = `

            <div class="message-avatar">
                ${type === "ai" ? "⚡" : "👤"}
            </div>

            <div class="message-body">

                <strong>
                    ${type === "ai"
                        ? "CryptoBolt AI"
                        : "You"}
                </strong>

                <p></p>

            </div>
        `;

        wrapper.querySelector("p").textContent = text;

        container.appendChild(wrapper);

        container.scrollTop =
            container.scrollHeight;
    }

    $("chat-form")?.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const input = $("chat-input");

            const question =
                input.value.trim();

            if (!question) return;

            input.value = "";

            addMessage("user", question);

            const thinking =
                "Researching the current market...";

            addMessage("ai", thinking);

            const messages =
                $("chat-messages");

            const last =
                messages.lastElementChild;

            const answer =
                await askAI(question);

            last.querySelector("p")
                .textContent = answer;
        }
    );

    /* -----------------------------
       QUICK QUESTIONS
    ----------------------------- */

    document
        .querySelectorAll(".question-chip, .chat-suggestions button")
        .forEach(button => {

            button.addEventListener("click", () => {

                $("chat-input").value =
                    button.textContent.trim();

                $("chat-input").focus();

            });

        });

    /* -----------------------------
       CLEAR CHAT
    ----------------------------- */

    $("clear-chat")?.addEventListener(
        "click",
        () => {

            $("chat-messages").innerHTML = `

                <div class="chat-message ai">

                    <div class="message-avatar">
                        ⚡
                    </div>

                    <div class="message-body">

                        <strong>
                            CryptoBolt AI
                        </strong>

                        <p>
                            Chat cleared. Ask me another
                            market research question.
                        </p>

                    </div>

                </div>
            `;
        }
    );

    /* -----------------------------
       ANALYZE BUTTON
    ----------------------------- */

    $("analyze-button")?.addEventListener(
        "click",
        async () => {

            $("analysis-empty")
                .classList.add("hidden");

            $("analysis-result")
                .classList.add("hidden");

            $("analysis-loading")
                .classList.remove("hidden");

            $("analysis-status")
                .textContent = "RESEARCHING";

            try {

                await fetchMarket();

                const tech =
                    technicalContext();

                const trend =
                    tech.ma7 != null && tech.ma25 != null
                        ? (tech.ma7 > tech.ma25
                            ? "Bullish"
                            : tech.ma7 < tech.ma25
                                ? "Bearish"
                                : "Neutral")
                        : "—";

                $("result-trend")
                    .textContent = trend;

                $("result-momentum")
                    .textContent =
                        tech.rsi14 == null
                            ? "—"
                            : tech.rsi14 >= 70
                                ? "Strong / Overbought"
                                : tech.rsi14 <= 30
                                    ? "Strong / Oversold"
                                    : "Moderate";

                $("result-rsi")
                    .textContent =
                    tech.rsi14 !== null
                        ? tech.rsi14.toFixed(1)
                        : "—";

                $("result-sentiment")
                    .textContent =
                    "Ask AI in chat";

                $("analysis-title")
                    .textContent =
                    `${marketData.asset} Market Read`;

                $("result-summary")
                    .textContent =
                    `Price is currently $${formatPrice(marketData.price)}. ` +
                    `The 24-hour move is ${marketData.change24h.toFixed(2)}%. ` +
                    (tech.ma7 != null && tech.ma25 != null
                        ? `MA(7) is ${tech.ma7 > tech.ma25 ? "above" : "below"} MA(25), `
                        : "") +
                    `while RSI(14) is ${tech.rsi14?.toFixed(1) ?? "unavailable"}.`;

                $("result-reasoning")
                    .innerHTML = `
                        <li>Current price: $${formatPrice(marketData.price)}</li>
                        <li>MA(7): ${tech.ma7 != null ? "$" + formatPrice(tech.ma7) : "—"}</li>
                        <li>MA(25): ${tech.ma25 != null ? "$" + formatPrice(tech.ma25) : "—"}</li>
                        <li>24h change: ${marketData.change24h.toFixed(2)}%</li>
                    `;

                $("result-risk")
                    .textContent =
                    "Technical indicators can disagree and sudden news can invalidate a market read. Treat this as research, not a prediction.";

                $("analysis-result")
                    .classList.remove("hidden");

                $("analysis-status")
                    .textContent = "READY";

            } catch (error) {

                $("analysis-title")
                    .textContent = "Research unavailable";

                $("analysis-empty")
                    .classList.remove("hidden");

                $("analysis-empty")
                    .querySelector("p")
                    .textContent =
                    error.message;

                $("analysis-status")
                    .textContent = "ERROR";

            } finally {

                $("analysis-loading")
                    .classList.add("hidden");
            }
        }
    );

    /* -----------------------------
       Initial market load
    ----------------------------- */

    fetchMarket().catch(() => {});

})();