import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { platform } from 'node:os'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import {
  buildChatPackages,
  chatPackageDir,
  chatPackageHash,
  chatSkillIdsFor,
  clearChatSetup,
  confirmChatSetup,
  readChatSkillsState
} from '../src/main/core/chat-skills'
import { SKILLS, toChatSkill, toClaudeCodeSkill } from '../src/main/core/content'
import { createZip } from '../src/main/core/zip'
import type { Env } from '../src/main/core/env'
import { cleanup, makeTempEnv } from './helpers'

/**
 * Unpacks with whatever real ZIP implementation the operating system provides, rather
 * than with our own writer's assumptions. Windows bsdtar rejects perfectly valid archives,
 * so PowerShell's extractor is used there.
 */
function unzipWithTheOperatingSystem(archive: string, destination: string): void {
  if (platform() === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destination}' -Force`
      ],
      { stdio: 'pipe' }
    )
    return
  }
  execFileSync('unzip', ['-o', '-q', archive, '-d', destination], { stdio: 'pipe' })
}

let env: Env

beforeEach(() => {
  env = makeTempEnv()
})

afterEach(async () => {
  await cleanup(env)
})

describe('the archive format', () => {
  it('produces something a real unzip implementation can unpack', async () => {
    const zip = createZip(
      [{ path: 'research/SKILL.md', contents: '---\nname: research\n---\n\nbody\n' }],
      new Date(Date.UTC(2026, 0, 1))
    )
    const file = join(env.home, 'test.zip')
    await fs.writeFile(file, zip)

    // Unpacked by the operating system's own extractor rather than by our own reader, so
    // a bug that happens to round-trip through our code cannot pass this.
    unzipWithTheOperatingSystem(file, env.home)
    const extracted = await fs.readFile(join(env.home, 'research', 'SKILL.md'), 'utf8')
    expect(extracted).toBe('---\nname: research\n---\n\nbody\n')
  })

  it('is byte-identical when built twice, so updates can be detected by content', () => {
    const stamp = new Date(Date.UTC(2026, 0, 1))
    const entries = [{ path: 'a/SKILL.md', contents: 'hello' }]
    expect(createZip(entries, stamp).equals(createZip(entries, stamp))).toBe(true)
  })
})

describe('packaging skills for a Claude account', () => {
  it('writes one archive per skill, with the skill folder at the root', async () => {
    const built = await buildChatPackages(env, ['research', 'write'])
    expect(built.files.sort()).toEqual(['research.zip', 'write.zip'])

    unzipWithTheOperatingSystem(join(built.directory, 'research.zip'), env.home)
    const skill = await fs.readFile(join(env.home, 'research', 'SKILL.md'), 'utf8')
    expect(skill).toContain('name: research')
    expect(skill).toContain('# Research')
  })

  it('includes plain instructions beside the archives', async () => {
    const built = await buildChatPackages(env, ['research'])
    const help = await fs.readFile(join(built.directory, 'HOW-TO-INSTALL.txt'), 'utf8')
    expect(help).toContain('Code execution')
    expect(help).toContain('research.zip')
  })

  it('rebuilds from scratch so a removed skill cannot linger', async () => {
    await buildChatPackages(env, ['research', 'write'])
    await buildChatPackages(env, ['research'])
    const files = await fs.readdir(chatPackageDir(env))
    expect(files).toContain('research.zip')
    expect(files).not.toContain('write.zip')
  })
})

describe('account state, which is the user word and never a detection', () => {
  it('starts as not set up', async () => {
    const state = await readChatSkillsState(env, [])
    expect(state.state).toBe('not-set-up')
    expect(state.confirmedAtIso).toBeNull()
  })

  it('reports prepared once packages exist but nothing is confirmed', async () => {
    await buildChatPackages(env, chatSkillIdsFor([]))
    const state = await readChatSkillsState(env, [])
    expect(state.state).toBe('prepared')
  })

  it('reports confirmed only after the user says so', async () => {
    const ids = chatSkillIdsFor(['research-toolkit'])
    await confirmChatSetup(env, ids)
    const state = await readChatSkillsState(env, ['research-toolkit'])
    expect(state.state).toBe('confirmed')
    expect(state.confirmedAtIso).toBeTruthy()
  })

  it('notices when the skills changed since the user confirmed', async () => {
    await confirmChatSetup(env, ['research'])
    // Confirming one skill and then having two selected means what is in the account no
    // longer matches what this app would produce.
    const state = await readChatSkillsState(env, ['research-toolkit'])
    expect(state.state).toBe('update-available')
  })

  it('forgets everything when the user resets it', async () => {
    await buildChatPackages(env, ['research'])
    await confirmChatSetup(env, ['research'])
    await clearChatSetup(env)
    const state = await readChatSkillsState(env, [])
    expect(state.state).toBe('not-set-up')
    expect(state.packageDirExists).toBe(false)
  })

  it('hashes content rather than order, so an identical set stays confirmed', () => {
    expect(chatPackageHash(['research', 'write'])).toBe(chatPackageHash(['write', 'research']))
    expect(chatPackageHash(['research'])).not.toBe(chatPackageHash(['research', 'write']))
  })
})

describe('one canonical source, two surfaces', () => {
  it('gives both surfaces the same body', () => {
    for (const id of Object.keys(SKILLS)) {
      const body = SKILLS[id]?.body ?? ''
      expect(toClaudeCodeSkill(id)).toContain(body)
      expect(toChatSkill(id)).toContain(body)
    }
  })

  it('keeps account descriptions inside the documented 200 character limit', () => {
    for (const [id, skill] of Object.entries(SKILLS)) {
      expect(skill.chatDescription.length, id).toBeLessThanOrEqual(200)
      expect(skill.chatDescription.length).toBeGreaterThan(40)
    }
  })

  it('names each command in its own description, which is what makes typing it work', () => {
    for (const [id, skill] of Object.entries(SKILLS)) {
      expect(skill.chatDescription, id).toContain(`/${skill.command}`)
      expect(skill.description, id).toContain(`/${skill.command}`)
    }
  })

  it('uses names Claude accepts', () => {
    for (const skill of Object.values(SKILLS)) {
      expect(skill.command).toMatch(/^[a-z0-9-]+$/)
      expect(skill.command.length).toBeLessThanOrEqual(64)
      // Anthropic reserves these words in skill names.
      expect(skill.command).not.toContain('claude')
      expect(skill.command).not.toContain('anthropic')
    }
  })

  it('avoids the Claude Code names that are already taken', () => {
    // /plan enters plan mode and /deep-research is a bundled skill; shadowing either
    // would take something away from the user.
    const taken = ['plan', 'deep-research', 'code-review', 'debug', 'verify', 'init', 'run']
    for (const skill of Object.values(SKILLS)) {
      expect(taken).not.toContain(skill.command)
    }
  })

  it('tells every skill to be honest about the tools it actually had', () => {
    for (const [id, skill] of Object.entries(SKILLS)) {
      expect(skill.body, id).toContain('never describe a source you did not open')
    }
  })
})
