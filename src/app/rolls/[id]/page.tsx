import { loadRoll } from "./loadRoll";
import { RollBackdrop } from "./RollBackdrop";

export const dynamic = "force-dynamic";

export default async function RollPage({ params }: PageProps<"/rolls/[id]">) {
  const { id } = await params;
  const { roll, photos } = await loadRoll(id);

  return <RollBackdrop roll={roll} photos={photos} />;
}
