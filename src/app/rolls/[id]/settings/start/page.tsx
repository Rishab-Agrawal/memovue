import { redirect } from "next/navigation";

import { loadRoll } from "../../loadRoll";
import { EditStartForm } from "./EditStartForm";

export const dynamic = "force-dynamic";

export default async function EditStartPage({ params }: PageProps<"/rolls/[id]/settings/start">) {
  const { id } = await params;
  // No backdrop on this route, so no wall to fill: the roll itself is all it renders.
  const { roll } = await loadRoll(id, 0);

  // A roll that has begun has nothing here to change — guests are already shooting it, and the
  // settings row that leads here is gone by then. This is for the tab left open across the
  // start, and for anyone who typed the address.
  if (roll.startsAt <= new Date()) redirect(`/rolls/${id}/settings`);

  return (
    <EditStartForm rollId={roll.id} startsAt={roll.startsAt} finishesAt={roll.finishesAt} />
  );
}
