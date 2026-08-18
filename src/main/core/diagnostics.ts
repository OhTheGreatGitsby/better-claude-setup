import type { Env } from './env'
import { listBackups } from './backup'
import { scanSystem } from './detect'
import { loadManifest } from './manifest'
import { readLog } from './logger'
import { sanitize } from './sanitize'

/**
 * Builds a support report the user can paste into a bug report.
 *
 * Everything in it passes through sanitize, so home directory paths, the operating
 * system username, email addresses, IP addresses and anything token-shaped are replaced
 * before the text is produced. The report never contains Claude conversations, project
 * files, or the contents of the user's own settings values.
 */
export async function buildDiagnosticReport(env: Env, appVersion: string): Promise<string> {
  const [scan, manifest, backups, logText] = await Promise.all([
    scanSystem(env, appVersion),
    loadManifest(env, appVersion),
    listBackups(env),
    readLog(env)
  ])

  const lines: string[] = []
  lines.push('# Better Claude Setup — diagnostic report')
  lines.push('')
  lines.push(
    'This report is generated locally and has been scrubbed of personal paths, usernames and anything that looks like a credential. Nothing is sent anywhere by this app.'
  )
  lines.push('')
  lines.push('## Application')
  lines.push(`- Version: ${appVersion}`)
  lines.push(`- Generated: ${env.now().toISOString()}`)
  lines.push('')
  lines.push('## System')
  lines.push(`- Platform: ${scan.platform}`)
  lines.push(`- Architecture: ${scan.arch}`)
  lines.push(`- OS release: ${scan.osRelease}`)
  lines.push('')
  lines.push('## Claude')
  lines.push(`- Claude Code installed: ${scan.claudeCode.installed}`)
  lines.push(`- Claude Code version: ${scan.claudeCode.version ?? 'unknown'}`)
  lines.push(`- Claude Code found via: ${scan.claudeCode.foundVia ?? 'not found'}`)
  lines.push(`- Claude desktop app detected: ${scan.claudeDesktop.installed}`)
  lines.push(`- Claude desktop config directory present: ${scan.claudeDesktop.configDirExists}`)
  lines.push('')
  lines.push('## Existing configuration')
  lines.push(`- settings.json present: ${scan.existingConfig.settingsJsonExists}`)
  lines.push(`- settings.json parses: ${scan.existingConfig.settingsJsonValid}`)
  if (scan.existingConfig.settingsJsonError) {
    lines.push(`- settings.json error: ${scan.existingConfig.settingsJsonError}`)
  }
  lines.push(`- CLAUDE.md present: ${scan.existingConfig.claudeMdExists}`)
  lines.push(`- CLAUDE.md length: ${scan.existingConfig.claudeMdLines} lines`)
  lines.push(`- Other skills present: ${scan.existingConfig.otherSkills.length}`)
  lines.push('')
  lines.push('## Better Claude Setup state')
  lines.push(
    `- Installed components: ${manifest.components.map((c) => c.componentId).join(', ') || 'none'}`
  )
  lines.push(`- Backups available: ${backups.length}`)
  lines.push('')
  lines.push('## Recent log')
  lines.push('```')
  lines.push(tail(logText, 120) || '(no log entries)')
  lines.push('```')

  return sanitize(lines.join('\n'), env)
}

function tail(text: string, maxLines: number): string {
  const lines = text.split('\n').filter(Boolean)
  return lines.slice(-maxLines).join('\n')
}
