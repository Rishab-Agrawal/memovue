import { cn } from "@/lib/cn";

/**
 * The mechanical frame counter off the back of a disposable camera: the number either side
 * of the current one is half-visible at the edges, so the dial reads as something that turns
 * rather than as a label that changes.
 */
export function Counter({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn(
        "tabular relative flex h-14 w-24 items-center justify-center overflow-hidden rounded-2xl bg-void",
        className,
      )}
    >
      {/* Ascending left to right, like the dial on the reference's camera. */}
      <span className="absolute left-1 text-[15px] text-dust/50 italic">
        {Math.max(0, value - 1)}
      </span>
      <span className="text-[22px] font-medium text-chalk italic" data-testid="shots-left">
        {value}
      </span>
      <span className="absolute right-1 text-[15px] text-dust/50 italic">{value + 1}</span>
    </div>
  );
}
