// components/admin/BackupSection.tsx
// Client component for server backup and restore functionality

'use client';

import { useState, useRef } from 'react';

export function BackupSection() {
  // Backup state
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');

  // Restore state
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreDatabase, setRestoreDatabase] = useState(true);
  const [restoreConfigs, setRestoreConfigs] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');

    try {
      const response = await fetch('/api/admin/settings/backup', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Backup failed');
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 'divinitycoin-backup.zip';

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupSuccess(`Backup created and downloaded: ${filename}`);
    } catch (err: any) {
      setBackupError(err.message || 'Failed to create backup');
    } finally {
      setBackupLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.zip') && !name.endsWith('.tar.gz')) {
        setRestoreError('Invalid file type. Must be .zip or .tar.gz');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setRestoreError('');
    }
  }

  async function handleRestore() {
    if (!selectedFile) return;

    setRestoreLoading(true);
    setRestoreError('');
    setRestoreSuccess('');
    setShowConfirm(false);

    try {
      const formData = new FormData();
      formData.append('backup', selectedFile);
      formData.append('restoreDatabase', restoreDatabase.toString());
      formData.append('restoreConfigs', restoreConfigs.toString());

      const response = await fetch('/api/admin/settings/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Restore failed');
      }

      // Build success message
      const messages: string[] = [];
      if (data.results?.database) {
        messages.push(`Database: ${data.results.database.message}`);
      }
      if (data.results?.configs) {
        messages.push(`Configs: ${data.results.configs.message}`);
        if (data.results.configs.files?.length) {
          messages.push(`Files restored: ${data.results.configs.files.join(', ')}`);
        }
      }

      setRestoreSuccess(messages.join('\n') || 'Restore completed successfully');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup');
    } finally {
      setRestoreLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Backup Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-neutral-900">Server Backup</h3>
            <p className="text-neutral-600 mt-1 mb-4">
              Download a complete backup of the database and configuration files.
            </p>

            <div className="bg-neutral-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Backup includes:</h4>
              <ul className="text-sm text-neutral-600 space-y-1">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  PostgreSQL database dump (all tables and data)
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Environment configuration files (.env)
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Prisma schema and package.json
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  PM2 ecosystem configuration
                </li>
              </ul>
            </div>

            {backupError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                {backupError}
              </div>
            )}

            {backupSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">
                {backupSuccess}
              </div>
            )}

            <button
              onClick={handleBackup}
              disabled={backupLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {backupLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Backup...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Backup
                </>
              )}
            </button>

            <p className="text-xs text-neutral-500 mt-3">
              Requires SUPER_ADMIN role. Backup creation may take a few minutes for large databases.
            </p>
          </div>
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-neutral-900">Restore from Backup</h3>
            <p className="text-neutral-600 mt-1 mb-4">
              Upload a backup file to restore the database and/or configuration files.
            </p>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Backup File (.zip or .tar.gz)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.tar.gz"
                onChange={handleFileSelect}
                className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile && (
                <p className="mt-2 text-sm text-neutral-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Restore Options */}
            <div className="bg-neutral-50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-3">Restore Options:</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={restoreDatabase}
                    onChange={(e) => setRestoreDatabase(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-neutral-700">
                    Restore Database
                    <span className="text-neutral-500 ml-1">(overwrites existing data)</span>
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={restoreConfigs}
                    onChange={(e) => setRestoreConfigs(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-neutral-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-neutral-700">
                    Restore Config Files
                    <span className="text-neutral-500 ml-1">(.env, package.json, etc.)</span>
                  </span>
                </label>
              </div>
            </div>

            {restoreError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
                {restoreError}
              </div>
            )}

            {restoreSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 whitespace-pre-line">
                {restoreSuccess}
              </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-red-800 mb-2">Confirm Restore</h4>
                <p className="text-sm text-red-700 mb-3">
                  This will overwrite existing data. This action cannot be undone.
                  {restoreDatabase && ' The database will be restored from the backup.'}
                  {restoreConfigs && ' Configuration files will be replaced.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRestore}
                    disabled={restoreLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {restoreLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Restoring...
                      </>
                    ) : (
                      'Yes, Restore Now'
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={restoreLoading}
                    className="px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!showConfirm && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!selectedFile || (!restoreDatabase && !restoreConfigs) || restoreLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restore from Backup
              </button>
            )}

            <p className="text-xs text-neutral-500 mt-3">
              Requires SUPER_ADMIN role. After restoring, you may need to restart the application with <code className="bg-neutral-100 px-1 rounded">pm2 reload divinitycoin</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
