-- PigStage: growers and finishers (append-only enum values)
ALTER TYPE "PigStage" ADD VALUE 'GROWER';
ALTER TYPE "PigStage" ADD VALUE 'FINISHER';

-- Pig: weaning date, post-service heat check (day ~21)
ALTER TABLE "pigs" ADD COLUMN IF NOT EXISTS "weanedDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "serviceHeatCheckAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "serviceHeatInHeat" BOOLEAN;

-- Farrowing / litter care
ALTER TABLE "farrowing_records" ADD COLUMN IF NOT EXISTS "avgBirthWeightKg" DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS "ironDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "tailDockedDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "teatClippedDate" TIMESTAMP(3);
