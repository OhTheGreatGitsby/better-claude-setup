import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DetectionResult, OperationResult } from '@shared/types'
import { Button, Card, Disclosure, Notice, StepList } from '../components/ui'

const DESKTOP_DOWNLOAD = 'https://claude.com/download'
const CLI_DOCS = 'https://code.claude.com/docs/en/setup'

export function ClaudeCodeStep({
  scan,
  onContinue,
  onBack,
  onRescan
}: {
  scan: DetectionResult
  onContinue: () => void
  onBack: () => void
  onRescan: () => Promise<void>
}): ReactNode {
  const [route, setRoute] = useState<{ kind: string; reason?: string } | null>(null)
  const [command, setCommand] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OperationResult | null>(null)

  useEffect(() => {
    let active = true
    void window.bcs.claudeCodeRoute().then((value) => {
      if (!active) return
      setRoute(value.route)
      setCommand(value.command)
    })
    return () => {
      active = false
    }
  }, [])

  const canAutoInstall = route?.kind === 'winget' || route?.kind === 'homebrew'

  async function install(): Promise<void> {
    setBusy(true)
    try {
      const outcome = await window.bcs.installClaudeCode()
      setResult(outcome)
      await onRescan()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <h1>Claude Code is not installed</h1>
      <p className="lede">
        Claude Code is Anthropic&apos;s free tool that lets Claude work with files on your computer.
        Better Claude Setup stores its improvements in Claude Code&apos;s settings folder, which the
        Claude desktop app also reads.
      </p>

      {!scan.claudeDesktop.installed ? (
        <Notice tone="warn">
          The Claude desktop app was not found either. You can install it from Anthropic&apos;s own
          download page. This app will never download Claude for you from anywhere else.
          <div style={{ marginTop: 10 }}>
            <Button onClick={() => void window.bcs.openExternal(DESKTOP_DOWNLOAD)}>
              Open the official download page
            </Button>
          </div>
        </Notice>
      ) : null}

      <Card>
        <h2>Would you like Better Claude Setup to install Claude Code for you?</h2>
        {canAutoInstall ? (
          <>
            <p className="muted">
              This will run one command using{' '}
              {route?.kind === 'winget' ? 'the Windows package installer' : 'Homebrew'}, which
              installs Claude Code from Anthropic and checks the publisher signature itself. You may
              be asked by your operating system to approve it.
            </p>
            <Disclosure summary="Show the exact command">
              <pre className="log selectable">{command}</pre>
              <p style={{ marginBottom: 0 }}>
                Better Claude Setup deliberately does not use the one-line installer that pipes a
                downloaded script straight into a shell, even though Anthropic documents it. A
                package manager verifies what it installs; a piped script does not.
              </p>
            </Disclosure>
            <div className="actions" style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={() => void install()} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Installing…
                  </>
                ) : (
                  'Yes, install Claude Code'
                )}
              </Button>
              <Button variant="ghost" onClick={onContinue} disabled={busy}>
                Skip for now
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              {route?.reason ?? 'Automatic installation is not available on this machine.'}{' '}
              Anthropic&apos;s installation page has step-by-step instructions for your system.
            </p>
            <div className="actions">
              <Button variant="primary" onClick={() => void window.bcs.openExternal(CLI_DOCS)}>
                Open the official instructions
              </Button>
              <Button onClick={() => void onRescan()}>I have installed it — check again</Button>
              <Button variant="ghost" onClick={onContinue}>
                Skip for now
              </Button>
            </div>
          </>
        )}
      </Card>

      {result ? (
        <Card flat>
          <h3>{result.summary}</h3>
          <StepList steps={result.steps} />
          {result.ok ? (
            <div className="actions" style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={onContinue}>
                Continue
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card flat>
        <h3>You can carry on without it</h3>
        <p className="muted small" style={{ marginBottom: 0 }}>
          The instructions and skills are ordinary files in your Claude folder. They will be waiting
          there whenever Claude Code or the Claude desktop app is installed. Only the optional
          add-ons in Extras need Claude Code to be present.
        </p>
      </Card>

      <div className="actions" style={{ marginTop: 16 }}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
