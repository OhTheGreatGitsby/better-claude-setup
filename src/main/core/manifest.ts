import type { Artifact, BackupRecord, InstalledComponentRecord, Manifest } from '@shared/types'
import { appStateDir, manifestPath } from './env'
import type { Env } from './env'
import { loadJson, saveJson } from './json-config'
import { ensureDir } from './safe-fs'

export function emptyManifest(env: Env, appVersion: string): Manifest {
  const iso = env.now().toISOString()
  return {
    manifestVersion: 1,
    appVersion,
    createdAtIso: iso,
    updatedAtIso: iso,
    components: [],
    backups: []
  }
}

/**
 * Reads the install manifest. A missing or unreadable manifest yields an empty one
 * rather than an error, so a damaged state file can never block the app from starting.
 */
export async function loadManifest(env: Env, appVersion: string): Promise<Manifest> {
  const loaded = await loadJson<Manifest>(manifestPath(env))
  if (!loaded.exists || !loaded.valid || !loaded.value) return emptyManifest(env, appVersion)
  const value = loaded.value
  if (value.manifestVersion !== 1 || !Array.isArray(value.components)) {
    return emptyManifest(env, appVersion)
  }
  return { ...emptyManifest(env, appVersion), ...value }
}

export async function saveManifest(env: Env, manifest: Manifest): Promise<void> {
  await ensureDir(appStateDir(env))
  await saveJson(manifestPath(env), { ...manifest, updatedAtIso: env.now().toISOString() })
}

export function recordComponent(
  manifest: Manifest,
  env: Env,
  componentId: string,
  version: string,
  artifacts: Artifact[]
): Manifest {
  const record: InstalledComponentRecord = {
    componentId,
    version,
    installedAtIso: env.now().toISOString(),
    artifacts
  }
  const components = manifest.components.filter((c) => c.componentId !== componentId)
  components.push(record)
  return { ...manifest, components }
}

export function forgetComponent(manifest: Manifest, componentId: string): Manifest {
  return {
    ...manifest,
    components: manifest.components.filter((c) => c.componentId !== componentId)
  }
}

export function recordBackup(manifest: Manifest, backup: BackupRecord): Manifest {
  return { ...manifest, backups: [backup, ...manifest.backups].slice(0, 50) }
}

export function findComponent(
  manifest: Manifest,
  componentId: string
): InstalledComponentRecord | undefined {
  return manifest.components.find((c) => c.componentId === componentId)
}
