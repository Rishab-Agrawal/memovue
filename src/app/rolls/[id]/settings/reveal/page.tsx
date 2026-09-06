import { redirect } from "next/navigation";

import { isOpen } from "@/lib/roll-access";

import { loadRoll } from "../../loadRoll";
import { EditRevealForm } from "./EditRevealForm";

export const dynamic = "force-dynamic";

export default async function EditRevealPage({
  params,
}: PageProps<"/rolls/[id]/settings/reveal">) {
  const { id } = await params;
  // No backdrop on this route, so no wall to fill: the roll itself is all it renders.
  const { roll } = await loadRoll(id, 0);

  // An open roll has nothing here to change: the photographs are out, and a reveal in the
  // future would not put them back. The settings row that leads here is already gone by then.
  if (isOpen(roll)) redirect(`/rolls/${id}/settings`);

  return (
    <EditRevealForm
      rollId={roll.id}
      finishesAt={roll.finishesAt}
      revealMode={roll.revealMode}
      delayHours={roll.revealDelayHours}
    />
  );
}
