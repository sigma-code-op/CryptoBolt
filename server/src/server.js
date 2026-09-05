import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PORT, ALLOWED_ORIGINS, GROQ_MODEL, IS_PRODUCTION } from './config.js';
import healthRouter from './routes/health.js';
import contactRouter from './routes/contact.js';
import aiRouter from './routes/ai.js';
import pushRouter from './routes/push.js';
import aiCallsRouter from './routes/ai-calls.js';
import { startAlertChecker } from './lib/alert-checker.js';
import { startAiCallResolver } from './lib/ai-call-tracker.js';

// =========================================================
// APP
// =========================================================

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(
  express.json({
    limit: '32kb',
  })
);

// =========================================================
// CORS
// =========================================================

app.use(
  cors({
    origin(origin, callback) {

      // In production, config.js already refuses to boot with an empty ALLOWED_ORIGINS, so
      // reaching this with an empty list only happens in dev/test — where "allow anything" is
      // the convenient default. In production, ALLOWED_ORIGINS is guaranteed non-empty here.
      if (
        !origin ||
        origin === 'null' ||
        (!IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) ||
        ALLOWED_ORIGINS.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error('Not allowed by CORS')
      );
    },

    allowedHeaders: [
      'Content-Type',
      'x-groq-key',
      'x-use-house-key',
      // Push subscribe/unsubscribe (routes/push.js) send the visitor's Supabase access
      // token here so the server can verify which signed-in user is making the request.
      'Authorization',
    ],
  })
);

// =========================================================
// ROUTES
// =========================================================
// Each router owns its own path prefixes (see routes/*.js) and its own rate
// limiter, so mounting order here doesn't matter for behavior — kept in the
// original route-definition order purely for readability.

app.use(healthRouter);
app.use(contactRouter);
app.use(aiRouter);
app.use(pushRouter);
app.use(aiCallsRouter);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (
    err,
    _req,
    res,
    _next
  ) => {

    if (
      err?.message ===
      'Not allowed by CORS'
    ) {

      return res.status(403).json({
        error:
          'Origin not allowed.',
      });
    }

    console.error(
      '[cryptobolt-server] Unhandled error:',
      err
    );

    return res.status(500).json({
      error:
        'Internal server error.',
    });
  }
);

// =========================================================
// START SERVER
// =========================================================

if (
  process.env.NODE_ENV !==
  'test'
) {

  app.listen(
    PORT,
    () => {

      console.log(
        `[cryptobolt-server] listening on port ${PORT} (bring-your-own-key mode, model: ${GROQ_MODEL})`
      );
    }
  );

  startAlertChecker();
  startAiCallResolver();
}

export {
  app,
};