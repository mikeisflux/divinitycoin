// app/api/admin/settings/restore/route.ts
// Server restore API - restores database and configs from backup

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIP, getUserAgent } from '@/lib/admin/middleware';
import { logAdminAction } from '@/lib/admin/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { writeFile, readFile, readdir } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Temporary directory for restore operations
const RESTORE_TEMP_DIR = '/tmp/divinitycoin-restore';

export async function POST(request: NextRequest) {
  // Only SUPER_ADMIN can restore backups
  const { authorized, admin, response } = await requireRole(request, ['SUPER_ADMIN']);

  if (!authorized) {
    return response;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const restorePath = path.join(RESTORE_TEMP_DIR, `restore-${timestamp}`);

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('backup') as File;
    const restoreDatabase = formData.get('restoreDatabase') === 'true';
    const restoreConfigs = formData.get('restoreConfigs') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No backup file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.zip') && !fileName.endsWith('.tar.gz')) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be .zip or .tar.gz' },
        { status: 400 }
      );
    }

    // Ensure temp directory exists
    if (!existsSync(RESTORE_TEMP_DIR)) {
      mkdirSync(RESTORE_TEMP_DIR, { recursive: true });
    }
    mkdirSync(restorePath, { recursive: true });

    // Save uploaded file
    const uploadPath = path.join(restorePath, file.name);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(uploadPath, Buffer.from(arrayBuffer));

    logger.info('Restore started', {
      fileName: file.name,
      restoreDatabase,
      restoreConfigs,
      adminId: admin!.id,
    });

    // Extract the backup
    const extractDir = path.join(restorePath, 'extracted');
    mkdirSync(extractDir, { recursive: true });

    if (fileName.endsWith('.zip')) {
      await execAsync(`unzip -o "${uploadPath}" -d "${extractDir}"`, { timeout: 120000 });
    } else {
      await execAsync(`tar -xzf "${uploadPath}" -C "${extractDir}"`, { timeout: 120000 });
    }

    // Find the backup directory (might be nested)
    const extractedContents = await readdir(extractDir);
    let backupDir = extractDir;

    // If there's a single directory, use that
    if (extractedContents.length === 1) {
      const potentialDir = path.join(extractDir, extractedContents[0]);
      const stat = await import('fs/promises').then(fs => fs.stat(potentialDir));
      if (stat.isDirectory()) {
        backupDir = potentialDir;
      }
    }

    const results: {
      database?: { success: boolean; message: string };
      configs?: { success: boolean; message: string; files?: string[] };
    } = {};

    // Restore database if requested
    if (restoreDatabase) {
      const sqlFile = path.join(backupDir, 'database.sql');

      if (!existsSync(sqlFile)) {
        results.database = {
          success: false,
          message: 'database.sql not found in backup',
        };
      } else {
        try {
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
          const cleanDbName = dbName.split('?')[0];

          // Restore using psql
          const restoreCmd = `PGPASSWORD="${dbPass}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${cleanDbName} -f "${sqlFile}"`;

          await execAsync(restoreCmd, { timeout: 600000 }); // 10 minute timeout

          results.database = {
            success: true,
            message: 'Database restored successfully',
          };
        } catch (dbError: any) {
          logger.error('Database restore failed:', dbError);
          results.database = {
            success: false,
            message: `Database restore failed: ${dbError.message}`,
          };
        }
      }
    }

    // Restore configs if requested
    if (restoreConfigs) {
      const configsDir = path.join(backupDir, 'configs');

      if (!existsSync(configsDir)) {
        results.configs = {
          success: false,
          message: 'configs directory not found in backup',
        };
      } else {
        try {
          const projectRoot = process.cwd();
          const configFiles = await readdir(configsDir);
          const restoredFiles: string[] = [];

          for (const configFile of configFiles) {
            // Convert back from flattened name (e.g., prisma_schema.prisma -> prisma/schema.prisma)
            const originalName = configFile.replace(/_/g, '/');
            const srcPath = path.join(configsDir, configFile);
            const destPath = path.join(projectRoot, originalName);

            // Ensure destination directory exists
            const destDir = path.dirname(destPath);
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true });
            }

            // Read and write the file
            const content = await readFile(srcPath);
            await writeFile(destPath, content);
            restoredFiles.push(originalName);
          }

          results.configs = {
            success: true,
            message: `Restored ${restoredFiles.length} config files`,
            files: restoredFiles,
          };
        } catch (configError: any) {
          logger.error('Config restore failed:', configError);
          results.configs = {
            success: false,
            message: `Config restore failed: ${configError.message}`,
          };
        }
      }
    }

    // Clean up temp files
    try {
      await execAsync(`rm -rf "${restorePath}"`);
    } catch {
      // Ignore cleanup errors
    }

    // Log the restore action
    await logAdminAction(
      admin!.id,
      'BACKUP_RESTORED',
      'system',
      file.name,
      {
        fileName: file.name,
        restoreDatabase,
        restoreConfigs,
        results,
      },
      getClientIP(request),
      getUserAgent(request)
    );

    logger.info('Restore completed', {
      fileName: file.name,
      results,
      adminId: admin!.id,
    });

    return NextResponse.json({
      success: true,
      results,
      message: 'Restore completed. You may need to restart the application for changes to take effect.',
    });

  } catch (error: any) {
    logger.apiError('Restore failed:', error);

    // Clean up on error
    try {
      await execAsync(`rm -rf "${restorePath}"`);
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: 'Restore failed', details: error.message },
      { status: 500 }
    );
  }
}
