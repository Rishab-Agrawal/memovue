-- The feed poll counts a roll's READY photographs on every guest's poll, three times a
-- minute each, and `(rollId, takenAt)` could not answer that without reading `status` off the
-- heap for every row in the roll. Moving `status` into the index answers the count from the
-- index alone and still orders the wall, so it replaces the old index rather than joining it.
DROP INDEX "Photo_rollId_takenAt_idx";
CREATE INDEX "Photo_rollId_status_takenAt_idx" ON "Photo"("rollId", "status", "takenAt");
