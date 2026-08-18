import { join } from 'node:path'
import type {
  Artifact,
  ComponentMeta,
  InstallPlan,
  Manifest,
  OperationResult,
  PlannedChange,
  StepResult
} from '@shared/types'
import { CORE_BLOCK_ID, PLUGIN_REFS, SETTING_VALUES, SKILL_GROUPS, componentById } from './catalog'
import { CORE_PRESET, skillFileContents } from './content'
import { claudeHome, claudeMdPath, claudeSettingsPath, skillsDir } from './env'
import type { Env } from './env'
import { loadJson, mergeOwnedKeys, removeOwnedKeys, saveJson } from './json-config'
import { removeBlock, upsertBlock } from './markers'
import {
  ensureDir,
  readTextIfExists,
  removeIfExists,
  resolveInside,
  writeTextAtomic
} from './safe-fs'
import { createBackup, restoreBackup } from './backup'
import { findClaudeExecutable, runClaude } from './detect'
import {
  findComponent,
  forgetComponent,
  loadManifest,
  recordBackup,
  recordComponent,
  saveManifest
} from './manifest'
import { log } from './logger'
import { sanitize } from './sanitize'

/**
 * An install is a sequence of small operations, each with an inverse. If one fails, the
 * ones that already ran are undone in reverse order, so the machine is never left in a
 * state the app cannot describe.
 */
interface Operation {
  id: string
  label: string
  apply: () => Promise<{ artifacts: Artifact[]; detail?: string }>
  undo: () => Promise<void>
  componentId: string
  version: string
}

export const APP_VERSION_FALLBACK = '1.0.0'

/** Builds the exact list of changes an install would make, without making any of them. */
export async function buildPlan(
  env: Env,
  appVersion: string,
  componentIds: string[]
): Promise<InstallPlan> {
  const manifest = await loadManifest(env, appVersion)
  const changes: PlannedChange[] = []
  const alreadyInstalled: string[] = []

  for (const id of componentIds) {
    const meta = componentById(id)
    if (!meta) continue

    const existing = findComponent(manifest, id)
    if (existing && existing.version === meta.version && meta.kind !== 'plugin') {
      alreadyInstalled.push(id)
    }

    switch (meta.kind) {
      case 'preset':
        changes.push({
          componentId: id,
          kind: 'claude-md-block',
          label: 'Add the Better Claude Setup working rules to your Claude instructions file',
          target: 'CLAUDE.md',
          detail: `A single marked block (better-claude-setup:${CORE_BLOCK_ID}). Existing content is kept.`
        })
        break
      case 'skill':
        for (const skillId of SKILL_GROUPS[id] ?? []) {
          changes.push({
            componentId: id,
            kind: 'skill-dir',
            label: `Add the ${skillId.replace(/^bcs-/, '').replace(/-/g, ' ')} skill`,
            target: `skills/${skillId}/SKILL.md`,
            detail: 'Loaded only when relevant, so it costs almost nothing the rest of the time.'
          })
        }
        break
      case 'setting':
        changes.push({
          componentId: id,
          kind: 'settings-keys',
          label: `Set ${Object.keys(SETTING_VALUES[id] ?? {}).join(', ')} in your Claude Code settings`,
          target: 'settings.json',
          detail: 'Every other setting you already have is preserved.'
        })
        break
      case 'plugin':
        changes.push({
          componentId: id,
          kind: 'plugin-install',
          label: `Install ${meta.name} from Anthropic’s official plugin catalogue`,
          target: PLUGIN_REFS[id] ?? id,
          detail: 'Downloads from Anthropic over HTTPS using the Claude Code command line tool.'
        })
        break
    }
  }

  return {
    componentIds,
    changes,
    backupWillBeCreated: changes.length > 0,
    alreadyInstalled
  }
}

function skillDirFor(env: Env, skillId: string): string {
  // resolveInside proves the computed path cannot escape the skills directory even if a
  // future catalogue entry contained something unexpected.
  return resolveInside(skillsDir(env), join(skillId))
}

