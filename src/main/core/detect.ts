import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { release } from 'node:os'
import type { ConfigState, DetectedProduct, DetectionProbe, DetectionResult } from '@shared/types'
import { claudeHome, claudeMdPath, claudeSettingsPath, skillsDir } from './env'
import type { Env } from './env'
import { loadJson } from './json-config'
import { pathExists, readTextIfExists } from './safe-fs'
import { run } from './exec'
import { listBackups } from './backup'
import { loadManifest } from './manifest'
import { SKILLS } from './content'
import { detectClaudeDesktop } from './detect-desktop'

export { detectClaudeDesktop }

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
  foundVia: 'native install' | 'system path'
}

/** Locates the Claude Code executable without modifying anything. */
export async function findClaudeExecutable(env: Env): Promise<ClaudeExecutable | null> {
  const nativeName = env.platform === 'win32' ? 'claude.exe' : 'claude'
  const nativePath = join(env.home, '.local', 'bin', nativeName)
  if (await pathExists(nativePath)) {
    return { path: nativePath, viaCmdShim: false, foundVia: 'native install' }
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
  if (exe) return { path: exe, viaCmdShim: false, foundVia: 'system path' }

  const shim = candidates.find((c) => /\.(cmd|bat)$/i.test(c))
  if (shim) return { path: shim, viaCmdShim: true, foundVia: 'system path' }

  const first = candidates[0]
  if (!first) return null
  return { path: first, viaCmdShim: false, foundVia: 'system path' }
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

export async function detectClaudeCode(env: Env): Promise<DetectedProduct> {
  const probes: DetectionProbe[] = []
  const exe = await findClaudeExecutable(env)

  if (!exe) {
    probes.push({ method: 'Command line tool', found: false, note: 'Not on the system path' })
    return { state: 'not-found', version: null, foundVia: null, location: null, probes }
  }

  probes.push({
    method: 'Command line tool',
    found: true,
    note: exe.foundVia === 'native install' ? 'Installed for your user' : 'Found on the system path'
  })

  const result = await runClaude(env, exe, ['--version'], 20_000)
  // Output looks like "2.1.232 (Claude Code)".
  const version = result.ok ? (result.stdout.match(/\b(\d+\.\d+\.\d+)\b/)?.[1] ?? null) : null

  probes.push({
    method: 'Version check',
    found: Boolean(version),
    note: version ? `Reported ${version}` : 'The program did not report a version'
  })

  return {
    state: 'installed',
    version,
    foundVia: exe.foundVia === 'native install' ? 'User installation' : 'System path',
    location: exe.foundVia === 'native install' ? 'Installed for your user' : 'On the system path',
    probes
  }
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
 * Confirms that what the manifest claims is installed is actually still on disk. A user
 * who deleted a skill folder by hand should see "partly set up", not a clean bill of health.
 */
async function checkInstalledArtifacts(
  env: Env,
  appVersion: string
): Promise<{ present: string[]; missing: string[] }> {
  const manifest = await loadManifest(env, appVersion)
  const present: string[] = []
  const missing: string[] = []

  for (const record of manifest.components) {
    let intact = true
    for (const artifact of record.artifacts) {
      if (artifact.type === 'skill-dir') {
        const name = artifact.relPath.replace(/^skills\//, '')
        if (!(await pathExists(join(skillsDir(env), name, 'SKILL.md')))) intact = false
      }
      if (artifact.type === 'claude-md-block') {
        const text = await readTextIfExists(claudeMdPath(env))
        if (!text || !text.includes(`better-claude-setup:${artifact.blockId}`)) intact = false
      }
    }
    if (intact) present.push(record.componentId)
    else missing.push(record.componentId)
  }

  return { present, missing }
}

function configState(present: string[], missing: string[]): ConfigState {
  if (present.length === 0 && missing.length === 0) return 'not-configured'
  if (missing.length > 0) return 'partial'
  return 'configured'
}

/**
 * Reads the machine's current state. This function only reads; it creates no files and
 * changes no settings, so it is safe to run before the user has agreed to anything.
 *
 * `onStep` reports each stage as it genuinely finishes, so the interface can show real
 * progress rather than a timed animation.
 */
export async function scanSystem(
  env: Env,
  appVersion: string,
  onStep?: (step: string) => void
): Promise<DetectionResult> {
  const home = claudeHome(env)
  const step = (name: string): void => onStep?.(name)

  step('system')
  const platformInfo = { arch: process.arch, osRelease: release() }

  step('claude-code')
  const claudeCode = await detectClaudeCode(env)

  step('claude-desktop')
  const claudeDesktop = await detectClaudeDesktop(env)

  step('configuration')
  const [settings, claudeMd, otherSkills, homeExists] = await Promise.all([
    loadJson(claudeSettingsPath(env)),
    readTextIfExists(claudeMdPath(env)),
    listForeignSkills(env),
    pathExists(home)
  ])

  step('better-claude-setup')
  const [{ present, missing }, backups, manifest] = await Promise.all([
    checkInstalledArtifacts(env, appVersion),
    listBackups(env),
    loadManifest(env, appVersion)
  ])

  step('done')

  return {
    platform: env.platform,
    arch: platformInfo.arch,
    osRelease: platformInfo.osRelease,
    claudeHome: home,
    claudeHomeExists: homeExists,
    claudeCode,
    claudeDesktop,
    existingConfig: {
      found: homeExists,
      settingsJsonExists: settings.exists,
      settingsJsonValid: settings.valid,
      settingsJsonError: settings.error,
      claudeMdExists: claudeMd !== null,
      claudeMdLines: claudeMd ? claudeMd.split('\n').length : 0,
      otherSkills
    },
    betterClaudeSetup: {
      state: configState(present, missing),
      everInstalled: present.length + missing.length > 0,
      installedComponentIds: present,
      missingComponentIds: missing,
      manifestVersion: manifest.components.length > 0 ? manifest.appVersion : null,
      lastRunIso: manifest.components.length > 0 ? manifest.updatedAtIso : null,
      backupCount: backups.length
    },
    scannedAtIso: env.now().toISOString()
  }
}
