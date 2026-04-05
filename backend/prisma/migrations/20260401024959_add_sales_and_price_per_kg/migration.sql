-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('LIVE_SALE', 'SLAUGHTER');

-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "pricePerKg" DECIMAL(10,2) NOT NULL DEFAULT 3.3;

-- CreateTable
CREATE TABLE "sale_records" (
    "id" TEXT NOT NULL,
    "pigId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "saleType" "SaleType" NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "weightAtSale" DECIMAL(10,2) NOT NULL,
    "pricePerKg" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "buyer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_records_farmId_saleDate_idx" ON "sale_records"("farmId", "saleDate");

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_pigId_fkey" FOREIGN KEY ("pigId") REFERENCES "pigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
