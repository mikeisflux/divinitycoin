// app/api/admin/settings/backup/route.ts
// Server backup API - creates downloadable backup of database and configs

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Temporary directory for backups
const BACKUP_DIR = '/tmp/divinitycoin-backups';

// Files to include in backup (relative to project root)
const CONFIG_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'ecosystem.config.js',
  'next.config.js',
  'package.json',
  'prisma/schema.prisma',
];

export async function POST(request: NextRequest) {
  // Only SUPER_ADMIN can create backups
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `divinitycoin-backup-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  try {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }
    mkdirSync(backupPath, { recursive: true });

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'Database URL not configured' },
        { status: 500 }
      );
    }

    // Parse database URL for pg_dump
    const dbMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!dbMatch) {
      return NextResponse.json(
        { error: 'Invalid database URL format' },
        { status: 500 }
      );
    }

    const [, dbUser, dbPass, dbHost, dbPort, dbName] = dbMatch;
    const sqlDumpPath = path.join(backupPath, 'database.sql');

    // Create database dump using pg_dump
    const pgDumpCmd = `PGPASSWORD="${dbPass}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName.split('?')[0]} --no-owner --no-acl -f "${sqlDumpPath}"`;

    try {
      await execAsync(pgDumpCmd, { timeout: 300000 }); // 5 minute timeout
    } catch (dbError: any) {
      logger.error('Database dump failed:', dbError);
      // Continue without database dump if pg_dump fails
      await writeFile(
        path.join(backupPath, 'database-error.txt'),
        `Database dump failed: ${dbError.message}\n\nYou may need to install postgresql-client or check database connectivity.`
      );
    }

    // Copy config files
    const projectRoot = process.cwd();
    const configDir = path.join(backupPath, 'configs');
    mkdirSync(configDir, { recursive: true });

    const includedFiles: string[] = [];
    for (const configFile of CONFIG_FILES) {
      const srcPath = path.join(projectRoot, configFile);
      if (existsSync(srcPath)) {
        try {
          const content = await readFile(srcPath);
          const destPath = path.join(configDir, configFile.replace(/\//g, '_'));
          await writeFile(destPath, content);
          includedFiles.push(configFile);
        } catch (err) {
          // Skip files that can't be read
        }
      }
    }

    // Create backup metadata
    const metadata = {
      createdAt: new Date().toISOString(),
      createdBy: admin!.email,
      nodeEnv: process.env.NODE_ENV,
      hostname: process.env.HOSTNAME || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
      files: includedFiles,
    };
    await writeFile(
      path.join(backupPath, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Create zip archive using system zip command
    const zipPath = `${backupPath}.zip`;

    try {
      await execAsync(`cd "${BACKUP_DIR}" && zip -r "${backupName}.zip" "${backupName}"`, { timeout: 60000 });
    } catch (zipError: any) {
      // Try tar.gz as fallback if zip is not available
      try {
        await execAsync(`cd "${BACKUP_DIR}" && tar -czf "${backupName}.tar.gz" "${backupName}"`, { timeout: 60000 });
        const tarPath = `${backupPath}.tar.gz`;
        const tarBuffer = await readFile(tarPath);

        // Clean up
        await execAsync(`rm -rf "${backupPath}" "${tarPath}"`).catch(() => {});

        await logAdminAction(
          admin!.id,
          'BACKUP_CREATED',
          'system',
          backupName,
          { backupName, timestamp, format: 'tar.gz' },
          getClientIP(request),
          getUserAgent(request)
        );

        return new NextResponse(tarBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/gzip',
            'Content-Disposition': `attachment; filename="${backupName}.tar.gz"`,
            'Content-Length': tarBuffer.length.toString(),
          },
        });
      } catch (tarError) {
        throw new Error(`Failed to create archive: zip and tar both failed`);
      }
    }

    // Read the zip file for response
    const zipBuffer = await readFile(zipPath);

    // Clean up temporary files
    try {
      await execAsync(`rm -rf "${backupPath}" "${zipPath}"`);
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    // Log the backup action
    await logAdminAction(
      admin!.id,
      'BACKUP_CREATED',
      'system',
      backupName,
      { backupName, timestamp, format: 'zip' },
      getClientIP(request),
      getUserAgent(request)
    );

    logger.info('Backup created successfully', { backupName, adminId: admin!.id });

    // Return the zip file as a download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${backupName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    logger.apiError('Backup creation failed:', error);

    // Clean up on error
    try {
      await execAsync(`rm -rf "${backupPath}" "${backupPath}.zip" "${backupPath}.tar.gz"`);
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    );
  }
}

// GET endpoint to check backup status/info
export async function GET(request: NextRequest) {
  const { authorized, response } = await requireRole(request, ['SUPER_ADMIN', 'ADMIN']);

  if (!authorized) {
    return response;
  }

  return NextResponse.json({
    available: true,
    description: 'Creates a full backup including database dump and configuration files',
    includes: [
      'PostgreSQL database dump (all tables)',
      'Environment configuration files (.env)',
      'Prisma schema',
      'Package configuration',
      'PM2 ecosystem config',
    ],
    requiresRole: 'SUPER_ADMIN',
  });
}
