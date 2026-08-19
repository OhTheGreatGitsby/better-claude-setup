# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-08-19

### Fixed

- **Claude Desktop detection.** Version 1.0.0 checked three hard-coded per-user folders and
  reported "Not found" for a desktop app that was installed and running. On Windows the app
  is commonly delivered as an MSIX package, which installs under
  `C:\Program Files\WindowsApps` — an ACL-locked directory an ordinary process cannot list,
  so no number of extra paths could ever have found it. Detection now asks the operating
  system's own installed-application records first: app packages, then installed programs,
  then install folders, then the start menu on Windows; Applications folders then Spotlight
  on macOS, with the version read from `Info.plist`; documented package paths on Linux.
- **An overstated claim.** The app, the README and the research notes said setup "also
  improves the Claude desktop app". That is true only of the desktop app's **Code** tab,
  which reads the same files as the CLI. The **Chat** and **Cowork** tabs are configured by
  your Anthropic account, not by anything on your computer. Every surface is now listed
  individually in the app and in the README.

### Added

- A design system — `design/tokens.css`, `base.css`, `components.css` and a component kit —
  replacing per-screen styling. Structure derived from the supplied reference: hard
  geometry, hairline borders, depth from hard offsets, square glyph tiles opening panel
  headers, monospace micro-labels, bracket-wrapped primary actions.
- A Claude mascot state system: seven application states mapped onto the three supplied
  pieces of pixel artwork, each with its own restrained motion, all honouring reduced-motion.
- A live installation screen, and progressive system-scan results. Both are driven by events
  the engine emits as each operation genuinely finishes; nothing advances on a timer.
- **Detection details** panels on the scan and manager screens, listing every route tried
  and what it found, with locations described rather than printed in full.
- A "Which Claude this affects" screen, listing each surface and whether it is configured.
- A third configuration state, **partly set up**, for when files recorded in the manifest
  have been removed outside the app, plus a Repair action that reinstates them.
- "Uncertain" as a distinct detection answer, for a leftover settings folder with no
  application, instead of forcing a guess into yes or no.
- Interface tests: Playwright drives the built app against a throwaway home directory
  through launch, scan, recommended setup, review, install, success, manager, disabling one
  component and restoring, asserting against files on disk at each stage. They run in CI on
  Windows.
- 17 new engine tests covering the detection failure, including the exact registry output
  from the machine where it was reproduced.

### Changed

- The native title bar is replaced by an in-app strip that doubles as the drag handle, with
  real window controls kept where each platform puts them and their colour following the
  system theme.
- Default window is 1120×800, minimum 760×600; two-column layouts collapse below 900px.
- `Env` gained an optional command seam so detection tests run against fixtures rather than
  whatever happens to be installed on the build machine.
- Buttons that render decorative angle brackets carry an explicit `aria-label`, because
  Chromium folds CSS generated content into the accessible name.

## [1.0.0] — 2026-08-18

First release.

### Added

- **System scan** that reports the operating system, Claude desktop app, Claude Code and
  version, existing `CLAUDE.md`, existing skills and previous Better Claude Setup state,
  without modifying anything.
- **Core improvements preset**: a 40-line block added to `~/.claude/CLAUDE.md` inside a
  marked, removable fence.
- **Ten skills** across writing, research, coding, planning and design, installed to
  `~/.claude/skills/bcs-*/` and loaded by Claude only when relevant.
- **Optional components**: `alwaysThinkingEnabled`, and two opt-in add-ons from Anthropic's
  official plugin catalogue (`security-guidance`, `commit-commands`).
- **Claude Code installation** via WinGet on Windows and Homebrew on macOS, with the exact
  command shown before it runs, and verification afterwards by asking the installed binary
  for its version.
- **"What will change?" screen** listing every write before anything happens.
- **Automatic backup** of `CLAUDE.md`, `settings.json` and `skills/` before the first
  modification.
- **Transactional install** with automatic rollback of completed steps when a later step
  fails.
- **Component manager** on relaunch: enable, remove individually, disable everything, or
  restore the original configuration.
- **Diagnostic report**, scrubbed of home paths, usernames, email addresses, IP addresses
  and credential-shaped strings, viewable in the app and exportable to a file.
- Windows NSIS installers (x64, arm64) and macOS disk images (arm64, x64).
- 75 automated tests covering path traversal, command injection, redaction, safe merging,
  marked blocks, install, rollback, removal, backup and restore.

### Known limitations

- Windows builds are not code-signed and macOS builds are not notarised; both require paid
  certificates the project does not have.
- macOS builds are produced by CI but have not been launched on a Mac by the maintainer.
- The personal instructions and Styles inside the Claude chat app are account settings held
  by Anthropic and cannot be configured by any local application.
- The two optional Anthropic plugins cannot be version-pinned, because Claude Code resolves
  the marketplace version itself.

[Unreleased]: https://github.com/OhTheGreatGitsby/better-claude-setup/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/OhTheGreatGitsby/better-claude-setup/releases/tag/v1.1.0
[1.0.0]: https://github.com/OhTheGreatGitsby/better-claude-setup/releases/tag/v1.0.0
