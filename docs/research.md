# Research

What was verified, from where, and what it means for the product. Everything below was
checked against Anthropic's own documentation on **18 August 2026** unless stated
otherwise. The Claude ecosystem changes quickly; treat any claim here as needing
re-verification after a few months.

Baseline machine used for verification: Windows 11, Node.js 24, Claude Code **2.1.232**
installed via npm, Claude desktop app configuration directory present.

---

## 1. Where Claude's documentation now lives

`docs.claude.com/en/docs/claude-code/*` now returns **301** to `code.claude.com/docs/en/*`.
Any tooling or documentation still pointing at the old host is following a redirect.

## 2. Claude Code configuration surfaces

Verified from [code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings),
[/memory](https://code.claude.com/docs/en/memory),
[/skills](https://code.claude.com/docs/en/skills) and
[/setup](https://code.claude.com/docs/en/setup).

| Surface | Location | Loaded when | Suitable for this app? |
| --- | --- | --- | --- |
| User settings | `~/.claude/settings.json` (`%USERPROFILE%\.claude\settings.json`) | always | Yes, sparingly |
| Project settings | `.claude/settings.json`, `.claude/settings.local.json` | per project | No — this app is not per-project |
| Managed settings | `/Library/Application Support/ClaudeCode/`, `C:\Program Files\ClaudeCode\`, `/etc/claude-code/`, plus MDM and registry policy | always, unoverridable | **No** — administrator territory, needs elevation |
| User memory | `~/.claude/CLAUDE.md` | every session, in full | Yes, kept small |
| Project memory | `./CLAUDE.md`, `./.claude/CLAUDE.md`, `./CLAUDE.local.md` | per project | No |
| Rules | `~/.claude/rules/*.md`, `.claude/rules/*.md` | every session, or when `paths:` match | Considered; see §6 |
| Skills | `~/.claude/skills/<name>/SKILL.md` | **name and description only** until used | **Yes — the primary vehicle** |
| Auto memory | `~/.claude/projects/<project>/memory/` | written by Claude itself | No — not ours to write |
| Output styles | `~/.claude/output-styles/*.md` + `outputStyle` setting | replaces part of the system prompt | Rejected; see §7 |
| Hooks | `hooks` key in settings | deterministic, at lifecycle events | Rejected for v1; see §7 |
| Plugins | marketplaces, `claude plugin` CLI | per plugin | Optional, opt-in only; see §5 |
| MCP servers | `claude mcp add`, `.mcp.json`, desktop `claude_desktop_config.json` | per server | Rejected for v1; see §7 |

Settings precedence, highest first: managed → command line → local → project → user.
Permission rules **merge** across scopes rather than replacing one another.

### Why the split matters

The documentation is explicit that CLAUDE.md is loaded **in full at the start of every
session** and recommends keeping each file **under 200 lines**, because "longer files
consume more context and reduce adherence". Skills work the opposite way: Claude Code
"loads a listing of skill names and descriptions into context so Claude knows what's
available", and the body loads only on invocation. The listing budget scales at **1% of the
model's context window**, and the combined `description` + `when_to_use` text is truncated
at **1,536 characters**.

That single fact determined the architecture of this product: **one short always-on block,
everything else a skill.** The core preset is 40 lines. The ten skills contribute only
their descriptions until used.

### Skill file format, as verified

`SKILL.md` frontmatter fields are all optional; `description` is the one that matters,
because Claude matches on it. Fields relevant here:

- `name` — defaults to the directory name.
- `description` — what it does *and when to use it*, key use case first.
- `license` — accepted, part of the [Agent Skills](https://agentskills.io) spec.
- `allowed-tools` / `disallowed-tools` — tool permission grants. **This app sets neither.**
  A skill that pre-approves tools is a privilege escalation a beginner cannot evaluate.

Skill directories are watched live, so a newly written skill appears without restarting.

## 3. Installing Claude Code

Anthropic documents several routes:

| Route | Command | Verification | Auto-updates |
| --- | --- | --- | --- |
| Native installer | `irm https://claude.ai/install.ps1 \| iex` / `curl … \| bash` | none at the point of execution | yes |
| WinGet | `winget install Anthropic.ClaudeCode` | publisher signature, by WinGet | no |
| Homebrew | `brew install --cask claude-code` | cask checksum, by Homebrew | no |
| npm | `npm install -g @anthropic-ai/claude-code` | npm registry integrity | yes |
| apt / dnf / apk | signed repositories, key fingerprint `31DD DE24 DDFA B679 F42D 7BD2 BAA9 29FF 1A7E CACE` | GPG | via system upgrade |

**Decision: use WinGet on Windows and Homebrew on macOS, and never the piped installer.**

The piped-script route is Anthropic's own documented default and is not in itself
dangerous. It is rejected here for a narrower reason: an installer aimed at beginners
should not teach, or perform on their behalf, the habit of downloading a script from the
internet and executing it immediately with the user's privileges. WinGet and Homebrew
perform the same install while verifying what they fetch. When neither is available the app
does not improvise — it opens Anthropic's own instructions and says why.

Anthropic also publishes a signed `manifest.json` with SHA256 checksums per release, macOS
binaries notarised by Apple, and Windows binaries signed by "Anthropic, PBC". This app does
not download those binaries itself, so it does not need to verify them; the package manager
does.

## 4. Claude Desktop and the Claude app

Verified from [code.claude.com/docs/en/desktop-quickstart](https://code.claude.com/docs/en/desktop-quickstart)
and Anthropic's help centre article on
[personalization features](https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features).

Two findings changed the product:

1. **The desktop app shares configuration with Claude Code — but only on one of its three
   tabs.** Re-verified 19 August 2026 against the desktop reference page, because version
   1.0.0 overstated this.

   Under "Shared configuration" the documentation is explicit: "Desktop and CLI read the
   same configuration files", covering `CLAUDE.md`, MCP servers, hooks, skills, and
   "Settings in `~/.claude.json` and `~/.claude/settings.json`". It also states that
   "Personal skills in `~/.claude/skills/` apply to local sessions".

   But the same page says the **Cowork** tab "sources its skills, plugins, and connectors
   from this Customize configuration, which syncs through your claude.ai account, **not**
   from the CLI's `~/.claude` directory". And **Chat** is governed by account-level
   personalization, as in the next finding.

   | Surface | Reads `~/.claude`? |
   | --- | --- |
   | Claude Code CLI and IDE extensions | Yes |
   | Desktop app, Code tab, local sessions | Yes |
   | Desktop app, Cowork tab | No — account-synced |
   | Desktop app, Chat tab | No — account settings and Styles |
   | Cloud and SSH sessions | No — remote home, or account |

   **Consequence:** the accurate claim is "configures Claude Code, and the desktop app's
   Code tab reads the same files". The v1.0.0 phrasing "also improves the Claude desktop
   app" was corrected in the interface, the README and this document.

2. **Personal preferences and Styles are account settings, not local files.** Anthropic's
   personalization features — "Instructions for Claude" in profile settings, Styles, and
   Project instructions — are held on the Anthropic account and applied server-side. They
   are reachable only through claude.ai or the app's own settings UI. There is no supported
   local file to write, and there is no supported API for a third-party app to write them.

   **Consequence:** Better Claude Setup deliberately makes no claim to configure the Claude
   chat app's personality. Pretending otherwise, or scripting the UI to do it, would be
   both fragile and dishonest. This limitation is stated in the app and in the README.

The desktop app's local configuration directory is `%APPDATA%\Claude` on Windows,
`~/Library/Application Support/Claude` on macOS. It contains `claude_desktop_config.json`
(MCP servers) among other state. **This app does not write to it** — see §7.

### Detecting the desktop app (revised 19 August 2026)

Version 1.0.0 checked three per-user directories and reported "not found" for anything
else. That was wrong in a way extra paths could never have fixed.

On the machine this was reproduced on, the app is installed as an **MSIX package**:

```
Name              : Claude
Publisher         : CN="Anthropic, PBC", O="Anthropic, PBC", ...
Version           : 1.32352.1.0
PackageFamilyName : Claude_pzs8sxrjxfjjc
InstallLocation   : C:\Program Files\WindowsApps\Claude_1.32352.1.0_x64__pzs8sxrjxfjjc
```

`C:\Program Files\WindowsApps` is ACL-locked: an ordinary process cannot list it or stat
inside it. A filesystem check against that location fails regardless of how the path is
spelled. The app must ask Windows' own package records instead.

Detection routes now used, in order:

| Platform | Route | How |
| --- | --- | --- |
| Windows | App packages | `reg.exe query "HKCU\...\AppModel\Repository\Packages" /f Claude /k`, readable without elevation; the package full name carries the version |
| Windows | Installed programs | `reg.exe query <uninstall key> /s /v DisplayName`, filtered to reject "Better Claude Setup" and "Claude Code" |
| Windows | Application folders | `%LOCALAPPDATA%\AnthropicClaude`, `%LOCALAPPDATA%\Programs\Claude`, `%LOCALAPPDATA%\Claude` |
| Windows | Start menu | a `Claude*.lnk` shortcut |
| macOS | Applications | `/Applications/Claude.app`, `~/Applications/Claude.app`, version read from `Contents/Info.plist` |
| macOS | Spotlight | `mdfind 'kMDItemFSName == "Claude.app"'` — matched on bundle name rather than a bundle identifier, which would be a guess |
| Linux | Package paths | `/opt/Claude/claude-desktop`, `/usr/bin/claude-desktop`, `/usr/lib/claude-desktop/claude-desktop` |

A leftover configuration directory with no application yields **uncertain** rather than a
yes or a no, because both would be a guess. Every route is recorded and shown under
"Detection details" in the app.

`Get-AppxPackage` returns richer data than `reg.exe`, including the publisher, but starting
PowerShell costs roughly a second and the registry read is enough to identify the package
and its version.

## 5. Third-party and first-party components

Anthropic runs two marketplaces:

- **`claude-plugins-official`** — curated by Anthropic, registered automatically on first
  interactive launch. Contains 500+ entries at time of writing.
- **`claude-community`** — third-party submissions that passed automated validation and
  safety screening, each pinned to a commit SHA. Added manually.

The official catalogue was read directly from
[`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official).
It is overwhelmingly vendor integrations (AWS, Datadog, MongoDB, Figma, Stripe-likes) and
language servers. Almost none of it is relevant to a general user who wants Claude to think
and write better.

### What was selected

| Component | Source | Why | Default |
| --- | --- | --- | --- |
| 10 skills + 1 core preset | **this repository** | Fully auditable plain Markdown, no dependencies, no network, no tool grants, and removable to the byte | On (design off) |
| `security-guidance@claude-plugins-official` | Anthropic | Reviews code Claude writes for common vulnerabilities. Published by Anthropic on its own curated catalogue. | **Off** |
| `commit-commands@claude-plugins-official` | Anthropic | Git commit and PR workflows. Genuinely useful, genuinely irrelevant to non-developers. | **Off** |

### What was rejected, and why

- **Community plugin marketplaces and popular third-party prompt packs.** Rejected as a
  class for v1, not individually. A plugin can ship hooks, MCP servers and executables that
  run with the user's privileges; the documentation says so directly ("highly trusted
  components that can execute arbitrary code on your machine"). A beginner installing a
  configuration tool cannot evaluate that trust, and this app should not evaluate it on
  their behalf by proxy. Popularity is not evidence of safety.
- **Language server (LSP) plugins.** Genuinely valuable, but each requires the user to
  install a language server binary separately, and they are useful only to programmers
  working in that specific language. Wrong audience for a default; a good v2 addition
  behind detection of the user's actual languages.
- **Large "awesome prompt" collections.** They work by putting thousands of tokens into
  every conversation, which is the exact failure mode Anthropic's own guidance warns about
  ("Bloated CLAUDE.md files cause Claude to ignore your actual instructions"). Including
  one would make Claude measurably worse at following instructions while appearing to do
  more.
- **Anything requiring a network fetch at install time from a non-Anthropic host.**

## 6. Behavioural preset design

Sources: [code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices),
the memory documentation's "Write effective instructions" section.

Guidance that directly shaped the preset:

- Target **under 200 lines**; shorter files produce better adherence. The preset is 40.
- Be **concrete enough to verify**: "Use 2-space indentation", not "format code properly".
  Each rule in the preset names an observable behaviour.
- **Consistency matters** — contradictory rules make Claude pick arbitrarily. The preset
  has no rule that contradicts another.
- **"Would removing this cause Claude to make mistakes?"** — the stated test for whether a
  line belongs. Several drafted rules were cut on this basis, including generic advice
  Claude already follows.
- **Give Claude a way to verify its work**, and have it **show evidence rather than
  asserting success**. This is the single most repeated point in Anthropic's guidance and
  appears in the preset and in three separate skills.
- CLAUDE.md is delivered as a user message after the system prompt and is **context, not
  enforced configuration**. The preset therefore reads as a working agreement, not as
  policy language, and makes no attempt to constrain Claude's safety behaviour — which it
  could not do anyway.

`~/.claude/rules/` was considered as an alternative home for the preset. Rules without
`paths:` frontmatter load at launch with the same cost as CLAUDE.md, so they offer no
context saving for always-on content, and CLAUDE.md is the location users already know and
can find with `/memory`. Path-scoped rules are a strong v2 option for coding-specific
guidance.

## 7. Deliberate non-features

- **Output styles.** They replace part of the system prompt and, unless
  `keep-coding-instructions: true` is set, remove Claude Code's built-in software
  engineering instructions entirely. That is a large, silent behavioural change for
  something an installer turned on. Rejected.
- **Hooks.** Deterministic and powerful, and therefore exactly the wrong thing to install
  by default: a hook is a shell command that runs automatically at lifecycle events. A
  beginner cannot audit one. Rejected for v1.
- **MCP servers.** Every server is another process with its own permissions and network
  access. The value to a general user is real but entirely dependent on which tools they
  personally use, which this app has no way to know. Rejected for v1.
- **Writing to `claude_desktop_config.json`.** Only useful for MCP, which is rejected above.
- **Managed settings.** They require administrator rights and cannot be overridden by the
  user — the opposite of this app's reversibility promise.

## 9. Claude account skills (verified 20 August 2026)

The v1.1 conclusion — that ordinary Claude chats could not use these skills — is **no longer
correct**, and the product changed accordingly.

From the platform documentation on Agent Skills:

> "Custom Skills: Upload your own Skills as zip files through Settings > Features.
> Available on Pro, Max, Team, and Enterprise plans with code execution enabled. Custom
> Skills are individual to each user."

And, decisively for the architecture:

> "Custom Skills do not sync across surfaces. Skills uploaded to one surface are not
> automatically available on others... Claude Code Skills are filesystem-based and separate
> from both claude.ai and API."

| Question | Answer |
| --- | --- |
| Upload format | A zip whose root contains the skill folder, e.g. `research/SKILL.md` |
| Where | Settings then Skills on the web; **Customize** in the desktop app sidebar |
| Plans | Pro, Max, Team, Enterprise. The help centre also lists Free; the platform docs do not, so Free is treated as unconfirmed |
| Prerequisite | Code execution and file creation enabled |
| Name rules | 64 chars max, lowercase/digits/hyphens, and may not contain "claude" or "anthropic" |
| Description limit | **200 characters** per the help centre, against Claude Code's far looser listing budget. The tighter limit is what this project builds to |
| Sharing | Per user. No organisation-wide management on claude.ai |
| Cowork | Loads "the skills enabled for your claude.ai account", so the account upload covers it |
| Consumer install API | **None.** The Skills API serves API workspaces, not personal accounts |

**Invocation.** The help centre says skills in Claude chats "work automatically based on
context... You don't need to explicitly invoke them"; the `/` menu is documented for the
Microsoft 365 add-ins, not for the chat surface. There is no slash-command menu to hook into.

What does work, and what this project relies on, is that Claude matches a request against
each skill's **description**. Every Better Claude skill therefore names its own command in
its description, so typing `/research something` matches the research skill. That is a
legitimate use of the documented mechanism rather than a claim of platform support, and the
app says exactly that on its chat setup screen.

**Consequence for the product:** two surfaces, one canonical content source, per-surface
exports, and a guided manual upload rather than any form of account automation.

## 10. macOS packaging (verified 20 August 2026)

v1.1 shipped a macOS build that a real Apple Silicon Mac refused with "is damaged and can't
be opened". The cause was in electron-builder's own schema for `mac.identity`:

> "Not set (default): electron-builder searches the keychain for a valid signing
> certificate. If none is found, signing is skipped for all architectures — there is no
> automatic ad-hoc fallback."

The config left `identity` unset and CI additionally passed `CSC_IDENTITY_AUTO_DISCOVERY`
false, so the app shipped with **no signature at all**, which Apple Silicon will not
execute. `hardenedRuntime: true` made it worse; the schema warns that with ad-hoc signing it
"enforces library validation which will reject pre-signed Electron frameworks".

Fix: `identity: "-"` for explicit ad-hoc signing, `hardenedRuntime: false`,
`notarize: false`, `dmg.sign: false`, and a verification script CI runs on every macOS build.

Measured on a macOS arm64 runner after the fix: `Signature=adhoc`, deep verification passes
including nested frameworks, a quarantined copy is no longer judged damaged, and the process
starts and stays alive. Gatekeeper still rejects the build, which is expected and
unavoidable without notarization.


## 8. Sources

All verified 18 August 2026.

- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/setup
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/discover-plugins
- https://code.claude.com/docs/en/output-styles
- https://code.claude.com/docs/en/desktop-quickstart
- https://github.com/anthropics/claude-plugins-official
- https://support.claude.com/en/articles/10185728-understanding-claude-s-personalization-features

Added 20 August 2026:

- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- https://support.claude.com/en/articles/12512180-using-skills-in-claude
- https://support.claude.com/en/articles/12512198-creating-custom-skills
- https://code.claude.com/docs/en/commands
- https://www.electron.build/docs/mac/
