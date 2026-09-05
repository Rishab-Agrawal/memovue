import { redirect } from "next/navigation";

import { isOpen } from "@/lib/roll-access";

import { loadRoll } from "../../loadRoll";
import { EditFinishForm } from "./EditFinishForm";

export const dynamic = "force-dynamic";

export default async function EditFinishPage({
  params,
}: PageProps<"/rolls/[id]/settings/finish">) {
  const { id } = await params;
  // No backdrop on this route, so no wall to fill: the roll itself is all it renders.
  const { roll } = await loadRoll(id, 0);

  // An open roll has nothing here to change: the photographs are out, and a close in the
  // future would not put them back. The settings row that leads here is already gone by then;
  // this is for the tab that was left open across the reveal.
  if (isOpen(roll)) redirect(`/rolls/${id}/settings`);

  return <EditFinishForm rollId={roll.id} startsAt={roll.startsAt} finishesAt={roll.finishesAt} />;
}
