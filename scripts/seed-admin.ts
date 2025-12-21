// scripts/seed-admin.ts
// Seed initial admin user

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_INITIAL_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    console.error('ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD must be set');
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`Admin user ${email} already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Created admin user: ${admin.email} (${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
