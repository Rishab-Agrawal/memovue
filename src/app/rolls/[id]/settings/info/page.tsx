import { requireHost } from "@/lib/session";

import { loadRoll } from "../../loadRoll";
import { EditInfoForm } from "./EditInfoForm";

export const dynamic = "force-dynamic";

export default async function EditInfoPage({ params }: PageProps<"/rolls/[id]/settings/info">) {
  const { id } = await params;
  // No backdrop on this route, so no wall to fill: the roll itself is all it renders.
  const [{ roll }, user] = await Promise.all([loadRoll(id, 0), requireHost()]);

  return (
    <EditInfoForm
      rollId={roll.id}
      name={roll.name}
      coverPreset={roll.coverPreset}
      coverUrl={roll.coverUrl}
      // What the invitation preview needs beyond the pair being edited. The roll already
      // holds its own answers to these, so unlike the wizard's they are not guesses.
      hostName={user.name}
      finishesAt={roll.finishesAt}
      shots={roll.photosPerGuest}
    />
  );
}
