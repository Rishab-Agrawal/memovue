-- When a roll's first frame was reserved. The shots pool's lockout and early cap are
-- fractions of the time from here to the close, rather than from the scheduled start.
-- Rolls already shooting take their earliest surviving photo.

ALTER TABLE "Roll" ADD COLUMN "firstShotAt" TIMESTAMP(3);

UPDATE "Roll" SET "firstShotAt" = (SELECT MIN("createdAt") FROM "Photo" WHERE "Photo"."rollId" = "Roll"."id");
