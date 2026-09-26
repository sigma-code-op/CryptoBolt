# CryptoBolt — Long-Tail Keyword Research & On-Page Audit

Companion to `SEO_KEYWORD_MAP.md` (which assigns one primary keyword per page).
This doc goes one layer deeper: long-tail/question keywords each pillar page
should be able to rank for, plus an on-page audit of how well current copy
already supports them.

## How to read priority
- **P1** — high intent, directly matches a feature you already have; easy win
- **P2** — good volume/relevance, needs a content or copy addition
- **P3** — worth targeting eventually, lower priority or needs a new page

---

## Pillar: Crypto Trading Terminal (`app.html`, `crypto-trading-terminal.html`, `index.html`)
| Long-tail keyword | Priority | Notes |
|---|---|---|
| free crypto trading terminal no signup | P1 | Matches product exactly — reinforce "no signup" language in copy (already implied, make it literal once) |
| crypto terminal with AI research | P1 | Strong differentiator vs. TradingView/Coinigy — already used in H1/meta |
| best free crypto charting tool | P2 | Competes with TradingView free tier — worth an explicit comparison mention |
| crypto order book depth viewer | P2 | Feature exists; not called out as its own long-tail phrase anywhere |
| live crypto terminal vs TradingView | P3 | Comparison-intent content gap — could be a short FAQ or blog post |

**On-page audit:** `crypto-trading-terminal.html` is thin (323 words) relative to how competitive "crypto trading terminal" is as a query. Titles/FAQ schema now differentiated from `app.html` (fixed). Consider adding 150–250 words expanding on the "Chart + order flow" and "Research and decision support" sections with one concrete example each — thin pages targeting a competitive head term are the most likely to get outranked by longer competitor guides.

## Pillar: AI Crypto Research (`ai.html`, `ai-crypto-research.html`, `ai-research-grounded-data.html`)
| Long-tail keyword | Priority | Notes |
|---|---|---|
| AI crypto market analysis free | P1 | Direct match, already covered |
| how does AI crypto research work | P1 | `ai-research-grounded-data.html` already answers this well — make sure it's linked from `ai.html`'s FAQ, not just the blog |
| AI Bitcoin price prediction | P2 | High search volume but you deliberately don't do price prediction — worth one explicit line disclaiming this (turns a mismatched click into trust signal instead of bounce) |
| crypto sentiment analysis tool | P2 | Not currently a phrase used anywhere on `ai.html` — add to supporting copy |
| grounded AI vs hallucinating AI crypto | P3 | Matches your actual differentiator (two-pass grounded pipeline) — could be its own FAQ answer |

**On-page audit:** titles for `ai.html` vs `ai-crypto-research.html` now differentiated (fixed). Both are still short (545 / 379 words) for a "how it works" style query — `ai-research-grounded-data.html` is the strongest of the three at explaining methodology; consider linking it more prominently from `ai.html`'s hero, not just its FAQ.

## Pillar: Bitcoin / Ethereum / (Solana) Live Price
| Long-tail keyword | Priority | Notes |
|---|---|---|
| bitcoin price today live | P1 | Covered; FAQ schema now added |
| BTC price chart real time free | P1 | Covered |
| ethereum price prediction today | P2 | You don't do predictions — same disclaim-and-redirect approach as AI page |
| solana price live | P1 | **Content gap.** Solana search interest has repeatedly spiked past Bitcoin/Ethereum's during rallies (briefly overtook Ethereum in worldwide Google search volume in Dec 2023). You have the exact template (`bitcoin-live-price.html` / `ethereum-live-price.html`) — this is the single highest-leverage new page on the site. |
| BTC vs ETH price comparison | P3 | Could be a short comparison section or FAQ item on either price page |

**On-page audit:** `bitcoin-live-price.html` and `ethereum-live-price.html` now have FAQPage schema matching their existing on-page Q&A (fixed). Both already have solid keyword density (3–4x).

