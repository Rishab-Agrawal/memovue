"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Trash } from "@/components/roll/Icons";

import { adjustAccessAction, grantAccessAction, revokeAccessAction } from "./actions";

export interface AccessRow {
  id: string;
  email: string;
  rollsLeft: number;
}

/**
 * The beta list: an address, and how many rolls are left to it.
 *
 * Zero and removed refuse the person identically — both land on the request form — but they
 * are different intentions, so both are here. Zero is somebody we let in who has spent what
 * they were given, one tap from being topped up. Removed is a row we would rather not keep.
 *
 * Removing asks first. The bin sits a thumb's width from the − that is safe to tap all day,
 * and an admin who meant to take one roll off somebody should not lose the row instead.
 */
export function AccessList({ rows }: { rows: AccessRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AccessRow | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () => {
    setError(null);
    startTransition(async () => {
      const result = await grantAccessAction({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail("");
      router.refresh();
    });
  };

  const adjust = (id: string, delta: 1 | -1) => {
    startTransition(async () => {
      await adjustAccessAction({ id, delta });
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await revokeAccessAction({ id });
      setRemoving(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mt-8 rounded-2xl bg-surface p-5">
        <label className="block">
          <span className="marking">Email address</span>
          <input
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="name@example.com"
            aria-label="Email address"
            onKeyDown={(event) => {
              if (event.key === "Enter" && email.trim()) add();
            }}
            className="mt-2 h-12 w-full rounded-2xl bg-void px-4 text-[15px] text-chalk placeholder:text-dust focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
          />
        </label>

        <Pill
          variant="flame"
          full
          className="mt-4"
          disabled={pending || !email.trim()}
          onClick={add}
        >
          {pending ? "Saving…" : "Allow this address"}
        </Pill>

        {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
      </div>

      <section className="mt-10">
        <p className="marking">Allowed · {rows.length}</p>

        {rows.length === 0 ? (
          <p className="mt-3 text-[14px] text-dust">Nobody but you can create a roll yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1 truncate text-[15px] text-chalk">{row.email}</span>

                <div className="flex shrink-0 items-center gap-1">
                  <Step
                    label={`One fewer roll for ${row.email}`}
                    disabled={pending || row.rollsLeft === 0}
                    onClick={() => adjust(row.id, -1)}
                  >
                    −
                  </Step>
                  <span
                    className="tabular w-8 text-center text-[16px] text-chalk"
                    aria-label={`${row.rollsLeft} rolls left for ${row.email}`}
                  >
                    {row.rollsLeft}
                  </span>
                  <Step
                    label={`One more roll for ${row.email}`}
                    disabled={pending}
                    onClick={() => adjust(row.id, 1)}
                  >
                    +
                  </Step>

                  <button
                    type="button"
                    aria-label={`Remove ${row.email}`}
                    disabled={pending}
                    onClick={() => setRemoving(row)}
                    className="ml-2 flex h-9 w-9 items-center justify-center rounded-full text-dust transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={removing !== null}
        title="Remove this address?"
        actions={
          <>
            <Pill variant="quiet" full disabled={pending} onClick={() => setRemoving(null)}>
              Cancel
            </Pill>
            <Pill
              full
              disabled={pending}
              className="bg-danger text-void hover:bg-danger"
              onClick={() => removing && remove(removing.id)}
            >
              {pending ? "Removing…" : "Remove"}
            </Pill>
          </>
        }
      >
        <p className="break-all">{removing?.email}</p>
        <p className="mt-2">
          They lose the {removing?.rollsLeft} roll{removing?.rollsLeft === 1 ? "" : "s"} left to
          them and are shown the request form again. Rolls they have already created stay where
          they are.
        </p>
      </Dialog>
    </>
  );
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-hair-bright text-[18px] text-chalk transition-colors hover:text-flame disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
