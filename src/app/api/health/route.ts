import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const timestamp = new Date().toISOString();
  const services: Record<string, string> = {};

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.database = 'connected';
  } catch {
    services.database = 'disconnected';
  }

  // Check Stripe configuration
  services.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured';

  // Check SendGrid configuration
  services.sendgrid = process.env.SENDGRID_API_KEY ? 'configured' : 'not_configured';

  const allHealthy = services.database === 'connected';

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp,
    version: '1.0.0',
    services,
  }, {
    status: allHealthy ? 200 : 503,
  });
}
