-- A cover lives at a fixed key and is overwritten in place, so replacing one changed no URL
-- and the CDN kept serving the picture it already had. This is the number that changes.
--
-- Existing rolls start at 0 rather than at a backfilled count: nothing recorded how often a
-- cover had been replaced, and every cover URL in the wild today carries no `?v=` at all, so
-- shipping this moves all of them onto a cache key nothing has seen exactly once.

-- AlterTable
ALTER TABLE "Roll" ADD COLUMN "coverVersion" INTEGER NOT NULL DEFAULT 0;
