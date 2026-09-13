import Link from "next/link";

import { BottomNav } from "@/components/roll/BottomNav";
import { Cover } from "@/components/roll/Cover";
import { Person } from "@/components/roll/Icons";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/format";
import { type RollCard, coverUrlFor, listRollsForUser } from "@/lib/rolls";
import { SAMPLE_ALBUM, SAMPLE_PHOTOS } from "@/lib/sample-album";
import { requireHost } from "@/lib/session";

export const metadata = { title: "Albums" };
export const dynamic = "force-dynamic";

/** Cells in a tile's mosaic, and the number of previews `listRollsForUser` signs. */
const CELLS = 4;

const destination = (roll: RollCard) =>
  roll.invitedBy ? `/e/${roll.code}` : `/rolls/${roll.id}`;

/** Everything that has finished shooting: a tile per album, a mosaic of its last four frames. */
export default async function AlbumsPage() {
  const user = await requireHost();
  const { albums } = await listRollsForUser(user.id);

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
            <Link key={roll.id} href={destination(roll)} className="block transition-[scale] duration-150 active:scale-[0.97]">
              <Mosaic roll={roll} coverUrl={coverUrlFor(roll)} />

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

          {/* Last, and labelled: one tile you can open teaches more than an empty tab. */}
          <Link href={SAMPLE_ALBUM.href} className="block transition-[scale] duration-150 active:scale-[0.97]">
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

/** The tile: up to four frames from inside the album, or its cover when there are none. */
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

  // As many frames as it was given, never padded; three lays the newest across the top.
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
