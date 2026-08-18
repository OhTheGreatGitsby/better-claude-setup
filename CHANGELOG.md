# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/OhTheGreatGitsby/better-claude-setup/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/OhTheGreatGitsby/better-claude-setup/releases/tag/v1.0.0
