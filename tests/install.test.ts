import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import {
  buildPlan,
  installComponents,
  removeComponents,
  restoreFromBackup
} from '../src/main/core/installer'
import { listBackups } from '../src/main/core/backup'
import { loadManifest } from '../src/main/core/manifest'
import { loadJson } from '../src/main/core/json-config'
import { claudeSettingsPath } from '../src/main/core/env'
import type { Env } from '../src/main/core/env'
import { CORE_PRESET } from '../src/main/core/content'
import { cleanup, exists, makeTempEnv, readFile, writeFile } from './helpers'

const VERSION = '1.0.0'
let env: Env

beforeEach(() => {
  env = makeTempEnv()
})

afterEach(async () => {
  await cleanup(env)
})

describe('planning', () => {
  it('describes every change before any is made', async () => {
    const plan = await buildPlan(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    expect(plan.changes.length).toBeGreaterThan(0)
    expect(plan.backupWillBeCreated).toBe(true)
    expect(plan.changes.some((c) => c.target === 'CLAUDE.md')).toBe(true)
    expect(plan.changes.some((c) => c.target.includes('bcs-essay'))).toBe(true)
    // Planning must not create anything.
    expect(await exists(env, '.claude/CLAUDE.md')).toBe(false)
    expect(await exists(env, '.claude/skills')).toBe(false)
  })

  it('ignores component ids that are not in the catalogue', async () => {
    const plan = await buildPlan(env, VERSION, ['not-a-real-component'])
    expect(plan.changes).toEqual([])
  })
})

describe('installing into an empty configuration', () => {
  it('writes the instruction block and the skill files', async () => {
    const result = await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    expect(result.ok).toBe(true)

    const claudeMd = await readFile(env, '.claude/CLAUDE.md')
    expect(claudeMd).toContain('BEGIN better-claude-setup:core-behaviour')
    expect(claudeMd).toContain('Be accurate before agreeable')

    const skill = await readFile(env, '.claude/skills/bcs-essay/SKILL.md')
    expect(skill).toContain('name: bcs-essay')
    expect(skill).toContain('description:')
  })

  it('records what it installed in its own manifest', async () => {
    await installComponents(env, VERSION, ['core-behaviour'])
    const manifest = await loadManifest(env, VERSION)
    expect(manifest.components.map((c) => c.componentId)).toEqual(['core-behaviour'])
    expect(manifest.components[0]?.artifacts[0]).toEqual({
      type: 'claude-md-block',
      blockId: 'core-behaviour'
    })
  })

  it('creates a restore point before the first change', async () => {
    const result = await installComponents(env, VERSION, ['core-behaviour'])
    const backups = await listBackups(env)
    expect(backups).toHaveLength(1)
    expect(result.backupId).toBe(backups[0]?.id)
  })

  it('keeps the always-loaded block small', async () => {
    // Official guidance is to keep CLAUDE.md well under 200 lines.
    expect(CORE_PRESET.split('\n').length).toBeLessThan(50)
  })
})

describe('installing over an existing configuration', () => {
  it('preserves the user’s own CLAUDE.md content', async () => {
    const original = '# My rules\n\nAlways run `make test`.\n'
    await writeFile(env, '.claude/CLAUDE.md', original)

    await installComponents(env, VERSION, ['core-behaviour'])
    const after = await readFile(env, '.claude/CLAUDE.md')
    expect(after).toContain('Always run `make test`.')
    expect(after).toContain('better-claude-setup:core-behaviour')
  })

  it('preserves the user’s own settings keys', async () => {
    await writeFile(
      env,
      '.claude/settings.json',
      JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] } }, null, 2)
    )

    await installComponents(env, VERSION, ['deeper-thinking'])
    const settings = await loadJson(claudeSettingsPath(env))
    expect(settings.value).toEqual({
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
      alwaysThinkingEnabled: true
    })
  })

  it('leaves skills the user installed themselves untouched', async () => {
    await writeFile(env, '.claude/skills/my-own-skill/SKILL.md', '---\nname: mine\n---\nhello')
    await installComponents(env, VERSION, ['writing-toolkit'])
    expect(await readFile(env, '.claude/skills/my-own-skill/SKILL.md')).toContain('hello')
  })

  it('refuses to touch a corrupt settings file and rolls the run back', async () => {
    const broken = '{ "model": "opus", '
    await writeFile(env, '.claude/settings.json', broken)

    const result = await installComponents(env, VERSION, ['core-behaviour', 'deeper-thinking'])
    expect(result.ok).toBe(false)
    expect(result.rolledBack).toBe(true)

    // The corrupt file is exactly as it was.
    expect(await readFile(env, '.claude/settings.json')).toBe(broken)
    // And the earlier successful step was undone.
    expect(await exists(env, '.claude/CLAUDE.md')).toBe(false)
  })

  it('is safe to run twice', async () => {
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    const first = await readFile(env, '.claude/CLAUDE.md')
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    const second = await readFile(env, '.claude/CLAUDE.md')
    expect(second).toBe(first)

    const manifest = await loadManifest(env, VERSION)
    expect(manifest.components).toHaveLength(2)
  })
})

describe('failure handling', () => {
  it('undoes completed steps when a later step fails', async () => {
    // A directory where the settings file should be makes the settings write fail.
    await fs.mkdir(join(env.home, '.claude', 'settings.json'), { recursive: true })

    const result = await installComponents(env, VERSION, [
      'core-behaviour',
      'writing-toolkit',
      'deeper-thinking'
    ])
    expect(result.ok).toBe(false)
    expect(result.rolledBack).toBe(true)
    expect(await exists(env, '.claude/CLAUDE.md')).toBe(false)
    expect(await exists(env, '.claude/skills/bcs-essay')).toBe(false)
  })

  it('reports nothing to do when the selection is empty', async () => {
    const result = await installComponents(env, VERSION, [])
    expect(result.ok).toBe(true)
    expect(result.backupId).toBeNull()
    expect(await exists(env, '.claude')).toBe(false)
  })
})

