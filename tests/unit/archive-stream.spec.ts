import { expect, test } from "@playwright/test";
import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";

/**
 * Why the download route pipes its archive through a `PassThrough`.
 *
 * Archiver builds on `readable-stream`, the userland copy of Node's streams, so an archive's
 * prototype chain reads `Transform -> Duplex -> Readable` while being no relation to the
 * `Readable` in `node:stream`. Anything that duck-types accepts it — which is why streaming a
 * download to the browser always worked — and anything that checks the constructor does not.
 * The S3 SDK's multipart upload checks, so every archive built into R2 died with "Body Data is
 * unsupported format" and the host got a 500 where their album should have been.
 *
 * Nothing here imports the route: it needs a database, a bucket and a settled roll. What it
 * pins is the assumption underneath it, so if archiver's stream identity ever changes, or the
 * bridge is removed as redundant, this says so rather than a host discovering it.
 */
test.describe("the archive stream", () => {
  test("is not the Readable the S3 client is looking for", () => {
    const archive = new ZipArchive({ zlib: { level: 0 } });
    try {
      // Named like one, related to one, not one.
      expect(archive.constructor.name).toBe("ZipArchive");
      expect(archive instanceof Readable).toBe(false);
    } finally {
      archive.abort();
    }
  });

  test("becomes one when piped through a PassThrough", () => {
    const archive = new ZipArchive({ zlib: { level: 0 } });
    try {
      expect(archive.pipe(new PassThrough()) instanceof Readable).toBe(true);
    } finally {
      archive.abort();
    }
  });

  /** `pipe` forwards data and not errors, which is why the route wires them across by hand. */
  test("a failed build has to be forwarded, or it looks like a finished one", async () => {
    const archive = new ZipArchive({ zlib: { level: 0 } });
    const out = new PassThrough();
    archive.on("error", (error: Error) => out.destroy(error));
    archive.pipe(out);

    const ended = new Promise<string>((resolve) => {
      out.on("error", (error: Error) => resolve(`error: ${error.message}`));
      out.on("end", () => resolve("ended cleanly"));
    });
    out.resume();

    archive.emit("error", new Error("R2 went away"));
    expect(await ended).toBe("error: R2 went away");
  });
});
