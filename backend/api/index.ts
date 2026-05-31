import serverlessHttp from 'serverless-http';

let connectPromise: Promise<void> | null = null;
let expressHandler: ReturnType<typeof serverlessHttp> | null = null;
const DB_CONNECT_TIMEOUT_MS = 8000;

function rebuildUrlWithApiPrefix(req: any, apiPath: string) {
  const queryObj: Record<string, unknown> = { ...(req.query || {}) };
  delete queryObj.path;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryObj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  req.url = `/api/${apiPath}${qs ? `?${qs}` : ''}`;
}

function normalizedApiPath(req: any): string {
  const apiPathRaw = req?.query?.path;
  if (apiPathRaw) {
    return Array.isArray(apiPathRaw) ? apiPathRaw.join('/') : String(apiPathRaw);
  }
  const url = String(req?.url || '');
  const match = url.match(/^\/api\/(.+?)(?:\?|$)/);
  return match?.[1] ?? '';
}

async function getExpressHandler() {
  if (!expressHandler) {
    const { default: app } = await import('../src/server');
    expressHandler = serverlessHttp(app);
  }
  return expressHandler;
}

async function ensureDatabase() {
  if (!connectPromise) {
    const { connectDb } = await import('../src/server');
    connectPromise = connectDb().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  await Promise.race([
    connectPromise,
    new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timed out')), DB_CONNECT_TIMEOUT_MS);
    }),
  ]);
}

export default async function vercelHandler(req: any, res: any) {
  const apiPath = normalizedApiPath(req);
  if (apiPath) rebuildUrlWithApiPrefix(req, apiPath);

  const requestPath = String(req?.url || '').split('?')[0];
  if (requestPath === '/api/health' || apiPath === 'health') {
    return (await getExpressHandler())(req, res);
  }

  try {
    await ensureDatabase();
  } catch (err) {
    console.error('Database connection failed:', err);
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
    return;
  }

  return (await getExpressHandler())(req, res);
}