describe('removing components', () => {
  it('removes only its own block from CLAUDE.md', async () => {
    const original = '# My rules\n\nAlways run `make test`.\n'
    await writeFile(env, '.claude/CLAUDE.md', original)
    await installComponents(env, VERSION, ['core-behaviour'])

    const result = await removeComponents(env, VERSION, ['core-behaviour'])
    expect(result.ok).toBe(true)
    expect(await readFile(env, '.claude/CLAUDE.md')).toBe(original)
  })

  it('deletes CLAUDE.md entirely if it only ever contained our block', async () => {
    await installComponents(env, VERSION, ['core-behaviour'])
    await removeComponents(env, VERSION, ['core-behaviour'])
    expect(await exists(env, '.claude/CLAUDE.md')).toBe(false)
  })

  it('removes only its own skill directories', async () => {
    await writeFile(env, '.claude/skills/my-own-skill/SKILL.md', 'mine')
    await installComponents(env, VERSION, ['writing-toolkit'])
    await removeComponents(env, VERSION, ['writing-toolkit'])

    expect(await exists(env, '.claude/skills/bcs-essay')).toBe(false)
    expect(await exists(env, '.claude/skills/my-own-skill/SKILL.md')).toBe(true)
  })

  it('removes a setting key only when the value is still ours', async () => {
    await installComponents(env, VERSION, ['deeper-thinking'])
    await writeFile(
      env,
      '.claude/settings.json',
      JSON.stringify({ alwaysThinkingEnabled: false, model: 'opus' }, null, 2)
    )
    await removeComponents(env, VERSION, ['deeper-thinking'])

    const settings = await loadJson(claudeSettingsPath(env))
    expect(settings.value).toEqual({ alwaysThinkingEnabled: false, model: 'opus' })
  })

  it('says so plainly when asked to remove something it did not install', async () => {
    const result = await removeComponents(env, VERSION, ['core-behaviour'])
    expect(result.steps[0]?.status).toBe('skipped')
  })

  it('forgets removed components in the manifest', async () => {
    await installComponents(env, VERSION, ['core-behaviour', 'writing-toolkit'])
    await removeComponents(env, VERSION, ['core-behaviour'])
    const manifest = await loadManifest(env, VERSION)
    expect(manifest.components.map((c) => c.componentId)).toEqual(['writing-toolkit'])
  })
})

describe('backup and restore', () => {
  it('restores the exact earlier state of every captured file', async () => {
    const originalMd = '# Mine\n\nKeep this.\n'
    const originalSettings = { model: 'opus' }
    await writeFile(env, '.claude/CLAUDE.md', originalMd)
    await writeFile(env, '.claude/settings.json', JSON.stringify(originalSettings, null, 2))
    await writeFile(env, '.claude/skills/my-own-skill/SKILL.md', 'mine')

    const install = await installComponents(env, VERSION, [
      'core-behaviour',
      'writing-toolkit',
      'deeper-thinking'
    ])
    expect(install.ok).toBe(true)
    expect(install.backupId).toBeTruthy()

    const restore = await restoreFromBackup(env, VERSION, install.backupId as string)
    expect(restore.ok).toBe(true)

    expect(await readFile(env, '.claude/CLAUDE.md')).toBe(originalMd)
    expect((await loadJson(claudeSettingsPath(env))).value).toEqual(originalSettings)
    expect(await readFile(env, '.claude/skills/my-own-skill/SKILL.md')).toBe('mine')
    expect(await exists(env, '.claude/skills/bcs-essay')).toBe(false)
  })

  it('removes files that did not exist before, when restoring', async () => {
    const install = await installComponents(env, VERSION, ['core-behaviour'])
    await restoreFromBackup(env, VERSION, install.backupId as string)
    expect(await exists(env, '.claude/CLAUDE.md')).toBe(false)
  })

  it('clears the manifest after a restore', async () => {
    const install = await installComponents(env, VERSION, ['core-behaviour'])
    await restoreFromBackup(env, VERSION, install.backupId as string)
    const manifest = await loadManifest(env, VERSION)
    expect(manifest.components).toEqual([])
  })

  it('fails cleanly when the restore point does not exist', async () => {
    const result = await restoreFromBackup(env, VERSION, 'backup-2020-01-01T00-00-00-000Z')
    expect(result.ok).toBe(false)
    expect(result.steps[0]?.status).toBe('failed')
  })
})

describe('written skill files', () => {
  it('produce valid frontmatter with a description Claude can match on', async () => {
    await installComponents(env, VERSION, [
      'writing-toolkit',
      'research-toolkit',
      'coding-toolkit',
      'planning-toolkit',
      'design-toolkit'
    ])
    const dir = join(env.home, '.claude', 'skills')
    const entries = await fs.readdir(dir)
    expect(entries.length).toBe(10)

    for (const entry of entries) {
      const text = await fs.readFile(join(dir, entry, 'SKILL.md'), 'utf8')
      expect(text.startsWith('---\n')).toBe(true)
      const frontmatter = text.split('---')[1] ?? ''
      expect(frontmatter).toContain(`name: ${entry}`)
      expect(frontmatter).toMatch(/description: .{40,}/)
      // The listing truncates the description at 1,536 characters.
      const description = frontmatter.match(/description: (.*)/)?.[1] ?? ''
      expect(description.length).toBeLessThan(1536)
      expect(description).not.toContain('\n')
    }
  })
})
