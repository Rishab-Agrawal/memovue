import { loadRoll } from "../../loadRoll";
import { EditInfoForm } from "./EditInfoForm";

export const dynamic = "force-dynamic";

export default async function EditInfoPage({ params }: PageProps<"/rolls/[id]/settings/info">) {
  const { id } = await params;
  const { roll } = await loadRoll(id);

  return <EditInfoForm rollId={roll.id} name={roll.name} coverPreset={roll.coverPreset} />;
}
