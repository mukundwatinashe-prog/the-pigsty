-- CreateEnum
CREATE TYPE "FeedType" AS ENUM ('MAIZE_CRECHE', 'SOYA', 'PREMIX', 'CONCENTRATE');

-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "feedLowStockThresholdKg" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "feed_purchases" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "feedType" "FeedType" NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "supplier" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "receiptKey" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_daily_usage" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "usageDate" DATE NOT NULL,
    "maizeBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "soyaBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "premixBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "concentrateBuckets" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_daily_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_purchases_farmId_purchasedAt_idx" ON "feed_purchases"("farmId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "feed_daily_usage_farmId_usageDate_key" ON "feed_daily_usage"("farmId", "usageDate");

-- CreateIndex
CREATE INDEX "feed_daily_usage_farmId_usageDate_idx" ON "feed_daily_usage"("farmId", "usageDate");

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_purchases" ADD CONSTRAINT "feed_purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_daily_usage" ADD CONSTRAINT "feed_daily_usage_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_daily_usage" ADD CONSTRAINT "feed_daily_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
