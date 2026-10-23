// prisma.config.ts
// Prisma 7 no longer accepts a connection URL inside schema.prisma. The running
// app connects through the pg driver adapter in src/lib/db.ts; this file exists
// only so the CLI (`prisma db push`, `prisma studio`, `prisma migrate`) knows
// which database to talk to.
//
// The Prisma 7 CLI no longer loads .env by itself, so we do it here. Without
// this, `prisma db push` in scripts/deploy.sh fails with
// `Cannot resolve environment variable: DATABASE_URL`.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
