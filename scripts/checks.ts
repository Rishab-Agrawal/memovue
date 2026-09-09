/**
 * The reporting half of the two `verify:*` scripts, written once.
 *
 * Deliberately not `node:assert`, and deliberately not a test runner. These are operator
 * tools pointed at a real database and a real Telegram group, and the thing an operator needs
 * is every answer at once — which topic landed where, which of five guards held. An assertion
 * that throws on the first failure tells you least on the day you most need it, so every
 * check runs and the count is what decides the exit code.
 */
let failures = 0;

export function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${name}${ok || !detail ? "" : `  (${detail})`}`);
}

/** The same, for a value that has to match one. Compared as JSON so shapes work too. */
export function checkEqual(name: string, actual: unknown, expected: unknown): void {
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`,
  );
}

/**
 * The verdict, and the exit code.
 *
 * Call it from `.finally()` rather than the end of `main`: most of the ways these scripts fail
 * are ways that return early, and a check that reports a failure while exiting 0 is a check
 * nothing downstream can act on.
 */
export function verdict(passed = ""): void {
  const pass = `PASS${passed ? ` — ${passed}` : ""}`;
  console.log(`\n${failures === 0 ? pass : `FAIL — ${failures} check(s)`}`);
  if (failures > 0) process.exitCode = 1;
}
