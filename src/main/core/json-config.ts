import { readTextIfExists, writeTextAtomic } from './safe-fs'

export interface LoadedJson<T> {
  exists: boolean
  valid: boolean
  value: T | null
  raw: string | null
  error: string | null
}

/**
 * Reads a JSON configuration file without ever throwing on malformed content.
 * A corrupt file is reported as invalid so the caller can refuse to write rather
 * than silently replacing whatever the user had.
 */
export async function loadJson<T = Record<string, unknown>>(path: string): Promise<LoadedJson<T>> {
  const raw = await readTextIfExists(path)
  if (raw === null) return { exists: false, valid: true, value: null, raw: null, error: null }
  if (raw.trim() === '') {
    return { exists: true, valid: true, value: null, raw, error: null }
  }
  try {
    const value = JSON.parse(raw) as T
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { exists: true, valid: false, value: null, raw, error: 'Expected a JSON object.' }
    }
    return { exists: true, valid: true, value, raw, error: null }
  } catch (error) {
    return {
      exists: true,
      valid: false,
      value: null,
      raw,
      error: error instanceof Error ? error.message : 'Unparsable JSON.'
    }
  }
}

/** Writes formatted JSON with a trailing newline, atomically. */
export async function saveJson(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Adds only the keys we own to an existing settings object, leaving every other key
 * untouched. Returns the keys that were actually changed so removal can be exact.
 * A key already present with a different value is left alone unless force is set,
 * because a user's deliberate choice outranks our default.
 */
export function mergeOwnedKeys(
  existing: Record<string, unknown>,
  additions: Record<string, unknown>,
  options: { force?: boolean } = {}
): { merged: Record<string, unknown>; addedKeys: string[]; conflicts: string[] } {
  const merged: Record<string, unknown> = { ...existing }
  const addedKeys: string[] = []
  const conflicts: string[] = []

  for (const [key, nextValue] of Object.entries(additions)) {
    const hasKey = Object.prototype.hasOwnProperty.call(existing, key)
    if (!hasKey) {
      merged[key] = nextValue
      addedKeys.push(key)
      continue
    }
    if (deepEqual(existing[key], nextValue)) continue
    if (options.force) {
      merged[key] = nextValue
      addedKeys.push(key)
    } else {
      conflicts.push(key)
    }
  }

  return { merged, addedKeys, conflicts }
}

/**
 * Removes keys we previously added, but only when the value still matches what we
 * wrote. A value the user has since edited is preserved.
 */
export function removeOwnedKeys(
  existing: Record<string, unknown>,
  ownedKeys: string[],
  expected: Record<string, unknown>
): { merged: Record<string, unknown>; removedKeys: string[]; keptKeys: string[] } {
  const merged: Record<string, unknown> = { ...existing }
  const removedKeys: string[] = []
  const keptKeys: string[] = []

  for (const key of ownedKeys) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) continue
    if (deepEqual(merged[key], expected[key])) {
      delete merged[key]
      removedKeys.push(key)
    } else {
      keptKeys.push(key)
    }
  }

  return { merged, removedKeys, keptKeys }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  if (typeof a === 'object') {
    const ao = a as Record<string, unknown>
    const bo = b as Record<string, unknown>
    const ak = Object.keys(ao).sort()
    const bk = Object.keys(bo).sort()
    if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false
    return ak.every((k) => deepEqual(ao[k], bo[k]))
  }
  return false
}
