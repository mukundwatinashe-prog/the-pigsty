-- AlterEnum
ALTER TYPE "FeedType" ADD VALUE 'LACTATING';
ALTER TYPE "FeedType" ADD VALUE 'WEANER';

-- AlterTable
ALTER TABLE "farms" ADD COLUMN "feedDefaultDailyBuckets" JSONB;

-- AlterTable
ALTER TABLE "feed_daily_usage" ADD COLUMN "lactatingBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0;
ALTER TABLE "feed_daily_usage" ADD COLUMN "weanerBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0;
