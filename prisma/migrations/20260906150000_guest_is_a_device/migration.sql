-- A guest is the browser holding the cookie, not the name typed into it.
--
-- `nameKey` existed only to make a name unique inside a roll, which at a five-hundred-guest
-- wedding refuses the second Riya at the door. `tokenVersion` existed only to sign the first
-- device out when somebody took a name back, which is the flow this removes.

DROP INDEX "Guest_rollId_nameKey_key";

ALTER TABLE "Guest" DROP COLUMN "nameKey",
                    DROP COLUMN "tokenVersion";
