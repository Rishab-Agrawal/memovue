import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 takes the connection through a driver adapter rather than the schema file.
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing required environment variable: DATABASE_URL");

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next dev server hot-reloads modules; without the global cache each reload leaks a pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
