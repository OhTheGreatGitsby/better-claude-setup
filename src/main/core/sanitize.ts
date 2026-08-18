import type { Env } from './env'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
// Long opaque strings that look like credentials. Deliberately broad.
const TOKENISH =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{8,}|xox[abprs]-[A-Za-z0-9-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g
const SECRET_ASSIGNMENT =
  /\b((?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*)("?)[^\s"',;]{4,}\2/gi
// An Authorization value can contain spaces ("Bearer <token>"), so the whole rest of the
// line goes, rather than only the first word after the colon.
const AUTH_HEADER = /\b(authorization\s*[:=]\s*).+/gi
const BEARER = /\b(bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi

/**
 * Removes personal and secret material from any string before it reaches a log file,
 * the diagnostic export, or the UI. Home directory paths become <home> and the OS
 * username is replaced wherever it appears.
 */
export function sanitize(text: string, env: Env): string {
  if (!text) return text
  let out = text

  const home = env.home
  const homeVariants = new Set<string>([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\')])
  for (const variant of homeVariants) {
    if (variant.length > 2) out = replaceAllLiteral(out, variant, '<home>')
  }

  const username = home.split(/[\\/]/).filter(Boolean).pop()
  if (username && username.length >= 3) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(username)}\\b`, 'g'), '<user>')
  }

  out = out.replace(AUTH_HEADER, '$1<redacted>')
  out = out.replace(BEARER, '$1<redacted>')
  out = out.replace(SECRET_ASSIGNMENT, '$1<redacted>')
  out = out.replace(TOKENISH, '<redacted-token>')
  out = out.replace(EMAIL, '<redacted-email>')
  out = out.replace(IPV4, '<redacted-ip>')
  return out
}

function replaceAllLiteral(haystack: string, needle: string, replacement: string): string {
  return haystack.split(needle).join(replacement)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
