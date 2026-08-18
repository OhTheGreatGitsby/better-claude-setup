import { execFile } from 'node:child_process'
import type { ExecFileOptions } from 'node:child_process'
import { sanitize } from './sanitize'
import type { Env } from './env'

export interface CommandResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  /** Sanitised, ready to show in the technical details drawer. */
  safeOutput: string
}

/**
 * Runs an executable with an argument array. There is no shell involved, so argument
 * values can never be reinterpreted as commands, quoting or redirection.
 *
 * Callers must pass a fixed command name and fixed arguments. Nothing typed by the user
 * is ever forwarded here.
 */
export async function run(
  env: Env,
  command: string,
  args: string[],
  options: { timeoutMs?: number; cwd?: string } = {}
): Promise<CommandResult> {
  assertNoShellMetacharacters(command)
  for (const arg of args) {
    if (typeof arg !== 'string') throw new TypeError('Command arguments must be strings.')
    if (arg.includes('\0')) throw new Error('Command argument contains a NUL byte.')
  }

  const execOptions: ExecFileOptions = {
    timeout: options.timeoutMs ?? 60_000,
    cwd: options.cwd,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    // Explicitly off: a true value would hand the argv to cmd.exe or /bin/sh.
    shell: false
  }

  return new Promise<CommandResult>((resolve) => {
    execFile(command, args, execOptions, (error, stdout, stderr) => {
      const out = String(stdout ?? '')
      const err = String(stderr ?? '')
      const code =
        error && typeof (error as NodeJS.ErrnoException & { code?: number }).code === 'number'
          ? Number((error as unknown as { code: number }).code)
          : error
            ? 1
            : 0
      resolve({
        ok: !error,
        exitCode: code,
        stdout: out,
        stderr: err,
        safeOutput: sanitize([out, err].filter(Boolean).join('\n').trim(), env)
      })
    })
  })
}

/**
 * Command names are hard-coded in this codebase; this check exists so a future edit
 * cannot introduce an interpolated command name without failing loudly.
 */
export function assertNoShellMetacharacters(command: string): void {
  if (!/^[A-Za-z0-9._\\/:+ -]+$/.test(command)) {
    throw new Error(`Refusing to execute a command name containing unusual characters.`)
  }
}
