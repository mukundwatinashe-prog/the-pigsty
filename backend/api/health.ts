/** Lightweight health check — does not import Express or connect to Postgres. */
export default function handler(
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
