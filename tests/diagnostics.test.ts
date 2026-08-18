import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildDiagnosticReport } from '../src/main/core/diagnostics'
import { log, readLog } from '../src/main/core/logger'
import { installComponents } from '../src/main/core/installer'
import type { Env } from '../src/main/core/env'
import { cleanup, makeTempEnv, writeFile } from './helpers'

const VERSION = '1.0.0'
let env: Env

beforeEach(() => {
  env = makeTempEnv()
})

afterEach(async () => {
  await cleanup(env)
})

describe('local logging', () => {
  it('writes a line and never records secrets or personal paths', async () => {
    await log(env, 'info', `Reading ${env.home}/.claude/settings.json with API_KEY=supersecret1`)
    const text = await readLog(env)
    expect(text).toContain('INFO')
    expect(text).toContain('<home>')
    expect(text).not.toContain('supersecret1')
    expect(text).not.toContain(env.home)
  })

  it('returns an empty string when there is no log yet', async () => {
    expect(await readLog(env)).toBe('')
  })
})

describe('diagnostic report', () => {
  it('describes the machine without leaking who owns it', async () => {
    await writeFile(env, '.claude/CLAUDE.md', 'my private note\n')
    await installComponents(env, VERSION, ['core-behaviour'])

    const report = await buildDiagnosticReport(env, VERSION)
    expect(report).toContain('Better Claude Setup — diagnostic report')
    expect(report).toContain('core-behaviour')
    expect(report).not.toContain(env.home)

    const username = env.home.split(/[\\/]/).filter(Boolean).pop() ?? ''
    if (username.length >= 3) expect(report).not.toContain(username)
  })

  it('never contains the contents of the user’s own instruction files', async () => {
    await writeFile(env, '.claude/CLAUDE.md', 'SECRET PROJECT PHOENIX detail\n')
    const report = await buildDiagnosticReport(env, VERSION)
    expect(report).not.toContain('PHOENIX')
    expect(report).toContain('CLAUDE.md present: true')
  })
})
