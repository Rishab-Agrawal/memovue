-- One identity per account per roll.
--
-- Postgres treats NULLs as distinct in a unique index, so anonymous guests are unconstrained
-- while an account holder cannot end up with two rows in the same roll — which would give
-- them two separate shot quotas and split their photos across two names.
CREATE UNIQUE INDEX "Guest_rollId_userId_key" ON "Guest"("rollId", "userId");
