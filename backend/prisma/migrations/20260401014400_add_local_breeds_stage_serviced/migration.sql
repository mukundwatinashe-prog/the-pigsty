/*
  Warnings:

  - You are about to drop the column `sex` on the `pigs` table. All the data in the column will be lost.
  - Added the required column `stage` to the `pigs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PigStage" AS ENUM ('BOAR', 'SOW', 'GILT', 'WEANER', 'PIGLET', 'PORKER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PigBreed" ADD VALUE 'MUKOTA';
ALTER TYPE "PigBreed" ADD VALUE 'KOLBROEK';
ALTER TYPE "PigBreed" ADD VALUE 'WINDSNYER';
ALTER TYPE "PigBreed" ADD VALUE 'SA_LANDRACE';
ALTER TYPE "PigBreed" ADD VALUE 'INDIGENOUS';

-- AlterTable
ALTER TABLE "pigs" DROP COLUMN "sex",
ADD COLUMN     "serviced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "servicedDate" TIMESTAMP(3),
ADD COLUMN     "stage" "PigStage" NOT NULL;

-- DropEnum
DROP TYPE "PigSex";
