-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM (
  'FAILED_LOGIN',
  'LOGIN_LOCKOUT',
  'FAILED_PASSWORD_RESET',
  'PASSWORD_RESET_LOCKOUT',
  'RATE_LIMIT_EXCEEDED',
  'MFA_FAILED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'SUSPICIOUS_IMPORT',
  'SUSPICIOUS_ACTIVITY',
  'BRUTE_FORCE_DETECTED'
);

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "mfa_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "login_locked_until" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "password_reset_locked_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "ip" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "path" TEXT,
    "details" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_events_createdAt_idx" ON "security_events"("createdAt");

-- CreateIndex
CREATE INDEX "security_events_severity_acknowledged_idx" ON "security_events"("severity", "acknowledged");

-- CreateIndex
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
