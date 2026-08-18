import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { BackupRecord } from '@shared/types'
import { backupsDir, claudeHome } from './env'
import type { Env } from './env'
import { copyDir, ensureDir, pathExists, removeIfExists } from './safe-fs'

/** Files and directories captured before the first modification of a run. */
const CAPTURE = ['settings.json', 'CLAUDE.md', 'skills']

export function backupIdFor(env: Env): string {
  const iso = env.now().toISOString().replace(/[:.]/g, '-')
  return `backup-${iso}`
}

/**
 * Snapshots the parts of ~/.claude that Better Claude Setup can modify. The snapshot is
 * a plain copy on disk, so a user can inspect or restore it by hand without this app.
 */
export async function createBackup(env: Env, reason: string): Promise<BackupRecord> {
  const id = backupIdFor(env)
  const dest = join(backupsDir(env), id)
  await ensureDir(dest)

  const home = claudeHome(env)
  const files: string[] = []

  for (const entry of CAPTURE) {
    const source = join(home, entry)
    if (!(await pathExists(source))) continue
    const target = join(dest, entry)
    const stat = await fs.stat(source)
    if (stat.isDirectory()) {
      await copyDir(source, target)
    } else {
      await ensureDir(dest)
      await fs.copyFile(source, target)
    }
    files.push(entry)
  }

  const record: BackupRecord = {
    id,
    createdAtIso: env.now().toISOString(),
    reason,
    files
  }
  await fs.writeFile(join(dest, 'backup.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return record
}

/**
 * Restores a snapshot. Entries that were absent when the snapshot was taken are removed
 * again, so restore returns the captured surface to exactly its earlier state.
 */
export async function restoreBackup(env: Env, id: string): Promise<string[]> {
  const source = join(backupsDir(env), id)
  if (!(await pathExists(source))) throw new Error(`Backup "${id}" was not found.`)

  const raw = await fs.readFile(join(source, 'backup.json'), 'utf8')
  const record = JSON.parse(raw) as BackupRecord
  const home = claudeHome(env)
  const restored: string[] = []

  for (const entry of CAPTURE) {
    const target = join(home, entry)
    const captured = record.files.includes(entry)
    if (!captured) {
      await removeIfExists(target)
      continue
    }
    await removeIfExists(target)
    const from = join(source, entry)
    const stat = await fs.stat(from)
    if (stat.isDirectory()) {
      await copyDir(from, target)
    } else {
      await ensureDir(home)
      await fs.copyFile(from, target)
    }
    restored.push(entry)
  }

  return restored
}

export async function listBackups(env: Env): Promise<BackupRecord[]> {
  const dir = backupsDir(env)
  if (!(await pathExists(dir))) return []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const records: BackupRecord[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const raw = await fs.readFile(join(dir, entry.name, 'backup.json'), 'utf8')
      records.push(JSON.parse(raw) as BackupRecord)
    } catch {
      // A backup folder without readable metadata is ignored rather than guessed at.
    }
  }
  return records.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso))
}
