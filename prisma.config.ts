import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js loads .env.local for the app, but the Prisma CLI does not — load it here so
// `prisma migrate` and `prisma studio` see the same DATABASE_URL the app uses.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
