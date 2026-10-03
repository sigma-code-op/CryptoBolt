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
    const AI_INSIGHT_ENDPOINT = `${String(API_BASE).replace(/\/$/, "")}/api/ai-insight`;

    const $ = (id) => document.getElementById(id);

    let marketData = null;

    /* -----------------------------
       AI FAILURE HANDLING
       Every AI call goes through aiFetch(), which turns any failure — missing/invalid key,
       rate limit, timeout, network error, a response that isn't the shape we expect — into one
       AiRequestError { code, message, retryable, retryAfterSeconds }. The UI then shows that
       message with the right recovery actions (retry, countdown, add/switch key) via
       buildRecovery(). Codes mirror server/src/lib/ai-errors.js.

       API keys: kept only in this tab's sessionStorage and sent in a request header. They are
       never put in a URL, a stored report, or a log line — redactKey() scrubs anything key-shaped
       out of messages before they are logged or shown.
    ----------------------------- */
    class AiRequestError extends Error {
        constructor(message, { code = "ai_failed", retryable = true, retryAfterSeconds = null, status = 0 } = {}) {
            super(message);
            this.name = "AiRequestError";
            this.code = code;
            this.retryable = retryable;
            this.retryAfterSeconds = retryAfterSeconds;
            this.status = status;
        }
    }

    const redactKey = (s) => String(s ?? "").replace(/gsk_[A-Za-z0-9_-]{6,}/g, "[redacted-key]");

    function toAiError(err) {
        if (err instanceof AiRequestError) return err;
        if (err?.name === "AbortError") {
            return new AiRequestError("The AI request took too long and was cancelled. Please try again.", { code: "timeout" });
        }
        return new AiRequestError(redactKey(err?.message) || "The AI request failed. Please try again.", { code: "ai_failed" });
    }

    async function aiFetch(url, { headers, body, timeoutMs }) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res;
        try {
            res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
        } catch (err) {
            // fetch() rejects with a TypeError when the server can't be reached at all (offline,
            // DNS, CORS-blocked). Only treated as "network" here, where we know fetch threw it.
            if (err instanceof TypeError) {
                throw new AiRequestError("Couldn't reach the CryptoBolt AI server. Check your connection and try again.", { code: "network" });
            }
            throw toAiError(err);
        } finally {
            clearTimeout(timer);
        }

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            const headerRetry = Number(res.headers.get("retry-after"));
            const bodyRetry = Number(data?.retryAfterSeconds);
            throw new AiRequestError(
                redactKey(data?.error) || `The AI service responded with an error (${res.status}). Please try again.`,
                {
                    code: typeof data?.code === "string" ? data.code : res.status === 429 ? "rate_limited" : "ai_failed",
                    retryable: typeof data?.retryable === "boolean" ? data.retryable : res.status === 429 || res.status >= 500,
                    retryAfterSeconds: bodyRetry > 0 ? bodyRetry : headerRetry > 0 ? headerRetry : null,
                    status: res.status,
                }
            );
        }

        if (!data || typeof data !== "object") {
            throw new AiRequestError("The AI service returned a response CryptoBolt couldn't read. Please try again.", {
                code: "malformed_response",
            });
        }
        return data;
    }

    function openKeyPanel() {
        const panel = $("api-panel");
        if (!panel) return;
        panel.classList.remove("hidden");
        if ($("groq-key")) $("groq-key").value = getKey();
        if (getKeyMode() === "own") $("groq-key")?.focus();
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Recovery actions for a failure: retry (with a live countdown when the server said how long
    // to wait) and, where relevant, jump to the key settings or switch between key modes.
    function buildRecovery(failure, onRetry) {
        const bar = document.createElement("div");
        bar.className = "ai-recovery";

        const add = (label, handler, { disabled = false } = {}) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.disabled = disabled;
            b.addEventListener("click", handler);
            bar.appendChild(b);
            return b;
        };

        const keyProblem = failure.code === "missing_key" || failure.code === "invalid_key";
        const houseProblem = failure.code === "house_rate_limited" || failure.code === "house_key_disabled";
        const houseAvailable = !$("ai-mode-house")?.classList.contains("hidden");

        if (failure.retryable && onRetry) {
            const retryBtn = add("Try again", () => onRetry());
            const wait = Number(failure.retryAfterSeconds);
            if (wait > 0) {
                let left = Math.min(Math.ceil(wait), 3600);
                retryBtn.disabled = true;
                const tick = () => {
                    if (!retryBtn.isConnected) return;
                    if (left <= 0) {
                        retryBtn.disabled = false;
                        retryBtn.textContent = "Try again";
                        return;
                    }
                    retryBtn.textContent = `Try again in ${left}s`;
                    left -= 1;
                    setTimeout(tick, 1000);
                };
                // Deferred so the bar has been attached to the page by the time the first tick checks
                // isConnected (the caller appends it right after buildRecovery returns).
                setTimeout(tick, 0);
            }
        }

        if (keyProblem) {
            add("Open API key settings", openKeyPanel);
            if (houseAvailable && getKeyMode() === "own") {
                add("Use CryptoBolt's key", () => {
                    setKeyMode("house");
                    syncKeyModeUI();
                    if (onRetry) onRetry();
                });
            }
        }

        if (houseProblem) {
            add("Use my own key", () => {
                setKeyMode("own");
                syncKeyModeUI();
                openKeyPanel();
            });
        }

        return bar;
    }

    /* -----------------------------
       CHAT MEMORY
       Kept client-side (last CHAT_HISTORY_LIMIT turns) and sent with every
       question so the backend can answer follow-ups ("what about the 4h
       chart?") instead of treating every message as a cold start. Persisted
       to localStorage so a reload doesn't lose the conversation.
    ----------------------------- */
    const CHAT_HISTORY_LIMIT = 8; // messages (user+assistant combined), not full transcript
    const CHAT_HISTORY_KEY = "cw_ai_chat_history";

    function loadChatHistory() {
        try {
            const raw = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
            return Array.isArray(raw) ? raw.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")) : [];
        } catch {
            return [];
        }
    }

    let chatHistory = loadChatHistory();

    function saveChatHistory() {
        try {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.slice(-CHAT_HISTORY_LIMIT)));
        } catch {
            /* storage full/unavailable — memory still works for this session */
        }
    }

    function pushChatHistory(role, content) {
        chatHistory.push({ role, content: String(content).slice(0, 1200) });
        chatHistory = chatHistory.slice(-CHAT_HISTORY_LIMIT);
        saveChatHistory();
    }

    /* -----------------------------
       API KEY
       Two modes, same idea as the app.html AI panel: 'own' (classic BYOK, key stays in
    this browser's sessionStorage) or 'house' (no key needed — the request is flagged
       with x-use-house-key and the backend's own shared Groq key is used instead, if the
       deployment has one configured).
    ----------------------------- */

    const getKey = () => sessionStorage.getItem("cw_groq_api_key") || "";

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
        sessionStorage.setItem("cw_groq_api_key", key);
        alert("API key saved for this browser tab.");
        $("api-panel")?.classList.add("hidden");
    });

    $("clear-key")?.addEventListener("click", () => {
        sessionStorage.removeItem("cw_groq_api_key");
        if ($("groq-key")) $("groq-key").value = "";
    });

    syncKeyModeUI();

    // Hide the "Use CryptoBolt's key" option if this deployment hasn't configured one
    // server-side, so nobody switches to a mode that just 503s.
    //
    // If it IS configured and this visitor hasn't made an explicit choice yet (no stored
    // mode, no key of their own already saved), default them into house mode — so landing
    // on the AI Research page and asking a question works with zero setup. They only see
    // the key-setup step if they hit the shared limit or choose to switch.
    (async () => {
        try {
            const res = await fetch(`${String(API_BASE).replace(/\/$/, "")}/api/health`);
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.houseKeyEnabled) {
                const hasExplicitMode = localStorage.getItem("cw_ai_key_mode") !== null;
                if (!hasExplicitMode && !getKey()) {
                    setKeyMode("house");
                    syncKeyModeUI();
                }
            } else {
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

        // Funding rate only exists for perpetual futures. Best-effort: a failure just means the
        // read is made without it (and says so), never that the whole analysis fails.
        let funding = null;
        if (isFutures()) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 6000);
                try {
                    const r = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, { signal: controller.signal });
                    if (r.ok) {
                        const d = await r.json();
                        const rate = Number(d?.lastFundingRate);
                        const next = Number(d?.nextFundingTime);
                        if (Number.isFinite(rate)) {
                            funding = {
                                ratePct: rate * 100,
                                nextMins: Number.isFinite(next) && next > Date.now() ? Math.round((next - Date.now()) / 60000) : null,
                            };
                        }
                    }
                } finally {
                    clearTimeout(timer);
                }
            } catch {
                funding = null;
            }
        }

        marketData = {
            fetchedAt: new Date().toISOString(),
            candleCount: candles.length,
            fundingRatePct: funding ? funding.ratePct : null,
            fundingNextMins: funding ? funding.nextMins : null,
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

    // Returns { answer, actions, sources, fearGreed, provenance, meta } on success, or
    // { failure, actions: [] } on any failure (see AiRequestError above).
    async function askAI(question) {
        const useHouseKey = getKeyMode() === "house";
        const key = getKey();
        if (!useHouseKey && !key) {
            return {
                failure: new AiRequestError(
                    'Please add your Groq API key first using the ⚙ API Key button — or switch to "Use CryptoBolt\'s key".',
                    { code: "missing_key", retryable: false }
                ),
                actions: [],
            };
        }

        try {
            // Refresh the market snapshot if it's missing or older than a minute, so the answer
            // isn't grounded in stale prices (the snapshot time is shown under every answer).
            const age = marketData ? Date.now() - Date.parse(marketData.fetchedAt) : Infinity;
            if (!marketData || !(age < 60000)) {
                try {
                    await fetchMarket();
                } catch {
                    /* still allow chat without live ticks */
                }
            }

            const technical = technicalContext();

            const payload = {
                message: question,
                history: chatHistory.slice(-CHAT_HISTORY_LIMIT),
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

            // Practice-account snapshot, only when the visitor has left the toggle on and the
            // account has something in it. Live prices are fetched here so the AI sees real
            // P&L / distance-to-liquidation, not stale saved numbers.
            const tradesContext = await collectTradesContext();
            if (tradesContext) payload.trades = tradesContext;

            const headers = { "Content-Type": "application/json" };
            if (useHouseKey) {
                headers["x-use-house-key"] = "1";
            } else {
                headers["x-groq-key"] = key;
            }

            const data = await aiFetch(AI_ENDPOINT, { headers, body: JSON.stringify(payload), timeoutMs: 45000 });

            const answer = typeof data.answer === "string" ? data.answer.trim() : "";
            if (!answer) {
                throw new AiRequestError("The AI returned an empty answer. Please try again.", { code: "empty_response" });
            }

            return {
                answer,
                actions: Array.isArray(data.actions) ? data.actions : [],
                sources: Array.isArray(data.sources) ? data.sources : [],
                fearGreed: data.fearGreed || null,
                provenance: data.provenance && typeof data.provenance === "object" ? data.provenance : null,
                meta: marketData
                    ? { asset: marketData.asset, isFutures: marketData.isFutures, fetchedAt: marketData.fetchedAt }
                    : null,
            };
        } catch (error) {
            const failure = toAiError(error);
            console.error("[CryptoBolt AI]", failure.code, redactKey(failure.message));
            return { failure, actions: [] };
        }
    }

    /* -----------------------------
       PAPER TRADES x AI
       Lets the chat see the visitor's practice account (js/ai-trades.js) and lets them
       confirm changes the AI proposes. Nothing is applied without a click on a card.
    ----------------------------- */

    const SHARE_TRADES_KEY = "cw_ai_share_trades";
    const tradesApi = () => window.cwAiTrades || null;
    const shareTradesOn = () => localStorage.getItem(SHARE_TRADES_KEY) !== "0";

    async function collectTradesContext() {
        const api = tradesApi();
        if (!api || !shareTradesOn()) return null;
        try {
            const state = api.readState(localStorage);
            if (!api.hasActivity(state)) return null;
            const quotes = await api.fetchQuotes(api.neededSymbols(state));
            return api.buildTradesContext(state, quotes);
        } catch (err) {
            console.warn("[CryptoBolt AI] couldn't read paper trades:", err);
            return null;
        }
    }

    function syncTradesToggle() {
        const box = $("ai-trades-toggle");
        const api = tradesApi();
        const row = $("ai-trades-row");
        if (!box || !row) return;
        if (!api) { row.classList.add("hidden"); return; }
        box.checked = shareTradesOn();
        const state = api.readState(localStorage);
        const note = $("ai-trades-note");
        if (note) {
            note.textContent = api.hasActivity(state)
                ? "Sends your practice-account positions and results to the AI so it can review them."
                : "No practice trades yet — place some on the Trading Account page and the AI can review them.";
        }
    }
    $("ai-trades-toggle")?.addEventListener("change", (e) => {
        localStorage.setItem(SHARE_TRADES_KEY, e.target.checked ? "1" : "0");
    });
    syncTradesToggle();
    // Trades placed in another tab show up here without a reload.
    window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("cw_paper_")) syncTradesToggle(); });

    // Cards for the actions the AI proposed. Each needs its own Confirm click; on confirm the
    // account and live prices are re-read and the action is re-validated before it's applied.
    function renderActionCards(wrapper, actions) {
        const api = tradesApi();
        if (!wrapper || !api || !actions || !actions.length) return;
        const body = wrapper.querySelector(".message-body");
        if (!body) return;

        const list = document.createElement("div");
        list.className = "ai-actions";
        const heading = document.createElement("div");
        heading.className = "ai-actions-heading";
        heading.textContent = "Proposed changes to your practice account — nothing happens until you confirm";
        list.appendChild(heading);

        actions.forEach((action) => {
            const card = document.createElement("div");
            card.className = "ai-action-card";
            const title = document.createElement("div");
            title.className = "ai-action-title";
            const detail = document.createElement("div");
            detail.className = "ai-action-detail";
            const reason = document.createElement("div");
            reason.className = "ai-action-reason";
            const status = document.createElement("div");
            status.className = "ai-action-status hidden";
            const buttons = document.createElement("div");
            buttons.className = "ai-action-buttons";
            const confirmBtn = document.createElement("button");
            confirmBtn.type = "button";
            confirmBtn.className = "ai-action-confirm";
            confirmBtn.textContent = "Confirm";
            const dismissBtn = document.createElement("button");
            dismissBtn.type = "button";
            dismissBtn.className = "ai-action-dismiss";
            dismissBtn.textContent = "Dismiss";
            buttons.append(confirmBtn, dismissBtn);

            const label = { set_tp_sl: "Update exits", cancel_order: "Cancel order", close_futures: "Close position" }[action.type] || "Change";
            title.textContent = label;
            detail.textContent = "Checking the current account…";
            if (action.reason) reason.textContent = `Why: ${action.reason}`;
            card.append(title, detail, reason, status, buttons);
            list.appendChild(card);

            const finish = (text, ok) => {
                buttons.classList.add("hidden");
                status.textContent = text;
                status.classList.remove("hidden");
                status.classList.toggle("ok", !!ok);
                card.classList.add(ok ? "done" : "closed");
            };

            // Fill in a live preview (title/detail) as soon as prices load.
            (async () => {
                const state = api.readState(localStorage);
                const quotes = await api.fetchQuotes(api.neededSymbols(state));
                const pv = api.previewAction(state, action, quotes);
                if (pv.ok) { title.textContent = pv.title; detail.textContent = pv.detail; }
                else { detail.textContent = pv.error; confirmBtn.disabled = true; }
            })();

            dismissBtn.addEventListener("click", () => finish("Dismissed.", false));
            confirmBtn.addEventListener("click", async () => {
                confirmBtn.disabled = true;
                detail.textContent = "Applying…";
                try {
                    const state = api.readState(localStorage);
                    const quotes = await api.fetchQuotes(api.neededSymbols(state));
                    // Re-read right before writing so we never clobber a change made in the meantime.
                    const fresh = api.readState(localStorage);
                    const result = api.applyAction(fresh, action, quotes);
                    if (!result.ok) { detail.textContent = result.error; finish(result.error, false); return; }
                    api.persistState(fresh, localStorage, result.changed);
                    finish(result.message + " Open the Trading Account page to see it.", true);
                    syncTradesToggle();
                } catch (err) {
                    console.error("[CryptoBolt AI] action failed:", err);
                    finish("Couldn't apply that change. Nothing was changed.", false);
                }
            });
        });

        body.appendChild(list);
        const container = $("chat-messages");
        if (container) container.scrollTop = container.scrollHeight;
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
            <div class="message-avatar">${type === "ai" ? '<i data-lucide="zap" width="14" height="14" stroke-width="2.3"></i>' : '<i data-lucide="user" width="14" height="14" stroke-width="2.1"></i>'}</div>
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

    // Replay any persisted conversation so a page reload doesn't lose it. The static
    // welcome bubble already in the HTML stays as the first message either way.
    (function restoreChatHistory() {
        if (!chatHistory.length) return;
        chatHistory.forEach((m) => addMessage(m.role === "assistant" ? "ai" : "user", m.content));
    })();

    function setMessageText(wrapper, type, text) {
        const el = wrapper?.querySelector(".message-text");
        if (!el) return;
        el.innerHTML = type === "ai" ? renderMarkdownLite(text) : `<p>${escapeHtmlChat(text)}</p>`;
    }

    // One chat turn. On failure the bubble shows the specific reason plus recovery buttons, and
    // the turn is NOT added to chat memory (so an error message never becomes "context" for the
    // next question). Retry re-runs the same question in the same bubble.
    async function runChatTurn(question, bubble) {
        if (!bubble) return;
        bubble.classList.remove("chat-error");
        bubble.querySelectorAll(".ai-recovery, .rs-chat-sources").forEach((n) => n.remove());
        setMessageText(bubble, "ai", "Researching the current market...");

        const result = await askAI(question);
        const body = bubble.querySelector(".message-body");

        if (result.failure) {
            bubble.classList.add("chat-error");
            setMessageText(bubble, "ai", result.failure.message);
            body?.appendChild(buildRecovery(result.failure, () => runChatTurn(question, bubble)));
            const box = $("chat-messages");
            if (box) box.scrollTop = box.scrollHeight;
            return;
        }

        setMessageText(bubble, "ai", result.answer);
        renderActionCards(bubble, result.actions);
        const sourcesHtml = window.cwAiResearch?.chatSourcesHtml(result, result.meta);
        if (body && sourcesHtml) {
            const wrap = document.createElement("div");
            wrap.className = "rs-chat-sources";
            wrap.innerHTML = sourcesHtml;
            body.appendChild(wrap);
        }
        pushChatHistory("user", question);
        pushChatHistory("assistant", result.answer);
        renderFollowups(question, result.answer);
        const box = $("chat-messages");
        if (box) box.scrollTop = box.scrollHeight;
    }

    $("chat-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const input = $("chat-input");
        const question = (input?.value || "").trim();
        if (!question) return;

        if (input) input.value = "";
        addMessage("user", question);

        const bubble = addMessage("ai", "Researching the current market...");
        await runChatTurn(question, bubble);
    });

    /* -----------------------------
       FOLLOW-UP SUGGESTIONS
       A small, rotating pool of natural next questions shown under the AI's
       latest reply — makes the chat feel like a conversation instead of a
       one-shot Q&A box. Purely client-side (no extra AI call to generate
       them), so there's no added latency or cost.
    ----------------------------- */
    const FOLLOWUP_POOL = [
        "What would change this view?",
        "How does this compare to yesterday?",
        "Explain that more simply",
        "What's the main risk here?",
        "How does this look on a longer timeframe?",
        "What should I watch next?",
    ];

    function renderFollowups() {
        const container = $("chat-followups");
        if (!container) return;
        const picks = FOLLOWUP_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        container.innerHTML = "";
        picks.forEach((text) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = text;
            btn.addEventListener("click", () => {
                if ($("chat-input")) {
                    $("chat-input").value = text;
                    $("chat-input").focus();
                }
            });
            container.appendChild(btn);
        });
    }

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
        chatHistory = [];
        saveChatHistory();
        if ($("chat-followups")) $("chat-followups").innerHTML = "";
        $("chat-messages").innerHTML = `
            <div class="chat-message ai">
                <div class="message-avatar"><i data-lucide="zap" width="14" height="14" stroke-width="2.3"></i></div>
                <div class="message-body">
                    <strong>CryptoBolt AI</strong>
                    <div class="message-text"><p>Chat cleared. Ask me another market research question.</p></div>
                </div>
            </div>
        `;
    });

    /* -----------------------------
       ANALYZE BUTTON — now backed by the real /api/ai-insight endpoint (the
       same Groq-backed, news+sentiment-grounded analysis app.html's Terminal
       uses), instead of a page-local MA(7)/MA(25) crossover. Falls back to
       that local calculation — clearly labeled as such — only when no key is
       available or the backend can't be reached.
    ----------------------------- */

    function setLoading(on) {
        $("analysis-loading")?.classList.toggle("hidden", !on);
    }

    // ATR(14) from raw klines (index 2=high, 3=low, 4=close), plus the same value
    // expressed as a % of price so a gauge/threshold reads sensibly across assets.
    function computeATR14(candles) {
        if (!Array.isArray(candles) || candles.length < 15) return null;
        const trs = [];
        for (let i = 1; i < candles.length; i++) {
            const high = Number(candles[i][2]), low = Number(candles[i][3]), prevClose = Number(candles[i - 1][4]);
            trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
        }
        const last14 = trs.slice(-14);
        if (last14.length < 14) return null;
        return last14.reduce((a, b) => a + b, 0) / last14.length;
    }

    function computeVolumeTrend(candles) {
        if (!Array.isArray(candles) || candles.length < 20) return null;
        const vols = candles.slice(-10).map((c) => Number(c[5])).filter(Number.isFinite);
        const prevVols = candles.slice(-20, -10).map((c) => Number(c[5])).filter(Number.isFinite);
        if (vols.length < 5 || prevVols.length < 5) return null;
        const avgRecent = vols.reduce((a, b) => a + b, 0) / vols.length;
        const avgPrior = prevVols.reduce((a, b) => a + b, 0) / prevVols.length;
        if (!(avgPrior > 0)) return null;
        const pct = ((avgRecent - avgPrior) / avgPrior) * 100;
        return pct > 15 ? "rising" : pct < -15 ? "falling" : "flat";
    }

    // Builds the exact context shape the backend's validateContext() expects
    // (see server/src/validators.js) from this page's own fetched ticker+klines —
    // no chart-engine dependency needed, unlike app.html's richer version.
    function buildInsightContext() {
        if (!marketData || !Array.isArray(marketData.candles) || marketData.candles.length < 20) return null;
        const tech = technicalContext();
        const highs = marketData.candles.slice(-60).map((c) => Number(c[2])).filter(Number.isFinite);
        const lows = marketData.candles.slice(-60).map((c) => Number(c[3])).filter(Number.isFinite);
        if (!highs.length || !lows.length) return null;
        const atr14 = computeATR14(marketData.candles);
        return {
            asset: marketData.asset,
            market: marketData.isFutures ? "perpetual futures" : "spot",
            interval: marketData.timeframe,
            price: marketData.price,
            change24hPct: marketData.change24h,
            high24h: marketData.high24h,
            low24h: marketData.low24h,
            volume24hUSDT: marketData.volume,
            ma7: tech.ma7,
            ma25: tech.ma25,
            rsi14: tech.rsi14,
            atr14,
            atrPct: atr14 !== null && marketData.price ? Number(((atr14 / marketData.price) * 100).toFixed(3)) : null,
            volumeTrend: computeVolumeTrend(marketData.candles),
            recentSwingHigh: Math.max(...highs),
            recentSwingLow: Math.min(...lows),
            recentClosesTrend: tech.recentCloses,
            // Perpetual futures only; omitted for spot or when the funding request failed.
            ...(marketData.isFutures && Number.isFinite(marketData.fundingRatePct)
                ? {
                      fundingRatePct: Number(marketData.fundingRatePct.toFixed(4)),
                      ...(Number.isFinite(marketData.fundingNextMins) ? { fundingNextMins: marketData.fundingNextMins } : {}),
                  }
                : {}),
        };
    }

    // Deterministic, non-AI fallback — same shape as the backend's parsed result so
    // renderInsight() can treat both identically. Used when no key is set/selected,
    // or when the backend request fails outright.
    function computeLocalRead(ctx, failure = null) {
        const trend = ctx.ma7 != null && ctx.ma25 != null
            ? (ctx.ma7 > ctx.ma25 ? "bullish" : ctx.ma7 < ctx.ma25 ? "bearish" : "neutral")
            : "neutral";
        const momentum = ctx.rsi14 == null ? "moderate" : (ctx.rsi14 >= 70 || ctx.rsi14 <= 30) ? "strong" : "moderate";
        return {
            trend, momentum, confidence: null,
            support: ctx.recentSwingLow, resistance: ctx.recentSwingHigh,
            summary: `Price is currently $${formatPrice(ctx.price)}. The 24-hour move is ${Number(ctx.change24hPct).toFixed(2)}%. ` +
                (ctx.ma7 != null && ctx.ma25 != null ? `MA(7) is ${ctx.ma7 > ctx.ma25 ? "above" : "below"} MA(25), ` : "") +
                `while RSI(14) is ${ctx.rsi14 != null ? ctx.rsi14.toFixed(1) : "unavailable"}.`,
            reasoningSteps: [
                `Current price: $${formatPrice(ctx.price)}`,
                `MA(7): ${ctx.ma7 != null ? "$" + formatPrice(ctx.ma7) : "—"}`,
                `MA(25): ${ctx.ma25 != null ? "$" + formatPrice(ctx.ma25) : "—"}`,
                `24h change: ${Number(ctx.change24hPct).toFixed(2)}%`,
            ],
            keyRisk: "Technical indicators can disagree and sudden news can invalidate a market read. Treat this as research, not a prediction.",
            isLocalCalculation: true,
            failure,
        };
    }

    async function requestBackendInsight(ctx) {
        const useHouseKey = getKeyMode() === "house";
        const key = getKey();
        const headers = { "Content-Type": "application/json" };
        if (useHouseKey) headers["x-use-house-key"] = "1"; else headers["x-groq-key"] = key;

        const data = await aiFetch(AI_INSIGHT_ENDPOINT, { headers, body: JSON.stringify({ context: ctx }), timeoutMs: 30000 });

        // Defensive shape check: the server already validates, but an old/cached server build or a
        // proxy in between could hand back something else, and an empty card is worse than an error.
        const r = data.result;
        if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.summary !== "string" || !r.summary.trim() || typeof r.trend !== "string") {
            throw new AiRequestError("The AI returned a response CryptoBolt couldn't read. Please try again.", { code: "malformed_response" });
        }

        return {
            ...r,
            reasoningSteps: Array.isArray(r.reasoningSteps) ? r.reasoningSteps.map(String) : [],
            sources: Array.isArray(data.sources) ? data.sources : [],
            fearGreed: data.fearGreed || null,
            provenance: data.provenance && typeof data.provenance === "object" ? data.provenance : null,
        };
    }

    function setSection(id, html) {
        const wrap = $(id + "-wrap");
        const inner = $(id);
        if (!inner) return;
        if (html) {
            inner.innerHTML = html;
            wrap?.classList.remove("hidden");
        } else {
            wrap?.classList.add("hidden");
        }
    }

    function renderInsight(parsed, ctx) {
        lastInsight = { parsed, ctx };
        $("analysis-share-row")?.classList.remove("hidden");
        if ($("result-trend")) $("result-trend").textContent = parsed.trend ? parsed.trend[0].toUpperCase() + parsed.trend.slice(1) : "—";
        if ($("result-momentum")) $("result-momentum").textContent = parsed.momentum ? parsed.momentum[0].toUpperCase() + parsed.momentum.slice(1) : "—";
        if ($("result-rsi")) $("result-rsi").textContent = ctx.rsi14 != null ? ctx.rsi14.toFixed(1) : "—";
        if ($("result-sentiment")) {
            $("result-sentiment").textContent = (parsed.fearGreed && typeof parsed.fearGreed.value === "number")
                ? `${parsed.fearGreed.value}/100 (${parsed.fearGreed.classification || "—"})`
                : (parsed.confidence ? `${parsed.confidence[0].toUpperCase()}${parsed.confidence.slice(1)} confidence` : "Ask AI in chat");
        }

        if ($("analysis-title")) $("analysis-title").textContent = `${ctx.asset} Market Read`;

        const banner = $("result-banner");
        if (banner) {
            if (parsed.isLocalCalculation) {
                const f = parsed.failure;
                const lead = f && f.code !== "missing_key"
                    ? `The AI request didn't complete: ${esc(f.message)} Showing a locally calculated read instead — no AI model, and no live news or sentiment research.`
                    : "No API key is set, so this is a locally calculated technical read — not by an AI model, with no live news or sentiment research. Add an API key for the full AI-generated read.";
                banner.innerHTML = `<div class="analysis-section" style="border-top:none;padding-top:0;"><p style="color:#e5b324;" role="alert"><i data-lucide="triangle-alert" width="13" height="13" stroke-width="2.1" style="vertical-align:-2px;"></i> <strong>Not AI-generated.</strong> ${lead}</p><div class="ai-recovery-slot"></div></div>`;
                if (f) {
                    banner.querySelector(".ai-recovery-slot")?.appendChild(buildRecovery(f, () => $("analyze-button")?.click()));
                }
            } else {
                banner.innerHTML = `<div class="analysis-section" style="border-top:none;padding-top:0;"><p style="color:#c084fc;"><i data-lucide="bot" width="13" height="13" stroke-width="2.1" style="vertical-align:-2px;"></i> AI-generated read from Llama (via Groq) — grounded in live indicators, news headlines, and market sentiment researched for this request. See "Where this read came from" below for exactly what went in.</p></div>`;
            }
        }

        if ($("result-summary")) $("result-summary").textContent = parsed.summary || "";
        setSection("result-outlook", parsed.outlook ? esc(parsed.outlook) : "");
        if ($("result-reasoning")) {
            $("result-reasoning").innerHTML = (Array.isArray(parsed.reasoningSteps) ? parsed.reasoningSteps : [])
                .map((s) => `<li>${esc(s)}</li>`).join("");
        }
        if ($("result-risk")) $("result-risk").textContent = parsed.keyRisk || "Technical indicators can disagree and sudden news can invalidate a market read. Treat this as research, not a prediction.";
        setSection("result-news", parsed.newsContext ? esc(parsed.newsContext) : "");
        setSection("result-catalyst", parsed.catalystWatch ? esc(parsed.catalystWatch) : "");
        // Headlines (with publish times and links) now live in the "Where this read came from"
        // panel rendered by js/ai-research.js, so this older list stays hidden.
        setSection("result-sources", "");

        const gaugeHost = $("result-gauge");
        if (gaugeHost) {
            gaugeHost.innerHTML = (typeof renderMarketConditionsGauge === "function")
                ? renderMarketConditionsGauge({
                    atrPct: ctx.atrPct,
                    fundingRatePct: Number.isFinite(ctx.fundingRatePct) ? ctx.fundingRatePct : null,
                    fearGreed: parsed.fearGreed,
                    market: ctx.market,
                })
                : "";
        }

        // Transparency panel, plain-language explainers, and saving to research history.
        try {
            window.cwAiResearch?.onInsight(parsed, ctx, {
                fetchedAt: marketData?.fetchedAt,
                candleCount: marketData?.candleCount,
                isFutures: Boolean(marketData?.isFutures),
            });
        } catch (err) {
            console.warn("[CryptoBolt AI] research panel failed:", redactKey(err?.message));
        }
    }

    function esc(s) {
        return escapeHtmlChat(s);
    }

    $("analyze-button")?.addEventListener("click", async () => {
        $("analysis-empty")?.classList.add("hidden");
        $("analysis-empty")?.querySelectorAll(".ai-recovery").forEach((n) => n.remove());
        $("analysis-result")?.classList.add("hidden");
        setLoading(true);
        if ($("analysis-status")) $("analysis-status").textContent = "RESEARCHING";

        try {
            await fetchMarket();
            const ctx = buildInsightContext();
            if (!ctx) throw new Error("Not enough chart data loaded yet — try again in a moment.");

            const useHouseKey = getKeyMode() === "house";
            const key = getKey();

            let parsed;
            if (!useHouseKey && !key) {
                parsed = computeLocalRead(ctx, new AiRequestError("No API key is set.", { code: "missing_key", retryable: false }));
            } else {
                try {
                    parsed = await requestBackendInsight(ctx);
                } catch (err) {
                    const failure = toAiError(err);
                    console.warn("[CryptoBolt AI] backend insight failed, showing local read:", failure.code, redactKey(failure.message));
                    parsed = computeLocalRead(ctx, failure);
                }
            }

            renderInsight(parsed, ctx);
            $("analysis-result")?.classList.remove("hidden");
            if ($("analysis-status")) $("analysis-status").textContent = parsed.isLocalCalculation ? "LOCAL READ" : "READY";
        } catch (error) {
            if ($("analysis-title")) $("analysis-title").textContent = "Research unavailable";
            $("analysis-empty")?.classList.remove("hidden");
            const p = $("analysis-empty")?.querySelector("p");
            if (p) {
                p.textContent =
                    redactKey(error.message) ||
                    "Could not load market data. Check your connection or try another asset.";
            }
            const emptyBox = $("analysis-empty");
            if (emptyBox) {
                emptyBox.querySelectorAll(".ai-recovery").forEach((n) => n.remove());
                emptyBox.appendChild(
                    buildRecovery(new AiRequestError("", { code: "market_data", retryable: true }), () => $("analyze-button")?.click())
                );
            }
            if ($("analysis-status")) $("analysis-status").textContent = "ERROR";
        } finally {
            setLoading(false);
        }
    });

    /* -----------------------------
       POPULAR ASSET CHIPS
       One-click swap of the researched asset — sets the input, mirrors the
       active state onto the chip row, and re-runs analysis immediately.
    ----------------------------- */
    function syncActiveAssetChip() {
        const current = ($("asset-input")?.value || "").trim().toUpperCase();
        document.querySelectorAll(".asset-chip").forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.asset === current);
        });
    }

    document.querySelectorAll(".asset-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            if ($("asset-input")) $("asset-input").value = chip.dataset.asset;
            syncActiveAssetChip();
            $("analyze-button")?.click();
        });
    });

    $("asset-input")?.addEventListener("input", syncActiveAssetChip);
    syncActiveAssetChip();

    /* -----------------------------
       REMEMBER LAST RESEARCH
       Prefills asset/market/timeframe from the last visit so a returning user
       doesn't have to re-type their usual pair. Doesn't auto-run analysis —
       that stays a deliberate click, since it costs an AI request.
    ----------------------------- */
    const LAST_RESEARCH_KEY = "cw_ai_last_research";
    try {
        const last = JSON.parse(localStorage.getItem(LAST_RESEARCH_KEY) || "null");
        if (last && typeof last === "object") {
            if (last.asset && $("asset-input")) $("asset-input").value = last.asset;
            if (last.market && $("market-type")) $("market-type").value = last.market;
            if (last.timeframe && $("timeframe")) $("timeframe").value = last.timeframe;
            syncActiveAssetChip();
        }
    } catch {
        /* corrupt/unavailable storage — just start from the page's defaults */
    }

    $("analyze-button")?.addEventListener("click", () => {
        try {
            localStorage.setItem(LAST_RESEARCH_KEY, JSON.stringify({
                asset: $("asset-input")?.value || "BTC",
                market: $("market-type")?.value || "spot",
                timeframe: $("timeframe")?.value || "1h",
            }));
        } catch {
            /* non-essential — analysis still runs fine without persistence */
        }
    });

    /* -----------------------------
       SHARE / COPY THE ANALYSIS
       Turns the last rendered read into a short plain-text summary, either
       copied to the clipboard or handed to X's share-intent URL. lastInsight
       is populated by renderInsight() below.
    ----------------------------- */
    let lastInsight = null;

    function buildShareText() {
        if (!lastInsight) return "";
        const { parsed, ctx } = lastInsight;
        const trend = parsed.trend ? parsed.trend[0].toUpperCase() + parsed.trend.slice(1) : "Neutral";
        const lines = [
            `${ctx.asset}/USDT — ${trend} (via CryptoBolt AI Research)`,
            parsed.summary ? String(parsed.summary).slice(0, 220) : "",
            "https://cryptobolt.io/ai.html",
        ].filter(Boolean);
        return lines.join("\n");
    }

    $("copy-analysis-btn")?.addEventListener("click", async () => {
        const text = buildShareText();
        const msg = $("analysis-share-msg");
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (msg) { msg.textContent = "Copied!"; setTimeout(() => { msg.textContent = ""; }, 3000); }
        } catch {
            if (msg) { msg.textContent = "Couldn't copy — select and copy manually."; setTimeout(() => { msg.textContent = ""; }, 4000); }
        }
    });

    $("share-analysis-btn")?.addEventListener("click", () => {
        const text = buildShareText();
        if (!text) return;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank", "noopener,noreferrer");
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