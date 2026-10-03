// ---------------------------------------------------------------------------
// AI chat + AI insight routes. Extracted verbatim from server.js.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import { GROQ_MODEL, GROQ_HOUSE_API_KEY, HOUSE_KEY_ENABLED } from '../config.js';
import { validateContext, validateAlertExplainPayload } from '../validators.js';
import { fetchCryptoNews, fetchFearGreedIndex } from '../lib/market-data.js';
import { getSupabaseAdmin, SUPABASE_ADMIN_CONFIGURED } from '../lib/supabase-admin.js';
import {
  synthesisSystemPrompt,
  buildUserPrompt,
  softenOverconfidentLanguage,
  softenList,
  CHAT_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
  ALERT_EXPLAIN_SYSTEM_PROMPT,
  buildAlertExplainPrompt,
} from '../lib/ai-prompts.js';
import {
  sanitizeTradesContext,
  extractActions,
  CHAT_TRADES_PROMPT,
} from '../lib/ai-trade-actions.js';
import {
  AI_ERROR_CODES,
  classifyAiError,
  aiErrorBody,
} from '../lib/ai-errors.js';
import { logError } from '../lib/logger.js';

const router = Router();

// =========================================================
// AI RATE LIMIT
// =========================================================

// Replies to a rate-limited request with the same structured error shape every other AI
// failure uses ({ error, code, retryable, retryAfterSeconds }), so the browser can show a
// countdown + retry instead of a dead-end message. retryAfterSeconds lives in the JSON body
// (not only a Retry-After header) because browsers hide non-safelisted response headers from
// cross-origin fetches.
function rateLimitHandler(error, code) {
  return (req, res) => {
    const resetAt = req.rateLimit?.resetTime;
    const ms = resetAt instanceof Date ? resetAt.getTime() - Date.now() : 0;
    const retryAfterSeconds = ms > 0 ? Math.ceil(ms / 1000) : null;

    res.status(429).json({
      error,
      code,
      retryable: true,
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    });
  };
}

const aiLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.AI_RATE_LIMIT_WINDOW_MINUTES
    ) || 15) *
    60 *
    1000,

  max:
    Number(
      process.env.AI_RATE_LIMIT_MAX
    ) || 30,

  standardHeaders: true,

  legacyHeaders: false,

  handler: rateLimitHandler(
    'Too many AI requests from this address. Please wait and try again.',
    AI_ERROR_CODES.RATE_LIMITED
  ),
});

// Pulls a bearer token out of a raw Authorization header value. Pure/testable on purpose —
// separated from anything that touches Supabase or the network.
export function extractBearerToken(authHeaderValue) {
  const raw = typeof authHeaderValue === 'string' ? authHeaderValue : '';
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
}

// Keys the shared house-key limiter by the visitor's own Supabase account when they're signed
// in and send a valid session token, instead of always falling back to IP address. Two
// different accounts on the same Wi-Fi network — or, just as commonly, the same mobile
// carrier's shared NAT — would otherwise collide in one IP-keyed bucket and rate-limit each
// other. Signing in isn't required to use the house key at all, so this only upgrades the key
// when it can — any missing/invalid/unverifiable token silently falls back to IP, exactly like
// today, rather than ever blocking the request over it.
export async function houseKeyRateLimitKey(req) {
  const token = extractBearerToken(req.get('authorization'));
  if (token && SUPABASE_ADMIN_CONFIGURED) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user?.id) {
        return `user:${data.user.id}`;
      }
    } catch (err) {
      // Network hiccup or malformed token talking to Supabase — fall through to IP below
      // rather than let a broken verification call bypass rate limiting entirely.
    }
  }
  return `ip:${req.ip}`;
}

// Separate, stricter limiter for requests using CryptoBolt's own shared "house" key —
// that usage is billed to the deployment owner, not the visitor, so it needs a tighter
// cap than the BYOK limiter above. Only reachable when HOUSE_KEY_ENABLED is true.
const houseKeyLimiter = rateLimit({
  windowMs:
    (Number(
      process.env.HOUSE_KEY_RATE_LIMIT_WINDOW_MINUTES
    ) || 60) *
    60 *
    1000,

  max:
    Number(
      process.env.HOUSE_KEY_RATE_LIMIT_MAX
    ) || 6,

  standardHeaders: true,

  legacyHeaders: false,

  keyGenerator: houseKeyRateLimitKey,

  handler: rateLimitHandler(
    "You've hit the shared AI key's usage limit for now. Add your own Groq key for unlimited use, or try again later.",
    AI_ERROR_CODES.HOUSE_RATE_LIMITED
  ),
});

