#!/usr/bin/env bash
# Nightly Postgres backup -> Cloudflare R2 (S3-compatible), with retention.
# Reads R2 credentials from api.env (same dir). Intended to run from cron:
#   0 2 * * *  /opt/pigtrack-pro/deploy/backup.sh >> /var/log/pigsty-backup.log 2>&1
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
# Read specific values out of api.env WITHOUT shell-sourcing it — the file is a
# docker env_file (literal KEY=VALUE), so values like `EMAIL_FROM=A <b@c>` are not
# shell-safe to `source`.
envval() { grep -m1 -E "^$1=" "$DIR/api.env" 2>/dev/null | cut -d= -f2- || true; }
R2_ACCOUNT_ID="$(envval R2_ACCOUNT_ID)"
R2_ACCESS_KEY_ID="$(envval R2_ACCESS_KEY_ID)"
R2_SECRET_ACCESS_KEY="$(envval R2_SECRET_ACCESS_KEY)"
R2_BUCKET_NAME="$(envval R2_BUCKET_NAME)"

: "${R2_ACCOUNT_ID:?}"; : "${R2_ACCESS_KEY_ID:?}"; : "${R2_SECRET_ACCESS_KEY:?}"; : "${R2_BUCKET_NAME:?}"

RETAIN_DAYS="$(envval BACKUP_RETAIN_DAYS)"; RETAIN_DAYS="${RETAIN_DAYS:-14}"
TS="$(date -u +%Y%m%d-%H%M%SZ)"
KEY="db-backups/pigtrack-${TS}.sql.gz"
TMP="/tmp/pigtrack-${TS}.sql.gz"
ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

echo "[backup] $(date -u) dumping database..."
docker exec -t pigsty-db pg_dump -U pigsty -d pigtrack | gzip > "$TMP"
SIZE="$(du -h "$TMP" | cut -f1)"

echo "[backup] uploading $KEY ($SIZE) to R2..."
aws s3 cp "$TMP" "s3://${R2_BUCKET_NAME}/${KEY}" --endpoint-url "$ENDPOINT" --only-show-errors
rm -f "$TMP"

# Retention: delete backups older than RETAIN_DAYS.
CUTOFF="$(date -u -d "-${RETAIN_DAYS} days" +%Y%m%d 2>/dev/null || date -u -v-"${RETAIN_DAYS}"d +%Y%m%d)"
aws s3 ls "s3://${R2_BUCKET_NAME}/db-backups/" --endpoint-url "$ENDPOINT" | awk '{print $4}' | while read -r f; do
  [ -z "$f" ] && continue
  d="$(echo "$f" | sed -n 's/^pigtrack-\([0-9]\{8\}\).*/\1/p')"
  if [ -n "$d" ] && [ "$d" -lt "$CUTOFF" ]; then
    echo "[backup] pruning old $f"
    aws s3 rm "s3://${R2_BUCKET_NAME}/db-backups/$f" --endpoint-url "$ENDPOINT" --only-show-errors
  fi
done

echo "[backup] done."
