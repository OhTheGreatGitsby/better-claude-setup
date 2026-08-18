import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { detectClaudeDesktop, listForeignSkills, scanSystem } from '../src/main/core/detect'
import { desktopConfigDir } from '../src/main/core/env'
import type { Env } from '../src/main/core/env'
import { installComponents } from '../src/main/core/installer'
import { cleanup, exists, makeTempEnv, writeFile } from './helpers'

const VERSION = '1.0.0'
let env: Env

afterEach(async () => {
  await cleanup(env)
})

describe('desktop app detection', () => {
  beforeEach(() => {
    env = makeTempEnv('win32')
  })

  it('reports not installed when nothing is there', async () => {
    const result = await detectClaudeDesktop(env)
    expect(result.installed).toBe(false)
    expect(result.configDirExists).toBe(false)
  })

  it('finds a Windows installation', async () => {
    await writeFile(env, 'AppData/Local/AnthropicClaude/claude.exe', 'binary')
    const result = await detectClaudeDesktop(env)
    expect(result.installed).toBe(true)
  })

  it('finds the alternative Windows install location', async () => {
    await writeFile(env, 'AppData/Local/Programs/Claude/Claude.exe', 'binary')
    expect((await detectClaudeDesktop(env)).installed).toBe(true)
  })

  it('distinguishes leftover configuration from an installation', async () => {
    await fs.mkdir(desktopConfigDir(env), { recursive: true })
    const result = await detectClaudeDesktop(env)
    expect(result.configDirExists).toBe(true)
    expect(result.installed).toBe(false)
  })
})

describe('macOS desktop app detection', () => {
  beforeEach(() => {
    env = makeTempEnv('darwin')
  })

  it('finds an app bundle in the user Applications folder', async () => {
    await fs.mkdir(join(env.home, 'Applications', 'Claude.app'), { recursive: true })
    expect((await detectClaudeDesktop(env)).installed).toBe(true)
  })

  it('uses the macOS support directory for configuration', () => {
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
    expect(foreign).not.toContain('bcs-essay')
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
    expect(scan.betterClaudeSetup.everInstalled).toBe(false)
    expect(await exists(env, '.claude')).toBe(false)
  })

  it('reports a corrupt settings file without repairing or deleting it', async () => {
    const broken = '{ "model": '
    await writeFile(env, '.claude/settings.json', broken)

    const scan = await scanSystem(env, VERSION)
    expect(scan.existingConfig.settingsJsonExists).toBe(true)
    expect(scan.existingConfig.settingsJsonValid).toBe(false)
    expect(scan.existingConfig.settingsJsonError).toBeTruthy()
    expect(await fs.readFile(join(env.home, '.claude', 'settings.json'), 'utf8')).toBe(broken)
  })

  it('counts the lines of an existing instructions file', async () => {
    await writeFile(env, '.claude/CLAUDE.md', 'one\ntwo\nthree\n')
    const scan = await scanSystem(env, VERSION)
    expect(scan.existingConfig.claudeMdExists).toBe(true)
    expect(scan.existingConfig.claudeMdLines).toBe(4)
  })

  it('reports what this app has installed after a setup run', async () => {
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    const scan = await scanSystem(env, VERSION)
    expect(scan.betterClaudeSetup.everInstalled).toBe(true)
    expect(scan.betterClaudeSetup.installedComponentIds).toEqual([
      'core-behaviour',
      'writing-toolkit'
    ])
    expect(scan.betterClaudeSetup.backupCount).toBe(1)
  })
})
