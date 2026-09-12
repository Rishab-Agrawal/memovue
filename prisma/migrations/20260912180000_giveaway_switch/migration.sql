-- Whether guests on this roll may hand their own film to the shots pool.
--
-- Off, including for every roll that already exists: a guest who gives half their shots away
-- has no way of knowing they were about to be the one taking the photographs, so the host
-- opens that door rather than finding it already open. Drawing from the pool is unaffected —
-- that film belongs to guests who never turned up, and nobody chose to keep it.

ALTER TABLE "Roll" ADD COLUMN "giveawayAllowed" BOOLEAN NOT NULL DEFAULT false;
