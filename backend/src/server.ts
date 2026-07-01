import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import prisma from './config/database';
import authRoutes from './routes/auth.routes';
import farmRoutes from './routes/farm.routes';
import penRoutes from './routes/pen.routes';
import pigRoutes from './routes/pig.routes';
import weightRoutes from './routes/weight.routes';
import reportRoutes from './routes/report.routes';
import feedRoutes from './routes/feed.routes';
import publicRoutes from './routes/public.routes';
import publicChatRoutes from './routes/publicChat.routes';
import contactRoutes from './routes/contact.routes';
import chatRoutes from './routes/chat.routes';
import securityRoutes from './routes/security.routes';
import adminRoutes from './routes/admin.routes';
import cronRoutes from './routes/cron.routes';
import { errorHandler } from './middleware/error.middleware';
import { BillingController } from './controllers/billing.controller';
import { SecurityService } from './services/security.service';
import { getClientIp } from './utils/requestIp';

const app = express();

app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  BillingController.webhook,
);

app.use(helmet());
app.use(cookieParser());

const corsOriginsFromEnv = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

// Capacitor/Cordova native shells load the app from these local origins and
// authenticate with Bearer tokens (see X-Client: mobile). Always allowed.
const NATIVE_APP_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'https://localhost',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOriginsFromEnv.includes(origin)) return callback(null, true);
      if (NATIVE_APP_ORIGINS.includes(origin)) return callback(null, true);
      if (env.NODE_ENV !== 'production') {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

function rateLimitWithAlert(max: number, windowMs: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message },
    handler: (req, res, _next, options) => {
      void SecurityService.log({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: max <= 10 ? 'HIGH' : 'MEDIUM',
        ip: getClientIp(req),
        path: req.originalUrl,
        details: `Rate limit ${max}/${windowMs}ms exceeded`,
      });
      res.status(options.statusCode).json(options.message);
    },
  });
}

const chatLimiter = rateLimitWithAlert(
  env.AI_RATE_LIMIT_MAX_REQUESTS,
  env.AI_RATE_LIMIT_WINDOW_MS,
  'Too many AI requests. Try again later.',
);

const publicChatLimiter = rateLimitWithAlert(10, 15 * 60 * 1000, 'Too many chat requests. Try again later.');

const publicLimiter = rateLimitWithAlert(20, 15 * 60 * 1000, 'Too many requests. Try again later.');

const farmApiLimiter = rateLimitWithAlert(300, 15 * 60 * 1000, 'Too many API requests. Slow down.');
// Public "Piggy" help chat — registered before the general public mount so it
// uses the AI rate limiter rather than the stricter contact-form limiter.
app.use('/api/public/chat', publicChatLimiter, express.json({ limit: '32kb' }), publicChatRoutes);
app.use('/api/public', publicLimiter, express.json({ limit: '32kb' }), publicRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/contact', limiter, express.json({ limit: '32kb' }), contactRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/farms', farmApiLimiter, farmRoutes);
app.use('/api/farms', penRoutes);
app.use('/api/farms', pigRoutes);
app.use('/api/farms', weightRoutes);
app.use('/api/farms', reportRoutes);
app.use('/api/farms', feedRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

let prismaConnected = false;
export const connectDb = async () => {
  if (prismaConnected) return;
  await prisma.$connect();
  prismaConnected = true;
  console.log('Database connected');
};

const start = async () => {
  try {
    await connectDb();
    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Prevent side-effects during Vercel serverless imports.
// Vercel will call our exported API handler instead.
if (typeof require !== 'undefined' && require.main === module) {
  start();
}

export default app;
