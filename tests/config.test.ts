import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadJson, mergeOwnedKeys, removeOwnedKeys, saveJson } from '../src/main/core/json-config'
import { hasBlock, listBlockIds, removeBlock, upsertBlock } from '../src/main/core/markers'
import { claudeSettingsPath } from '../src/main/core/env'
import type { Env } from '../src/main/core/env'
import { cleanup, makeTempEnv, writeFile } from './helpers'

let env: Env

beforeEach(() => {
  env = makeTempEnv()
})

afterEach(async () => {
  await cleanup(env)
})

describe('reading configuration files', () => {
  it('reports a missing file without throwing', async () => {
    const loaded = await loadJson(claudeSettingsPath(env))
    expect(loaded.exists).toBe(false)
    expect(loaded.valid).toBe(true)
    expect(loaded.value).toBeNull()
  })

  it('reports a corrupt file as invalid instead of throwing', async () => {
    await writeFile(env, '.claude/settings.json', '{ "model": "opus", ')
    const loaded = await loadJson(claudeSettingsPath(env))
    expect(loaded.exists).toBe(true)
    expect(loaded.valid).toBe(false)
    expect(loaded.error).toBeTruthy()
    expect(loaded.value).toBeNull()
  })

  it('rejects a JSON file whose root is not an object', async () => {
    await writeFile(env, '.claude/settings.json', '["not", "an", "object"]')
    const loaded = await loadJson(claudeSettingsPath(env))
    expect(loaded.valid).toBe(false)
  })

  it('treats an empty file as empty rather than corrupt', async () => {
    await writeFile(env, '.claude/settings.json', '   \n')
    const loaded = await loadJson(claudeSettingsPath(env))
    expect(loaded.valid).toBe(true)
    expect(loaded.value).toBeNull()
  })

  it('round-trips through save and load', async () => {
    await saveJson(claudeSettingsPath(env), { model: 'opus', nested: { a: [1, 2] } })
    const loaded = await loadJson(claudeSettingsPath(env))
    expect(loaded.value).toEqual({ model: 'opus', nested: { a: [1, 2] } })
  })
})

describe('merging settings without destroying existing values', () => {
  it('adds only new keys', () => {
    const existing = { model: 'opus', theme: 'dark', permissions: { allow: ['Bash(ls)'] } }
    const { merged, addedKeys } = mergeOwnedKeys(existing, { alwaysThinkingEnabled: true })
    expect(merged.model).toBe('opus')
    expect(merged.theme).toBe('dark')
    expect(merged.permissions).toEqual({ allow: ['Bash(ls)'] })
    expect(merged.alwaysThinkingEnabled).toBe(true)
    expect(addedKeys).toEqual(['alwaysThinkingEnabled'])
  })

  it('never overwrites a value the user already chose', () => {
    const existing = { alwaysThinkingEnabled: false }
    const { merged, addedKeys, conflicts } = mergeOwnedKeys(existing, {
      alwaysThinkingEnabled: true
    })
    expect(merged.alwaysThinkingEnabled).toBe(false)
    expect(addedKeys).toEqual([])
    expect(conflicts).toEqual(['alwaysThinkingEnabled'])
  })

  it('treats an identical existing value as nothing to do', () => {
    const { addedKeys, conflicts } = mergeOwnedKeys(
      { alwaysThinkingEnabled: true },
      { alwaysThinkingEnabled: true }
    )
    expect(addedKeys).toEqual([])
    expect(conflicts).toEqual([])
  })

  it('removes only keys whose value is still the one we wrote', () => {
    const existing = { model: 'opus', alwaysThinkingEnabled: true }
    const { merged, removedKeys } = removeOwnedKeys(existing, ['alwaysThinkingEnabled'], {
      alwaysThinkingEnabled: true
    })
    expect(merged).toEqual({ model: 'opus' })
    expect(removedKeys).toEqual(['alwaysThinkingEnabled'])
  })

  it('keeps a key the user has since edited', () => {
    const existing = { alwaysThinkingEnabled: false }
    const { merged, removedKeys, keptKeys } = removeOwnedKeys(existing, ['alwaysThinkingEnabled'], {
      alwaysThinkingEnabled: true
    })
    expect(merged).toEqual({ alwaysThinkingEnabled: false })
    expect(removedKeys).toEqual([])
    expect(keptKeys).toEqual(['alwaysThinkingEnabled'])
  })
})

describe('marked blocks in CLAUDE.md', () => {
  const user = '# My notes\n\nAlways use pnpm.\n'

  it('appends a block to an empty document', () => {
    const next = upsertBlock('', 'core-behaviour', 'Be accurate.')
    expect(hasBlock(next, 'core-behaviour')).toBe(true)
    expect(next).toContain('Be accurate.')
  })

  it('preserves everything the user already wrote', () => {
    const next = upsertBlock(user, 'core-behaviour', 'Be accurate.')
    expect(next).toContain('# My notes')
    expect(next).toContain('Always use pnpm.')
  })

  it('replaces the block in place rather than adding a second one', () => {
    const once = upsertBlock(user, 'core-behaviour', 'First version.')
    const twice = upsertBlock(once, 'core-behaviour', 'Second version.')
    expect(listBlockIds(twice)).toEqual(['core-behaviour'])
    expect(twice).toContain('Second version.')
    expect(twice).not.toContain('First version.')
  })

  it('restores the document exactly when the block is removed', () => {
    const withBlock = upsertBlock(user, 'core-behaviour', 'Be accurate.')
    const restored = removeBlock(withBlock, 'core-behaviour')
    expect(restored).toBe(user)
  })

  it('leaves other blocks alone when removing one', () => {
    let doc = upsertBlock(user, 'core-behaviour', 'A')
    doc = upsertBlock(doc, 'other-block', 'B')
    const removed = removeBlock(doc, 'core-behaviour')
    expect(hasBlock(removed, 'other-block')).toBe(true)
    expect(hasBlock(removed, 'core-behaviour')).toBe(false)
    expect(removed).toContain('Always use pnpm.')
  })

  it('does nothing when asked to remove a block that is not there', () => {
    expect(removeBlock(user, 'core-behaviour')).toBe(user)
  })

  it('refuses an unsafe block id', () => {
    expect(() => upsertBlock(user, '../escape', 'x')).toThrow()
  })
})
