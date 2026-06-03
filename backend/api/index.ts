import app from '../src/server';

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

/** Vercel rewrite: /api/:path* -> /api/index?path=:path* */
export default function handler(req: any, res: any) {
  const apiPath = normalizedApiPath(req);
  if (apiPath) rebuildUrlWithApiPrefix(req, apiPath);
  return app(req, res);
}
