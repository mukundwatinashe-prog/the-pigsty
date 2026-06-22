-- CreateEnum
CREATE TYPE "ReportEmailCadence" AS ENUM ('OFF', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "farms"
ADD COLUMN "report_email_cadence" "ReportEmailCadence" NOT NULL DEFAULT 'OFF',
ADD COLUMN "report_email_last_sent_at" TIMESTAMP(3),
ADD COLUMN "alert_sms_phone" TEXT,
ADD COLUMN "alert_sms_farrowing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alert_sms_low_stock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "alert_sms_last_farrowing_at" TIMESTAMP(3),
ADD COLUMN "alert_sms_last_low_stock_at" TIMESTAMP(3);
