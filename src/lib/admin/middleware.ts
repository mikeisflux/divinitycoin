// lib/admin/middleware.ts
// Admin route protection middleware

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, AdminUser } from './auth';

export interface AdminContext {
  admin: AdminUser;
  token: string;
}

export async function requireAdmin(
  request: NextRequest
): Promise<{ authorized: boolean; admin?: AdminUser; response?: NextResponse }> {
  const token = request.cookies.get('admin_session')?.value;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const admin = await validateAdminSession(token);

  if (!admin) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, admin };
}

export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ authorized: boolean; admin?: AdminUser; response?: NextResponse }> {
  const result = await requireAdmin(request);

  if (!result.authorized) {
    return result;
  }

  if (!allowedRoles.includes(result.admin!.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      ),
    };
  }

  return result;
}

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}
