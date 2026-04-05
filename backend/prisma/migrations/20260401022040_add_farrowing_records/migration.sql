-- CreateTable
CREATE TABLE "farrowing_records" (
    "id" TEXT NOT NULL,
    "pigId" TEXT NOT NULL,
    "farrowingDate" TIMESTAMP(3) NOT NULL,
    "pigletsBornAlive" INTEGER NOT NULL,
    "pigletsBornDead" INTEGER NOT NULL DEFAULT 0,
    "pigletsWeaned" INTEGER,
    "weaningDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farrowing_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farrowing_records_pigId_farrowingDate_idx" ON "farrowing_records"("pigId", "farrowingDate");

-- AddForeignKey
ALTER TABLE "farrowing_records" ADD CONSTRAINT "farrowing_records_pigId_fkey" FOREIGN KEY ("pigId") REFERENCES "pigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
