-- Film moved between one guest and the roll's shared pool.
--
-- The pool is what is left of `maxGuests × photosPerGuest` once everybody standing in the
-- roll has been handed their allowance, so it is summed from this column rather than stored
-- on the roll: a roll's size can still be edited afterwards, and a stored pool would then
-- disagree with the roll it belongs to. Everybody who joined before this has moved nothing.

ALTER TABLE "Guest" ADD COLUMN "fromPool" INTEGER NOT NULL DEFAULT 0;
