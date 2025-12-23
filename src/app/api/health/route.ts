import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const timestamp = new Date().toISOString();

  // Check database connection
  let dbHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  // SECURITY: Only expose minimal health information
  // Do NOT reveal which services are configured (reconnaissance risk)
  return NextResponse.json({
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp,
  }, {
    status: dbHealthy ? 200 : 503,
  });
}
