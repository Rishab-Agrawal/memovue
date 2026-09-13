import { fromWall } from "./format";

/**
 * One album that belongs to nobody, so the Albums tab has something to open before a host's
 * first roll closes. Fiction: it never touches the database.
 */

/** The film on the sample's camera, and what its invitation promises. */
export const SAMPLE_SHOTS = 21;

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
