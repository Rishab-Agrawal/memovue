import { expect, test } from "@playwright/test";

import { r2Bill, requestClass } from "@/lib/cost";

/**
 * The half of the cost watch that can be wrong without looking wrong.
 *
 * Fetching is not the risk: a broken query throws, and the watch says out loud that it has
 * gone blind. The risk is the arithmetic in between, because a free tier applied to the wrong
 * quantity or a class of request charged at the other of two rates that differ by twelve
 * times produces a perfectly plausible dollar figure — and the only symptom is an alarm that
 * rings on the wrong month, months from now, about a bill nobody can reconcile.
 *
 * No network, no bucket, no token. `cost.ts` takes its credentials as an argument precisely so
 * this file can exist.
 */

const NOTHING = { gb: 0, classA: 0, classB: 0 };

test.describe("what R2 charges", () => {
  test("is nothing at all inside the free allowances", () => {
    expect(r2Bill(NOTHING)).toBe(0);
    // A whisker under every limit at once, which is where this app lives today.
    expect(r2Bill({ gb: 9.99, classA: 999_999, classB: 9_999_999 })).toBe(0);
  });

  /**
   * The allowance is subtracted, not switched off. Getting this wrong the other way — billing
   * the whole quantity the moment it crosses — reads as a sudden bill for nothing changing.
   */
  test("charges only the excess once an allowance is passed", () => {
    expect(r2Bill({ ...NOTHING, gb: 11 })).toBeCloseTo(0.015, 10);
    expect(r2Bill({ ...NOTHING, classA: 2_000_000 })).toBeCloseTo(4.5, 10);
    expect(r2Bill({ ...NOTHING, classB: 11_000_000 })).toBeCloseTo(0.36, 10);
  });

  test("adds the three up rather than taking the largest", () => {
    expect(r2Bill({ gb: 110, classA: 3_000_000, classB: 20_000_000 })).toBeCloseTo(
      100 * 0.015 + 2 * 4.5 + 10 * 0.36,
      10,
    );
  });

  test("never returns a negative for an account well under every allowance", () => {
    expect(r2Bill({ gb: 0.0001, classA: 12, classB: 3 })).toBe(0);
  });
});

test.describe("which price a request is charged at", () => {
  test("prices the operations this app actually performs", () => {
    // Every photograph: one presigned PutObject in, one GetObject out on a cache miss.
    expect(requestClass("PutObject")).toBe("A");
    expect(requestClass("GetObject")).toBe("B");
    // The album ZIP and the sweep.
    expect(requestClass("ListObjects")).toBe("A");
    expect(requestClass("HeadObject")).toBe("B");
    expect(requestClass("DeleteObject")).toBe("free");
    // Multipart, which `lib-storage` uses for anything large.
    expect(requestClass("CreateMultipartUpload")).toBe("A");
    expect(requestClass("UploadPart")).toBe("A");
    expect(requestClass("CompleteMultipartUpload")).toBe("A");
    expect(requestClass("AbortMultipartUpload")).toBe("free");
  });

  /**
   * The whole reason this is a rule rather than a list. Cloudflare adds operations over time,
   * and one this has never heard of must land on the dearer of the two prices — an estimate
   * that is too high sets the alarm off early, an estimate that is too low is the alarm not
   * going off at all.
   */
  test("charges an operation it has never heard of at the dearer rate", () => {
    expect(requestClass("LifecycleStorageTierTransition")).toBe("A");
    expect(requestClass("SomethingCloudflareAddsIn2027")).toBe("A");
  });
});

/*
  There is nothing here about the Railway thresholds, because there are none in the repo to
  test — they are read live off the account on every run. See the note at the top of `cost.ts`.
*/
