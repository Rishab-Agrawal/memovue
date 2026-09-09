import type { ReactNode } from "react";

/**
 * One person in a roll, on either of the two lists that show them.
 *
 * The host's list and the guest's list are the same roster — the same names, the same film
 * spent — and they had been written twice. What actually differs is two words and a button:
 * the host's own row reads "you" to the host and "host" to everybody else, and only the host
 * is offered a way to take somebody out.
 */
export function PersonRow({
  person,
  hostSuffix,
  action,
}: {
  person: { name: string; isHost: boolean; shotsUsed: number };
  hostSuffix: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-4">
      <span className="flex-1 truncate text-[15px] text-chalk">
        {person.name}
        {person.isHost ? <span className="text-dust"> · {hostSuffix}</span> : null}
      </span>
      <span className="tabular text-[13px] text-dust">{person.shotsUsed} shots used</span>
      {action}
    </li>
  );
}
