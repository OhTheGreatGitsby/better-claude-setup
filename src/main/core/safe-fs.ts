import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * Thrown when a computed path would escape the directory it is supposed to stay in.
 * Every write in this application goes through assertInside first.
 */
export class PathEscapeError extends Error {
  constructor(target: string, root: string) {
    super(`Refusing to touch "${target}" because it is outside "${root}".`)
    this.name = 'PathEscapeError'
  }
}

/** Rejects absolute paths, traversal segments, NUL bytes and Windows drive prefixes. */
export function assertSafeRelative(relPath: string): string {
  if (!relPath || relPath.trim() === '') throw new Error('Empty relative path.')
  if (relPath.includes('\0')) throw new Error('Path contains a NUL byte.')
  if (isAbsolute(relPath) || /^[a-zA-Z]:/.test(relPath)) {
    throw new Error(`Expected a relative path, received "${relPath}".`)
  }
  const parts = relPath.split(/[\\/]+/)
  if (parts.some((p) => p === '..')) throw new Error(`Path traversal rejected: "${relPath}".`)
  return parts.filter((p) => p !== '.' && p !== '').join(sep)
}

/** Resolves relPath under root and proves the result stays inside root. */
export function resolveInside(root: string, relPath: string): string {
  const safeRel = assertSafeRelative(relPath)
  const absoluteRoot = resolve(root)
  const target = resolve(absoluteRoot, safeRel)
  assertInside(target, absoluteRoot)
  return target
}

export function assertInside(target: string, root: string): void {
  const rel = relative(resolve(root), resolve(target))
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new PathEscapeError(target, root)
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Writes to a sibling temporary file and renames it into place, so an interrupted
 * write can never leave a half-written configuration file behind.
 */
export async function writeTextAtomic(target: string, contents: string): Promise<void> {
  await fs.mkdir(dirname(target), { recursive: true })
  const tmp = join(dirname(target), `.${basenameOf(target)}.bcs-tmp-${process.pid}`)
  await fs.writeFile(tmp, contents, { encoding: 'utf8', mode: 0o600 })
  await fs.rename(tmp, target)
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

export async function removeIfExists(p: string): Promise<void> {
  await fs.rm(p, { recursive: true, force: true })
}

export async function copyDir(from: string, to: string): Promise<void> {
  await fs.cp(from, to, { recursive: true })
}

function basenameOf(p: string): string {
  return p.split(/[\\/]/).pop() ?? 'file'
}
