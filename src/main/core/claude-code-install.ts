import type { OperationResult, StepResult } from '@shared/types'
import type { Env } from './env'
import { run } from './exec'
import { detectClaudeCodeVersion } from './detect'
import { log } from './logger'

/**
 * Installing Claude Code.
 *
 * Anthropic documents several installation routes. The two used here are the package
 * managers — WinGet on Windows, Homebrew on macOS — because both verify publisher
 * signatures themselves and neither requires downloading and executing a script.
 *
 * Anthropic also documents a one-line installer that pipes a remote script straight into
 * a shell. This app deliberately does not run that, because a downloaded script executing
 * with the user's privileges is exactly the pattern an installer should not normalise.
 * When no package manager is available the app sends the user to Anthropic's own
 * installation page instead, and says why.
 */

export const CLAUDE_CODE_DOCS_URL = 'https://code.claude.com/docs/en/setup'

export type InstallRoute =
  | { kind: 'winget' }
  | { kind: 'homebrew' }
  | { kind: 'manual'; reason: string }

/** Decides how Claude Code can be installed here, without installing anything. */
export async function chooseInstallRoute(env: Env): Promise<InstallRoute> {
  if (env.platform === 'win32') {
    const probe = await run(env, 'winget.exe', ['--version'], { timeoutMs: 20_000 })
    if (probe.ok) return { kind: 'winget' }
    return {
      kind: 'manual',
      reason:
        'WinGet, the Windows package installer, is not available on this machine. Windows 10 and 11 normally include it as "App Installer".'
    }
  }

  if (env.platform === 'darwin') {
    const probe = await run(env, 'brew', ['--version'], { timeoutMs: 20_000 })
    if (probe.ok) return { kind: 'homebrew' }
    return {
      kind: 'manual',
      reason: 'Homebrew is not installed on this Mac.'
    }
  }

  return {
    kind: 'manual',
    reason: 'Automatic installation is only offered on Windows and macOS.'
  }
}

/** Human-readable description of the exact command that will run. Shown before consent. */
export function describeRoute(route: InstallRoute): string {
  switch (route.kind) {
    case 'winget':
      return 'winget install --id Anthropic.ClaudeCode --exact --source winget'
    case 'homebrew':
      return 'brew install --cask claude-code'
    case 'manual':
      return `Open ${CLAUDE_CODE_DOCS_URL} in your browser`
  }
}

/**
 * Installs Claude Code through the chosen package manager, then verifies by asking the
 * installed binary for its version. The result is only reported as successful when that
 * verification actually succeeds.
 */
export async function installClaudeCode(env: Env): Promise<OperationResult> {
  const route = await chooseInstallRoute(env)
  const steps: StepResult[] = []

  if (route.kind === 'manual') {
    return {
      ok: false,
      steps: [
        {
          id: 'install-claude-code',
          label: 'Install Claude Code',
          status: 'skipped',
          message: `${route.reason} Open Anthropic's installation page and follow the steps there, then run the system scan again.`,
          detail: CLAUDE_CODE_DOCS_URL
        }
      ],
      backupId: null,
      rolledBack: false,
      summary: 'Claude Code was not installed automatically.'
    }
  }

  const command = route.kind === 'winget' ? 'winget.exe' : 'brew'
  const args =
    route.kind === 'winget'
      ? [
          'install',
          '--id',
          'Anthropic.ClaudeCode',
          '--exact',
          '--source',
          'winget',
          '--accept-package-agreements',
          '--accept-source-agreements'
        ]
      : ['install', '--cask', 'claude-code']

  await log(env, 'info', `Installing Claude Code via ${route.kind}`)
  const result = await run(env, command, args, { timeoutMs: 15 * 60_000 })

  steps.push({
    id: 'install-claude-code',
    label: `Install Claude Code using ${route.kind === 'winget' ? 'WinGet' : 'Homebrew'}`,
    status: result.ok ? 'done' : 'failed',
    message: result.ok
      ? 'The installer finished.'
      : 'The installer did not finish successfully. The technical output is below.',
    detail: result.safeOutput,
    exitCode: result.exitCode
  })

  // Trust the verification, not the installer's exit code.
  const verified = await detectClaudeCodeVersion(env)
  steps.push({
    id: 'verify-claude-code',
    label: 'Check that Claude Code now runs',
    status: verified.installed && verified.version ? 'done' : 'failed',
    message:
      verified.installed && verified.version
        ? `Claude Code ${verified.version} is installed.`
        : 'Claude Code still does not answer when asked for its version. You may need to close and reopen this app, or restart your computer, so the new program is found.'
  })

  const ok = verified.installed && Boolean(verified.version)
  return {
    ok,
    steps,
    backupId: null,
    rolledBack: false,
    summary: ok
      ? `Claude Code ${verified.version} is ready.`
      : 'Claude Code could not be confirmed as installed.'
  }
}
