import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

/**
 * Interface tests run the real application against a throwaway home directory.
 *
 * The developer's own Claude configuration is never opened: the fixture below points the
 * home directory at a fresh temporary folder for every test, seeds it with a user's own
 * instructions file, settings and skill, and deletes it afterwards.
 */
export interface FixtureHome {
  root: string
  claudeDir: string
  readClaudeMd: () => string | null
  hasSkill: (name: string) => boolean
  listSkills: () => string[]
  listChatPackages: () => string[]
}

export function createFixtureHome(): FixtureHome {
  const root = mkdtempSync(join(tmpdir(), 'bcs-e2e-'))

  // Electron will not start against a home directory that looks nothing like a real
  // profile on Windows, so the usual folders are created alongside the Claude one.
  for (const dir of [
    'AppData/Local/Temp',
    'AppData/Roaming',
    'Documents',
    'Desktop',
    'Downloads',
    '.claude/skills/my-own-skill'
  ]) {
    mkdirSync(join(root, ...dir.split('/')), { recursive: true })
  }

  const claudeDir = join(root, '.claude')
  writeFileSync(join(claudeDir, 'CLAUDE.md'), '# My own notes\n\nAlways run make test.\n', 'utf8')
  writeFileSync(join(claudeDir, 'settings.json'), '{\n  "model": "opus"\n}\n', 'utf8')
  writeFileSync(join(claudeDir, 'skills', 'my-own-skill', 'SKILL.md'), 'mine\n', 'utf8')

  return {
    root,
    claudeDir,
    readClaudeMd: () => {
      const path = join(claudeDir, 'CLAUDE.md')
      return existsSync(path) ? readFileSync(path, 'utf8') : null
    },
    hasSkill: (name) => existsSync(join(claudeDir, 'skills', name, 'SKILL.md')),
    listChatPackages: () => {
      const dir = join(claudeDir, 'better-claude-setup', 'chat-skills')
      if (!existsSync(dir)) return []
      return readdirSync(dir).sort()
    },
    listSkills: () => {
      const dir = join(claudeDir, 'skills')
      if (!existsSync(dir)) return []
      return readdirSync(dir).sort()
    }
  }
}

export const test = base.extend<{
  app: ElectronApplication
  window: Page
  home: FixtureHome
  /** Runs the app with Claude Code removed from the search path. */
  hideClaudeCode: boolean
}>({
  hideClaudeCode: [false, { option: true }],

  home: async ({}, use) => {
    const home = createFixtureHome()
    await use(home)
    rmSync(home.root, { recursive: true, force: true })
  },

  app: async ({ home, hideClaudeCode }, use) => {
    // ELECTRON_RUN_AS_NODE has to be absent, not empty: with the variable present at all
    // Electron starts as a plain Node process and never opens a window.
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (key === 'ELECTRON_RUN_AS_NODE' || value === undefined) continue
      env[key] = value
    }
    env.USERPROFILE = home.root
    env.HOME = home.root

    if (hideClaudeCode) {
      // Whether Claude Code is installed is a property of the machine, so the only way to
      // exercise the "not installed" branch on a developer's computer is to take it off
      // the search path. Enough of the system path is kept for the app to still run and
      // to query the operating system's own application records.
      env.PATH = [
        `${process.env.SystemRoot ?? 'C:\Windows'}\system32`,
        process.env.SystemRoot ?? 'C:\Windows',
        `${process.env.SystemRoot ?? 'C:\Windows'}\System32\WindowsPowerShell\v1.0`
      ].join(';')
      env.Path = env.PATH
    }

    const app = await electron.launch({
      args: [resolve('out/main/index.js')],
      env
    })
    await use(app)
    await app.close()
  },

  window: async ({ app }, use) => {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  }
})

export { expect } from '@playwright/test'
