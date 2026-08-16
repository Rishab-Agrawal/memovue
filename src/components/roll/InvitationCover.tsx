import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Camera, Clock, Person } from "@/components/roll/Icons";
import { Plate } from "@/components/roll/Plate";

/**
 * The first thing a guest sees. It appears three times — shrunk inside a phone mock on the
 * wizard's card step, full-screen as its preview, and for real on the guest landing — so it
 * is one component with a `mini` scale rather than three drifting copies.
 */
export function InvitationCover({
  coverIndex,
  title,
  hostName,
  countdown,
  shots,
  mini,
  children,
}: {
  coverIndex: number;
  title: string;
  hostName: string;
  countdown: string;
  shots: number;
  mini?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col justify-end overflow-hidden">
      <Plate index={coverIndex} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/45 to-transparent" />

      <div className={cn("relative", mini ? "px-3 pb-3" : "px-5 pb-6")}>
        <div className="flex justify-center">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-void/40 backdrop-blur-sm",
              mini ? "px-2 py-0.5 text-[7px]" : "px-4 py-2 text-[13px]",
            )}
          >
            <Person className={mini ? "h-2 w-2" : "h-4 w-4"} />
            Invited by {hostName}
          </span>
        </div>

        <h2
          className={cn(
            "display mt-3 text-center text-balance text-chalk",
            mini ? "text-[13px]" : "text-[30px]",
          )}
        >
          {title}
        </h2>

        <div
          className={cn(
            "tabular mt-2 flex items-center justify-center text-chalk/75",
            mini ? "gap-2 text-[7px]" : "gap-4 text-[14px]",
          )}
        >
          <span className="flex items-center gap-1.5">
            <Clock className={mini ? "h-2 w-2" : "h-4 w-4"} />
            {countdown}
          </span>
          <span className="flex items-center gap-1.5">
            <Camera className={mini ? "h-2 w-2" : "h-4 w-4"} />
            {shots} shots available
          </span>
        </div>

        <div className={cn(mini ? "mt-3 space-y-1.5" : "mt-6 space-y-3")}>{children}</div>
      </div>
    </div>
  );
}
