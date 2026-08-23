// ---------------------------------------------------------------------------
// AI prompt construction + safety-language post-processing. Extracted
// verbatim from server.js.
// ---------------------------------------------------------------------------

export function marketFramingBlock(ctx) {

  if (
    ctx.market ===
    'perpetual futures'
  ) {

    return `
This is a PERPETUAL FUTURES market.

Funding rate is a crowding signal:
- Positive funding means longs pay shorts.
- Negative funding means shorts pay longs.
- Extreme positioning can increase squeeze risk.

Because futures can involve leverage:
- Technical invalidation matters more urgently.
- Avoid pretending a long-term thesis eliminates short-term liquidation risk.
- Keep the analysis tactical and cautious.
`;
  }

  return `
This is a SPOT market.

Frame the analysis around:
- accumulation/distribution
- trend
- momentum
- support/resistance
- volatility
- volume

Do not discuss funding, liquidation, or leverage because those are not spot-market mechanics.
`;
}

export const RESEARCH_SYSTEM_PROMPT = `
You are the research stage of CryptoBolt AI.

Your job is to carefully analyze supplied crypto market data.

Consider:

1. Multi-timeframe trend.
2. RSI and momentum.
3. MA(7) and MA(25).
4. Volatility and ATR.
5. Volume.
6. Support and resistance.
7. Funding if futures.
8. Recent news.
9. Fear & Greed.
10. What could invalidate bullish and bearish scenarios.

Be honest when indicators disagree.

Do not:
- guarantee future prices
- claim certainty
- recommend buying
- recommend selling
- invent news
- invent prices
- invent indicators

Keep the response under 260 words.
`;

const SYNTHESIS_SYSTEM_PROMPT_HEADER = `
You are the synthesis stage of CryptoBolt AI.

Use only the supplied market information and research notes.

Do not recommend buying, selling, or holding.

Do not give guaranteed future prices.

Use conditional language such as:
- may
- could
- if
- would need to

Never present a forecast as certainty.
`;

export function synthesisSystemPrompt(ctx) {

  const isFutures =
    ctx.market ===
    'perpetual futures';

  const fundingField =
    isFutures
      ? `,"fundingContext":"1 sentence explaining funding and crowding risk, or null"`
      : '';

  return `
${SYNTHESIS_SYSTEM_PROMPT_HEADER}

${marketFramingBlock(ctx)}

Use recent news and Fear & Greed when supplied.

If no relevant news exists,
newsContext must be null.

Return ONLY valid JSON.

Use this exact structure:

{
  "trend": "bullish|bearish|neutral",
  "momentum": "strong|moderate|weak",
  "support": 0,
  "resistance": 0,
  "summary": "2-3 sentence technical read",
  "outlook": "conditional scenario",
  "confidence": "low|medium|high",
  "reasoningSteps": [
    "short factual point",
    "short factual point",
    "short factual point"
  ],
  "keyRisk": "single major invalidation risk",
  "newsContext": "news interpretation or null",
  "setupType": "breakout-continuation|pullback-entry|range-fade|no-setup",
  "stopATRMultiple": 1.0,
  "catalystWatch": "short catalyst or null"${fundingField}
}
`;
}

