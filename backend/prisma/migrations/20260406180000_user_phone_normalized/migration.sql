-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone_normalized" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_normalized_key" ON "users"("phone_normalized");
