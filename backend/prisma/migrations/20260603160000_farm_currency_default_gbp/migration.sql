-- Default new farms to GBP (UK-facing site).
ALTER TABLE "farms" ALTER COLUMN "currency" SET DEFAULT 'GBP';
