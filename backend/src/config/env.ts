import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  STRIPE_PRICE_ID_GROWER: process.env.STRIPE_PRICE_ID_GROWER || process.env.STRIPE_PRICE_ID_PRO || '',
  STRIPE_PRICE_ID_ENTERPRISE: process.env.STRIPE_PRICE_ID_ENTERPRISE || '',
  STRIPE_PRODUCT_ID_GROWER: process.env.STRIPE_PRODUCT_ID_GROWER || '',
  STRIPE_PRODUCT_ID_ENTERPRISE: process.env.STRIPE_PRODUCT_ID_ENTERPRISE || '',
  AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-haiku-4-5',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  AI_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '900000', 10),
  AI_RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '30', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  /** Cloudflare email Worker that relays transactional mail to Resend. */
  CLOUDFLARE_EMAIL_WORKER_URL: process.env.CLOUDFLARE_EMAIL_WORKER_URL || '',
  EMAIL_WORKER_TOKEN: process.env.EMAIL_WORKER_TOKEN || '',
  /** Direct Resend API key — used when the email Worker URL is not configured. */
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_FROM || 'The Pigsty <noreply@the-pigsty.org>',
  /** Twilio Programmable SMS for password-reset codes. */
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',
  /** Comma-separated platform admin emails — /api/admin/*, /api/security/*, and admin UI in the app. */
  PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS || '',
  CONTACT_INBOX_EMAIL: process.env.CONTACT_INBOX_EMAIL || 'pigfarm@the-pigsty.org',
  /** Cloudflare R2 (S3-compatible) for durable feed receipt storage. */
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  /** Cloudflare Turnstile secret — verifies chat requests are from humans. */
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',
  /** Bearer token for Vercel Cron → /api/cron/* (Vercel sets this automatically in production). */
  CRON_SECRET: process.env.CRON_SECRET || '',
};

export const stripeConfigured = Boolean(
  env.STRIPE_SECRET_KEY && (env.STRIPE_PRICE_ID_GROWER || env.STRIPE_PRODUCT_ID_GROWER),
);

export const twilioConfigured = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER,
);

export const turnstileConfigured = Boolean(env.TURNSTILE_SECRET_KEY);

/**
 * Fail fast if critical auth/database secrets are missing or weak.
 * Missing secrets in production abort startup (never run an insecure API);
 * weak secrets and missing secrets in development emit warnings only.
 */
function validateCriticalSecrets() {
  const isProd = env.NODE_ENV === 'production';
  const MIN_SECRET_LENGTH = 32;

  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET) missing.push('JWT_REFRESH_SECRET');

  if (missing.length) {
    const message = `Missing required environment variable(s): ${missing.join(', ')}`;
    if (isProd) throw new Error(`[startup] ${message}. Refusing to start.`);
    console.warn(`[startup] ${message}. The API will not work correctly until these are set.`);
  }

  const weak: string[] = [];
  if (env.JWT_SECRET && env.JWT_SECRET.length < MIN_SECRET_LENGTH) weak.push('JWT_SECRET');
  if (env.JWT_REFRESH_SECRET && env.JWT_REFRESH_SECRET.length < MIN_SECRET_LENGTH) {
    weak.push('JWT_REFRESH_SECRET');
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    weak.push('JWT_SECRET and JWT_REFRESH_SECRET must not be identical');
  }
  if (weak.length) {
    console.warn(
      `[startup] Weak auth secret(s) detected (${weak.join('; ')}). ` +
        `Use unique, random values of at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }
}

validateCriticalSecrets();
