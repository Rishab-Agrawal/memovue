import { cn } from "@/lib/cn";
import { SAMPLE_ALBUM } from "@/lib/sample-album";

/*
  The sample album drawn live and sealed, so scrolling it to the middle of the screen develops
  every photo at once: the reveal, on the pages that promise it. The motion is in globals.css,
  under `.reveal`. Sized in container units, so it scales like the screenshots beside it.
*/
export function SealedAlbum({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("@container", className)}>
      <div className="reveal aspect-[720/1392] bg-page px-[5cqw] pt-[22cqw]">
        <p className="display-md mx-auto max-w-[72cqw] text-center text-[8.5cqw] text-balance text-chalk">
          {SAMPLE_ALBUM.name}
        </p>

        <p className="mt-[9cqw] flex justify-between border-y border-hair py-[3.5cqw] text-[3.6cqw] text-ash">
          <span>
            <span className="tabular text-chalk">{SAMPLE_ALBUM.photos.length}</span> moments
          </span>
          <span>
            <span className="tabular text-chalk">{SAMPLE_ALBUM.guests}</span> people
          </span>
        </p>

        <div className="mt-[5cqw] grid grid-cols-2 gap-[2.5cqw]">
          {SAMPLE_ALBUM.photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-[4/5] overflow-hidden rounded-[4.5cqw] bg-void"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
              <span className="reveal-seal tabular absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-void/60 px-[3cqw] py-[1.5cqw] text-[3.4cqw] whitespace-nowrap text-chalk">
                Reveals in 1d 2h
              </span>
              <span className="reveal-name marking absolute bottom-[3cqw] left-[3.5cqw] text-[3cqw] text-chalk/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {photo.by}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
