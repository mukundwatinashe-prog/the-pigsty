// Loaded first (before Express) so Sentry can instrument the app. Entirely a
// no-op until SENTRY_DSN is set, so it can never affect the running server until
// error monitoring is deliberately enabled.
import * as Sentry from '@sentry/node';
import { env } from './config/env';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Error monitoring only — no performance tracing (keeps volume/cost down).
    tracesSampleRate: 0,
  });
  console.log('[sentry] error monitoring enabled');
}
