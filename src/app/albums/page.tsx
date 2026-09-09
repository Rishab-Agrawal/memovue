import Link from "next/link";

import { BottomNav } from "@/components/roll/BottomNav";
import { Cover } from "@/components/roll/Cover";
import { Person } from "@/components/roll/Icons";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/format";
import { type RollCard, coverUrlsFor, listRollsForUser } from "@/lib/rolls";
import { SAMPLE_ALBUM, SAMPLE_PHOTOS } from "@/lib/sample-album";
import { requireHost } from "@/lib/session";

export const metadata = { title: "Albums" };
export const dynamic = "force-dynamic";

/** Cells in a tile's mosaic, and the number of previews `listRollsForUser` signs. */
const CELLS = 4;

const destination = (roll: RollCard) =>
  roll.invitedBy ? `/e/${roll.code}` : `/rolls/${roll.id}`;

/**
 * Everything that has finished shooting, on a screen of its own.
 *
 * A tile per album in two columns, each one a mosaic of the last four frames in it. The
 * fanned stack of prints this replaces put four photographs on top of each other to save the
 * horizontal room a shared screen did not have; with the screen to itself there is no reason
 * to hide three quarters of every picture, so none of them are hidden.
 */
export default async function AlbumsPage() {
  const user = await requireHost();
  const { albums } = await listRollsForUser(user.id);
  const covers = coverUrlsFor(albums);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-[calc(var(--safe-top)+2rem)] pb-8">
        <h1 className="display text-[30px] text-chalk">Albums</h1>
        <p className="mt-2 text-[14px] text-dust">
          {albums.length === 0
            ? "Completed rolls show up here"
            : `${albums.length} ${albums.length === 1 ? "roll" : "rolls"}, finished`}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6">
          {albums.map((roll) => (
            <Link key={roll.id} href={destination(roll)} className="block">
              <Mosaic roll={roll} coverUrl={covers.get(roll.id)} />

              <p className="display-sm mt-2.5 line-clamp-2 text-[15px] text-chalk">
                {roll.name}
              </p>
              <p className="tabular mt-0.5 text-[12px] text-dust">
                {formatRange(roll.startsAt, roll.finishesAt)}
              </p>
              {roll.invitedBy ? (
                <p className="mt-1 flex items-center gap-1 text-[12px] text-dust">
                  <Person className="h-3 w-3 shrink-0" />
                  <span className="truncate">{roll.invitedBy}</span>
                </p>
              ) : null}
            </Link>
          ))}

          {/*
            Last, and labelled. It is somebody else's evening — an empty tab explaining an
            album in a paragraph teaches less than one tile you can open, and a host with
            albums of their own still gets theirs first.
          */}
          <Link href={SAMPLE_ALBUM.href} className="block">
            <Mosaic
              roll={{ thumbs: SAMPLE_PHOTOS.map((photo) => photo.url), coverPreset: 1 }}
            />

            <p className="display-sm mt-2.5 line-clamp-2 text-[15px] text-chalk">
              {SAMPLE_ALBUM.name}
            </p>
            <p className="tabular mt-0.5 text-[12px] text-dust">
              {formatRange(SAMPLE_ALBUM.startsAt, SAMPLE_ALBUM.finishesAt)}
            </p>
            <p className="mt-1 text-[12px] text-ash">Sample</p>
          </Link>
        </div>
      </div>

      <BottomNav current="albums" />
    </div>
  );
}

/**
 * The tile: four frames from inside the album, or its cover when there are none to show.
 *
 * A sealed album, or one nobody put a frame in, has no previews signed for it — so it falls
 * back to the cover the host chose rather than to stock photography, which would tell them
 * their guests' pictures had loaded when they had not.
 */
function Mosaic({
  roll,
  coverUrl,
}: {
  /** Only the two fields a tile draws, so the sample can be one without being a roll. */
  roll: Pick<RollCard, "thumbs" | "coverPreset">;
  coverUrl?: string | null;
}) {
  if (roll.thumbs.length === 0) {
    return (
      <Cover
        url={coverUrl}
        preset={roll.coverPreset}
        className="aspect-square w-full rounded-2xl"
      />
    );
  }

  /*
    The tile takes however many frames it was given rather than padding to four. Repeating a
    photograph to fill the grid says the album holds two of something it holds one of, and
    filling the gap with a wash puts a "you can't see this yet" tile inside an album that is
    open. Three lays the newest across the top, which is the only arrangement of three that
    isn't a hole.
  */
  const shown = roll.thumbs.slice(0, CELLS);
  const shape =
    shown.length === 1
      ? "grid-cols-1 grid-rows-1"
      : shown.length === 2
        ? "grid-cols-2 grid-rows-1"
        : "grid-cols-2 grid-rows-2";

  return (
    <div className={cn("grid aspect-square w-full gap-px overflow-hidden rounded-2xl bg-hair", shape)}>
      {shown.map((url, index) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={url}
          src={url}
          alt=""
          className={cn(
            "h-full w-full min-h-0 object-cover",
            shown.length === 3 && index === 0 && "col-span-2",
          )}
        />
      ))}
    </div>
  );
}
