import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { DetectedProduct, DetectionProbe } from '@shared/types'
import { desktopConfigDir } from './env'
import type { Env } from './env'
import { pathExists, readTextIfExists } from './safe-fs'
import { run } from './exec'

/**
 * Finding the Claude desktop application.
 *
 * Version 1.0.0 checked three hard-coded per-user directories and reported "not found"
 * for everything else. That was wrong: on Windows the app is commonly delivered as an
 * MSIX package, which installs under C:\Program Files\WindowsApps. That directory is
 * ACL-locked, so it cannot be listed by an ordinary process at all — the check could
 * never have succeeded for an MSIX install no matter how many paths were added.
 *
 * The fix is to ask the operating system's own installed-application records instead of
 * guessing at paths, and to keep the path checks only as a fallback for the plain
 * installer. Each route records a probe so the interface can show its working.
 */

/** Registry location where Windows records every installed app package, readable per user. */
const APPX_REPOSITORY =
  'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages'

const UNINSTALL_KEYS = [
  'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
]

/** Plain-installer locations, kept as a fallback for non-package installs. */
const WINDOWS_EXE_CANDIDATES = [
  ['AppData', 'Local', 'AnthropicClaude', 'claude.exe'],
  ['AppData', 'Local', 'Programs', 'Claude', 'Claude.exe'],
  ['AppData', 'Local', 'Claude', 'Claude.exe']
]

const MAC_APP_PATHS = ['/Applications/Claude.app']
const MAC_USER_APP = ['Applications', 'Claude.app']
const LINUX_CANDIDATES = [
  '/opt/Claude/claude-desktop',
  '/usr/bin/claude-desktop',
  '/usr/lib/claude-desktop/claude-desktop'
]

function probe(method: string, found: boolean, note: string): DetectionProbe {
  return { method, found, note }
}

function notFound(probes: DetectionProbe[]): DetectedProduct {
  return { state: 'not-found', version: null, foundVia: null, location: null, probes }
}

export async function detectClaudeDesktop(env: Env): Promise<DetectedProduct> {
  switch (env.platform) {
    case 'win32':
      return detectOnWindows(env)
    case 'darwin':
      return detectOnMac(env)
    default:
      return detectOnLinux(env)
  }
}

async function detectOnWindows(env: Env): Promise<DetectedProduct> {
  const probes: DetectionProbe[] = []

  // 1. App packages (MSIX / Microsoft Store). This is the route that matters most,
  //    because the package directory itself is unreadable without elevation.
  const appx = await run(env, 'reg.exe', ['query', APPX_REPOSITORY, '/f', 'Claude', '/k'], {
    timeoutMs: 15_000
  })
  if (appx.ok) {
    const packageName = findClaudePackage(appx.stdout)
    if (packageName) {
      probes.push(probe('Windows app packages', true, `Package ${packageName.family}`))
      return {
        state: 'installed',
        version: packageName.version,
        foundVia: 'Windows app packages',
        location: 'Installed as a Windows app package',
        probes
      }
    }
    probes.push(probe('Windows app packages', false, 'No Claude package registered'))
  } else {
    probes.push(probe('Windows app packages', false, 'Package records could not be read'))
  }

  // 2. Installed-programs records, which cover the standalone installer.
  for (const key of UNINSTALL_KEYS) {
    const result = await run(env, 'reg.exe', ['query', key, '/s', '/v', 'DisplayName'], {
      timeoutMs: 20_000
    })
    if (!result.ok) continue
    const entry = findClaudeUninstallEntry(result.stdout)
    if (entry) {
      probes.push(probe('Windows installed programs', true, entry))
      return {
        state: 'installed',
        version: null,
        foundVia: 'Windows installed programs',
        location: 'Listed in installed programs',
        probes
      }
    }
  }
  probes.push(probe('Windows installed programs', false, 'No Claude entry listed'))

  // 3. Known installer paths.
  for (const parts of WINDOWS_EXE_CANDIDATES) {
    if (await pathExists(join(env.home, ...parts))) {
      const where = parts.slice(0, -1).join('/')
      probes.push(probe('Application folder', true, where))
      return {
        state: 'installed',
        version: null,
        foundVia: 'Application folder',
        location: where,
        probes
      }
    }
  }
  probes.push(probe('Application folder', false, 'Not in the usual install folders'))

  // 4. Start menu shortcut, which survives some unusual install layouts.
  const startMenu = join(
    env.home,
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  )
  if (await hasClaudeShortcut(startMenu)) {
    probes.push(probe('Start menu', true, 'Shortcut present'))
    return {
      state: 'installed',
      version: null,
      foundVia: 'Start menu',
      location: 'Start menu shortcut',
      probes
    }
  }
  probes.push(probe('Start menu', false, 'No shortcut'))

  return withLeftoverConfigCheck(env, probes)
}

