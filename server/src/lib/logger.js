// ---------------------------------------------------------------------------
// Structured logging.
//
// This project is meant to run on "any static host" for the frontend (see README.md) and a
// small Node process for the backend — there's no assumption of a particular hosting
// provider, so this deliberately does NOT pull in a third-party error-tracking SaaS (Sentry,
// Bugsnag, etc.), which would mean a new signup, a new API key, and a new outbound network
// dependency for something a handful of JSON lines on stderr already solves: every major host
// (Render, Railway, Fly, a plain systemd/pm2 process, Docker) already captures stdout/stderr
// and lets you search/alert on it, so writing well-structured JSON there is the zero-setup
// option. If you outgrow this, these are the two functions to swap for an SDK call.
//
// One JSON object per line (that's what makes it grep/jq-able and ingestible by literally any
// log pipeline without a special parser): { ts, level, msg, requestId?, ...meta }.
// ---------------------------------------------------------------------------

function write(level, msg, meta) {
  const line = { ts: new Date().toISOString(), level, msg, ...meta };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

/**
 * Logs a caught/unhandled error with structured context. `err` can be an Error, a string, or
 * anything thrown — normalized into a message + stack (when available) so a log search for a
 * request id always finds the same shape of record.
 */
export function logError(msg, err, meta = {}) {
  const errInfo =
    err instanceof Error
      ? { errorMessage: err.message, stack: err.stack }
      : { errorMessage: String(err) };
  write('error', msg, { ...errInfo, ...meta });
}

/** Logs a plain informational event in the same structured shape, for anything worth searching later. */
export function logInfo(msg, meta = {}) {
  write('info', msg, meta);
}