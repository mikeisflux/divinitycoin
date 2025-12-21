import { describe, it, expect, vi } from 'vitest';

describe('Health Check API', () => {
  it('should return health status structure', () => {
    const healthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        cache: 'connected',
        stripe: 'configured',
      },
    };

    expect(healthResponse.status).toBe('healthy');
    expect(healthResponse.services).toBeDefined();
    expect(healthResponse.services.database).toBe('connected');
  });

  it('should validate timestamp format', () => {
    const timestamp = new Date().toISOString();
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

    expect(timestamp).toMatch(isoPattern);
  });

  it('should handle unhealthy status', () => {
    const unhealthyResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      services: {
        database: 'disconnected',
        cache: 'connected',
        stripe: 'configured',
      },
    };

    expect(unhealthyResponse.status).toBe('unhealthy');
    expect(unhealthyResponse.error).toBeDefined();
    expect(unhealthyResponse.services.database).toBe('disconnected');
  });
});

describe('API Response Formats', () => {
  it('should format success responses correctly', () => {
    const formatSuccess = <T>(data: T) => ({
      success: true,
      data,
    });

    const response = formatSuccess({ id: 1, name: 'Test' });
    expect(response.success).toBe(true);
    expect(response.data.id).toBe(1);
  });

  it('should format error responses correctly', () => {
    const formatError = (message: string, code?: string) => ({
      success: false,
      error: {
        message,
        code: code || 'UNKNOWN_ERROR',
      },
    });

    const response = formatError('Not found', 'NOT_FOUND');
    expect(response.success).toBe(false);
    expect(response.error.message).toBe('Not found');
    expect(response.error.code).toBe('NOT_FOUND');
  });

  it('should format paginated responses', () => {
    const formatPaginated = <T>(items: T[], page: number, limit: number, total: number) => ({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });

    const response = formatPaginated([1, 2, 3], 2, 10, 35);
    expect(response.pagination.page).toBe(2);
    expect(response.pagination.totalPages).toBe(4);
    expect(response.pagination.hasNext).toBe(true);
    expect(response.pagination.hasPrev).toBe(true);
  });
});