async function buildOperations(
  env: Env,
  componentIds: string[]
): Promise<{ operations: Operation[]; skipped: StepResult[] }> {
  const operations: Operation[] = []
  const skipped: StepResult[] = []

  for (const id of componentIds) {
    const meta = componentById(id)
    if (!meta) {
      skipped.push({
        id,
        label: id,
        status: 'skipped',
        message: 'This component is not in the catalogue and was ignored.'
      })
      continue
    }

    if (meta.kind === 'preset') operations.push(presetOperation(env, meta))
    if (meta.kind === 'skill') operations.push(...skillOperations(env, meta))
    if (meta.kind === 'setting') operations.push(settingOperation(env, meta))
    if (meta.kind === 'plugin') operations.push(pluginOperation(env, meta))
  }

  return { operations, skipped }
}

function presetOperation(env: Env, meta: ComponentMeta): Operation {
  const path = claudeMdPath(env)
  return {
    id: `${meta.id}:claude-md`,
    componentId: meta.id,
    version: meta.version,
    label: 'Add working rules to your Claude instructions file',
    apply: async () => {
      const current = (await readTextIfExists(path)) ?? ''
      const next = upsertBlock(current, CORE_BLOCK_ID, CORE_PRESET)
      await ensureDir(claudeHome(env))
      await writeTextAtomic(path, next)
      return {
        artifacts: [{ type: 'claude-md-block', blockId: CORE_BLOCK_ID }],
        detail: `Wrote ${next.split('\n').length} lines total; ${current.split('\n').length} were already yours.`
      }
    },
    undo: async () => {
      const current = await readTextIfExists(path)
      if (current === null) return
      const next = removeBlock(current, CORE_BLOCK_ID)
      if (next.trim() === '') {
        await removeIfExists(path)
      } else {
        await writeTextAtomic(path, next)
      }
    }
  }
}

function skillOperations(env: Env, meta: ComponentMeta): Operation[] {
  return (SKILL_GROUPS[meta.id] ?? []).map((skillId) => ({
    id: `${meta.id}:${skillId}`,
    componentId: meta.id,
    version: meta.version,
    label: `Add the ${skillId} skill`,
    apply: async () => {
      const dir = skillDirFor(env, skillId)
      await ensureDir(dir)
      await writeTextAtomic(join(dir, 'SKILL.md'), skillFileContents(skillId))
      return {
        artifacts: [{ type: 'skill-dir', relPath: `skills/${skillId}` }],
        detail: `Created skills/${skillId}/SKILL.md`
      }
    },
    undo: async () => {
      await removeIfExists(skillDirFor(env, skillId))
    }
  }))
}

function settingOperation(env: Env, meta: ComponentMeta): Operation {
  const path = claudeSettingsPath(env)
  const additions = SETTING_VALUES[meta.id] ?? {}
  return {
    id: `${meta.id}:settings`,
    componentId: meta.id,
    version: meta.version,
    label: `Update Claude Code settings`,
    apply: async () => {
      const loaded = await loadJson(path)
      if (loaded.exists && !loaded.valid) {
        throw new Error(
          'Your Claude Code settings file could not be read as valid JSON, so nothing was changed. Fix or remove the file and try again.'
        )
      }
      const existing = loaded.value ?? {}
      const { merged, addedKeys, conflicts } = mergeOwnedKeys(existing, additions)
      await ensureDir(claudeHome(env))
      await saveJson(path, merged)
      const detail =
        conflicts.length > 0
          ? `Kept your existing value for: ${conflicts.join(', ')}. Added: ${addedKeys.join(', ') || 'nothing'}.`
          : `Added: ${addedKeys.join(', ') || 'nothing (already set)'}.`
      return { artifacts: [{ type: 'settings-keys', keys: addedKeys }], detail }
    },
    undo: async () => {
      const loaded = await loadJson(path)
      if (!loaded.exists || !loaded.valid || !loaded.value) return
      const { merged } = removeOwnedKeys(loaded.value, Object.keys(additions), additions)
      await saveJson(path, merged)
    }
  }
}

