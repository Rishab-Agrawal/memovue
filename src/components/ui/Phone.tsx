import { cn } from "@/lib/cn";

/*
  A screenshot of the app, in a phone. Not next/image: fixed local files gain nothing from the
  optimiser. `half` drops the top edge, for screenshots that are themselves crops.
*/
export function Phone({
  src,
  className,
  half,
}: {
  src: string;
  className?: string;
  half?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden border border-hair-bright bg-void p-[3px] shadow-[0_28px_56px_rgba(0,0,0,0.65)]",
        half ? "rounded-b-[1.9rem] border-t-0" : "rounded-[2.3rem]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={cn(
          "block w-full",
          half ? "rounded-b-[1.7rem]" : "rounded-[2.1rem]",
        )}
      />
    </div>
  );
}
