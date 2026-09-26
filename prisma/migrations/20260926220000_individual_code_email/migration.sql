-- An individual's code is known by the address it was given to, not by a name.
ALTER TABLE "Referrer" ALTER COLUMN "name" DROP NOT NULL;
UPDATE "Referrer" SET "name" = NULL WHERE "kind" = 'INDIVIDUAL';

-- Requests from before codes replaced the per-address allowance are nobody's to answer now.
DELETE FROM "CodeRequest";
