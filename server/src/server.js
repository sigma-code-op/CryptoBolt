import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ALLOWED_ORIGINS, IS_PRODUCTION } from './config.js';
import { logError } from './lib/logger.js';
import healthRouter from './routes/health.js';
import contactRouter from './routes/contact.js';
import aiRouter from './routes/ai.js';
import pushRouter from './routes/push.js';
import telegramRouter from './routes/telegram.js';
import clientErrorRouter from './routes/client-error.js';

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

// A short id per request, attached before anything else runs so every downstream log line
// (and the error response body, if this request ends up in the error handler below) can be
// tied together and to whatever a visitor reports back — "it broke, request id abc123" is
// searchable in the structured logs in a way "it broke" alone never is.
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

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
        (origin !== 'null' && !IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) ||
        (origin !== 'null' && ALLOWED_ORIGINS.includes(origin))
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
app.use(telegramRouter);
app.use(clientErrorRouter);

// =========================================================
// ERROR HANDLER
// =========================================================

app.use(
  (
    err,
    req,
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

    logError('Unhandled request error', err, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    });

    return res.status(500).json({
      error:
        'Internal server error.',
      requestId: req.requestId,
    });
  }
);

export {
  app,
};