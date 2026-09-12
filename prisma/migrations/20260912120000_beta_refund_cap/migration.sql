-- Give-backs are counted now, so the refund for deleting an unstarted roll can be capped: an
-- uncapped one is a free roll on tap, and the first roll is free without asking as of here.
-- Existing rows start at zero — nobody is charged for a refund taken before this column.

ALTER TABLE "BetaAccess" ADD COLUMN "refunds" INTEGER NOT NULL DEFAULT 0;
