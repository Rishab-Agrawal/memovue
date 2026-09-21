import { fromWall } from "./format";

/**
 * One album that belongs to nobody, so the Albums tab has something to open before a host's
 * first roll closes. Fiction: it never touches the database.
 */

/** The film on the sample's camera, and what its invitation promises. */
export const SAMPLE_SHOTS = 21;

/**
 * What the invitation and the live album always have left. The sample's own evening ended in
 * February, so a real clock would read "Ended" on a roll that has just been handed over.
 */
export const SAMPLE_CLOSES_IN_MS = 28 * 60 * 60 * 1000;

export const SAMPLE_ALBUM = {
  href: "/albums/sample",
  name: "Priya and Arjun's Wedding",
  /** Whoever the invitation says invited you. */
  host: "Priya",
  startsAt: fromWall(2026, 1, 14, 11, 0),
  finishesAt: fromWall(2026, 1, 15, 2, 0),
  /** One more than the photographers below: somebody always shoots nothing. */
  guests: 3,
  /** Newest first, like every other wall. */
  photos: [
    { id: "sample-walk", by: "Kabir", src: "/frames/wedding-walk.jpg" },
    { id: "sample-toast", by: "Meera", src: "/frames/wedding-toast.jpg" },
    { id: "sample-dance", by: "Meera", src: "/frames/wedding-dance.jpg" },
  ],
};

/** The sample's frames in the shape the wall and the album tile both want. */
export const SAMPLE_PHOTOS = SAMPLE_ALBUM.photos.map((photo) => ({
  id: photo.id,
  by: photo.by,
  url: photo.src,
  fullUrl: photo.src,
  blurData: "",
}));
