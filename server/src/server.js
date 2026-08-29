import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PORT, ALLOWED_ORIGINS, GROQ_MODEL, IS_PRODUCTION } from './config.js';
import healthRouter from './routes/health.js';
import contactRouter from './routes/contact.js';
import aiRouter from './routes/ai.js';

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
}

export {
  app,
};