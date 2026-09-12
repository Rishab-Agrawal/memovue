-- How many times a guest has drawn a refill out of the shots pool.
--
-- Counted rather than derived from `fromPool`, because the ceilings are on the number of
-- draws and not on the total: ten in the life of a roll, and only two inside the first
-- quarter of the event. Handing film back and reclaiming it again are not draws and do not
-- spend one. Everybody who joined before this has taken none.

ALTER TABLE "Guest" ADD COLUMN "refills" INTEGER NOT NULL DEFAULT 0;
