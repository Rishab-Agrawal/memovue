-- Instrumentation: one column and one tally table.
--
-- `Roll.albumOpenedAt` is left NULL for every roll that already exists rather than being
-- backfilled from anything, because nothing recorded it — a guessed value would be indis-
-- tinguishable from a measured one, which is the worst property a metric can have.

-- AlterTable
ALTER TABLE "Roll" ADD COLUMN "albumOpenedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Metric" (
    "day" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("day","name")
);
