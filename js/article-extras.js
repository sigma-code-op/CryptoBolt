/* Article extras: interactive "Try the numbers" widgets and the quick-check quiz.
   Education only; every widget is plain arithmetic on the numbers the reader types. */
(function () {
  'use strict';
  var nf = function (n, d) { return isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: d == null ? 0 : Math.min(d, 2) }) : '–'; };
  var usd = function (n, d) { return (n < 0 ? '-$' : '$') + nf(Math.abs(n), d == null ? 2 : d); };
  var pct = function (n, d) { return nf(n, d == null ? 2 : d) + '%'; };

  function build(root, fields, compute, note) {
    var body = root.querySelector('.cb-widget-body');
    var form = document.createElement('div');
    form.className = 'cb-w-form';
    var inputs = {};
    fields.forEach(function (f) {
      var wrap = document.createElement('label');
      wrap.className = 'cb-w-field';
      var span = document.createElement('span');
      span.textContent = f.label;
      wrap.appendChild(span);
      var el;
      if (f.options) {
        el = document.createElement('select');
        f.options.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; el.appendChild(op); });
        el.value = f.value;
      } else {
        el = document.createElement('input');
        el.type = 'number'; el.inputMode = 'decimal';
        el.min = f.min; el.max = f.max; el.step = f.step; el.value = f.value;
      }
      el.id = 'w-' + f.id + '-' + Math.random().toString(36).slice(2, 6);
      inputs[f.id] = el;
      wrap.appendChild(el);
      if (f.range) {
        var r = document.createElement('input');
        r.type = 'range'; r.min = f.min; r.max = f.max; r.step = f.step; r.value = f.value;
        r.setAttribute('aria-label', f.label + ' slider');
        r.addEventListener('input', function () { el.value = r.value; run(); });
        el.addEventListener('input', function () { r.value = el.value; });
        wrap.appendChild(r);
      }
      form.appendChild(wrap);
    });
    var out = document.createElement('div');
    out.className = 'cb-w-out';
    out.setAttribute('aria-live', 'polite');
    body.appendChild(form); body.appendChild(out);
    if (note) { var n = document.createElement('p'); n.className = 'cb-w-note'; n.textContent = note; body.appendChild(n); }
    function run() {
      var v = {};
      Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].tagName === 'SELECT' ? inputs[k].value : parseFloat(inputs[k].value); });
      out.innerHTML = compute(v);
    }
    Object.keys(inputs).forEach(function (k) { inputs[k].addEventListener('input', run); inputs[k].addEventListener('change', run); });
    run();
  }
  function stat(label, value, tone) { return '<div class="cb-w-stat' + (tone ? ' ' + tone : '') + '"><b>' + value + '</b><span>' + label + '</span></div>'; }
  function stats(arr) { return '<div class="cb-w-stats">' + arr.join('') + '</div>'; }

  var W = {
    recovery: function (r) {
      build(r, [{ id: 'l', label: 'Loss on the account (%)', min: 1, max: 95, step: 1, value: 50, range: true }], function (v) {
        var l = Math.min(Math.max(v.l, 0), 99) / 100, g = 1 / (1 - l) - 1;
        return stats([stat('after a ' + nf(l * 100, 0) + '% loss, $1,000 becomes', usd(1000 * (1 - l), 0)), stat('gain needed to get back to even', pct(g * 100, 1), g > 1 ? 'bad' : ''), stat('a 10% loss needs only', pct((1 / 0.9 - 1) * 100, 1))]);
      }, 'Losses are asymmetric: the deeper the hole, the more than proportionally you must climb.');
    },
    halving: function (r) {
      build(r, [{ id: 'e', label: 'Halving era (0 = launch in 2009)', min: 0, max: 8, step: 1, value: 4, range: true }], function (v) {
        var e = Math.round(v.e), reward = 50 / Math.pow(2, e), mined = 0;
        for (var i = 0; i <= e; i++) mined += 210000 * 50 / Math.pow(2, i);
        return stats([stat('block reward (BTC)', nf(reward, 8)), stat('approx. start of era', e === 0 ? '2009' : '~' + (2008 + 4 * e)), stat('coins issued by end of era', nf(mined / 1e6, 2) + 'M'), stat('share of the 21M cap', pct(mined / 21e6 * 100, 1))]);
      }, 'Era dates are approximate (block times vary). The reward schedule itself is fixed by the protocol rules.');
    },
    expectancy: function (r) {
      build(r, [{ id: 'w', label: 'Win rate (%)', min: 5, max: 90, step: 1, value: 40, range: true }, { id: 'rr', label: 'Reward per 1R risked', min: 0.5, max: 5, step: 0.1, value: 2 }, { id: 'n', label: 'Number of trades', min: 10, max: 500, step: 10, value: 100 }], function (v) {
        var w = v.w / 100, e = w * v.rr - (1 - w), be = 1 / (1 + v.rr);
        return stats([stat('expectancy per trade', (e >= 0 ? '+' : '') + nf(e, 2) + 'R', e < 0 ? 'bad' : 'good'), stat('break-even win rate', pct(be * 100, 1)), stat('expected result over ' + v.n + ' trades', (e >= 0 ? '+' : '') + nf(e * v.n, 1) + 'R', e < 0 ? 'bad' : 'good')]);
      }, 'Before fees and slippage, and assuming your win rate holds. Real samples are noisy: see the losing-streak calculator.');
    },
    dca: function (r) {
      var paths = { fall: [100, 90, 80, 70, 60, 50], rise: [50, 60, 70, 80, 90, 100], vee: [100, 80, 60, 60, 80, 100], chop: [80, 100, 70, 95, 65, 90] };
      build(r, [{ id: 'b', label: 'Total budget ($)', min: 100, max: 100000, step: 100, value: 1200 }, { id: 'p', label: 'Price path over 6 periods', value: 'vee', options: [['fall', 'Steady fall'], ['rise', 'Steady rise'], ['vee', 'Drop then recover'], ['chop', 'Choppy']] }], function (v) {
        var pr = paths[v.p], each = v.b / 6, coins = 0;
        pr.forEach(function (x) { coins += each / x; });
        var last = pr[5], dcaVal = coins * last, lump = v.b / pr[0] * last;
        return '<p class="cb-w-path">Prices: ' + pr.join(' → ') + '</p>' + stats([stat('DCA average cost', usd(v.b / coins), ''), stat('DCA value at the end', usd(dcaVal, 0), dcaVal >= v.b ? 'good' : 'bad'), stat('lump sum at period 1 ends at', usd(lump, 0), lump >= v.b ? 'good' : 'bad')]);
      }, 'Illustrative price paths, not forecasts. Notice DCA wins in some paths and loses in others: it changes the risk shape, not the expected return.');
    },
    funding: function (r) {
      build(r, [{ id: 's', label: 'Position size ($)', min: 100, max: 1000000, step: 100, value: 10000 }, { id: 'l', label: 'Leverage (x)', min: 1, max: 100, step: 1, value: 10 }, { id: 'f', label: 'Funding per 8h (%)', min: -0.2, max: 0.3, step: 0.005, value: 0.01 }, { id: 'd', label: 'Days held', min: 1, max: 365, step: 1, value: 30 }], function (v) {
        var per = v.s * v.f / 100, tot = per * 3 * v.d, margin = v.s / v.l;
        return stats([stat('per settlement', usd(per), per > 0 ? 'bad' : 'good'), stat('over ' + v.d + ' days (3 per day)', usd(tot), tot > 0 ? 'bad' : 'good'), stat('as % of your margin', pct(tot / margin * 100, 1), tot > 0 ? 'bad' : 'good')]);
      }, 'Positive rate on a long is a cost; negative is income. Funding is charged on position size, not margin. Real rates change every period.');
    },
    breakeven: function (r) {
      build(r, [{ id: 'p', label: 'Entry price ($)', min: 0.0001, max: 1000000, step: 0.01, value: 100 }, { id: 'f', label: 'Fee per side (%)', min: 0, max: 2, step: 0.01, value: 0.1, range: true }], function (v) {
        var f = v.f / 100, be = v.p * (1 + f) / (1 - f);
        return stats([stat('break-even sell price', usd(be, 4)), stat('rise needed to break even', pct((be / v.p - 1) * 100, 3)), stat('round-trip fees on $1,000', usd(2 * 1000 * f, 2))]);
      }, 'Fees charged on the buy and on the sell, same rate on both. Spread and funding would push the break-even further out.');
    },
    slippage: function (r) {
      var book = [[2, 100.0], [3, 100.1], [5, 100.3], [10, 100.6], [20, 101.0]];
      build(r, [{ id: 'q', label: 'Market buy size (coins)', min: 1, max: 40, step: 1, value: 4, range: true }], function (v) {
        var left = v.q, cost = 0, rows = '';
        book.forEach(function (lv) { var t = Math.min(left, lv[0]); if (t > 0) { cost += t * lv[1]; rows += '<li>' + t + ' @ $' + lv[1].toFixed(2) + '</li>'; left -= t; } });
        var filled = v.q - left, avg = cost / filled, slip = (avg / 100 - 1) * 100;
        return '<p class="cb-w-path">Asks: 2 @ 100.00, 3 @ 100.10, 5 @ 100.30, 10 @ 100.60, 20 @ 101.00</p><ul class="cb-w-fills">' + rows + '</ul>' + stats([stat('average fill', usd(avg, 3)), stat('slippage vs best ask', pct(slip, 3), slip > 0.2 ? 'bad' : ''), stat('extra cost vs best ask', usd(cost - filled * 100))]);
      }, 'A sample order book. Bigger orders walk further up the asks, so the average price gets worse.');
    },
    il: function (r) {
      build(r, [{ id: 'x', label: 'Price of token A vs token B, versus deposit (x)', min: 0.1, max: 10, step: 0.05, value: 2, range: true }], function (v) {
        var x = Math.max(v.x, 0.01), il = 2 * Math.sqrt(x) / (1 + x) - 1, hold = 1000 * (1 + x) / 2, pool = hold * (1 + il);
        return stats([stat('impermanent loss vs holding', pct(il * 100, 2), il < -0.001 ? 'bad' : ''), stat('hold value of $1,000 deposit', usd(hold, 2)), stat('pool value before fees', usd(pool, 2))]);
      }, 'Standard 50/50 constant-product pool, before trading fees. Set x back to 1 and the loss disappears.');
    },
    size: function (r) {
      build(r, [{ id: 'a', label: 'Account ($)', min: 100, max: 10000000, step: 100, value: 5000 }, { id: 'r', label: 'Risk per trade (%)', min: 0.1, max: 5, step: 0.1, value: 1, range: true }, { id: 'e', label: 'Entry ($)', min: 0.0001, max: 1000000, step: 0.01, value: 100 }, { id: 's', label: 'Stop ($)', min: 0.0001, max: 1000000, step: 0.01, value: 95 }], function (v) {
        var risk = v.a * v.r / 100, d = Math.abs(v.e - v.s);
        if (!d) return '<p class="cb-w-path">Entry and stop must differ.</p>';
        var coins = risk / d, val = coins * v.e;
        return stats([stat('amount at risk', usd(risk, 2)), stat('position size', nf(coins, 4) + ' coins'), stat('position value', usd(val, 2)), stat('leverage implied', nf(val / v.a, 2) + 'x', val / v.a > 5 ? 'bad' : '')]);
      }, 'Before fees and slippage. Move the stop wider and watch the size shrink while the risk stays the same.');
    },
    liq: function (r) {
      build(r, [{ id: 'l', label: 'Leverage (x)', min: 1, max: 100, step: 1, value: 10, range: true }, { id: 'e', label: 'Long entry ($)', min: 0.0001, max: 1000000, step: 0.01, value: 100 }], function (v) {
        var mmr = 0.005, drop = Math.max(1 / v.l - mmr, 0), liq = v.e * (1 - drop);
        var w = Math.min(drop * 100, 100);
        return '<div class="cb-w-bar" role="img" aria-label="Distance to liquidation"><i style="width:' + w + '%"></i></div>' + stats([stat('price drop that liquidates (approx.)', v.l === 1 ? 'none (no margin loan)' : pct(drop * 100, 2), drop < 0.05 ? 'bad' : ''), stat('approx. liquidation price', v.l === 1 ? '–' : usd(liq, 2)), stat('a 1% move changes your equity by', nf(v.l, 0) + '%')]);
      }, 'Simplified isolated-margin long with 0.5% maintenance margin. Exchanges differ. Use the liquidation price calculator for a fuller model.');
    },
    apy: function (r) {
      build(r, [{ id: 'a', label: 'APR (%)', min: 0.1, max: 200, step: 0.1, value: 10 }, { id: 'n', label: 'Compounding', value: '12', options: [['1', 'Yearly'], ['12', 'Monthly'], ['365', 'Daily']] }], function (v) {
        var n = parseFloat(v.n), apy = Math.pow(1 + v.a / 100 / n, n) - 1;
        return stats([stat('APY', pct(apy * 100, 2)), stat('$1,000 after a year', usd(1000 * (1 + apy), 2)), stat('extra from compounding', usd(1000 * apy - 1000 * v.a / 100, 2))]);
      }, 'Paid in the staked token. If the token falls more than the yield, you are behind in dollars.');
    }
  };

  document.querySelectorAll('.cb-widget[data-widget]').forEach(function (el) {
    var fn = W[el.getAttribute('data-widget')];
    if (fn) { try { fn(el); } catch (e) { /* leave empty */ } }
  });

  document.querySelectorAll('.cb-quiz').forEach(function (q) {
    var ans = parseInt(q.getAttribute('data-answer'), 10), fb = q.querySelector('.cb-quiz-fb'), btns = q.querySelectorAll('button');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(b.getAttribute('data-i'), 10), ok = i === ans;
        btns.forEach(function (x) { x.disabled = true; x.classList.remove('ok', 'no'); });
        b.classList.add(ok ? 'ok' : 'no');
        if (!ok) btns[ans].classList.add('ok');
        fb.hidden = false;
        fb.textContent = (ok ? 'Correct. ' : 'Not quite. ') + fb.getAttribute('data-explain');
      });
    });
  });
})();