import { fromWall } from "./format";

/**
 * One album that belongs to nobody.
 *
 * The Albums tab is empty until a host's first roll has closed, which for most people is days
 * after they sign up — so the screen explained an album in a paragraph rather than showing
 * one. This is one to open instead: three of the shipped frames, shot by two of the three
 * people who were there, on a wedding that ended in February.
 *
 * It is fiction and it never touches the database. Nobody hosts it, so there is no ZIP to
 * build and no Save on it, and there is nothing in it a host could take out.
 */
export const SAMPLE_ALBUM = {
  href: "/albums/sample",
  name: "Priya and Arjun's Wedding",
  startsAt: fromWall(2026, 1, 14, 11, 0),
  finishesAt: fromWall(2026, 1, 15, 2, 0),
  /** One more than the pair below: somebody came and shot nothing, as somebody always does. */
  guests: 3,
  /*
    Newest first, the way every other wall in the app is ordered. Two names across three
    frames — an album is a room full of cameras, and one name on every photograph would be
    the one thing a shared roll never looks like.
  */
  photos: [
    { id: "sample-dance", by: "Meera", src: "/frames/wedding-dance.jpg" },
    { id: "sample-toast", by: "Meera", src: "/frames/wedding-toast.jpg" },
    { id: "sample-walk", by: "Kabir", src: "/frames/wedding-walk.jpg" },
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
