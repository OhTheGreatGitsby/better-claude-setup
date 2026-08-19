import { homedir, platform as osPlatform } from 'node:os'
import { join } from 'node:path'
import type { Platform } from '@shared/types'

/**
 * Every core function takes an Env instead of reading the real home directory itself.
 * Tests pass a temporary directory, so the developer's real Claude configuration is
 * never used as a test target.
 */
export interface CommandOutcome {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandOutcome>

export interface Env {
  home: string
  platform: Platform
  /** Injected so tests can control time deterministically. */
  now: () => Date
  /**
   * Optional stand-in for running an operating-system command. Detection asks Windows and
   * macOS about installed applications, and a test with a fixture home directory would
   * otherwise get answers from the real machine it happens to be running on.
   */
  exec?: CommandRunner
}

export function realEnv(): Env {
  const p = osPlatform()
  const known: Platform = p === 'win32' || p === 'darwin' ? p : 'linux'
  return { home: homedir(), platform: known, now: () => new Date() }
}

/** ~/.claude — shared by Claude Code and the Claude desktop app's Code tab. */
export function claudeHome(env: Env): string {
  return join(env.home, '.claude')
}

export function claudeSettingsPath(env: Env): string {
  return join(claudeHome(env), 'settings.json')
}

export function claudeMdPath(env: Env): string {
  return join(claudeHome(env), 'CLAUDE.md')
}

export function skillsDir(env: Env): string {
  return join(claudeHome(env), 'skills')
}

/** Everything Better Claude Setup owns lives under one directory we can reason about. */
export function appStateDir(env: Env): string {
  return join(claudeHome(env), 'better-claude-setup')
}

export function manifestPath(env: Env): string {
  return join(appStateDir(env), 'manifest.json')
}

export function backupsDir(env: Env): string {
  return join(appStateDir(env), 'backups')
}

export function logsDir(env: Env): string {
  return join(appStateDir(env), 'logs')
}

/** Where the Claude desktop app keeps its local configuration, per platform. */
export function desktopConfigDir(env: Env): string {
  switch (env.platform) {
    case 'win32':
      return join(env.home, 'AppData', 'Roaming', 'Claude')
    case 'darwin':
      return join(env.home, 'Library', 'Application Support', 'Claude')
    default:
      return join(env.home, '.config', 'Claude')
  }
}
