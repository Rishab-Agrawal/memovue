import { cn } from "@/lib/cn";

/*
  A screenshot of the app, in a phone. Not next/image: fixed local files gain nothing from the
  optimiser. `half` drops the top edge, for screenshots that are themselves crops. Children
  stand in for `src` when the screen is a recording or drawn live. `width` and `height` are the
  file's own, so the frame holds its space before the image arrives. Clipped with `overflow: clip`,
  not hidden: a scroll container would capture the scroll timeline a live screen reads.
*/
export function Phone({
  src,
  width,
  height,
  className,
  half,
  children,
}: {
  src?: string;
  width?: number;
  height?: number;
  className?: string;
  half?: boolean;
  children?: React.ReactNode;
}) {
  const media = cn(
    "block w-full",
    half ? "rounded-b-[1.7rem]" : "rounded-[2.1rem]",
  );

  return (
    <div
      className={cn(
        "overflow-clip border border-hair-bright bg-void p-[3px] shadow-[0_28px_56px_rgba(0,0,0,0.65)]",
        half ? "rounded-b-[1.9rem] border-t-0" : "rounded-[2.3rem]",
        className,
      )}
    >
      {children ? (
        <div className={cn(media, "overflow-clip")}>{children}</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={width} height={height} alt="" className={media} />
      )}
    </div>
  );
}
