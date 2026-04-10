-- Feed purchase pricing: per-type rates in farm currency (unit is KG or TONNE on farm row)
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "feedPurchasePriceUnit" VARCHAR(10) NOT NULL DEFAULT 'KG';
ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "feedPurchasePrices" JSONB;
