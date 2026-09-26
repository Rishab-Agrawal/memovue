-- Whether guests may add photos from their library rather than only through the camera.
--
-- Off, including for every roll that already exists: a disposable camera is the point, and the
-- host opens this door rather than finding it already open.

ALTER TABLE "Roll" ADD COLUMN "uploadsAllowed" BOOLEAN NOT NULL DEFAULT false;
