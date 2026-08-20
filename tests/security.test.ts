import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  PathEscapeError,
  assertInside,
  assertSafeRelative,
  resolveInside
} from '../src/main/core/safe-fs'
import { assertNoShellMetacharacters, run } from '../src/main/core/exec'
import { sanitize } from '../src/main/core/sanitize'
import { assertBlockId } from '../src/main/core/markers'
import type { Env } from '../src/main/core/env'

const env: Env = { home: '/home/testperson', platform: 'linux', now: () => new Date(0) }

describe('path traversal defences', () => {
  it('rejects parent directory segments', () => {
    expect(() => assertSafeRelative('../../etc/passwd')).toThrow(/traversal/i)
    expect(() => assertSafeRelative('skills/../../..')).toThrow(/traversal/i)
    expect(() => assertSafeRelative('a/../../b')).toThrow(/traversal/i)
  })

  it('rejects absolute paths and Windows drive prefixes', () => {
    expect(() => assertSafeRelative('/etc/passwd')).toThrow(/relative/i)
    expect(() => assertSafeRelative('C:\\Windows\\System32')).toThrow(/relative/i)
  })

  it('rejects NUL bytes used to truncate paths', () => {
    expect(() => assertSafeRelative('skill\u0000.md')).toThrow(/NUL/)
  })

  it('rejects empty input', () => {
    expect(() => assertSafeRelative('')).toThrow()
    expect(() => assertSafeRelative('   ')).toThrow()
  })

  it('normalises harmless relative paths', () => {
    expect(assertSafeRelative('a/./b')).toMatch(/a[\\/]b/)
  })

  it('keeps resolved paths inside the root', () => {
    const root = join('/tmp', 'root')
    expect(resolveInside(root, 'skills/research')).toContain('root')
    expect(() => resolveInside(root, '../outside')).toThrow()
  })

  it('assertInside rejects the root itself and anything above it', () => {
    expect(() => assertInside('/tmp/root', '/tmp/root')).toThrow(PathEscapeError)
    expect(() => assertInside('/tmp', '/tmp/root')).toThrow(PathEscapeError)
    expect(() => assertInside('/tmp/root/child', '/tmp/root')).not.toThrow()
  })

  it('rejects unusual skill ids that could become directory names', () => {
    expect(() => assertBlockId('../evil')).toThrow()
    expect(() => assertBlockId('Core')).toThrow()
    expect(() => assertBlockId('a b')).toThrow()
    expect(assertBlockId('core-behaviour')).toBe('core-behaviour')
  })
})

describe('command execution defences', () => {
  it('refuses command names containing shell metacharacters', () => {
    expect(() => assertNoShellMetacharacters('sh -c "rm -rf /"')).toThrow()
    expect(() => assertNoShellMetacharacters('claude; rm -rf ~')).toThrow()
    expect(() => assertNoShellMetacharacters('claude && curl evil.test')).toThrow()
    expect(() => assertNoShellMetacharacters('claude`whoami`')).toThrow()
    expect(() => assertNoShellMetacharacters('claude$(id)')).toThrow()
  })

  it('accepts ordinary executable paths on both platforms', () => {
    expect(() => assertNoShellMetacharacters('/usr/local/bin/claude')).not.toThrow()
    expect(() =>
      assertNoShellMetacharacters('C:\\Users\\someone\\AppData\\Roaming\\npm\\claude.cmd')
    ).not.toThrow()
  })

  it('rejects NUL bytes in arguments', async () => {
    await expect(run(env, 'node', ['--version\u0000'])).rejects.toThrow(/NUL/)
  })

  it('treats shell metacharacters in arguments as literal text, not as commands', async () => {
    // If a shell were involved, the semicolon would start a second command.
    const result = await run(env, process.execPath, ['-e', 'console.log(process.argv[1])', '; id'])
    expect(result.stdout).toContain('; id')
    expect(result.stdout).not.toMatch(/uid=/)
  })
})

describe('sanitising output', () => {
  it('replaces the home directory in both slash styles', () => {
    const windows: Env = { ...env, home: 'C:\\Users\\Someone', platform: 'win32' }
    expect(sanitize('C:\\Users\\Someone\\.claude\\settings.json', windows)).toBe(
      '<home>\\.claude\\settings.json'
    )
    expect(sanitize('C:/Users/Someone/.claude', windows)).toBe('<home>/.claude')
  })

  it('replaces the operating system username wherever it appears', () => {
    expect(sanitize('user testperson ran the installer', env)).toContain('<user>')
  })

  it('redacts email addresses and IP addresses', () => {
    expect(sanitize('contact someone@example.com now', env)).toContain('<redacted-email>')
    const address = [192, 168, 1, 42].join('.')
    expect(sanitize(`connected to ${address}`, env)).toContain('<redacted-ip>')
  })

  it('redacts credential-shaped strings', () => {
    // Assembled from pieces rather than written out, so this file contains no literal
    // string that a credential scanner would have to be told to ignore.
    const letters = 'abcdefghijklmnop'
    const samples = [
      ['sk', letters].join('-'),
      ['ghp', letters.toUpperCase() + 'QRST'].join('_'),
      ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'dBjftJeZ4CVPmB92K27uhb'].join('.')
    ]
    for (const sample of samples) {
      expect(sanitize(`token: ${sample}`, env)).not.toContain(sample)
    }
  })

  it('redacts assignments regardless of spelling or case', () => {
    expect(sanitize('API_KEY=hunter2hunter2', env)).not.toContain('hunter2hunter2')
    expect(sanitize('Authorization: Bearer abcdefgh', env)).not.toContain('abcdefgh')
    expect(sanitize('password = "correcthorse"', env)).not.toContain('correcthorse')
  })

  it('leaves ordinary text alone', () => {
    expect(sanitize('Installed 4 components successfully.', env)).toBe(
      'Installed 4 components successfully.'
    )
  })
})