// Picks the BYOK or house-key limiter for a request *before* either limiter's handler
// runs, based on the same header the request handlers below use to pick the key itself.
// Keeps the two limiter pools (and their two rate-limit budgets) fully separate.
function aiRateLimit(req, res, next) {

  const wantsHouseKey =
    req.get('x-use-house-key') === '1';

  if (wantsHouseKey) {
    return houseKeyLimiter(req, res, next);
  }

  return aiLimiter(req, res, next);
}

// Resolves which Groq API key a request should use:
//  - 'x-use-house-key: 1' → CryptoBolt's own server-side key (if the deployment has one
//    configured), so the visitor doesn't need to paste their own.
//  - otherwise → the visitor's own key, sent in 'x-groq-key' (classic BYOK).
// Returns { apiKey } on success, or { errorStatus, errorBody } to send straight back.
function resolveApiKey(req) {

  const wantsHouseKey =
    req.get('x-use-house-key') === '1';

  if (wantsHouseKey) {

    if (!HOUSE_KEY_ENABLED) {

      return {
        errorStatus: 503,
        errorBody: {
          error:
            "CryptoBolt's shared AI key isn't enabled on this deployment. Switch to your own Groq key instead.",
          code: AI_ERROR_CODES.HOUSE_KEY_DISABLED,
          retryable: false,
        },
      };
    }

    return {
      apiKey: GROQ_HOUSE_API_KEY,
    };
  }

  const apiKey =
    req.get('x-groq-key');

  if (
    !apiKey ||
    !apiKey.startsWith('gsk_')
  ) {

    return {
      errorStatus: 401,
      errorBody: {
        error:
          'Missing or invalid Groq API key. Add your key, or switch on "Use CryptoBolt\'s key" instead.',
        code: AI_ERROR_CODES.MISSING_KEY,
        retryable: false,
      },
    };
  }

  return {
    apiKey,
  };
}

// ---------------------------------------------------------------------------
// Source transparency helpers.
// Every AI response says exactly what fed it: which news items (with publish times), which
// sentiment reading, which model, and when it ran — so the UI can separate measured data
// from the model's interpretation of it. These describe inputs only; nothing here is
// model-generated.
// ---------------------------------------------------------------------------

function mapSources(newsItems) {
  return (Array.isArray(newsItems) ? newsItems : []).map((news) => ({
    title: news.title,
    source: news.source,
    hoursAgo: news.hoursAgo,
    ...(news.publishedAt ? { publishedAt: news.publishedAt } : {}),
    ...(news.url ? { url: news.url } : {}),
  }));
}

// Field names (never values) the browser sent that were non-null — i.e. which indicators
// were actually available to the model. Names are whitelisted by shape so a crafted payload
// can't smuggle arbitrary text into the response.
function presentFieldNames(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj)
    .filter((k) => /^[A-Za-z0-9_]{1,40}$/.test(k) && obj[k] !== null && obj[k] !== undefined)
    .slice(0, 40);
}

const INTERPRETATION_FIELDS = [
  'trend',
  'momentum',
  'confidence',
  'summary',
  'outlook',
  'reasoningSteps',
  'keyRisk',
  'fundingContext',
  'newsContext',
  'catalystWatch',
  'positionNote',
  'setupType',
];

export function buildProvenance({ kind, inputs, newsItems, fearGreed, passes, researchNotes, parsed, usedPaperTrades }) {
  return {
    kind,
    generatedAt: new Date().toISOString(),
    model: GROQ_MODEL,
    ...(passes ? { passes } : {}),
    // Names of the measured fields that were available to the model.
    inputs: presentFieldNames(inputs),
    headlinesProvided: Array.isArray(newsItems) ? newsItems.length : 0,
    fearGreedProvided: Boolean(fearGreed),
    ...(researchNotes !== undefined ? { researchNotesProvided: Boolean(researchNotes) } : {}),
    ...(usedPaperTrades !== undefined ? { paperTradesProvided: Boolean(usedPaperTrades) } : {}),
    // Which response fields are the model's own words/judgement rather than echoed data.
    ...(parsed
      ? { interpretationFields: INTERPRETATION_FIELDS.filter((f) => parsed[f] !== undefined && parsed[f] !== null) }
      : {}),
  };
}

