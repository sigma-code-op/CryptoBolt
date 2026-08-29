// ---------------------------------------------------------------------------
// AI chat + AI insight routes. Extracted verbatim from server.js.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import { GROQ_MODEL } from '../config.js';
import { validateContext } from '../validators.js';
import { fetchCryptoNews, fetchFearGreedIndex } from '../lib/market-data.js';
import {
  synthesisSystemPrompt,
  buildUserPrompt,
  softenOverconfidentLanguage,
  softenList,
  CHAT_SYSTEM_PROMPT,
  RESEARCH_SYSTEM_PROMPT,
} from '../lib/ai-prompts.js';

const router = Router();

// =========================================================
// AI RATE LIMIT
// =========================================================

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

  message: {
    error:
      'Too many AI requests from this address. Please wait and try again.',
  },
});

router.post(
  '/api/ai-chat',
  aiLimiter,
  async (req, res) => {

    const apiKey =
      req.get('x-groq-key');

    if (
      !apiKey ||
      !apiKey.startsWith('gsk_')
    ) {

      return res.status(401).json({
        error:
          'Missing or invalid Groq API key. Add your key in the AI page first.',
      });
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

    const contextText =
      JSON.stringify({

        pageSnapshot:
          context,

        liveServerFearGreed:
          fearGreed,

        recentNews:
          newsItems,

        note:
          'This is market research context, not personalized portfolio or account state.',
      });

    try {

      const completion =
        await groq.chat.completions.create({

          model:
            GROQ_MODEL,

          max_tokens:
            900,

          reasoning_effort:
            'low',

          messages: [

            {
              role:
                'system',

              content:
                CHAT_SYSTEM_PROMPT,
            },

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
        });
      }

      answer =
        softenOverconfidentLanguage(
          answer
        );

      return res.json({

        answer,

        sources:
          newsItems.map(
            (news) => ({
              title:
                news.title,

              source:
                news.source,

              hoursAgo:
                news.hoursAgo,
            })
          ),

        fearGreed:
          fearGreed || null,
      });

    } catch (err) {

      const status =
        err?.status;

      if (status === 401) {

        return res.status(401).json({
          error:
            'Invalid API key. Check the key you entered and try again.',
        });
      }

      if (status === 429) {

        return res.status(429).json({
          error:
            'Rate limited by Groq. Please wait a moment and try again.',
        });
      }

      if (
        status === 404 ||
        (err?.message || '')
          .toLowerCase()
          .includes('model')
      ) {

        return res.status(502).json({
          error:
            `Model "${GROQ_MODEL}" is unavailable. Update GROQ_MODEL on the server.`,
        });
      }

      console.error(
        '[cryptobolt-server] Groq chat error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'AI chat request failed.',
      });
    }
  }
);

// =========================================================
// ORIGINAL AI INSIGHT ENDPOINT
// =========================================================

router.post(
  '/api/ai-insight',
  aiLimiter,
  async (req, res) => {

    const apiKey =
      req.get('x-groq-key');

    if (
      !apiKey ||
      !apiKey.startsWith('gsk_')
    ) {

      return res.status(401).json({
        error:
          'Missing or invalid Groq API key. Add your key in the app first.',
      });
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
      }

      if (!parsed) {

        if (lastErr) {
          throw lastErr;
        }

        return res.status(502).json({
          error:
            'AI service returned an unexpected response format. Please try again.',
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
          newsItems.map(
            (news) => ({
              title:
                news.title,

              source:
                news.source,

              hoursAgo:
                news.hoursAgo,
            })
          ),

        fearGreed:
          fearGreed || null,
      });

    } catch (err) {

      const status =
        err?.status;

      if (status === 401) {

        return res.status(401).json({
          error:
            'Invalid API key. Check the key you entered and try again.',
        });
      }

      if (status === 429) {

        return res.status(429).json({
          error:
            'Rate limited by Groq. Please wait a moment and try again.',
        });
      }

      if (
        status === 404 ||
        (err?.message || '')
          .toLowerCase()
          .includes('model')
      ) {

        return res.status(502).json({
          error:
            `Model "${GROQ_MODEL}" is unavailable. Set GROQ_MODEL in the server environment to a supported model.`,
        });
      }

      console.error(
        '[cryptobolt-server] Groq request error:',
        err?.message || err
      );

      return res.status(502).json({
        error:
          'AI service request failed.',
      });
    }
  }
);

export default router;