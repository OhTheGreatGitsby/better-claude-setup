import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { logsDir } from './env'
import type { Env } from './env'
import { ensureDir, pathExists } from './safe-fs'
import { sanitize } from './sanitize'

export type LogLevel = 'info' | 'warn' | 'error'

const MAX_LOG_BYTES = 512 * 1024

/**
 * Appends a sanitised line to the local diagnostic log. Nothing leaves the machine and
 * every value passes through sanitize first, so home paths, usernames, email addresses
 * and anything token-shaped never reach disk.
 */
export async function log(env: Env, level: LogLevel, message: string): Promise<void> {
  try {
    const dir = logsDir(env)
    await ensureDir(dir)
    const file = join(dir, 'better-claude-setup.log')
    await rotateIfLarge(file)
    const line = `${env.now().toISOString()} ${level.toUpperCase()} ${sanitize(message, env)}\n`
    await fs.appendFile(file, line, 'utf8')
  } catch {
    // Logging must never break the operation it is describing.
  }
}

async function rotateIfLarge(file: string): Promise<void> {
  if (!(await pathExists(file))) return
  const stat = await fs.stat(file)
  if (stat.size < MAX_LOG_BYTES) return
  await fs.rm(`${file}.1`, { force: true })
  await fs.rename(file, `${file}.1`)
}

export async function readLog(env: Env): Promise<string> {
  const file = join(logsDir(env), 'better-claude-setup.log')
  if (!(await pathExists(file))) return ''
  return fs.readFile(file, 'utf8')
}