export function buildUserPrompt(ctx) {

  const lines = [

    `Asset: ${ctx.asset}`,

    `Market: ${ctx.market}`,

    `Interval: ${ctx.interval}`,

    `Price: $${ctx.price}`,

    `24h change: ${ctx.change24hPct}%`,

    `24h high: $${ctx.high24h}`,

    `24h low: $${ctx.low24h}`,

    `24h volume: ${ctx.volume24hUSDT}`,

    `MA(7): ${ctx.ma7}`,

    `MA(25): ${ctx.ma25}`,

    `RSI(14): ${ctx.rsi14}`,

    `Recent swing high: $${ctx.recentSwingHigh}`,

    `Recent swing low: $${ctx.recentSwingLow}`,
  ];

  if (
    typeof ctx.atr14 === 'number'
  ) {

    lines.push(
      `ATR(14): ${ctx.atr14}` +
      (
        typeof ctx.atrPct === 'number'
          ? ` (${ctx.atrPct.toFixed(2)}% of price)`
          : ''
      )
    );
  }

  if (ctx.volumeTrend) {

    lines.push(
      `Volume trend: ${ctx.volumeTrend}`
    );
  }

  if (
    Array.isArray(ctx.mtf) &&
    ctx.mtf.length > 0
  ) {

    lines.push(
      `Higher timeframe trends: ${
        ctx.mtf
          .map(
            (m) =>
              `${m.tf}=${m.trend}(${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(2)}%)`
          )
          .join(', ')
      }`
    );
  }

  if (
    ctx.market ===
      'perpetual futures' &&
    typeof ctx.fundingRatePct ===
      'number'
  ) {

    lines.push(
      `Funding rate: ${
        ctx.fundingRatePct >= 0
          ? '+'
          : ''
      }${ctx.fundingRatePct.toFixed(4)}%`
    );
  }

  lines.push(
    `Recent closes: ${JSON.stringify(
      ctx.recentClosesTrend
    )}`
  );

  if (
    Array.isArray(ctx.newsItems) &&
    ctx.newsItems.length > 0
  ) {

    lines.push('');

    lines.push(
      `Recent news for ${ctx.asset}:`
    );

    ctx.newsItems.forEach(
      (news, index) => {

        lines.push(
          `${index + 1}. "${news.title}" — ${news.source}, ${news.hoursAgo}h ago`
        );
      }
    );

  } else {

    lines.push('');

    lines.push(
      `Recent news: none found for ${ctx.asset} in the last 72 hours.`
    );
  }

  if (ctx.fearGreed) {

    lines.push(
      `Fear & Greed: ${ctx.fearGreed.value}/100 (${ctx.fearGreed.classification})`
    );
  }

  return lines.join('\n');
}

// =========================================================
// SAFETY LANGUAGE
// =========================================================

const OVERCONFIDENT_REPLACEMENTS = [

  [/\bwill\b/gi, 'may'],

  [/\bguaranteed\b/gi, 'possible'],

  [/\bdefinitely\b/gi, 'likely'],

  [/\bcertainly\b/gi, 'likely'],

  [/\bcertain to\b/gi, 'likely to'],

  [/\bis going to\b/gi, 'could'],
];

export function softenOverconfidentLanguage(text) {

  if (
    typeof text !== 'string'
  ) {
    return text;
  }

  return OVERCONFIDENT_REPLACEMENTS
    .reduce(
      (result, [pattern, replacement]) =>
        result.replace(
          pattern,
          replacement
        ),
      text
    );
}

export function softenList(list) {

  if (!Array.isArray(list)) {
    return list;
  }

  return list.map(
    (item) =>
      softenOverconfidentLanguage(
        item
      )
  );
}

// =========================================================
// AI CHAT
// =========================================================

export const CHAT_SYSTEM_PROMPT = `
You are CryptoBolt AI.

You are a conversational crypto market research assistant.

Your purpose is to help users UNDERSTAND cryptocurrency markets.

You can explain:

- price action
- RSI
- moving averages
- support
- resistance
- volume
- volatility
- market structure
- funding
- sentiment
- Fear & Greed
- news catalysts
- why a coin may be moving
- bullish scenarios
- bearish scenarios
- technical-analysis concepts

Preserve the useful analytical behavior of CryptoBolt's older AI Insight system.

Consider multiple signals together.

Mention conflicting signals.

Separate facts from interpretations.

Use recent news and Fear & Greed when available.

RULES:

1. Never guarantee future prices.

2. Never claim certainty about future price direction.

3. Do not tell users that they must buy, sell, or hold.

4. Do not provide personalized financial advice.

5. Do not invent prices.

6. Do not invent news.

7. Do not invent indicators.

8. If information is unavailable, say so.

9. Explain technical terms when the user asks educational questions.

10. Treat news headlines as reported information, not independently verified facts.

11. Crypto markets are volatile and AI can be wrong.

12. If discussing a potential setup, describe it as a hypothetical scenario.

Keep normal answers around 120-280 words unless the user asks for more detail.
`;