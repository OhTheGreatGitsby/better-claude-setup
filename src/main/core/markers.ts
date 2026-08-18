/**
 * Better Claude Setup only ever adds fenced blocks to CLAUDE.md. Each block carries a
 * stable id, so a block can be added, replaced or removed without reading or rewriting
 * anything the user wrote around it.
 */

export const BLOCK_START = (id: string): string => `<!-- BEGIN better-claude-setup:${id} -->`
export const BLOCK_END = (id: string): string => `<!-- END better-claude-setup:${id} -->`

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

export function assertBlockId(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid block id: "${id}".`)
  return id
}

export function hasBlock(document: string, id: string): boolean {
  assertBlockId(id)
  return document.includes(BLOCK_START(id)) && document.includes(BLOCK_END(id))
}

export function listBlockIds(document: string): string[] {
  const ids: string[] = []
  const re = /<!-- BEGIN better-claude-setup:([a-z0-9-]{1,64}) -->/g
  let match: RegExpExecArray | null
  while ((match = re.exec(document)) !== null) {
    const id = match[1]
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

/** Inserts the block at the end, or replaces it in place if it is already present. */
export function upsertBlock(document: string, id: string, body: string): string {
  assertBlockId(id)
  const block = `${BLOCK_START(id)}\n${body.trim()}\n${BLOCK_END(id)}`
  if (hasBlock(document, id)) {
    return replaceBlock(document, id, block)
  }
  const base = document.trimEnd()
  return base === '' ? `${block}\n` : `${base}\n\n${block}\n`
}

/** Removes the block and the blank line that separated it, leaving other content intact. */
export function removeBlock(document: string, id: string): string {
  assertBlockId(id)
  if (!hasBlock(document, id)) return document
  const stripped = replaceBlock(document, id, '\u0000')
  const collapsed = stripped
    .replace(/\n{0,2}\u0000\n?/, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
  return collapsed === '' ? '' : `${collapsed}\n`
}

function replaceBlock(document: string, id: string, replacement: string): string {
  const start = document.indexOf(BLOCK_START(id))
  const endMarker = BLOCK_END(id)
  const endIndex = document.indexOf(endMarker, start)
  if (start === -1 || endIndex === -1) return document
  return document.slice(0, start) + replacement + document.slice(endIndex + endMarker.length)
}
