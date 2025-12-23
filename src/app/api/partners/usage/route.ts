// app/api/partners/usage/route.ts
// Partner usage analytics API

export const dynamic = 'force-dynamic';

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getPartnerFromRequest } from '@/lib/partner/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const partner = await getPartnerFromRequest();

    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get API request logs for this partner
    const apiLogs = await prisma.apiRequestLog.findMany({
      where: {
        partnerId: partner.partnerId,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    // Calculate overview stats
    const totalRequests = apiLogs.length;
    const successfulRequests = apiLogs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
    const averageResponseTime = totalRequests > 0
      ? apiLogs.reduce((sum, l) => sum + l.responseTimeMs, 0) / totalRequests
      : 0;

    // Get cards issued by this partner
    const cardsIssued = await prisma.giftCard.count({
      where: {
        partnerId: partner.partnerId,
        createdAt: { gte: startDate },
      },
    });

    const volumeResult = await prisma.giftCard.aggregate({
      where: {
        partnerId: partner.partnerId,
        createdAt: { gte: startDate },
      },
      _sum: { initialBalance: true },
    });

    // Generate daily usage data
    const dailyMap = new Map<string, { date: string; requests: number; successful: number; failed: number; volume: number }>();

    // Initialize days
    const days = period === '24h' ? 1 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, requests: 0, successful: 0, failed: 0, volume: 0 });
    }

    // Populate with actual data
    for (const log of apiLogs) {
      const dateStr = log.timestamp.toISOString().split('T')[0];
      const day = dailyMap.get(dateStr);
      if (day) {
        day.requests++;
        if (log.statusCode >= 200 && log.statusCode < 300) {
          day.successful++;
        } else {
          day.failed++;
        }
      }
    }

    const dailyUsage = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate top endpoints
    const endpointMap = new Map<string, { requests: number; totalTime: number }>();
    for (const log of apiLogs) {
      const existing = endpointMap.get(log.endpoint) || { requests: 0, totalTime: 0 };
      existing.requests++;
      existing.totalTime += log.responseTimeMs;
      endpointMap.set(log.endpoint, existing);
    }

    const topEndpoints = Array.from(endpointMap.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        requests: data.requests,
        avgResponseTime: data.totalTime / data.requests,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 5);

    // Error breakdown
    const errorMap = new Map<number, { message: string; count: number }>();
    for (const log of apiLogs) {
      if (log.statusCode >= 400) {
        const existing = errorMap.get(log.statusCode) || { message: getStatusMessage(log.statusCode), count: 0 };
        existing.count++;
        errorMap.set(log.statusCode, existing);
      }
    }

    const errorBreakdown = Array.from(errorMap.entries())
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.count - a.count);

    // Recent requests
    const recentRequests = apiLogs.slice(0, 20).map(log => ({
      id: log.id,
      endpoint: log.endpoint,
      method: log.method,
      status: log.statusCode,
      responseTime: log.responseTimeMs,
      timestamp: log.timestamp.toISOString(),
      ip: log.ipAddress,
    }));

    return NextResponse.json({
      overview: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate,
        totalCardsIssued: cardsIssued,
        totalVolume: volumeResult._sum.initialBalance || 0,
        averageResponseTime,
      },
      dailyUsage,
      topEndpoints,
      recentRequests,
      errorBreakdown,
    });
  } catch (error) {
    logger.apiError('Failed to fetch usage data:', error);
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }
}

function getStatusMessage(code: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Rate Limited',
    500: 'Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return messages[code] || 'Error';
}
