#!/bin/sh
# Apply any pending DB migrations, then start the API server.
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] starting API server..."
exec node dist/server.js
