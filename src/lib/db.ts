// lib/db.ts
// Singleton Prisma client

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 connects through a driver adapter rather than its own engine, so the
// connection string is read here instead of in schema.prisma. Building the
// client lazily matters now: the adapter opens a real pg pool, and the previous
// shape constructed one on every module evaluation even when the cached global
// was the one actually used.
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

  // In production, use event-based logging to filter out connection reset errors
  // These are normal when the database restarts and Prisma auto-reconnects
  const client = new PrismaClient(
    process.env.NODE_ENV === 'development'
      ? { adapter, log: ['query', 'error', 'warn'] }
      : { adapter, log: [{ level: 'error', emit: 'event' }] }
  );

  // In production, filter out expected connection errors (database restarts)
  if (process.env.NODE_ENV === 'production') {
    (client as any).$on('error', (e: { message: string }) => {
      // Ignore connection termination errors (database restarts, maintenance)
      // Error 57P01 = admin_shutdown, 57P02 = crash_shutdown, 57P03 = cannot_connect_now
      if (e.message?.includes('57P01') ||
          e.message?.includes('terminating connection') ||
          e.message?.includes('administrator command')) {
        // Silently ignore - Prisma will auto-reconnect
        return;
      }
      // Log other errors normally
      console.error('prisma:error', e.message);
    });
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
