import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { release } from 'node:os'
import type { DetectionResult } from '@shared/types'
import { claudeHome, claudeMdPath, claudeSettingsPath, desktopConfigDir, skillsDir } from './env'
import type { Env } from './env'
import { loadJson } from './json-config'
import { pathExists, readTextIfExists } from './safe-fs'
import { run } from './exec'
import { listBackups } from './backup'
import { loadManifest } from './manifest'
import { SKILLS } from './content'

/**
 * How Claude Code can be launched on this machine.
 *
 * On Windows an npm global install provides `claude.cmd`, which Node refuses to execute
 * directly since the 2024 command-injection fix. In that case we launch it through
 * cmd.exe with a fully resolved path and fixed arguments — never a composed string.
 */
export interface ClaudeExecutable {
  path: string
  viaCmdShim: boolean
  foundVia: 'native-install' | 'PATH'
}

const WIN_DESKTOP_CANDIDATES = [
  ['AppData', 'Local', 'AnthropicClaude', 'claude.exe'],
  ['AppData', 'Local', 'Programs', 'Claude', 'Claude.exe'],
  ['AppData', 'Local', 'Claude', 'Claude.exe']
]

const MAC_DESKTOP_CANDIDATES = [['Applications', 'Claude.app']]
const MAC_SYSTEM_DESKTOP = '/Applications/Claude.app'
const LINUX_DESKTOP_CANDIDATES = ['/opt/Claude/claude-desktop', '/usr/bin/claude-desktop']

/** Locates the Claude Code executable without modifying anything. */
export async function findClaudeExecutable(env: Env): Promise<ClaudeExecutable | null> {
  const nativeName = env.platform === 'win32' ? 'claude.exe' : 'claude'
  const nativePath = join(env.home, '.local', 'bin', nativeName)
  if (await pathExists(nativePath)) {
    return { path: nativePath, viaCmdShim: false, foundVia: 'native-install' }
  }

  const locator = env.platform === 'win32' ? 'where.exe' : 'which'
  const result = await run(env, locator, ['claude'], { timeoutMs: 10_000 })
  if (!result.ok) return null

  const candidates = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  // Prefer a real executable over a shim, so we can avoid cmd.exe when possible.
  const exe = candidates.find((c) => /\.exe$/i.test(c))
  if (exe) return { path: exe, viaCmdShim: false, foundVia: 'PATH' }

  const shim = candidates.find((c) => /\.(cmd|bat)$/i.test(c))
  if (shim) return { path: shim, viaCmdShim: true, foundVia: 'PATH' }

  const first = candidates[0]
  if (!first) return null
  return { path: first, viaCmdShim: false, foundVia: 'PATH' }
}

/** Runs the Claude Code CLI with a fixed argument list. Nothing user-typed reaches here. */
export async function runClaude(
  env: Env,
  exe: ClaudeExecutable,
  args: string[],
  timeoutMs = 120_000
): ReturnType<typeof run> {
  if (exe.viaCmdShim) {
    return run(env, 'cmd.exe', ['/d', '/s', '/c', exe.path, ...args], { timeoutMs })
  }
  return run(env, exe.path, args, { timeoutMs })
}

export async function detectClaudeCodeVersion(env: Env): Promise<{
  installed: boolean
  version: string | null
  foundVia: string | null
}> {
  const exe = await findClaudeExecutable(env)
  if (!exe) return { installed: false, version: null, foundVia: null }

  const result = await runClaude(env, exe, ['--version'], 20_000)
  if (!result.ok) return { installed: true, version: null, foundVia: exe.foundVia }

  // Output looks like "2.1.232 (Claude Code)".
  const match = result.stdout.match(/\b(\d+\.\d+\.\d+)\b/)
  return { installed: true, version: match?.[1] ?? null, foundVia: exe.foundVia }
}

export async function detectClaudeDesktop(
  env: Env
): Promise<{ installed: boolean; configDirExists: boolean }> {
  const configDirExists = await pathExists(desktopConfigDir(env))

  let installed = false
  if (env.platform === 'win32') {
    for (const parts of WIN_DESKTOP_CANDIDATES) {
      if (await pathExists(join(env.home, ...parts))) {
        installed = true
        break
      }
    }
  } else if (env.platform === 'darwin') {
    if (await pathExists(MAC_SYSTEM_DESKTOP)) installed = true
    if (!installed) {
      for (const parts of MAC_DESKTOP_CANDIDATES) {
        if (await pathExists(join(env.home, ...parts))) {
          installed = true
          break
        }
      }
    }
  } else {
    for (const candidate of LINUX_DESKTOP_CANDIDATES) {
      if (await pathExists(candidate)) {
        installed = true
        break
      }
    }
  }

  return { installed, configDirExists }
}

/** Skill directories present that this app did not create. */
export async function listForeignSkills(env: Env): Promise<string[]> {
  const dir = skillsDir(env)
  if (!(await pathExists(dir))) return []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const ours = new Set(Object.keys(SKILLS))
  return entries
    .filter((e) => e.isDirectory() && !ours.has(e.name))
    .map((e) => e.name)
    .sort()
}

/**
 * Reads the machine's current state. This function only reads; it creates no files and
 * changes no settings, so it is safe to run before the user has agreed to anything.
 */
export async function scanSystem(env: Env, appVersion: string): Promise<DetectionResult> {
  const home = claudeHome(env)
  const [claudeCode, claudeDesktop, settings, claudeMd, otherSkills, manifest, backups] =
    await Promise.all([
      detectClaudeCodeVersion(env),
      detectClaudeDesktop(env),
      loadJson(claudeSettingsPath(env)),
      readTextIfExists(claudeMdPath(env)),
      listForeignSkills(env),
      loadManifest(env, appVersion),
      listBackups(env)
    ])

  return {
    platform: env.platform,
    arch: process.arch,
    osRelease: release(),
    claudeHome: home,
    claudeHomeExists: await pathExists(home),
    claudeCode,
    claudeDesktop,
    existingConfig: {
      settingsJsonExists: settings.exists,
      settingsJsonValid: settings.valid,
      settingsJsonError: settings.error,
      claudeMdExists: claudeMd !== null,
      claudeMdLines: claudeMd ? claudeMd.split('\n').length : 0,
      otherSkills
    },
    betterClaudeSetup: {
      everInstalled: manifest.components.length > 0,
      installedComponentIds: manifest.components.map((c) => c.componentId),
      manifestVersion: manifest.components.length > 0 ? manifest.appVersion : null,
      lastRunIso: manifest.components.length > 0 ? manifest.updatedAtIso : null,
      backupCount: backups.length
    },
    scannedAtIso: env.now().toISOString()
  }
}