// Sends a classified Groq/network failure to the browser and logs it WITHOUT any secret.
// Only the error class/status/code are logged — never request headers, never the key.
function sendAiFailure(res, req, err, routeLabel) {
  const classified = classifyAiError(err, { model: GROQ_MODEL });

  logError(`AI ${routeLabel} failed`, err, {
    requestId: req.requestId,
    code: classified.code,
    upstreamStatus: err?.status ?? null,
  });

  return res.status(classified.status).json(aiErrorBody(classified));
}

// Validates the client-sent conversation history for /api/ai-chat. Best-effort and
// defensive: any malformed entry just gets dropped rather than rejecting the whole
// request — chat memory is a nice-to-have, never a reason to fail someone's question.
// Capped at 8 turns and 1200 chars/turn to keep prompt size and cost bounded.
function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }));
}

router.post(
  '/api/ai-chat',
  aiRateLimit,
  async (req, res) => {

    const {
      apiKey,
      errorStatus,
      errorBody,
    } = resolveApiKey(req);

    if (errorStatus) {
      return res.status(errorStatus).json(errorBody);
    }

    // Support both the current frontend contract ({ message, context }) and an
    // older/alternate one ({ question, market }) so this endpoint keeps working
    // even if an older cached/deployed copy of ai-chat.js is still live somewhere.
    const message =
      String(
        req.body?.message || req.body?.question || ''
      ).trim();

    if (!message) {

      return res.status(400).json({
        error:
          'Ask a question first.',
      });
    }

    if (message.length > 1800) {

      return res.status(400).json({
        error:
          'Please keep your question under 1,800 characters.',
      });
    }

    const rawContext =
      (req.body?.context &&
        typeof req.body.context === 'object' &&
        req.body.context) ||
      (req.body?.market &&
        typeof req.body.market === 'object' &&
        req.body.market) ||
      {};

    const context = rawContext;

    const selectedAsset =
      String(
        context?.selectedAsset ||
        context?.asset ||
        'BTC'
      )
        .toUpperCase()
        .replace(
          /[^A-Z0-9]/g,
          ''
        )
        .slice(0, 15) || 'BTC';

    // Create a new Groq client for this request.
    // The user's API key is not saved.
    const groq =
      new Groq({
        apiKey,
      });

    // Fetch current news and sentiment.
    const [
      newsItems,
      fearGreed,
    ] = await Promise.all([

      fetchCryptoNews(
        selectedAsset
      ).catch(() => []),

      fetchFearGreedIndex()
        .catch(() => null),
    ]);

    const history = sanitizeHistory(req.body?.history);

    // Optional snapshot of the visitor's practice (paper) account, sent only when they've left
    // "Let AI see my paper trades" on. Best-effort like history: malformed → treated as absent.
    const trades = sanitizeTradesContext(req.body?.trades);

    const contextText =
      JSON.stringify({

        pageSnapshot:
          context,

        liveServerFearGreed:
          fearGreed,

        recentNews:
          newsItems,

        ...(trades ? { paperTrades: trades } : {}),

        note:
          trades
            ? 'paperTrades is the visitor\'s simulated practice account (virtual money). The rest is market research context.'
            : 'This is market research context, not personalized portfolio or account state.',
      });

    try {

      const completion =
        await groq.chat.completions.create({

          model:
            GROQ_MODEL,

          max_tokens:
            trades ? 1300 : 900,

          reasoning_effort:
            'low',

          messages: [

            {
              role:
                'system',

              content:
                trades
                  ? `${CHAT_SYSTEM_PROMPT}\n${CHAT_TRADES_PROMPT}`
                  : CHAT_SYSTEM_PROMPT,
            },

            // Prior turns of this conversation, if the client sent any — lets the
            // model handle follow-ups ("what about on the 4h chart?") instead of
            // treating every message as a cold start. See sanitizeHistory() above.
            ...history,

            {
              role:
                'user',

              content:
                `LIVE MARKET CONTEXT:\n${contextText}\n\nUSER QUESTION:\n${message}`,
            },

          ],
        });

      let answer =
        (
          completion
            .choices?.[0]
            ?.message
            ?.content || ''
        ).trim();

      if (!answer) {

        return res.status(502).json({
          error:
            'AI model returned an empty response. Please try again.',
          code: AI_ERROR_CODES.EMPTY_RESPONSE,
          retryable: true,
        });
      }

      // Pull the model's proposed practice-account actions (if any) out of the text and
      // validate them against the snapshot this request carried. Only proposals — the browser
      // makes the visitor confirm each one before anything changes.
      const { text: visibleAnswer, actions } =
        extractActions(
          answer,
          trades
        );

      answer =
        softenOverconfidentLanguage(
          visibleAnswer
        );

      return res.json({

        answer,

        actions,

        sources:
          mapSources(newsItems),

        fearGreed:
          fearGreed || null,

        provenance:
          buildProvenance({
            kind: 'chat',
            inputs: context,
            newsItems,
            fearGreed,
            usedPaperTrades: Boolean(trades),
          }),
      });

    } catch (err) {

      return sendAiFailure(res, req, err, 'chat');
    }
  }
);

