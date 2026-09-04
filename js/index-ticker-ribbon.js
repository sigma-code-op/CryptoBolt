// ---------------------------------------------------------------------------
// index.html marketing-page ticker ribbon (BTC/ETH/SOL/BNB spot prices).
// Extracted from an inline <script> so the page can run under a
// Content-Security-Policy without 'unsafe-inline' in script-src.
// ---------------------------------------------------------------------------

(function () {
    var symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
    var labels = { BTCUSDT: "BTC / USDT", ETHUSDT: "ETH / USDT", SOLUSDT: "SOL / USDT", BNBUSDT: "BNB / USDT" };
    var row = document.getElementById("mk-ticker-row");
    var updated = document.getElementById("mk-ticker-updated");

    function fmtPrice(n) {
        n = parseFloat(n);
        if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
        if (n >= 1) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return n.toPrecision(4);
    }

    function render(data) {
        row.innerHTML = "";
        data.forEach(function (t) {
            var chg = parseFloat(t.priceChangePercent);
            var up = chg >= 0;
            var cell = document.createElement("div");
            cell.className = "mk-ticker-cell";
            cell.innerHTML =
                '<div class="mk-ticker-sym">' + labels[t.symbol] + '</div>' +
                '<div class="mk-ticker-px">$' + fmtPrice(t.lastPrice) + '</div>' +
                '<div class="mk-ticker-chg ' + (up ? 'mk-up' : 'mk-down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(chg).toFixed(2) + '%</div>';
            row.appendChild(cell);
        });
        updated.textContent = "Updated " + new Date().toLocaleTimeString();
    }

    function load() {
        fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols)))
            .then(function (r) { if (!r.ok) throw new Error("bad response"); return r.json(); })
            .then(function (data) {
                var ordered = symbols.map(function (s) { return data.find(function (d) { return d.symbol === s; }); }).filter(Boolean);
                if (ordered.length) render(ordered);
                else throw new Error("empty");
            })
            .catch(function () {
                updated.textContent = "Live in the terminal";
            });
    }

    load();
    setInterval(load, 15000);
})();