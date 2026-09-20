-- An address to tell each time a roll is created with this business's code. Optional, and the
-- only thing ever sent to it — there is no other mail a referral partner gets.

ALTER TABLE "Referrer" ADD COLUMN "email" TEXT;
