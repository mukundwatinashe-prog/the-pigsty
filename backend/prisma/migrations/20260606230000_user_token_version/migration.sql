-- Invalidate outstanding JWT access tokens on logout by bumping tokenVersion.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
