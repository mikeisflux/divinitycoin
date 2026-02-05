// app/api/cron/backup/route.ts
// Automated backup cron endpoint
// Can be triggered by external cron service or system crontab

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, readdir, unlink, stat } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';

const execAsync = promisify(exec);

// Backup storage directory
const BACKUP_STORAGE_DIR = process.env.BACKUP_STORAGE_DIR || '/var/backups/divinitycoin';
const BACKUP_TEMP_DIR = '/tmp/divinitycoin-cron-backups';

// Keep last N backups
const MAX_BACKUPS_TO_KEEP = 4; // ~1 month of weekly backups

// Files to include in backup
const CONFIG_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  'ecosystem.config.js',
  'next.config.js',
  'package.json',
  'prisma/schema.prisma',
];

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If no secret configured, only allow from localhost
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0] || '127.0.0.1';
    return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === cronSecret;
  }

  const secretParam = request.nextUrl.searchParams.get('secret');
  return secretParam === cronSecret;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    logger.warn('Unauthorized cron backup attempt', {
      ip: request.headers.get('x-forwarded-for'),
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;
  const tempBackupPath = path.join(BACKUP_TEMP_DIR, backupName);

  try {
    // Ensure directories exist
    if (!existsSync(BACKUP_TEMP_DIR)) {
      mkdirSync(BACKUP_TEMP_DIR, { recursive: true });
    }
    if (!existsSync(BACKUP_STORAGE_DIR)) {
      mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });
    }
    mkdirSync(tempBackupPath, { recursive: true });

    // Get database URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Parse database URL
    const dbMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!dbMatch) {
      throw new Error('Invalid DATABASE_URL format');
    }

    const [, dbUser, dbPass, dbHost, dbPort, dbName] = dbMatch;
    const sqlDumpPath = path.join(tempBackupPath, 'database.sql');

    // Create database dump
    logger.info('Starting scheduled backup', { backupName });

    try {
      const pgDumpCmd = `PGPASSWORD="${dbPass}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName.split('?')[0]} --no-owner --no-acl -f "${sqlDumpPath}"`;
      await execAsync(pgDumpCmd, { timeout: 600000 }); // 10 minute timeout
    } catch (dbError: any) {
      logger.error('Database dump failed in cron backup:', dbError);
      await writeFile(
        path.join(tempBackupPath, 'database-error.txt'),
        `Database dump failed: ${dbError.message}`
      );
    }

    // Copy config files
    const projectRoot = process.cwd();
    const configDir = path.join(tempBackupPath, 'configs');
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
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Create metadata
    const metadata = {
      createdAt: new Date().toISOString(),
      createdBy: 'cron',
      type: 'scheduled',
      nodeEnv: process.env.NODE_ENV,
      files: includedFiles,
    };
    await writeFile(
      path.join(tempBackupPath, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Create archive in storage directory
    const archivePath = path.join(BACKUP_STORAGE_DIR, `${backupName}.tar.gz`);

    try {
      await execAsync(`cd "${BACKUP_TEMP_DIR}" && tar -czf "${archivePath}" "${backupName}"`, {
        timeout: 120000,
      });
    } catch (tarError) {
      // Try zip as fallback
      const zipPath = path.join(BACKUP_STORAGE_DIR, `${backupName}.zip`);
      await execAsync(`cd "${BACKUP_TEMP_DIR}" && zip -r "${zipPath}" "${backupName}"`, {
        timeout: 120000,
      });
    }

    // Clean up temp directory
    await execAsync(`rm -rf "${tempBackupPath}"`).catch(() => {});

    // Get archive size
    const archiveExists = existsSync(archivePath);
    const finalPath = archiveExists ? archivePath : path.join(BACKUP_STORAGE_DIR, `${backupName}.zip`);
    const archiveStats = await stat(finalPath);
    const sizeMB = (archiveStats.size / (1024 * 1024)).toFixed(2);

    // Clean up old backups (keep only MAX_BACKUPS_TO_KEEP)
    await cleanupOldBackups();

    // Log to database
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'LAST_BACKUP' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            path: finalPath,
            sizeMB,
            status: 'success',
          }),
          updatedAt: new Date(),
        },
        create: {
          key: 'LAST_BACKUP',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            path: finalPath,
            sizeMB,
            status: 'success',
          }),
        },
      });
    } catch {
      // Ignore database logging errors
    }

    logger.info('Scheduled backup completed', {
      backupName,
      path: finalPath,
      sizeMB,
    });

    return NextResponse.json({
      success: true,
      backup: {
        name: backupName,
        path: finalPath,
        sizeMB,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    logger.error('Scheduled backup failed:', error);

    // Clean up on error
    await execAsync(`rm -rf "${tempBackupPath}"`).catch(() => {});

    // Log failure
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'LAST_BACKUP' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message,
          }),
          updatedAt: new Date(),
        },
        create: {
          key: 'LAST_BACKUP',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            status: 'failed',
            error: error.message,
          }),
        },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: 'Backup failed', details: error.message },
      { status: 500 }
    );
  }
}

async function cleanupOldBackups() {
  try {
    const files = await readdir(BACKUP_STORAGE_DIR);
    const backupFiles = files
      .filter(f => f.startsWith('backup-') && (f.endsWith('.tar.gz') || f.endsWith('.zip')))
      .sort()
      .reverse(); // Newest first

    // Delete old backups beyond the limit
    const toDelete = backupFiles.slice(MAX_BACKUPS_TO_KEEP);
    for (const file of toDelete) {
      const filePath = path.join(BACKUP_STORAGE_DIR, file);
      await unlink(filePath);
      logger.info('Deleted old backup', { file });
    }
  } catch (err) {
    logger.warn('Failed to cleanup old backups:', err);
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
