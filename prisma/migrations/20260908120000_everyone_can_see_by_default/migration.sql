-- A shared album is what somebody sets a roll up for, so the column now defaults on and the
-- wizard's toggle starts on to match. Existing rolls are untouched: a default only decides
-- what a row with no explicit value gets, and every roll made through the wizard sends one.
ALTER TABLE "Roll" ALTER COLUMN "everyoneCanSee" SET DEFAULT true;
