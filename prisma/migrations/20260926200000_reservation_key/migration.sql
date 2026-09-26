-- The phone's name for each frame. A reservation asked for twice, by a retry whose answer was
-- lost or by a second tab, returns the first instead of spending another shot.
--
-- The unique index leads with "guestId", so it serves the per-guest counts the old one did.

ALTER TABLE "Photo" ADD COLUMN "clientId" TEXT;

DROP INDEX "Photo_guestId_idx";

CREATE UNIQUE INDEX "Photo_guestId_clientId_key" ON "Photo"("guestId", "clientId");