// =========================================================
// ORIGINAL AI INSIGHT ENDPOINT
// =========================================================

// The minimum a synthesis response must contain to be worth showing: a plain object with a
// non-empty summary and a trend string. Everything else on the card is optional.
export function isUsableInsight(parsed) {
  return (
    Boolean(parsed) &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    typeof parsed.summary === 'string' &&
    parsed.summary.trim().length > 0 &&
    typeof parsed.trend === 'string' &&
    parsed.trend.trim().length > 0
  );
}

router.post(
  '/api/ai-insight',
  aiRateLimit,
  async (req, res) => {

    const {
      apiKey,
      errorStatus,
      errorBody,
    } = resolveApiKey(req);

    if (errorStatus) {
      return res.status(errorStatus).json(errorBody);
    }

    const ctx =
      req.body?.context;

    const validationError =
      validateContext(ctx);

    if (validationError) {

      return res.status(400).json({
        error:
          validationError,
      });
    }

    const groq =
      new Groq({
        apiKey,
      });

    // Live news + sentiment.
    const [
      newsItems,
      fearGreed,
    ] = await Promise.all([

      fetchCryptoNews(
        ctx.asset
      ).catch(() => []),

      fetchFearGreedIndex()
        .catch(() => null),
    ]);

    const enrichedCtx = {
      ...ctx,
      newsItems,
      fearGreed,
    };

    const userPrompt =
      buildUserPrompt(
        enrichedCtx
      );

    try {

      // =====================================================
      // PASS 1 — RESEARCH
      // =====================================================

      const researchCompletion =
        await groq.chat.completions.create({

          model:
            GROQ_MODEL,

          max_tokens:
            700,

          reasoning_effort:
            'low',

          messages: [

            {
              role:
                'system',

              content:
                RESEARCH_SYSTEM_PROMPT,
            },

            {
              role:
                'user',

              content:
                userPrompt,
            },

          ],
        });

      const researchNotes =
        (
          researchCompletion
            .choices?.[0]
            ?.message
            ?.content || ''
        ).trim();

      // =====================================================
      // PASS 2 — SYNTHESIS
      // =====================================================

      const synthesisMessages = [

        {
          role:
            'system',

          content:
            synthesisSystemPrompt(
              enrichedCtx
            ),
        },

        {
          role:
            'user',

          content:
            `${userPrompt}

Research notes from pass 1:
${researchNotes || '(No research notes were returned. Reason from the supplied data only.)'}`,
        },

      ];

      // Retries up to 2 attempts total, and — unlike before — a malformed-JSON response from
      // attempt 1 now also triggers attempt 2, instead of failing straight to a 502. An empty
      // response and an unparseable response are both just "this attempt didn't give us usable
      // JSON", so both should get the same one extra try.
      let parsed =
        null;

      let lastErr =
        null;

      for (
        let attempt = 0;
        attempt < 2 &&
        !parsed;
        attempt++
      ) {

        let rawText =
          '';

        try {

          const synthesisCompletion =
            await groq.chat.completions.create({

              model:
                GROQ_MODEL,

              max_tokens:
                1200,

              reasoning_effort:
                'low',

              response_format:
                {
                  type:
                    'json_object',
                },

              messages:
                synthesisMessages,
            });

          rawText =
            (
              synthesisCompletion
                .choices?.[0]
                ?.message
                ?.content || ''
            ).trim();

        } catch (error) {

          lastErr =
            error;

          continue;
        }

        if (!rawText) {
          continue;
        }

        const cleaned =
          rawText
            .replace(
              /^```json\s*/i,
              ''
            )
            .replace(
              /```$/,
              ''
            )
            .trim();

        try {

          parsed =
            JSON.parse(
              cleaned
            );

        } catch {

          // Malformed JSON — fall through and let the loop try again (or exhaust attempts).
          parsed =
            null;
        }

        // Valid JSON that isn't the shape we asked for (an array, a bare string, or an object
        // with no summary/trend) is no more usable than malformed JSON, so it gets the same
        // retry rather than reaching the browser and rendering as an empty card.
        if (parsed && !isUsableInsight(parsed)) {
          parsed =
            null;
        }
      }

      if (!parsed) {

        if (lastErr) {
          throw lastErr;
        }

        return res.status(502).json({
          error:
            'AI service returned an unexpected response format. Please try again.',
          code: AI_ERROR_CODES.MALFORMED_RESPONSE,
          retryable: true,
        });
      }

      // =====================================================
      // SAFETY LANGUAGE CLEANUP
      // =====================================================

      if (parsed.summary) {

        parsed.summary =
          softenOverconfidentLanguage(
            parsed.summary
          );
      }

      if (parsed.outlook) {

        parsed.outlook =
          softenOverconfidentLanguage(
            parsed.outlook
          );
      }

      parsed.reasoningSteps =
        softenList(
          parsed.reasoningSteps
        );

      if (parsed.keyRisk) {

        parsed.keyRisk =
          softenOverconfidentLanguage(
            parsed.keyRisk
          );
      }

      if (parsed.fundingContext) {

        parsed.fundingContext =
          softenOverconfidentLanguage(
            parsed.fundingContext
          );
      }

      if (parsed.newsContext) {

        parsed.newsContext =
          softenOverconfidentLanguage(
            parsed.newsContext
          );
      }

      if (parsed.catalystWatch) {

        parsed.catalystWatch =
          softenOverconfidentLanguage(
            parsed.catalystWatch
          );
      }

      if (parsed.positionNote) {

        parsed.positionNote =
          softenOverconfidentLanguage(
            parsed.positionNote
          );
      }

      if (
        typeof parsed.stopATRMultiple ===
        'number'
      ) {

        parsed.stopATRMultiple =
          Math.min(
            3,
            Math.max(
              1,
              parsed.stopATRMultiple
            )
          );
      }

      return res.json({

        result:
          parsed,

        research:
          researchNotes || null,

        sources:
          mapSources(newsItems),

        fearGreed:
          fearGreed || null,

        provenance:
          buildProvenance({
            kind: 'insight',
            inputs: ctx,
            newsItems,
            fearGreed,
            passes: 2,
            researchNotes,
            parsed,
          }),
      });

    } catch (err) {

      return sendAiFailure(res, req, err, 'insight');
    }
  }
);

