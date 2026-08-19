import { promises as fs } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Env } from '../src/main/core/env'

/**
 * Every test runs against a throwaway home directory. The developer's real ~/.claude is
 * never read or written by the test suite.
 */
export function makeTempEnv(platform: Env['platform'] = 'linux'): Env {
  const home = mkdtempSync(join(tmpdir(), 'bcs-test-'))
  let tick = 0
  return {
    home,
    platform,
    // Deterministic clock so backup ids and timestamps are stable across runs.
    now: () => new Date(Date.UTC(2026, 0, 1, 12, 0, tick++))
  }
}

export async function cleanup(env: Env | undefined): Promise<void> {
  if (!env) return
  await fs.rm(env.home, { recursive: true, force: true })
}

/** An Env whose operating-system queries always come back empty. */
export function withNoInstalledApps(env: Env): Env {
  return {
    ...env,
    exec: async () => ({ ok: false, exitCode: 1, stdout: '', stderr: '' })
  }
}

/** An Env whose operating-system queries return the supplied output. */
export function withCommandOutput(
  env: Env,
  respond: (command: string, args: string[]) => string | null
): Env {
  return {
    ...env,
    exec: async (command, args) => {
      const stdout = respond(command, args)
      return stdout === null
        ? { ok: false, exitCode: 1, stdout: '', stderr: '' }
        : { ok: true, exitCode: 0, stdout, stderr: '' }
    }
  }
}

export async function writeFile(env: Env, relPath: string, contents: string): Promise<string> {
  const full = join(env.home, relPath)
  await fs.mkdir(join(full, '..'), { recursive: true })
  await fs.writeFile(full, contents, 'utf8')
  return full
}

export async function readFile(env: Env, relPath: string): Promise<string> {
  return fs.readFile(join(env.home, relPath), 'utf8')
}

export async function exists(env: Env, relPath: string): Promise<boolean> {
  try {
    await fs.stat(join(env.home, relPath))
    return true
  } catch {
    return false
  }
}