function pluginOperation(env: Env, meta: ComponentMeta): Operation {
  const ref = PLUGIN_REFS[meta.id]
  return {
    id: `${meta.id}:plugin`,
    componentId: meta.id,
    version: meta.version,
    label: `Install ${meta.name}`,
    apply: async () => {
      if (!ref) throw new Error('This add-on has no plugin reference and was not installed.')
      const exe = await findClaudeExecutable(env)
      if (!exe) {
        throw new Error(
          'Claude Code is not installed, so this add-on cannot be installed. Install Claude Code first.'
        )
      }
      const result = await runClaude(env, exe, ['plugin', 'install', ref], 180_000)
      if (!result.ok) {
        throw new Error(
          `Claude Code could not install this add-on. It reported: ${firstMeaningfulLine(result.safeOutput)}`
        )
      }
      return { artifacts: [{ type: 'plugin', pluginRef: ref }], detail: result.safeOutput }
    },
    undo: async () => {
      if (!ref) return
      const exe = await findClaudeExecutable(env)
      if (!exe) return
      await runClaude(env, exe, ['plugin', 'uninstall', ref], 120_000)
    }
  }
}

function firstMeaningfulLine(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line ?? 'no output'
}

/**
 * Installs the chosen components. A backup is taken before the first change. If any step
 * fails, every step that already succeeded is undone before returning.
 */
