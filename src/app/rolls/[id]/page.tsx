import { WALL_PAGE, loadRoll } from "./loadRoll";
import { RollBackdrop } from "./RollBackdrop";

export const dynamic = "force-dynamic";

/**
 * As far as one link can extend the wall.
 *
 * The wall pages rather than loading a whole wedding at once, and the tap that asks for more
 * is a plain link carrying a number — so the number is a caller's, and gets a ceiling like
 * every other one. Ten pages is twelve hundred frames, past the point where a two-column grid
 * on a phone is a useful way to look at anything; the download button is the answer beyond it.
 */
const WALL_MAX = WALL_PAGE * 10;

/** A number off a URL, or the first page. Anything else — absent, negative, `?photos=NaN`. */
function wanted(raw: string | string[] | undefined): number {
  const asked = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(asked)) return WALL_PAGE;
  return Math.min(Math.max(asked, WALL_PAGE), WALL_MAX);
}

export default async function RollPage({ params, searchParams }: PageProps<"/rolls/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  const shown = wanted(query.photos);
  const { roll, photos, more } = await loadRoll(id, shown);

  return (
    <RollBackdrop
      roll={roll}
      photos={photos}
      moreHref={more ? `/rolls/${id}?photos=${Math.min(shown + WALL_PAGE, WALL_MAX)}` : undefined}
    />
  );
}
