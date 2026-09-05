-- A new cover was inserted at index 0 of `COVERS`, which renumbers every cover after it.
-- Existing rolls store the index, not the picture, so without this they would each wake up
-- showing their neighbour's artwork. Shift them to keep pointing at what their host chose.
--
-- Rolls with an uploaded cover are shifted too: `coverKey` wins over the preset while the
-- upload exists, but the preset is still what they fall back to if it ever goes away.
UPDATE "Roll" SET "coverPreset" = "coverPreset" + 1;
