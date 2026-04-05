-- AlterEnum: Remove unused role values
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('OWNER', 'FARM_MANAGER', 'WORKER');
ALTER TABLE "farm_members" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
