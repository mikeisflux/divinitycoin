// app/api/admin/inbox/attachments/[id]/route.ts
// Download email attachments

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/admin/middleware';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN', 'SUPPORT']);
  if (!authorized) return response;

  try {
    const attachment = await prisma.emailAttachment.findUnique({
      where: { id: params.id },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // If we have a direct URL, redirect to it
    if (attachment.url) {
      return NextResponse.redirect(attachment.url);
    }

    // If we have a storage key, serve from local storage
    if (attachment.storageKey) {
      const filePath = path.join(process.cwd(), 'uploads', 'attachments', attachment.storageKey);

      try {
        const fileBuffer = await readFile(filePath);

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': attachment.contentType,
            'Content-Disposition': `attachment; filename="${attachment.filename}"`,
            'Content-Length': String(attachment.size),
          },
        });
      } catch {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Attachment has no file data' }, { status: 404 });
  } catch (error) {
    console.error('Failed to fetch attachment:', error);
    return NextResponse.json({ error: 'Failed to fetch attachment' }, { status: 500 });
  }
}