## Pillar: Funding Rate / Spot vs Futures / Fear & Greed (education content)
| Long-tail keyword | Priority | Notes |
|---|---|---|
| what is a good funding rate | P1 | Common phrasing in forums/Reddit — not currently answered directly on `funding-rate-explained.html` |
| positive vs negative funding rate explained | P1 | Already the page's core content |
| funding rate calculator | P2 | You don't have a calculator; if you ever build one this is a strong standalone page |
| highest funding rate exchange comparison | P3 | Cross-exchange comparison content — out of scope unless you pull multi-exchange data |
| liquidation price calculator crypto | P1 | **Done** — `/liquidation-price-calculator.html` now covers this with an interactive long/short, isolated/cross calculator plus FAQ schema. |
| crypto trading fees comparison | P3 | Content gap; lower priority since you're not an exchange |
| spot trading vs futures trading for beginners | P1 | `spot-vs-futures.html` targets this conceptually but the exact phrase "spot vs futures" only appears once in 431 words — thin for how competitive this query is |
| how is the fear and greed index calculated | P1 | Commonly asked; `fear-and-greed-index.html` doesn't currently break down the calculation inputs beyond a one-line list — worth a short dedicated paragraph or FAQ item |
| what does extreme fear mean in crypto | P2 | Same page, easy FAQ addition |
| fear and greed index trading strategy | P2 | Page already takes a "context not signal" stance — good differentiation from competitors who oversell it as a buy/sell trigger |

**On-page audit:**
- Added the literal phrase "fear and greed index" (spelled out) once in the intro on `fear-and-greed-index.html` — the page previously used only "Fear & Greed" with the ampersand, so it wasn't an exact match for people who type the spelled-out phrase.
- `spot-vs-futures.html` and `invest.html` are both thin (431 and 347 words) with their primary keyword phrase appearing only once each. Neither is broken, but both would benefit from one more paragraph reinforcing the primary phrase naturally (not stuffing — one extra natural mention each is enough).

## Pillar: Paper Trading (`trade.html`, `crypto-paper-trading.html`)
| Long-tail keyword | Priority | Notes |
|---|---|---|
| crypto paper trading simulator free | P1 | Covered; FAQ schema now added to `crypto-paper-trading.html` |
| practice crypto trading without real money | P1 | Covered in copy |
| virtual crypto trading account | P2 | Not an exact phrase used anywhere — easy to weave in |
| crypto paper trading leaderboard | P3 | You actually have this feature (`trade.html` has a leaderboard) but it's not mentioned in any meta description or landing copy — small missed long-tail opportunity |

---

## Cross-cutting recommendations

1. **FAQPage schema gap (fixed for 4 pages this pass):** `bitcoin-live-price.html`, `ethereum-live-price.html`, `crypto-trading-terminal.html`, and `crypto-paper-trading.html` all had genuine on-page Q&A content (visible H3 questions + answers) with no matching `FAQPage` JSON-LD. Added schema matching the visible copy exactly (schema must match on-page content — mismatched schema is treated as spam). Note: Google restricted FAQ rich results to authoritative government/health sites in 2023, so don't expect a rich snippet boost — the real value now is machine-readability for AI answer engines (relevant since you already ship `llms.txt` for AI crawler discoverability).
2. **Thin competitive pages:** `crypto-trading-terminal.html`, `spot-vs-futures.html`, and `invest.html` are all under 450 words while targeting moderately competitive head terms. Not urgent, but the next time you touch any of them, add a paragraph rather than trim.
3. **Biggest single opportunity:** a Solana live price page. Real, validated search demand; near-zero build cost since the BTC/ETH template already exists.
4. **"Prediction" queries:** Both the AI research and BTC/ETH price pages sit near high-volume "price prediction" queries you deliberately don't serve. A one-line disclaimer ("CryptoBolt shows live data and context, not price predictions") on each, ideally in an FAQ item, can capture the click and redirect intent instead of just losing the ranking opportunity entirely.