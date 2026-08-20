# Tasks

Working record for Better Claude Setup. Items move to DONE only when the thing itself was
actually run, not when the code that would do it was written.

## DONE

### Phase A — Discovery
- [x] Inspect the project directory (empty), toolchain (Node 24, npm 11, git, GitHub CLI
      2.97), and OS (Windows 11)
- [x] Confirm no Rust toolchain is present — this decided the framework choice
- [x] Read the local Claude state read-only: Claude Code 2.1.232, desktop config directory
      present, `~/.claude/settings.json` with 8 keys, no user `CLAUDE.md`, no skills folder

### Phase B — Research
- [x] Verify Claude Code settings locations, keys and precedence against current docs
- [x] Verify `CLAUDE.md` locations, load order and the under-200-lines guidance
- [x] Verify the skill format, frontmatter fields, and that only name + description sit in
      context until a skill is used
- [x] Verify every documented Claude Code installation route and choose between them
- [x] Establish that the desktop app shares `~/.claude` with Claude Code
- [x] Establish that Claude app personal preferences and Styles are **account** settings
      with no local file — recorded as a product limitation rather than worked around
- [x] Read the official plugin marketplace catalogue and select two components from it
- [x] Reject community plugins, LSP plugins, output styles, hooks, MCP and large prompt
      packs, each with a written reason
- [x] Write `docs/research.md` **before** the architecture was fixed

### Phase C — Plan
- [x] Choose Electron over Tauri and record why in `docs/architecture.md`
- [x] Design the reversible-operation install model
- [x] Write the security model in `docs/security.md`

### Phase D–E — Foundation and engine
- [x] Project scaffold: electron-vite, TypeScript (strict, `noUncheckedIndexedAccess`),
      React, Vitest, electron-builder
- [x] `Env` seam so no core function reads the real home directory
- [x] Path containment, atomic writes, tolerant JSON reads, owned-key merge and removal
- [x] Marked-block add / replace / remove for `CLAUDE.md`
- [x] Backup, restore, install manifest with per-artifact records
- [x] Transactional installer with reverse-order rollback
- [x] Argv-array process execution with no shell anywhere
- [x] Sanitising logger and diagnostic report

### Phase F — Interface
- [x] Welcome, system scan, Claude Code step, choose, customise, "What will change?",
      result, and the relaunch manager
- [x] Every component shows what it writes, its source, licence, verification date, network
      use and context cost
- [x] Technical output behind expandable sections, never dumped at a beginner

### Phase G — Components
- [x] Core preset (40 lines) and ten skills across five categories
- [x] One optional setting and two opt-in Anthropic plugins

### Phase H — QA
- [x] 75 automated tests, all passing
- [x] Typecheck clean on both projects
- [x] `npm audit`: 0 vulnerabilities
- [x] Built the Windows installers (x64 93 MB, arm64 96 MB) and launched the packaged app
- [x] Drove the built app through install, component removal and restore against a
      throwaway home directory, and checked the resulting files by hand

### Phase I–J — Repository and distribution
- [x] Privacy scanner written, and verified by planting a violation and confirming it fails
- [x] Repository initialised with a GitHub noreply identity
- [x] CI: format, typecheck, test, audit, privacy scan, Windows and macOS builds
- [x] Release workflow with checksums and build provenance attestation

## NOT DONE — and why

- **Windows code signing.** Needs a paid certificate. Users will see a SmartScreen warning.
- **macOS notarisation.** Needs an Apple Developer account. Users will need to right-click →
  Open on first launch.
- **Running the macOS build on a Mac.** CI builds it; nobody has launched it. Stated in the
  README rather than implied to be tested.
- **Version pinning for the two Anthropic plugins.** Claude Code owns marketplace version
  resolution; this app cannot pin it.
- **macOS desktop-app detection on real hardware.** The routes are implemented and tested
  against fixtures, but nobody has run them against an actual macOS installation.

## DONE — v1.1.0

- [x] Reproduce the Claude Desktop detection failure on a real machine and find the cause:
      an MSIX package in an ACL-locked directory that no filesystem check could ever reach
- [x] Rewrite detection to use the operating system's own installed-application records,
      with every route recorded and shown in the interface
- [x] Add a third answer, "uncertain", for a leftover settings folder with no application
- [x] Add a command seam to `Env` so detection tests are hermetic
- [x] Verify the fix read-only against the reporting machine: installed, 1.32352.1.0
- [x] Re-verify the configuration-sharing claim and correct it everywhere: the desktop
      app's Code tab shares files, Chat and Cowork do not
- [x] Derive a design system from the supplied reference and rebuild every screen on it
- [x] Build a mascot state system over the three supplied pieces of artwork
- [x] Replace timed progress with events the engine emits as work genuinely finishes
- [x] Add a live installation screen and a "partly set up" state with a Repair action
- [x] Replace the native title bar with an in-app strip, keeping real window controls
- [x] Playwright interface tests over the whole critical path, wired into CI
- [x] Visual review of every screen in dark, light and at a narrow window size

## DONE — v1.2.0

- [x] Confirm the local logo work was safe: already committed as 64fdd30 and pushed
- [x] Re-research Claude account skills; the v1.1 "chats cannot use these" claim is now wrong
- [x] Diagnose the macOS "damaged" failure: the app had no signature at all, because
      electron-builder skips signing with no certificate and does not fall back to ad-hoc
- [x] Fix it with explicit ad-hoc signing and hardened runtime off, verified on a macOS
      arm64 runner including a quarantined copy and a real process launch
- [x] One canonical skill source exporting to Claude Code and Claude account formats
- [x] Rename the commands, avoiding the /plan and /deep-research collisions
- [x] Build account upload packages with an in-repo ZIP writer, no new dependency
- [x] Guided three-step chat setup that never touches the account
- [x] Separate Claude Code and Claude Chat surfaces throughout, with specific status wording
- [x] Fix the native-control overlap using the overlay geometry the OS publishes,
      measured at four widths across three display scales
- [x] Interface polish: SVG icon set, interface-font panel titles, larger type, quieter grid
- [x] Dedicated small logo mark cropped from the supplied artwork
- [x] Download-first README with direct per-architecture links

## TODO — next

- [ ] Sign and notarise once certificates exist — the single largest remaining gap
- [ ] Behavioural evaluation of the skills themselves across both surfaces; current tests
      assert content and packaging, not answer quality
- [ ] Confirm macOS desktop-app detection against a real macOS installation
- [ ] Detect the languages a user actually works in, and offer the matching LSP plugin
- [ ] Update checking for installed components, with a visible diff of what changed
- [ ] Path-scoped rules (`.claude/rules/`) for coding guidance, so it loads only near code
- [ ] Translations
