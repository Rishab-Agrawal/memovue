"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { BottomNav } from "@/components/roll/BottomNav";
import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Instagram, Logout, Mail, Pencil, Trash, Warning } from "@/components/roll/Icons";
import { SettingRow } from "@/components/roll/SettingRow";

import { deleteAccountAction, logoutAction, updateNameAction } from "./actions";

/** The two red rows, which are the same shape as a `SettingRow` but act rather than lead. */
const danger =
  "flex h-14 w-full items-center gap-3.5 border-b border-hair-bright/60 text-left text-[15px] text-danger last:border-b-0";

/**
 * Your own screen.
 *
 * It opens on the person rather than on the word "Settings" over a white circle of initials,
 * and the rows below are separated by hairlines rather than each being its own filled tile —
 * which is what this app's own first design rule asks for and what the version copied from
 * the reference was ignoring.
 *
 * Two of the reference's sections never existed here. "Website" sat next to Instagram —
 * pointless for us, because the thing it would link to is the page you are already on. And
 * the PARTNER section, whose only row was "Have a discount code?", has nothing to hold:
 * access hangs on the address you signed in with, so there is nothing for anyone to type.
 */
export function AccountScreen({
  name: initialName,
  email,
  isAdmin,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const saveName = () => {
    startTransition(async () => {
      await updateNameAction({ name });
      setEditing(false);
    });
  };

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-[calc(var(--safe-top)+2rem)] pb-6">
        {/*
          The person is the heading, not the word "Settings" over a white circle holding their
          initials. This screen is reached from a tab called You: it should open with who you
          are, at the size everything else on this app gives to the thing it is about.
        */}
        <section>
          <div className="flex items-start gap-4">
            {editing ? (
              /* A real form, so the phone keyboard's Go key submits it — and a way back out,
                 which a field whose only exit was Save did not have. */
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  saveName();
                }}
                className="flex flex-1 items-center gap-2"
              >
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-label="Your name"
                  autoFocus
                  className="h-16 min-w-0 flex-1 rounded-2xl bg-surface px-4 text-[16px] text-chalk focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
                />
                <Pill type="submit" variant="flame" className="h-16 px-5" disabled={pending}>
                  Save
                </Pill>
                <Pill
                  type="button"
                  variant="quiet"
                  aria-label="Cancel"
                  className="h-16 w-12 px-0"
                  disabled={pending}
                  onClick={() => {
                    setName(initialName);
                    setEditing(false);
                  }}
                >
                  ✕
                </Pill>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit your name"
                className="group flex flex-1 items-start justify-between gap-4 text-left"
              >
                <span className="min-w-0">
                  <span className="display block truncate text-[32px] text-chalk">{name}</span>
                  <span className="mt-1 block truncate text-[14px] text-dust">{email}</span>
                </span>
                <Pencil className="mt-2.5 h-5 w-5 shrink-0 text-dust transition-colors group-hover:text-flame" />
              </button>
            )}
          </div>
        </section>

        <section className="mt-10">
          <p className="marking">Support</p>
          <div className="mt-1">
            <SettingRow
              icon={<Instagram className="h-5 w-5" />}
              label="Instagram"
              // The account itself, not the front door — this row went to whichever profile
              // the phone happened to be logged into.
              value="@memovue.official"
              href="https://instagram.com/memovue.official"
            />
            <SettingRow
              icon={<Mail className="h-5 w-5" />}
              label="Contact support"
              href="mailto:hello@memovue.com"
            />
          </div>
        </section>

        {isAdmin ? (
          <section className="mt-9">
            <p className="marking">Admin</p>
            <div className="mt-1">
              <SettingRow
                icon={<Pencil className="h-5 w-5" />}
                label="Beta access"
                href="/admin"
              />
            </div>
          </section>
        ) : null}

        <section className="mt-9">
          <p className="marking">Account</p>
          <div className="mt-1">
            <button
              type="button"
              onClick={() => startTransition(() => void logoutAction())}
              className={danger}
            >
              <Logout className="h-5 w-5" />
              Log out
            </button>

            <button type="button" onClick={() => setConfirming(true)} className={danger}>
              <Trash className="h-5 w-5" />
              Delete account
            </button>
          </div>
        </section>
      </div>

      <BottomNav current="account" />

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={
          <span className="flex flex-col items-center gap-3 text-center">
            <Warning className="h-8 w-8 text-danger" />
            Delete Account?
          </span>
        }
        actions={
          <>
            <Pill variant="quiet" full onClick={() => setConfirming(false)}>
              Cancel
            </Pill>
            <Pill
              full
              disabled={pending}
              className="bg-danger px-4 text-void hover:bg-danger"
              onClick={() => startTransition(() => void deleteAccountAction())}
            >
              Delete Account
            </Pill>
          </>
        }
      >
        <p className="text-chalk">This will permanently delete:</p>
        <ul className="mt-3 space-y-2 pl-4">
          {[
            "Your account and profile",
            "All rolls you created will be permanently deleted and cannot be recovered",
            "Your participation in other events will no longer be attached to your account",
          ].map((line) => (
            <li key={line} className="list-disc">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-danger">
          Hosted rolls and account data cannot be recovered after deletion.
        </p>
      </Dialog>

      <Link href="/" className="sr-only">
        MemoVue
      </Link>
    </div>
  );
}
