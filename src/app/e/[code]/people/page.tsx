import { redirect } from "next/navigation";

import { BackButton } from "@/components/roll/Chrome";
import { PersonRow } from "@/components/roll/PersonRow";
import { getGuestContext } from "@/lib/guest-context";
import { listParticipants } from "@/lib/rolls";

export const dynamic = "force-dynamic";

/**
 * Who else is at this roll, for whoever is holding its camera.
 *
 * The host has the same list one screen over, wrapped in the two things only they can do —
 * remove somebody, and raise the cap. There is nothing here a guest cannot already see: every
 * one of these names is printed on the photographs in the album beside it.
 */
export default async function GuestPeoplePage({ params }: PageProps<"/e/[code]/people">) {
  const { code } = await params;

  const context = await getGuestContext(code);
  if (!context) redirect(`/join/${code}`);

  const people = await listParticipants(context.roll.id);

  return (
    <div className="min-h-dvh bg-page">
      <div className="pad-safe-top px-4">
        <BackButton href={`/e/${context.roll.code}/album`} />
      </div>

      <div className="px-5 pt-6 pb-10">
        <h1 className="display-md text-[24px] text-chalk">People</h1>
        <p className="mt-2 text-[14px] text-ash">
          {people.length === 1 ? "1 person has" : `${people.length} people have`} joined this roll.
        </p>

        <ul className="mt-5 divide-y divide-hair border-t border-hair">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} hostSuffix="host" />
          ))}
        </ul>
      </div>
    </div>
  );
}
