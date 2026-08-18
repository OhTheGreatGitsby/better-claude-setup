import { shell } from 'electron'

/**
 * The only path from this application to a web browser. Anything that is not an https
 * URL is dropped, so a malformed or hostile string can never reach the operating system
 * as a file, command or custom protocol handler.
 */
export async function openExternalIfSafe(rawUrl: string): Promise<boolean> {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return false
    await shell.openExternal(url.toString())
    return true
  } catch {
    return false
  }
}
