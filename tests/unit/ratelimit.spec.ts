import { expect, test } from "@playwright/test";

import {
  AUTOMATED_MESSAGE,
  MIN_FILL_MS,
  MIN_RENDER_MS,
  looksAutomated,
} from "@/lib/bot-check";
import { clientIp, limited, outOfGuesses, rateLimit, wrongGuess } from "@/lib/ratelimit";

/**
 * The parts of the limiter that decide whether it is a limit at all.
 *
 * Counting is the easy half. The two that actually carry weight are *who* a request is
 * attributed to — get that from a header the caller writes and every budget in the app
 * becomes one per request — and *what* spends a budget, since the guessing surfaces are
 * reached from screens a whole venue loads through one router.
 *
 * The buckets are module state shared by everything in this file, so every test uses keys
 * and addresses of its own.
 */

function withHeaders(headers: Record<string, string>): Request {
  return new Request("https://memovue.test/", { headers });
}

test.describe("who a request is attributed to", () => {
  test("reads the header the edge sets", () => {
    expect(clientIp(withHeaders({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  test("ignores x-forwarded-for entirely, at either end of it", () => {
    /*
      Railway does not set XFF, so anything in it came from the caller. Reading it — from
      either end — is what made every IP-keyed budget in the app free: one header per request
      and each one lands in a bucket of its own.

      The last entry is no safer than the first here. It can only be believed because a proxy
      appended it, and a request that reached us without passing through one has nobody who
      could have.
    */
    expect(clientIp(withHeaders({ "x-forwarded-for": "10.0.0.1" }))).toBe("unknown");
    expect(clientIp(withHeaders({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("unknown");

    // And it cannot dilute the address the edge did set.
    const both = withHeaders({ "x-forwarded-for": "10.0.0.1", "x-real-ip": "203.0.113.7" });
    expect(clientIp(both)).toBe("203.0.113.7");
  });

  test("does not invent an address when there is none", () => {
    expect(clientIp(withHeaders({}))).toBe("unknown");
    expect(clientIp(withHeaders({ "x-real-ip": "   " }))).toBe("unknown");
  });

  test("prefers Cloudflare's answer, because that is who the visitor is", () => {
    /*
      memovue.com is proxied through Cloudflare, so the connection Railway accepts comes from
      a Cloudflare machine and `x-real-ip` names that machine rather than the phone. Reading
      it collapsed the whole internet into a handful of buckets — ten wrong roll codes from
      anywhere on earth spent the guess budget for every guest at every event.
    */
    const proxied = withHeaders({ "cf-connecting-ip": "203.0.113.9", "x-real-ip": "172.71.0.1" });
    expect(clientIp(proxied)).toBe("203.0.113.9");

    // And it stays the fallback for a deployment with nothing in front of Railway.
    expect(clientIp(withHeaders({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(withHeaders({ "cf-connecting-ip": "  " , "x-real-ip": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });
});

test.describe("counting", () => {
  test("allows the limit and refuses past it", () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(rateLimit("count-a", 3, 60).ok).toBe(true);
    }

    const refused = rateLimit("count-a", 3, 60);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("keys do not share a budget", () => {
    rateLimit("count-b", 1, 60);
    expect(rateLimit("count-b", 1, 60).ok).toBe(false);
    expect(rateLimit("count-c", 1, 60).ok).toBe(true);
  });

  test("the window expires", async () => {
    expect(rateLimit("count-d", 1, 1).ok).toBe(true);
    expect(rateLimit("count-d", 1, 1).ok).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(rateLimit("count-d", 1, 1).ok).toBe(true);
  });

  test("the route-handler form answers 429 with a retry-after", async () => {
    expect(limited("count-e", 1, 60)).toBeNull();

    const response = limited("count-e", 1, 60);
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await response?.json()).toEqual({ error: "rate_limited" });
  });
});

test.describe("the guessing budget", () => {
  test("a caller who never guesses wrong is never stopped", () => {
    // The whole point: five hundred guests scanning the card on their table share one
    // address, and every code they arrive with exists. Nothing above is ever called for
    // them, so there is no number of honest joins that closes this door.
    expect(outOfGuesses("198.51.100.1")).toBe(false);
  });

  test("ten wrong answers is where it ends", () => {
    const ip = "198.51.100.2";
    for (let attempt = 0; attempt < 9; attempt += 1) {
      wrongGuess(ip);
      expect(outOfGuesses(ip)).toBe(false);
    }

    wrongGuess(ip);
    expect(outOfGuesses(ip)).toBe(true);
  });

  test("one address running out does not stop anybody else", () => {
    const ip = "198.51.100.3";
    for (let attempt = 0; attempt < 10; attempt += 1) wrongGuess(ip);

    expect(outOfGuesses(ip)).toBe(true);
    expect(outOfGuesses("198.51.100.4")).toBe(false);
  });
});

test.describe("telling a script from a person", () => {
  const filledIn = { trap: "", elapsedMs: MIN_FILL_MS + 1 };

  test("lets a person through", () => {
    expect(looksAutomated(filledIn)).toBe(false);
  });

  test("catches anything in the hidden field", () => {
    expect(looksAutomated({ ...filledIn, trap: "https://buy-followers.example" })).toBe(true);
  });

  test("catches a submission that never had the form on screen", () => {
    // What a posted server action looks like: the fields the screen would have carried
    // simply are not there. Zero is the same answer, and is what `useFormAge` reports
    // before its effect has run.
    expect(looksAutomated({})).toBe(true);
    expect(looksAutomated({ trap: "", elapsedMs: 0 })).toBe(true);
    expect(looksAutomated({ trap: "", elapsedMs: Number.NaN })).toBe(true);
  });

  test("catches a form answered faster than anyone could have read it", () => {
    expect(looksAutomated({ ...filledIn, elapsedMs: MIN_FILL_MS - 1 })).toBe(true);
  });

  test("at the door of a roll, any measured time is enough", () => {
    // The guest who taps the instant the page paints is a guest. Refusing them is the worst
    // failure this product has, so the door asks only whether the form rendered at all.
    expect(looksAutomated({ trap: "", elapsedMs: 1 }, MIN_RENDER_MS)).toBe(false);
    expect(looksAutomated({ trap: "", elapsedMs: 0 }, MIN_RENDER_MS)).toBe(true);
    expect(looksAutomated({}, MIN_RENDER_MS)).toBe(true);
    // The hidden field still decides, however long the caller waited.
    expect(looksAutomated({ trap: "x", elapsedMs: 60_000 }, MIN_RENDER_MS)).toBe(true);
  });

  test("says the same thing however it was tripped", () => {
    // Never names the check that failed, and asks for the retry that fixes the only one of
    // them a real person can trip.
    expect(AUTOMATED_MESSAGE).toContain("try again");
  });
});
