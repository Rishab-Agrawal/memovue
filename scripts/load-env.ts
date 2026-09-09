/**
 * `.env` and `.env.local`, for everything that runs outside Next.
 *
 * Next loads these itself; the cron scripts, the Prisma CLI and the Playwright setup do not,
 * and each of them had carried its own three-line copy of the same preamble. Imported for its
 * side effect and imported first, so the variables are in place before anything else in the
 * file is evaluated — `src/lib/env.ts` and `src/lib/prisma.ts` both read `process.env` the
 * moment they load and throw on what is missing.
 *
 * Node's own loader rather than dotenv, with one difference that has to be undone: dotenv
 * leaves a variable already in the environment alone, `loadEnvFile` overwrites it. So what is
 * really set — on a deployment, that is everything — is snapshotted and put back on top.
 * Between the two files `.env.local` wins by going second. A file that is not there is the
 * normal case, not a failure.
 */
const real = { ...process.env };

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* No such file. */
  }
}

Object.assign(process.env, real);
