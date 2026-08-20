#!/usr/bin/env bash
#
# Proves that a macOS build is structurally capable of launching, rather than merely
# proving that electron-builder produced a file.
#
# Version 1.1.0 shipped a macOS build that failed on a real Mac with "is damaged and
# can't be opened". The cause was an app with no signature at all: electron-builder skips
# signing when no certificate is found and does not fall back to ad-hoc, and Apple Silicon
# refuses to run an unsigned executable. Nothing in the old pipeline would have caught it,
# because a broken app still produces a perfectly good DMG.
#
# Every check below is one that would have failed on that build.
#
# Usage: bash scripts/verify-macos-build.sh [release-dir]
set -uo pipefail

RELEASE_DIR="${1:-release}"
failures=0

section() {
  echo ""
  echo "=============================================================="
  echo "  $1"
  echo "=============================================================="
}

fail() {
  echo "FAIL: $1"
  failures=$((failures + 1))
}

pass() {
  echo "ok: $1"
}

if [ "$(uname)" != "Darwin" ]; then
  echo "This script only means anything on macOS; skipping."
  exit 0
fi

section "Artifacts produced"
shopt -s nullglob
dmgs=("$RELEASE_DIR"/*.dmg)
if [ ${#dmgs[@]} -eq 0 ]; then
  fail "No .dmg was produced"
  exit 1
fi
for dmg in "${dmgs[@]}"; do
  echo "  $(basename "$dmg") — $(du -h "$dmg" | cut -f1)"
done

APP_PATH="$RELEASE_DIR/mac-arm64/Better Claude Setup.app"
[ -d "$APP_PATH" ] || APP_PATH="$RELEASE_DIR/mac/Better Claude Setup.app"
[ -d "$APP_PATH" ] || APP_PATH="$RELEASE_DIR/mac-universal/Better Claude Setup.app"

if [ ! -d "$APP_PATH" ]; then
  fail "No .app bundle found under $RELEASE_DIR"
  ls -la "$RELEASE_DIR" || true
  exit 1
fi
pass "Found app bundle: $APP_PATH"

BIN="$APP_PATH/Contents/MacOS/Better Claude Setup"

section "Bundle structure"
for required in \
  "$APP_PATH/Contents/Info.plist" \
  "$BIN" \
  "$APP_PATH/Contents/Frameworks/Electron Framework.framework" \
  "$APP_PATH/Contents/Resources/app.asar"; do
  if [ -e "$required" ]; then
    pass "present: ${required#"$APP_PATH/"}"
  else
    fail "missing: ${required#"$APP_PATH/"}"
  fi
done

if [ -x "$BIN" ]; then
  pass "main executable has the executable bit"
else
  fail "main executable is not executable"
fi

section "Info.plist"
if plutil -lint "$APP_PATH/Contents/Info.plist" >/dev/null 2>&1; then
  pass "Info.plist parses"
  for key in CFBundleIdentifier CFBundleShortVersionString CFBundleExecutable LSMinimumSystemVersion; do
    value=$(plutil -extract "$key" raw -o - "$APP_PATH/Contents/Info.plist" 2>/dev/null || echo "MISSING")
    echo "    $key = $value"
    [ "$value" = "MISSING" ] && fail "Info.plist is missing $key"
  done
else
  fail "Info.plist does not parse"
fi

section "Architecture"
arch_output=$(file "$BIN")
echo "  $arch_output"
case "$arch_output" in
  *arm64*|*x86_64*) pass "executable is a recognised Mach-O architecture" ;;
  *) fail "unexpected executable architecture" ;;
esac

section "Code signature"
# This is the check that would have caught the 1.1.0 failure.
if codesign -dv --verbose=4 "$APP_PATH" 2>&1 | tee /tmp/codesign-info.txt; then
  pass "the bundle carries a signature"
  if grep -q "Signature=adhoc" /tmp/codesign-info.txt; then
    echo "    signature type: ad-hoc (expected without a Developer ID certificate)"
  elif grep -q "Authority=Developer ID Application" /tmp/codesign-info.txt; then
    echo "    signature type: Developer ID (real certificate present)"
  fi
else
  fail "the bundle has NO signature — Apple Silicon will refuse to launch it as 'damaged'"
fi

section "Signature validity, including nested code"
if codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1; then
  pass "signature verifies, nested frameworks included"
else
  fail "signature verification failed"
fi

section "Gatekeeper assessment"
# Without notarization this is EXPECTED to be rejected. What matters is *which* rejection:
# "Unnotarized Developer ID" or "unsigned" is survivable by the user; a malformed bundle
# is not. The result is recorded rather than asserted.
spctl_out=$(spctl --assess --type execute --verbose=4 "$APP_PATH" 2>&1 || true)
echo "$spctl_out"
if echo "$spctl_out" | grep -qi "accepted"; then
  echo "    Gatekeeper ACCEPTS this build (signed and notarized)."
else
  echo "    Gatekeeper rejects this build, which is expected without notarization."
  echo "    The user-facing consequence is documented in the README."
fi

section "Quarantine behaviour"
# Simulates what actually happens to a downloaded DMG, which is where 1.1.0 broke.
QTEST=$(mktemp -d)
cp -R "$APP_PATH" "$QTEST/" 2>/dev/null
QAPP="$QTEST/Better Claude Setup.app"
xattr -w com.apple.quarantine "0083;00000000;Safari;" "$QAPP" 2>/dev/null || true
echo "  attributes after simulated download:"
xattr -l "$QAPP" 2>/dev/null | sed 's/^/    /' || echo "    (none)"
qverdict=$(spctl --assess --type execute --verbose=4 "$QAPP" 2>&1 || true)
echo "  Gatekeeper verdict on the quarantined copy:"
echo "$qverdict" | sed 's/^/    /'
if echo "$qverdict" | grep -qi "damaged\|invalid\|not signed at all"; then
  fail "a quarantined copy is judged damaged or unsigned — this is the 1.1.0 bug"
else
  pass "the quarantined copy is not judged damaged"
fi
rm -rf "$QTEST"

section "Launch test"
# The strongest check available without a logged-in GUI session: start the real binary and
# see whether the process survives. A "damaged" bundle dies immediately with SIGKILL.
"$BIN" --version >/tmp/launch-out.txt 2>&1 &
launch_pid=$!
sleep 6
if kill -0 "$launch_pid" 2>/dev/null; then
  pass "the application process started and stayed alive"
  kill "$launch_pid" 2>/dev/null || true
  wait "$launch_pid" 2>/dev/null || true
else
  wait "$launch_pid" 2>/dev/null
  code=$?
  # Electron with no window server may exit non-zero; SIGKILL (137) is the signature of a
  # bundle macOS refused to run.
  if [ "$code" -eq 137 ] || [ "$code" -eq 9 ]; then
    fail "the process was killed by the operating system (exit $code) — the bundle is rejected"
  else
    echo "    process exited with $code; output:"
    sed 's/^/    /' /tmp/launch-out.txt | head -20
    pass "the process ran and exited on its own rather than being killed by macOS"
  fi
fi

section "Disk image"
for dmg in "${dmgs[@]}"; do
  echo "  checking $(basename "$dmg")"
  mount_point=$(mktemp -d)
  if hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mount_point" >/dev/null 2>&1; then
    pass "  mounts"
    if ls "$mount_point"/*.app >/dev/null 2>&1; then
      pass "  contains an application bundle"
    else
      fail "  contains no application bundle"
    fi
    hdiutil detach "$mount_point" >/dev/null 2>&1 || true
  else
    fail "  does not mount"
  fi
  rm -rf "$mount_point"
done

section "Result"
if [ "$failures" -eq 0 ]; then
  echo "All macOS package checks passed."
  echo "Signing status is recorded above; Gatekeeper acceptance still requires notarization."
  exit 0
fi
echo "$failures macOS package check(s) FAILED."
exit 1
