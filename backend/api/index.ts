import serverlessHttp from 'serverless-http';
import app, { connectDb } from '../src/server';

let connectPromise: Promise<void> | null = null;

const expressHandler = serverlessHttp(app);

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

export default async function vercelHandler(req: any, res: any) {
  if (!connectPromise) connectPromise = connectDb();
  await connectPromise;

  const apiPathRaw = req?.query?.path;
  if (apiPathRaw) {
    const apiPath = Array.isArray(apiPathRaw) ? apiPathRaw.join('/') : String(apiPathRaw);
    rebuildUrlWithApiPrefix(req, apiPath);
  }

  return expressHandler(req, res);
}

