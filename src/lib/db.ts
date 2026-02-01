// lib/db.ts
// Singleton Prisma client

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// In production, use event-based logging to filter out connection reset errors
// These are normal when the database restarts and Prisma auto-reconnects
const prismaClientOptions = process.env.NODE_ENV === 'development'
  ? { log: ['query', 'error', 'warn'] as const }
  : {
      log: [
        { level: 'error', emit: 'event' } as const,
      ]
    };

const client = new PrismaClient(prismaClientOptions);

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

export const prisma = globalForPrisma.prisma ?? client;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
