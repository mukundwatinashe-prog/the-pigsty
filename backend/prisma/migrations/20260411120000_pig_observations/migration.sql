-- CreateEnum
CREATE TYPE "PigObservationCategory" AS ENUM (
  'GENERAL_WELLBEING',
  'APPETITE_FEED_INTAKE',
  'BEHAVIOUR_ACTIVITY',
  'RESPIRATORY_COUGHING',
  'DIGESTIVE_DIARRHEA',
  'SKIN_LESIONS',
  'LAMENESS_MOBILITY',
  'EYES_NOSE_DISCHARGE',
  'OTHER'
);

-- CreateTable
CREATE TABLE "pig_observations" (
    "id" TEXT NOT NULL,
    "pigId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "PigObservationCategory" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pig_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pig_observations_pigId_createdAt_idx" ON "pig_observations"("pigId", "createdAt");

-- AddForeignKey
ALTER TABLE "pig_observations" ADD CONSTRAINT "pig_observations_pigId_fkey" FOREIGN KEY ("pigId") REFERENCES "pigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pig_observations" ADD CONSTRAINT "pig_observations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
