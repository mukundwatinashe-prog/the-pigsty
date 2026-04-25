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
import contactRoutes from './routes/contact.routes';
import chatRoutes from './routes/chat.routes';
import { errorHandler } from './middleware/error.middleware';
import { BillingController } from './controllers/billing.controller';

const app = express();

app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  BillingController.webhook,
);

app.use(helmet());
app.use(cookieParser());

const corsOriginsFromEnv = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOriginsFromEnv.includes(origin)) return callback(null, true);
      if (env.NODE_ENV !== 'production') {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
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

const chatLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  max: env.AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authRoutes);
app.use('/api/contact', limiter, express.json({ limit: '32kb' }), contactRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/farms', farmRoutes);
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
