import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { listForeignSkills, scanSystem } from '../src/main/core/detect'
import {
  detectClaudeDesktop,
  findClaudePackage,
  findClaudeUninstallEntry
} from '../src/main/core/detect-desktop'
import { desktopConfigDir, skillsDir } from '../src/main/core/env'
import type { Env } from '../src/main/core/env'
import { installComponents } from '../src/main/core/installer'
import {
  cleanup,
  exists,
  makeTempEnv,
  withCommandOutput,
  withNoInstalledApps,
  writeFile
} from './helpers'

const VERSION = '1.1.0'
let env: Env

afterEach(async () => {
  await cleanup(env)
})

/**
 * The failure this suite exists for: version 1.0.0 looked only in three per-user folders
 * and so reported "not found" for a Claude desktop app installed as a Windows app
 * package, which lives in an ACL-locked system directory that cannot be listed at all.
 */
describe('Windows app package records', () => {
  const REAL_REG_OUTPUT = [
    '',
    'HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages\\Claude_1.32352.1.0_x64__pzs8sxrjxfjjc',
    'End of search: 1 match(es) found.',
    ''
  ].join('\r\n')

  it('reads the package name and version out of the registry listing', () => {
    const found = findClaudePackage(REAL_REG_OUTPUT)
    expect(found).not.toBeNull()
    expect(found?.version).toBe('1.32352.1.0')
    expect(found?.family).toBe('Claude_pzs8sxrjxfjjc')
  })

  it('handles an ARM64 package', () => {
    const output =
      '    HKEY_CURRENT_USER\\...\\Packages\\Claude_1.4.0.0_arm64__pzs8sxrjxfjjc\r\nEnd of search: 1 match(es) found.'
    expect(findClaudePackage(output)?.version).toBe('1.4.0.0')
  })

  it('does not match a different vendor package that merely contains the word', () => {
    const output =
      '    HKEY_CURRENT_USER\\...\\Packages\\ClaudeCompanion_2.0.0.0_x64__abcdefghijklm'
    expect(findClaudePackage(output)).toBeNull()
  })

  it('returns null when the search found nothing', () => {
    expect(findClaudePackage('End of search: 0 match(es) found.')).toBeNull()
  })
})

describe('Windows installed-programs records', () => {
  it('finds a Claude desktop entry', () => {
    const output = [
      'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Claude',
      '    DisplayName    REG_SZ    Claude'
    ].join('\r\n')
    expect(findClaudeUninstallEntry(output)).toBe('Claude')
  })

  it('does not mistake this application for the Claude desktop app', () => {
    const output = '    DisplayName    REG_SZ    Better Claude Setup'
    expect(findClaudeUninstallEntry(output)).toBeNull()
  })

  it('does not mistake the command line tool for the desktop app', () => {
    const output = '    DisplayName    REG_SZ    Claude Code'
    expect(findClaudeUninstallEntry(output)).toBeNull()
  })

  it('ignores unrelated programs', () => {
    const output = [
      '    DisplayName    REG_SZ    Visual Studio Code',
      '    DisplayName    REG_SZ    Not Claude Related'
    ].join('\r\n')
    expect(findClaudeUninstallEntry(output)).toBeNull()
  })
})

describe('desktop app detection on Windows', () => {
  beforeEach(() => {
    // No operating-system query returns anything, so these tests exercise the fallback
    // routes against the fixture home rather than whatever is on the build machine.
    env = withNoInstalledApps(makeTempEnv('win32'))
  })

  it('finds a plain installer layout', async () => {
    await writeFile(env, 'AppData/Local/AnthropicClaude/claude.exe', 'binary')
    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('installed')
    expect(result.foundVia).toBe('Application folder')
  })

  it('finds the alternative installer layout', async () => {
    await writeFile(env, 'AppData/Local/Programs/Claude/Claude.exe', 'binary')
    expect((await detectClaudeDesktop(env)).state).toBe('installed')
  })

  it('finds a start menu shortcut when no folder matches', async () => {
    await writeFile(
      env,
      'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Claude.lnk',
      'shortcut'
    )
    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('installed')
    expect(result.foundVia).toBe('Start menu')
  })

  it('does not treat this application’s own shortcut as the Claude app', async () => {
    await writeFile(
      env,
      'AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Better Claude Setup.lnk',
      'shortcut'
    )
    expect((await detectClaudeDesktop(env)).state).not.toBe('installed')
  })

  it('reports uncertain, not missing, when only leftover settings remain', async () => {
    await fs.mkdir(desktopConfigDir(env), { recursive: true })
    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('uncertain')
    expect(result.foundVia).toBe('Leftover settings only')
  })

  it('reports not found on a clean machine', async () => {
    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('not-found')
    expect(result.version).toBeNull()
  })

  it('finds an app package even though its folder cannot be listed', async () => {
    // This is the exact case version 1.0.0 missed. The package directory lives under
    // C:\Program Files\WindowsApps, which an ordinary process cannot read at all, so the
    // answer has to come from the registry rather than the filesystem.
    const packaged = withCommandOutput(makeTempEnv('win32'), (command, args) =>
      command === 'reg.exe' && args.includes('/k')
        ? String.raw`HKEY_CURRENT_USER\Software\...\Packages\Claude_1.32352.1.0_x64__pzs8sxrjxfjjc`
        : null
    )
    const result = await detectClaudeDesktop(packaged)
    expect(result.state).toBe('installed')
    expect(result.version).toBe('1.32352.1.0')
    expect(result.foundVia).toBe('Windows app packages')
    await cleanup(packaged)
  })

  it('falls back to installed programs when there is no app package', async () => {
    const listed = withCommandOutput(makeTempEnv('win32'), (command, args) =>
      command === 'reg.exe' && args.includes('DisplayName')
        ? '    DisplayName    REG_SZ    Claude'
        : null
    )
    const result = await detectClaudeDesktop(listed)
    expect(result.state).toBe('installed')
    expect(result.foundVia).toBe('Windows installed programs')
    await cleanup(listed)
  })

  it('records every route it tried, so the answer can be checked', async () => {
    const result = await detectClaudeDesktop(env)
    const methods = result.probes.map((p) => p.method)
    expect(methods).toContain('Windows app packages')
    expect(methods).toContain('Windows installed programs')
    expect(methods).toContain('Application folder')
    expect(result.probes.every((p) => !p.note.includes(env.home))).toBe(true)
  })
})

