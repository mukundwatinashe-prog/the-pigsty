CREATE TYPE "FarmPlan" AS ENUM ('FREE', 'PRO');

ALTER TABLE "farms" ADD COLUMN "plan" "FarmPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "farms" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "farms" ADD COLUMN "stripeSubscriptionId" TEXT;

CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