// =========================================================
// ALERT TRIGGER EXPLANATION
// =========================================================
// Called by js/07-alerts.js right after a price alert fires client-side. Deliberately the
// cheapest of the three AI endpoints here — one short completion, no multi-pass research —
// since it's firing automatically (not on an explicit "Analyze" click) and shouldn't feel
// like it's burning through someone's rate limit for a one-line note. Uses the same
// resolveApiKey/aiRateLimit plumbing as /api/ai-chat and /api/ai-insight above, so it's
// still subject to the visitor's own BYOK limit or the stricter shared house-key limit.

router.post(
  '/api/alert-explain',
  aiRateLimit,
  async (req, res) => {

    const {
      apiKey,
      errorStatus,
      errorBody,
    } = resolveApiKey(req);

    if (errorStatus) {
      return res.status(errorStatus).json(errorBody);
    }

    const payload = req.body || {};

    const validationError = validateAlertExplainPayload(payload);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const asset = String(payload.asset).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) || 'BTC';

    const groq = new Groq({ apiKey });

    // Best-effort context, same as /api/ai-chat — a failed news/sentiment fetch should
    // never block the note, it just gets written with less grounding.
    const [newsItems, fearGreed] = await Promise.all([
      fetchCryptoNews(asset).catch(() => []),
      fetchFearGreedIndex().catch(() => null),
    ]);

    const userPrompt = buildAlertExplainPrompt({
      asset,
      direction: payload.direction,
      target: payload.target,
      price: payload.price,
      market: payload.market,
      changePercent24h: payload.changePercent24h ?? null,
      fearGreed: fearGreed?.value ?? fearGreed ?? null,
      newsItems,
    });

    try {

      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 90,
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: ALERT_EXPLAIN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      let explanation = (completion.choices?.[0]?.message?.content || '').trim();

      if (!explanation) {
        return res.status(502).json({
          error: 'AI model returned an empty response.',
          code: AI_ERROR_CODES.EMPTY_RESPONSE,
          retryable: true,
        });
      }

      explanation = softenOverconfidentLanguage(explanation);

      return res.json({ explanation });

    } catch (err) {

      return sendAiFailure(res, req, err, 'alert-explain');
    }
  }
);

export default router;