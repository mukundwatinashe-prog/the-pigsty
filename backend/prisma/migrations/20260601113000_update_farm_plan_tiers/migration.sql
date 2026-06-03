-- Migrate billing plans from legacy FREE/PRO to FREE/GROWER/ENTERPRISE.
CREATE TYPE "FarmPlan_new" AS ENUM ('FREE', 'GROWER', 'ENTERPRISE');

ALTER TABLE "farms"
ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "farms"
ALTER COLUMN "plan" TYPE "FarmPlan_new"
USING (
  CASE
    WHEN "plan"::text = 'PRO' THEN 'GROWER'::"FarmPlan_new"
    ELSE "plan"::text::"FarmPlan_new"
  END
);

DROP TYPE "FarmPlan";
ALTER TYPE "FarmPlan_new" RENAME TO "FarmPlan";

ALTER TABLE "farms"
ALTER COLUMN "plan" SET DEFAULT 'FREE'::"FarmPlan";
