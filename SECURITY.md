# Security policy

## Supported versions

The most recent release is supported. Older releases are not patched.

## Reporting a vulnerability

Please report security issues privately using GitHub's
[private vulnerability reporting](https://github.com/OhTheGreatGitsby/better-claude-setup/security/advisories/new)
on this repository, rather than opening a public issue.

Please include:

- what the problem is and why it matters
- the steps to reproduce it
- the version of Better Claude Setup and your operating system
- the impact you think it has

This is a volunteer project, so please allow up to 14 days for a first response. If a
report is valid, the fix and a release will follow as quickly as is practical, and you will
be credited in the changelog unless you prefer otherwise.

## What is in scope

- Writing outside the user's Claude configuration directory
- Command injection or arbitrary code execution
- Escaping the renderer sandbox, or reaching main-process functionality the preload bridge
  does not name
- Leaking personal data, credentials or file paths into logs, the diagnostic report, or the
  interface
- Destroying or corrupting user configuration that the app claims to preserve
- Failure of the rollback, removal, or restore guarantees

## What is out of scope

- The absence of code signing and notarisation. This is a known, documented limitation, not
  a vulnerability report. See the README.
- Vulnerabilities in Claude Code, the Claude desktop app, or Anthropic's plugins. Report
  those to Anthropic.
- Issues that require an attacker to already have write access to the user's home
  directory, since at that point the machine is already lost.
- Findings from automated scanners with no demonstrated impact.

## Security design

The threat model, the renderer lockdown, the command-execution rules and the redaction
behaviour are documented in [docs/security.md](docs/security.md).
