import { expect, test } from "@playwright/test";

import { GUEST_COOKIE_PREFIX, staleGuestCookies } from "@/lib/guest-cookies";

/**
 * A browser carries one guest cookie per roll it has joined, at four hundred days each, and
 * sends all of them on every request. Something has to evict, and the thing being checked
 * here is that it evicts the *oldest few* rather than, on some off-by-one, everything a guest
 * holds — which would be a person walked out of every album they were in at once.
 */

/** A JWT-shaped string whose payload carries `iat`. Only the middle segment is ever read. */
function token(iat: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: "g", ev: "e", iat })).toString("base64url");
  return `header.${payload}.signature`;
}

function jar(count: number, from = 1_000) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${GUEST_COOKIE_PREFIX}R${index}`,
    value: token(from + index),
  }));
}

test.describe("evicting guest cookies", () => {
  test("leaves a browser under the limit alone", () => {
    expect(staleGuestCookies(jar(5), "mv_g_NEW")).toEqual([]);
  });

  test("keeps twenty in total, counting the one just set", () => {
    // Nineteen others plus the new one is exactly the limit, so nothing goes.
    expect(staleGuestCookies(jar(19), "mv_g_NEW")).toEqual([]);
    // Twenty others would make twenty-one, so the oldest one goes.
    expect(staleGuestCookies(jar(20), "mv_g_NEW")).toEqual([`${GUEST_COOKIE_PREFIX}R0`]);
  });

  test("drops the oldest first, and only the excess", () => {
    const dropped = staleGuestCookies(jar(25), "mv_g_NEW");
    expect(dropped).toEqual(
      [0, 1, 2, 3, 4, 5].map((index) => `${GUEST_COOKIE_PREFIX}R${index}`),
    );
  });

  test("never evicts the cookie just written, however old the rest are", () => {
    const held = [...jar(30), { name: "mv_g_NEW", value: token(0) }];
    expect(staleGuestCookies(held, "mv_g_NEW")).not.toContain("mv_g_NEW");
  });

  test("leaves other cookies where they are", () => {
    const held = [
      ...jar(25),
      { name: "mv_host", value: token(1) },
      { name: "mv_oauth_state", value: "not-a-jwt" },
    ];
    const dropped = staleGuestCookies(held, "mv_g_NEW");
    expect(dropped.every((name) => name.startsWith(GUEST_COOKIE_PREFIX))).toBe(true);
  });

  test("an unreadable token sorts oldest rather than throwing", () => {
    const held = [{ name: `${GUEST_COOKIE_PREFIX}BAD`, value: "garbage" }, ...jar(20)];
    expect(staleGuestCookies(held, "mv_g_NEW")[0]).toBe(`${GUEST_COOKIE_PREFIX}BAD`);
  });
});
