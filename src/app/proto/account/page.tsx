"use client";

import { useSearchParams } from "next/navigation";

import { BottomNav } from "../components/BottomNav";
import { Pill, PillLink } from "../components/Chrome";
import { Dialog } from "../components/Dialog";
import { Instagram, Logout, Mail, Pencil, Trash, Warning } from "../components/Icons";
import { SettingRow } from "../components/SettingRow";
import { HOST } from "../mock";

/**
 * Two things from the reference are missing on purpose.
 *
 * "Website" sat next to Instagram under SOCIALS — pointless for us, because the thing it
 * would link to is the page you are already on. And the whole PARTNER section, whose only
 * row was "Have a discount code?", is gone: codes are entered when a roll is created, which
 * is the moment they actually apply.
 */
export default function AccountSettings() {
  const confirming = useSearchParams().get("v") === "delete";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-6">
        <h1 className="display text-[30px] text-chalk">Settings</h1>

        <section className="mt-6">
          <p className="marking">Info</p>
          <div className="mt-3 flex items-center gap-4">
            <span className="display-md flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-chalk text-[20px] text-void">
              {HOST.initials}
            </span>
            <div className="flex h-16 flex-1 items-center justify-between rounded-2xl bg-surface px-4">
              <span className="text-[16px] text-chalk">{HOST.name}</span>
              <Pencil className="h-4 w-4 text-dust" />
            </div>
          </div>
        </section>

        <section className="mt-8 border-t border-hair pt-6">
          <p className="marking">Socials</p>
          <div className="mt-3 space-y-2.5">
            <SettingRow
              icon={<Instagram className="h-5 w-5" />}
              label="Instagram"
              href="/proto/account"
            />
            <SettingRow
              icon={<Mail className="h-5 w-5" />}
              label="Contact Support"
              href="/proto/account"
            />
          </div>
        </section>

        <section className="mt-8 border-t border-hair pt-6">
          <p className="marking">Account</p>
          <div className="mt-3 space-y-2.5">
            <SettingRow
              icon={<Logout className="h-5 w-5" />}
              label="Logout"
              href="/proto/welcome"
              tone="danger"
            />
            <SettingRow
              icon={<Trash className="h-5 w-5" />}
              label="Delete Account"
              href="/proto/account?v=delete"
              tone="danger"
            />
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
            <PillLink href="/proto/account" variant="quiet" full>
              Cancel
            </PillLink>
            <Pill full className="bg-danger px-4 text-void hover:bg-danger">
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
          Hosted events and account data cannot be recovered after deletion.
        </p>
      </Dialog>
    </div>
  );
}
