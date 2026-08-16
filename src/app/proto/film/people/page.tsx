import { Sheet } from "../../components/Sheet";
import { PARTICIPANT_CAP, PEOPLE, SHOTS_PER_PERSON, FILM } from "../../mock";
import { FilmBackdrop } from "../FilmBackdrop";

/**
 * The reference opens an "Add Participants" upsell here — three price tiers for raising the
 * cap. We do not sell that, so the same tap answers the question it was really asking:
 * who has actually turned up, and how much film have they used.
 */
export default function People() {
  return (
    <div className="relative min-h-full">
      <FilmBackdrop />

      <Sheet
        title="People"
        subtitle={`${FILM.people} of ${PARTICIPANT_CAP} participants have joined.`}
      >
        <ul className="mt-5 divide-y divide-hair border-t border-hair">
          {PEOPLE.map((person) => (
            <li key={person.name} className="flex items-center justify-between py-4">
              <span className="text-[15px] text-chalk">{person.name}</span>
              <span className="tabular text-[13px] text-dust">
                {person.shotsUsed} of {SHOTS_PER_PERSON} shots used
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
