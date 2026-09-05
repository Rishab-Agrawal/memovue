-- The ZIP ceiling moved from an in-process rate limiter to a lifetime count per roll, so it
-- has to outlive the process that counted it.
--
-- Existing rolls start at 0. Nothing recorded how often any of them had been downloaded, and
-- the old budget was ten an hour, so no host in the wild has been told a number this one
-- should be continuing from.

-- AlterTable
ALTER TABLE "Roll" ADD COLUMN "downloads" INTEGER NOT NULL DEFAULT 0;