async function detectOnMac(env: Env): Promise<DetectedProduct> {
  const probes: DetectionProbe[] = []
  const candidates = [...MAC_APP_PATHS, join(env.home, ...MAC_USER_APP)]

  for (const bundle of candidates) {
    if (!(await pathExists(bundle))) continue
    const label = bundle.startsWith(env.home) ? 'Your Applications folder' : 'Applications folder'
    probes.push(probe('Applications folder', true, label))
    return {
      state: 'installed',
      version: await readMacBundleVersion(bundle),
      foundVia: 'Applications folder',
      location: label,
      probes
    }
  }
  probes.push(probe('Applications folder', false, 'No Claude.app in Applications'))

  // Spotlight finds bundles installed somewhere unusual. Matching on the bundle's file
  // name avoids guessing at an identifier that may change between releases.
  const spotlight = await run(env, 'mdfind', ['kMDItemFSName == "Claude.app"'], {
    timeoutMs: 15_000
  })
  if (spotlight.ok) {
    const bundle = spotlight.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.endsWith('Claude.app'))
    if (bundle) {
      probes.push(probe('Spotlight', true, 'Found outside the Applications folder'))
      return {
        state: 'installed',
        version: await readMacBundleVersion(bundle),
        foundVia: 'Spotlight',
        location: 'Outside the Applications folder',
        probes
      }
    }
  }
  probes.push(probe('Spotlight', false, 'Spotlight found no Claude app'))

  return withLeftoverConfigCheck(env, probes)
}

async function detectOnLinux(env: Env): Promise<DetectedProduct> {
  const probes: DetectionProbe[] = []
  for (const candidate of LINUX_CANDIDATES) {
    if (await pathExists(candidate)) {
      probes.push(probe('Installed package', true, candidate))
      return {
        state: 'installed',
        version: null,
        foundVia: 'Installed package',
        location: candidate,
        probes
      }
    }
  }
  probes.push(probe('Installed package', false, 'No Claude desktop package found'))
  return withLeftoverConfigCheck(env, probes)
}

/**
 * A configuration directory without an application means the app ran here at some point.
 * That is reported as uncertain rather than as either a yes or a no, because both would
 * be a guess.
 */
async function withLeftoverConfigCheck(
  env: Env,
  probes: DetectionProbe[]
): Promise<DetectedProduct> {
  const configDir = desktopConfigDir(env)
  if (await pathExists(configDir)) {
    probes.push(probe('Leftover settings', true, 'Settings from the Claude app are present'))
    return {
      state: 'uncertain',
      version: null,
      foundVia: 'Leftover settings only',
      location: null,
      probes
    }
  }
  probes.push(probe('Leftover settings', false, 'No Claude app settings folder'))
  return notFound(probes)
}

/** Parses `Claude_1.32352.1.0_x64__abc123` out of reg.exe key output. */
export function findClaudePackage(
  registryOutput: string
): { family: string; version: string | null } | null {
  const lines = registryOutput.split(/\r?\n/)
  for (const line of lines) {
    const key = line.trim().split('\\').pop() ?? ''
    // Package full names look like Name_Version_Architecture__PublisherHash.
    const match = /^Claude_(\d+(?:\.\d+)*)_[^_]+__([A-Za-z0-9]+)$/.exec(key)
    if (match) {
      return { family: `Claude_${match[2]}`, version: match[1] ?? null }
    }
    if (/^Claude_[^_]*__[A-Za-z0-9]+$/.test(key)) {
      return { family: key, version: null }
    }
  }
  return null
}

/**
 * Finds a Claude desktop entry in installed-programs output while rejecting entries that
 * merely mention Claude, such as this application itself or the command line tool.
 */
export function findClaudeUninstallEntry(registryOutput: string): string | null {
  const lines = registryOutput.split(/\r?\n/)
  for (const line of lines) {
    const match = /DisplayName\s+REG_SZ\s+(.+)$/.exec(line.trim())
    if (!match) continue
    const name = (match[1] ?? '').trim()
    if (!/^claude\b/i.test(name)) continue
    if (/better claude|claude code|claude cli/i.test(name)) continue
    return name
  }
  return null
}

async function hasClaudeShortcut(startMenuDir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(startMenuDir, { withFileTypes: true, recursive: true })
    return entries.some(
      (entry) => entry.isFile() && /^claude(\s|\.)/i.test(entry.name) && entry.name.endsWith('.lnk')
    )
  } catch {
    return false
  }
}

/** Reads CFBundleShortVersionString from an app bundle without running anything. */
async function readMacBundleVersion(bundlePath: string): Promise<string | null> {
  const plist = await readTextIfExists(join(bundlePath, 'Contents', 'Info.plist'))
  if (!plist) return null
  const match = /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)
  return match?.[1]?.trim() ?? null
}
