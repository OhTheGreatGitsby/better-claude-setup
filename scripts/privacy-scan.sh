#!/usr/bin/env bash
#
# Scans the working tree and the full git history for anything that would identify the
# machine or the person who built this, or that looks like a credential.
#
# Deliberately pattern-based: it must not contain the maintainer's own name, username or
# email, because this file is public. Anything genuinely fictional that matches a pattern
# is allowed by name in ALLOWED_PLACEHOLDERS below.
#
# Usage: bash scripts/privacy-scan.sh
set -uo pipefail

fail=0

# Placeholder identities used deliberately in tests and documentation. Kept as exact
# strings rather than loose words: an allowlist entry as broad as "example" would swallow
# a genuine leak that happened to sit on the same line.
ALLOWED_PLACEHOLDERS='/home/testperson|C:\\\\Users\\\\Someone|C:\\\\Users\\\\someone|C:/Users/Someone|someone@example\.com|users\.noreply\.github\.com'

report() {
  echo ""
  echo "FAIL: $1"
  fail=1
}

scan_tree() {
  local label="$1" pattern="$2"
  local hits
  hits=$(git grep -n -I -E "$pattern" -- \
    ':!package-lock.json' \
    ':!docs/screenshots' \
    ':!scripts/privacy-scan.sh' 2>/dev/null \
    | grep -Ev "$ALLOWED_PLACEHOLDERS" || true)
  if [ -n "$hits" ]; then
    report "$label found in the working tree"
    echo "$hits" | head -20
  fi
}

scan_history() {
  local label="$1" pattern="$2"
  local hits revs
  revs=$(git rev-list --all 2>/dev/null)
  # With no commits yet there is no history to search, and passing an empty revision list
  # to git grep would silently search the working tree again.
  if [ -z "$revs" ]; then
    return
  fi
  # Search every blob ever committed, not just the current checkout.
  hits=$(git grep -n -I -E "$pattern" $revs -- \
    ':!package-lock.json' \
    ':!docs/screenshots' \
    ':!scripts/privacy-scan.sh' 2>/dev/null \
    | grep -Ev "$ALLOWED_PLACEHOLDERS" | head -20 || true)
  if [ -n "$hits" ]; then
    report "$label found in git history"
    echo "$hits"
  fi
}

echo "Scanning for absolute home directory paths..."
HOME_PATHS='([A-Za-z]:\\Users\\[A-Za-z0-9._-]+|/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+)'
scan_tree "Absolute home directory path" "$HOME_PATHS"
scan_history "Absolute home directory path" "$HOME_PATHS"

echo "Scanning for email addresses..."
EMAILS='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
scan_tree "Email address" "$EMAILS"
scan_history "Email address" "$EMAILS"

echo "Scanning for credential-shaped strings..."
SECRETS='(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})'
scan_tree "Credential-shaped string" "$SECRETS"
scan_history "Credential-shaped string" "$SECRETS"

echo "Scanning for private IP addresses..."
# Basic ERE: git grep here does not accept PCRE non-capturing groups.
scan_tree "IP address" '([0-9]{1,3}\.){3}[0-9]{1,3}'

echo "Checking for files that should never be committed..."
FORBIDDEN=$(git ls-files | grep -E '(^|/)(\.env($|\.)|.*\.pem$|.*\.p12$|.*\.pfx$|.*\.key$|\.npmrc$|id_rsa|\.claude/settings|credentials\.json)' || true)
if [ -n "$FORBIDDEN" ]; then
  report "Files that must not be committed are tracked"
  echo "$FORBIDDEN"
fi

echo "Checking commit author identities..."
AUTHORS=$(git log --format='%an <%ae>%n%cn <%ce>' 2>/dev/null | sort -u || true)
if [ -n "$AUTHORS" ]; then
  BAD=$(echo "$AUTHORS" | grep -vE '(users\.noreply\.github\.com|@github\.com)' || true)
  if [ -n "$BAD" ]; then
    report "Commit identities are not GitHub noreply addresses"
    echo "$BAD"
  fi
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "Privacy scan passed: nothing identifying found."
else
  echo "Privacy scan FAILED. Fix the findings above before publishing."
fi
exit "$fail"
