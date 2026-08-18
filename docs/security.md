# Security model

Better Claude Setup is an installer that edits configuration files and can launch package
managers. It is treated here as security-sensitive software, because that is what it is.

## Threat model

| Adversary | Concern | Mitigation |
| --- | --- | --- |
| A hostile web page or script reaching the renderer | Using the app as a way to write arbitrary files or run commands | Renderer is sandboxed with no Node access, cannot navigate, and cannot make network requests. The bridge exposes 15 named methods and no generic invoke |
| A malicious value arriving over IPC | Path traversal, command injection, writing outside the Claude folder | Every argument is validated against a closed set in the main process. Paths are resolved and proven to be inside their root. Commands are argv arrays, never strings |
| A compromised or malicious component in the catalogue | Silent installation of something harmful | The catalogue is in this repository and is reviewable. Every component declares what it writes, whether it uses the network, and whether it runs commands. Only two components touch the network and both are off by default |
| A supply-chain attack on this project's dependencies | Malicious code in a shipped build | Runtime dependencies: React and React DOM only. All versions pinned exactly. `npm audit` runs in CI. Actions are pinned to commit SHAs |
| An attacker with the user's diagnostic report | Learning the user's identity, paths or credentials | Everything written to the log or the report passes through the redactor first |
| The application itself, misbehaving | Destroying a configuration it does not understand | It refuses to write a settings file it could not parse, backs up before the first change, and rolls back on any failure |

## Renderer lockdown

In [`src/main/index.ts`](../src/main/index.ts):

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webviewTag: false`.
- `setWindowOpenHandler` denies every window, handing https URLs to the OS browser instead.
- `will-navigate` is prevented outside the dev server.
- `session.webRequest.onBeforeRequest` **cancels every request** that is not `file:`,
  `devtools:`, `blob:`, `data:`, or the dev server. The interface cannot phone home even
  if a dependency tried to.
- `setPermissionRequestHandler` denies every permission (camera, geolocation, notifications
  and the rest) unconditionally.
- A Content-Security-Policy meta tag sets `default-src 'none'` with `script-src 'self'`,
  no `connect-src` beyond self, `form-action 'none'` and `base-uri 'none'`.
- A single-instance lock prevents two copies racing on the same configuration files.

## IPC surface

The preload bridge in [`src/preload/index.ts`](../src/preload/index.ts) exposes exactly
fifteen methods. There is no `invoke(channel, …)` escape hatch, so the renderer cannot
reach a channel the bridge does not name.

In [`src/main/ipc/handlers.ts`](../src/main/ipc/handlers.ts):

- Component ids are filtered against the catalogue. An unknown id is dropped, not passed on.
- Backup ids must match `^backup-[0-9TZ-]{10,40}$`, so a path can never arrive disguised as
  an id.
- `openExternal` accepts **https only**; every other scheme returns `false` without action.
- `revealConfig` takes an enum-like value, not a path.

## Filesystem safety

[`src/main/core/safe-fs.ts`](../src/main/core/safe-fs.ts):

- `assertSafeRelative` rejects absolute paths, Windows drive prefixes, `..` segments and
  NUL bytes.
- `resolveInside(root, rel)` resolves the path and then proves with `path.relative` that
  the result is strictly inside `root`, raising `PathEscapeError` otherwise. Every skill
  directory path goes through it, including on removal.
- `writeTextAtomic` writes to a sibling temporary file with mode `0600` and renames it into
  place, so an interrupted write cannot leave a half-written configuration file.

## Process execution

[`src/main/core/exec.ts`](../src/main/core/exec.ts) uses `execFile` with an explicit
`shell: false` and an argument **array**. There is no string concatenation anywhere in the
command path, so a value can never be reinterpreted as a command separator, a redirect, or
a substitution.

Every command name and every argument in this codebase is a literal. Nothing the user types
is forwarded to a process. `assertNoShellMetacharacters` exists as a tripwire so a future
edit that introduces an interpolated command name fails loudly rather than silently.

The one exception is Windows npm shims: Node refuses to execute `.cmd` files directly since
the 2024 command-injection fix, so those are launched as
`cmd.exe /d /s /c <resolved path> <fixed args>`. The path comes from `where.exe` and is
verified to exist; the arguments remain literals.

Tests in [`tests/security.test.ts`](../tests/security.test.ts) assert that shell
metacharacters passed as arguments arrive as literal text and are not executed.

## Privilege

The app never requests elevation. The Windows installer is per-user with
`allowElevation: false`. Everything it writes is inside the user's own home directory.
Package-manager installs may prompt the operating system for approval — that prompt comes
from Windows or Homebrew, and this app neither suppresses nor automates it.

## Network

| Path | When | Host |
| --- | --- | --- |
| `winget install Anthropic.ClaudeCode` | only if the user asks to install Claude Code | Microsoft's WinGet source → Anthropic |
| `brew install --cask claude-code` | same, on macOS | Homebrew → Anthropic |
| `claude plugin install <name>@claude-plugins-official` | only if an Extras component is selected | Anthropic |
| Opening a documentation link | only on a click | the OS browser |

That is the complete list. There is no update check, no telemetry endpoint, and no
analytics. The app does not download, verify, or execute any binary itself; package
managers do that and perform their own signature verification.

The piped-shell installer Anthropic documents (`irm … | iex`) is deliberately not used.
See [research.md §3](research.md#3-installing-claude-code).

## Secrets and personal data

[`src/main/core/sanitize.ts`](../src/main/core/sanitize.ts) is applied to every log line,
every error message shown in the interface, all captured process output, and the whole
diagnostic report. It replaces:

- the home directory, in both slash styles, with `<home>`
- the operating system username with `<user>`
- email addresses, IPv4 addresses
- `sk-…`, `ghp_…`, `xox…` and JWT-shaped strings
- `api_key=`, `secret:`, `token=`, `password=` assignments
- `Authorization:` header values in full, and `Bearer <value>`

The app never reads Claude conversations, project files, or the *values* inside the user's
own settings. The diagnostic report contains counts and booleans, not content — asserted in
[`tests/diagnostics.test.ts`](../tests/diagnostics.test.ts).

## Dependencies

Runtime: `react`, `react-dom`. That is all.

Everything else is a build-time dependency and is not shipped inside the application
bundle. All versions are pinned exactly (`--save-exact`), and `npm ci` in CI installs from
the lockfile. `npm audit` runs on every push and reported **0 vulnerabilities** at the time
of the first release.

## CI and release

- Workflows declare `permissions: contents: read` at the top level; only the release job
  raises it, and only to what it needs.
- Third-party actions are pinned to full commit SHAs, not tags.
- No secrets are used by CI other than the automatically provided `GITHUB_TOKEN`.
- Releases publish `SHA256SUMS.txt` and GitHub build provenance attestations.

## Not yet done

- **Code signing (Windows) and notarisation (macOS).** Both need paid certificates this
  project does not hold. Users will see publisher warnings. This is the largest remaining
  gap and is stated plainly in the README rather than glossed over.
- The two optional Anthropic plugins cannot be version-pinned, because Claude Code resolves
  the marketplace version itself.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md).