describe('desktop app detection on macOS', () => {
  beforeEach(() => {
    env = withNoInstalledApps(makeTempEnv('darwin'))
  })

  it('finds an app bundle in the user Applications folder and reads its version', async () => {
    const plist = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<plist version="1.0"><dict>',
      '<key>CFBundleShortVersionString</key><string>1.9.2</string>',
      '</dict></plist>'
    ].join('\n')
    await writeFile(env, 'Applications/Claude.app/Contents/Info.plist', plist)

    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('installed')
    expect(result.version).toBe('1.9.2')
  })

  it('still reports installed when the bundle has no readable version', async () => {
    await fs.mkdir(join(env.home, 'Applications', 'Claude.app'), { recursive: true })
    const result = await detectClaudeDesktop(env)
    expect(result.state).toBe('installed')
    expect(result.version).toBeNull()
  })

  it('uses the macOS support directory for leftover settings', async () => {
    expect(desktopConfigDir(env)).toContain(join('Library', 'Application Support', 'Claude'))
  })
})

describe('existing skills', () => {
  beforeEach(() => {
    env = makeTempEnv()
  })

  it('lists nothing when the skills folder is absent', async () => {
    expect(await listForeignSkills(env)).toEqual([])
  })

  it('lists only skills this app did not install', async () => {
    await writeFile(env, '.claude/skills/my-own-skill/SKILL.md', 'mine')
    await writeFile(env, '.claude/skills/another/SKILL.md', 'also mine')
    await installComponents(env, VERSION, ['writing-toolkit'])

    const foreign = await listForeignSkills(env)
    expect(foreign).toEqual(['another', 'my-own-skill'])
    expect(foreign).not.toContain('write')
  })
})

describe('system scan', () => {
  beforeEach(() => {
    env = makeTempEnv()
  })

  it('creates nothing on a machine with no Claude configuration', async () => {
    const scan = await scanSystem(env, VERSION)
    expect(scan.claudeHomeExists).toBe(false)
    expect(scan.existingConfig.claudeMdExists).toBe(false)
    expect(scan.betterClaudeSetup.state).toBe('not-configured')
    expect(await exists(env, '.claude')).toBe(false)
  })

  it('reports each stage as it finishes, in order', async () => {
    const steps: string[] = []
    await scanSystem(env, VERSION, (step) => steps.push(step))
    expect(steps).toEqual([
      'system',
      'claude-code',
      'claude-desktop',
      'configuration',
      'better-claude-setup',
      'done'
    ])
  })

  it('reports a corrupt settings file without repairing or deleting it', async () => {
    const broken = '{ "model": '
    await writeFile(env, '.claude/settings.json', broken)

    const scan = await scanSystem(env, VERSION)
    expect(scan.existingConfig.settingsJsonExists).toBe(true)
    expect(scan.existingConfig.settingsJsonValid).toBe(false)
    expect(await fs.readFile(join(env.home, '.claude', 'settings.json'), 'utf8')).toBe(broken)
  })

  it('counts the lines of an existing instructions file', async () => {
    await writeFile(env, '.claude/CLAUDE.md', 'one\ntwo\nthree\n')
    const scan = await scanSystem(env, VERSION)
    expect(scan.existingConfig.claudeMdExists).toBe(true)
    expect(scan.existingConfig.claudeMdLines).toBe(4)
  })

  it('reports a healthy setup as configured', async () => {
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    const scan = await scanSystem(env, VERSION)
    expect(scan.betterClaudeSetup.state).toBe('configured')
    expect(scan.betterClaudeSetup.installedComponentIds).toEqual([
      'core-behaviour',
      'writing-toolkit'
    ])
    expect(scan.betterClaudeSetup.missingComponentIds).toEqual([])
  })

  it('notices when a skill the manifest claims was deleted by hand', async () => {
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    await fs.rm(join(skillsDir(env), 'write'), { recursive: true, force: true })

    const scan = await scanSystem(env, VERSION)
    expect(scan.betterClaudeSetup.state).toBe('partial')
    expect(scan.betterClaudeSetup.missingComponentIds).toContain('writing-toolkit')
    expect(scan.betterClaudeSetup.installedComponentIds).toContain('core-behaviour')
  })

  it('notices when the instructions block was removed by hand', async () => {
    await installComponents(env, VERSION, ['core-behaviour'])
    await writeFile(env, '.claude/CLAUDE.md', '# I rewrote this myself\n')

    const scan = await scanSystem(env, VERSION)
    expect(scan.betterClaudeSetup.state).toBe('partial')
    expect(scan.betterClaudeSetup.missingComponentIds).toEqual(['core-behaviour'])
  })
})
