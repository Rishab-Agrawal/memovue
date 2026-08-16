"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { BottomNav } from "@/components/roll/BottomNav";
import { Pill } from "@/components/roll/Chrome";
import { Dialog } from "@/components/roll/Dialog";
import { Instagram, Logout, Mail, Pencil, Trash, Warning } from "@/components/roll/Icons";
import { SettingRow } from "@/components/roll/SettingRow";

import { deleteAccountAction, logoutAction, updateNameAction } from "./actions";

/**
 * Two things from the reference are missing on purpose.
 *
 * "Website" sat next to Instagram under SOCIALS — pointless for us, because the thing it
 * would link to is the page you are already on. And the whole PARTNER section, whose only
 * row was "Have a discount code?", is gone: codes are spent when a roll is created, which is
 * the moment they actually apply.
 */
export function AccountScreen({
  name: initialName,
  email,
  initials,
  isAdmin,
}: {
  name: string;
  email: string;
  initials: string;
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
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-6">
        <h1 className="display text-[30px] text-chalk">Settings</h1>

        <section className="mt-6">
          <p className="marking">Info</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="display-md flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-chalk text-[20px] text-void">
              {initials}
            </span>

            {editing ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  aria-label="Your name"
                  autoFocus
                  className="h-16 flex-1 rounded-2xl bg-surface px-4 text-[16px] text-chalk focus:outline-none focus-visible:ring-1 focus-visible:ring-flame"
                />
                <Pill variant="flame" className="h-16 px-5" disabled={pending} onClick={saveName}>
                  Save
                </Pill>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-16 flex-1 items-center justify-between rounded-2xl bg-surface px-4 text-left transition-colors hover:text-flame"
              >
                <span>
                  <span className="block text-[16px] text-chalk">{name}</span>
                  <span className="block text-[13px] text-dust">{email}</span>
                </span>
                <Pencil className="h-4 w-4 text-dust" />
              </button>
            )}
          </div>
        </section>

        <section className="mt-8 border-t border-hair pt-6">
          <p className="marking">Socials</p>
          <div className="mt-3 space-y-2.5">
            <SettingRow
              icon={<Instagram className="h-5 w-5" />}
              label="Instagram"
              href="https://instagram.com"
            />
            <SettingRow
              icon={<Mail className="h-5 w-5" />}
              label="Contact Support"
              href="mailto:hello@memovue.com"
            />
          </div>
        </section>

        {isAdmin ? (
          <section className="mt-8 border-t border-hair pt-6">
            <p className="marking">Admin</p>
            <div className="mt-3">
              <SettingRow
                icon={<Pencil className="h-5 w-5" />}
                label="Coupon codes"
                href="/admin"
              />
            </div>
          </section>
        ) : null}

        <section className="mt-8 border-t border-hair pt-6">
          <p className="marking">Account</p>
          <div className="mt-3 space-y-2.5">
            <button
              type="button"
              onClick={() => startTransition(() => void logoutAction())}
              className="flex h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3.5 text-left text-[15px] text-danger transition-colors"
            >
              <Logout className="h-5 w-5" />
              Logout
            </button>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex h-14 w-full items-center gap-3 rounded-2xl bg-surface px-3.5 text-left text-[15px] text-danger transition-colors"
            >
              <Trash className="h-5 w-5" />
              Delete Account
            </button>
          </div>
        </section>
      </div>

      <BottomNav current="account" />

      <Dialog
        open={confirming}
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
