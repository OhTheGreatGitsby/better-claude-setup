# Architecture

## Framework choice

**Electron + TypeScript + React, bundled by electron-vite, packaged by electron-builder.**

### What was evaluated

| Option | Windows + macOS | Installer | Size | Filesystem + process work | Buildable and verifiable here |
| --- | --- | --- | --- | --- | --- |
| **Electron** | yes | NSIS, DMG | ~95 MB | Node APIs directly | **yes, verified** |
| Tauri | yes | NSIS, DMG | ~10 MB | Rust, via commands | no Rust toolchain on the build machine |
| .NET MAUI / WinUI | Windows-first | yes | small | good | macOS story is weak |
| Web app | n/a | n/a | n/a | **cannot touch the filesystem** | disqualified |

### Why Electron won

This application is, in substance, a careful JSON and Markdown editor with a process
launcher attached. Almost all of its risk lives in path handling, atomic writes, merge
semantics and rollback — not in rendering. Electron gives that logic direct access to
Node's `fs` and `child_process` with no bridge layer, and lets the same code be unit tested
under Vitest without launching a GUI at all. That is why the test suite can cover the
install engine end-to-end against fixture home directories.

Tauri produces a binary roughly ten times smaller, and for a distributed installer that is
a real advantage. It was rejected on a verifiability argument rather than a technical one:
the build machine has no Rust toolchain and no MSVC build tools, so choosing Tauri would
have meant shipping a Windows installer that had never been built or run. A 95 MB installer
that demonstrably works beats a 10 MB one that was never compiled.

**Cost accepted:** the installer is ~95 MB per architecture, and the app carries Chromium's
security surface. The second is mitigated by locking the renderer down hard — see
[security.md](security.md).

## Process layout

```
┌─────────────────────────── main process (Node) ────────────────────────────┐
│  index.ts          window creation, navigation and network lockdown        │
│  ipc/handlers.ts   one handler per channel; validates every argument       │
│  core/                                                                     │
│    env.ts          resolves every path from an injected Env, never os      │
│    detect.ts       read-only system scan                                   │
│    catalog.ts      the component manifest (what exists, what it writes)    │
│    content.ts      the actual text written into Claude's configuration     │
│    installer.ts    plan → operations → apply with rollback → manifest      │
│    backup.ts       snapshot and restore of the captured surface            │
│    manifest.ts     what this app installed, so removal can be exact        │
│    json-config.ts  tolerant reads, owned-key merge, owned-key removal      │
│    markers.ts      add/replace/remove a marked block in CLAUDE.md          │
│    safe-fs.ts      path containment, atomic writes                         │
│    exec.ts         argv-array process execution, never a shell             │
│    sanitize.ts     redaction applied to everything that leaves the core    │
│    logger.ts       local, rotated, sanitised                               │
└────────────────────────────────────────────────────────────────────────────┘
                                    ▲
                         contextBridge, 15 named methods
                                    ▼
┌────────────────────── renderer (sandboxed, no Node) ───────────────────────┐
│  App.tsx           screen state machine                                    │
│  screens/*         Welcome, SystemScan, ClaudeCodeStep, Customize,         │
│                    Review, Result, Manager                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

The renderer holds no logic that can change the machine. It renders data and calls named
methods. Every decision about what is safe to write is made in the main process.

## The `Env` seam

Every core function takes an `Env` — `{ home, platform, now }` — rather than calling
`os.homedir()` itself:

```ts
export interface Env {
  home: string
  platform: Platform
  now: () => Date
}
```

This exists for one reason: **the test suite must never use the developer's real Claude
configuration as a scratch pad.** Tests construct an `Env` pointing at a temporary
directory with a fixed clock, so the full install/remove/restore cycle runs against
fixtures. It also makes platform-specific path logic testable on any host — the macOS
detection tests run on Windows.

## Installation as reversible operations

An install is not a script. It is a list of `Operation` values, each with an inverse:

```ts
interface Operation {
  id: string
  label: string
  apply: () => Promise<{ artifacts: Artifact[]; detail?: string }>
  undo: () => Promise<void>
  componentId: string
  version: string
}
```

The sequence is:

1. Build the operation list from the selected component ids.
2. Take a backup of the captured surface (`CLAUDE.md`, `settings.json`, `skills/`).
3. Apply operations in order, collecting the artifacts each one produced.
4. On any failure: run `undo()` on every completed operation **in reverse order**, report
   each undo as its own step, and return `rolledBack: true`.
5. On success: record `{ componentId, version, artifacts }` in the manifest.

Because the manifest stores *artifacts* rather than component names, removal is exact. To
remove the core preset the app deletes one marked block by id, not "the instructions file".
To remove a settings component it deletes a named key **only if the value is still the one
it wrote** — a value the user has since changed is left alone and reported as kept.

### Ownership markers

`CLAUDE.md` is shared with the user, so this app writes only inside a fenced block:

```markdown
<!-- BEGIN better-claude-setup:core-behaviour -->
...
<!-- END better-claude-setup:core-behaviour -->
```

Re-running replaces the block in place rather than appending a second copy. Removing it
collapses the surrounding blank lines so the file returns to its exact previous bytes —
which is asserted in the test suite, not assumed.

Skills are namespaced `bcs-*` and each lives in its own directory, so "our skills" and
"the user's skills" are never ambiguous.

## Failure model

| Situation | Behaviour |
| --- | --- |
| `settings.json` is not valid JSON | Refuse to write it at all; roll the run back; leave the file byte-for-byte unchanged |
| A key we want already has a different value | Keep the user's value, report the conflict, continue |
| A write fails midway | Undo everything already applied, in reverse |
| An undo itself fails | Report it as a failed step and point the user at Restore |
| Claude Code is missing but a plugin was selected | The component is disabled in the UI; if reached anyway, the step fails with a plain-language reason |
| The manifest is missing or corrupt | Treated as empty. A damaged state file never blocks startup |

## Data written

| Path (relative to the Claude folder) | Owner | Purpose |
| --- | --- | --- |
| `CLAUDE.md` | shared | one marked block |
| `skills/bcs-*/` | this app | skill files |
| `settings.json` | shared | named keys only |
| `better-claude-setup/manifest.json` | this app | what was installed, and its artifacts |
| `better-claude-setup/backups/<id>/` | this app | restore points, plus `backup.json` metadata |
| `better-claude-setup/logs/` | this app | sanitised, rotated at 512 KB, one generation kept |

Everything this app owns lives under one directory, so a user can delete
`better-claude-setup/` to forget it entirely without touching Claude.

## Build and release

- `electron-vite` builds three bundles: main (CommonJS), preload, renderer.
- The app version is injected at build time as `__APP_VERSION__`, because
  `app.getVersion()` reports Electron's version when running unpackaged.
- `electron-builder` produces NSIS installers (x64, arm64) and DMGs (arm64, x64).
- The Windows installer is per-user and requests no elevation (`allowElevation: false`).
  Nothing this app does requires administrator rights.
- CI runs typecheck, format check, tests and an `npm audit` on every push, and builds on
  both Windows and macOS runners.
- Releases attach per-architecture artifacts, a `SHA256SUMS.txt`, and build provenance
  attestations generated by GitHub.

## Known constraints

- `os.homedir()` is used through `Env`, so it honours `USERPROFILE`. Electron itself does
  not start reliably with a redirected `USERPROFILE` on Windows unless the directory
  resembles a real profile, which affects UI-level testing only, not the shipped app.
- Skill descriptions are capped at 1,536 characters by Claude Code's listing budget. The
  test suite asserts every description stays under it.