export async function installComponents(
  env: Env,
  appVersion: string,
  componentIds: string[]
): Promise<OperationResult> {
  const { operations, skipped } = await buildOperations(env, componentIds)
  const steps: StepResult[] = [...skipped]

  if (operations.length === 0) {
    return {
      ok: true,
      steps,
      backupId: null,
      rolledBack: false,
      summary: 'Nothing was selected, so nothing changed.'
    }
  }

  let manifest = await loadManifest(env, appVersion)
  await ensureDir(claudeHome(env))

  const backup = await createBackup(env, `Before installing: ${componentIds.join(', ')}`)
  manifest = recordBackup(manifest, backup)
  steps.push({
    id: 'backup',
    label: 'Save a copy of your current Claude configuration',
    status: 'done',
    message:
      backup.files.length > 0
        ? `Backed up ${backup.files.join(', ')}.`
        : 'You had no existing Claude configuration to back up, so an empty restore point was recorded.',
    detail: `Backup id ${backup.id}`
  })
  await log(env, 'info', `Created backup ${backup.id}`)

  const completed: Operation[] = []
  const artifactsByComponent = new Map<string, Artifact[]>()

  for (const operation of operations) {
    try {
      const outcome = await operation.apply()
      completed.push(operation)
      const list = artifactsByComponent.get(operation.componentId) ?? []
      artifactsByComponent.set(operation.componentId, [...list, ...outcome.artifacts])
      steps.push({
        id: operation.id,
        label: operation.label,
        status: 'done',
        message: 'Done.',
        detail: outcome.detail
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown failure.'
      steps.push({
        id: operation.id,
        label: operation.label,
        status: 'failed',
        message: sanitize(message, env)
      })
      await log(env, 'error', `Step ${operation.id} failed: ${message}`)

      for (const done of [...completed].reverse()) {
        try {
          await done.undo()
          steps.push({
            id: `${done.id}:undo`,
            label: `Undo: ${done.label}`,
            status: 'rolled-back',
            message: 'Reverted.'
          })
        } catch (undoError) {
          steps.push({
            id: `${done.id}:undo`,
            label: `Undo: ${done.label}`,
            status: 'failed',
            message:
              'This change could not be undone automatically. Use Restore original configuration.',
            detail: sanitize(String(undoError), env)
          })
        }
      }

      await saveManifest(env, manifest)
      return {
        ok: false,
        steps,
        backupId: backup.id,
        rolledBack: true,
        summary:
          'Setup stopped and every change was undone. Your Claude configuration is as it was before.'
      }
    }
  }

  for (const [componentId, artifacts] of artifactsByComponent) {
    const meta = componentById(componentId)
    manifest = recordComponent(manifest, env, componentId, meta?.version ?? '0.0.0', artifacts)
  }
  await saveManifest(env, manifest)
  await log(env, 'info', `Installed components: ${componentIds.join(', ')}`)

  return {
    ok: true,
    steps,
    backupId: backup.id,
    rolledBack: false,
    summary: 'Everything you chose was installed, and a restore point was saved first.'
  }
}

/**
 * Removes components this app installed, using the manifest so only our own artifacts
 * are touched. Anything the user changed by hand since installation is left in place.
 */
export async function removeComponents(
  env: Env,
  appVersion: string,
  componentIds: string[]
): Promise<OperationResult> {
  let manifest = await loadManifest(env, appVersion)
  const steps: StepResult[] = []

  for (const componentId of componentIds) {
    const record = findComponent(manifest, componentId)
    const meta = componentById(componentId)
    const label = meta?.name ?? componentId

    if (!record) {
      steps.push({
        id: componentId,
        label,
        status: 'skipped',
        message: 'Better Claude Setup did not install this, so nothing was removed.'
      })
      continue
    }

    try {
      for (const artifact of record.artifacts) {
        await removeArtifact(env, artifact)
      }
      manifest = forgetComponent(manifest, componentId)
      steps.push({ id: componentId, label, status: 'done', message: 'Removed.' })
    } catch (error) {
      steps.push({
        id: componentId,
        label,
        status: 'failed',
        message: sanitize(error instanceof Error ? error.message : 'Unknown failure.', env)
      })
    }
  }

  await saveManifest(env, manifest)
  const failed = steps.some((s) => s.status === 'failed')
  return {
    ok: !failed,
    steps,
    backupId: null,
    rolledBack: false,
    summary: failed
      ? 'Some components could not be removed. Everything else was removed.'
      : 'Removed. Your own settings and files were left alone.'
  }
}

async function removeArtifact(env: Env, artifact: Artifact): Promise<void> {
  switch (artifact.type) {
    case 'claude-md-block': {
      const path = claudeMdPath(env)
      const current = await readTextIfExists(path)
      if (current === null) return
      const next = removeBlock(current, artifact.blockId)
      if (next.trim() === '') {
        await removeIfExists(path)
      } else {
        await writeTextAtomic(path, next)
      }
      return
    }
    case 'skill-dir': {
      const name = artifact.relPath.replace(/^skills\//, '')
      await removeIfExists(resolveInside(skillsDir(env), name))
      return
    }
    case 'settings-keys': {
      const path = claudeSettingsPath(env)
      const loaded = await loadJson(path)
      if (!loaded.exists || !loaded.valid || !loaded.value) return
      const expected = Object.assign({}, ...Object.values(SETTING_VALUES)) as Record<
        string,
        unknown
      >
      const { merged } = removeOwnedKeys(loaded.value, artifact.keys, expected)
      await saveJson(path, merged)
      return
    }
    case 'plugin': {
      const exe = await findClaudeExecutable(env)
      if (!exe) return
      await runClaude(env, exe, ['plugin', 'uninstall', artifact.pluginRef], 120_000)
      return
    }
  }
}

/** Restores the captured configuration surface from a backup and clears the manifest. */
export async function restoreFromBackup(
  env: Env,
  appVersion: string,
  backupId: string
): Promise<OperationResult> {
  const steps: StepResult[] = []
  try {
    const restored = await restoreBackup(env, backupId)
    steps.push({
      id: 'restore',
      label: 'Restore your original Claude configuration',
      status: 'done',
      message:
        restored.length > 0
          ? `Restored ${restored.join(', ')}.`
          : 'Restored: you had no Claude configuration at that point, so it was removed again.'
    })

    const manifest = await loadManifest(env, appVersion)
    const cleared: Manifest = { ...manifest, components: [] }
    await saveManifest(env, cleared)
    await log(env, 'info', `Restored backup ${backupId}`)

    return {
      ok: true,
      steps,
      backupId,
      rolledBack: false,
      summary: 'Your Claude configuration is back to how it was before Better Claude Setup.'
    }
  } catch (error) {
    return {
      ok: false,
      steps: [
        {
          id: 'restore',
          label: 'Restore your original Claude configuration',
          status: 'failed',
          message: sanitize(error instanceof Error ? error.message : 'Unknown failure.', env)
        }
      ],
      backupId,
      rolledBack: false,
      summary: 'Nothing was restored.'
    }
  }
}
