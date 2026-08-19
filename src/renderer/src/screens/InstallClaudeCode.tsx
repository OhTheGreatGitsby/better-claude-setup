import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { DetectionResult, OperationResult } from '@shared/types'
import { Mascot } from '../components/Mascot'
import {
  Badge,
  Button,
  Disclosure,
  Notice,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  StepList
} from '../components/kit'

const DESKTOP_DOWNLOAD = 'https://claude.com/download'
const CLI_DOCS = 'https://code.claude.com/docs/en/setup'

export function InstallClaudeCode({
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
  const manager = route?.kind === 'winget' ? 'the Windows package installer' : 'Homebrew'

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
    <div className="page page--narrow">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>Claude Code is not installed</h1>
          <p className="lead">
            Claude Code is Anthropic&apos;s free tool that lets Claude work with files on your
            computer. It is the part Better Claude Setup configures.
          </p>
        </div>
        <div className="hero__art">
          <Mascot state={busy ? 'installing' : 'thinking'} size="lg" />
        </div>
      </div>

      <div className="stack-4">
        {scan.claudeDesktop.state !== 'installed' ? (
          <Notice tone="info" icon="◱">
            <p style={{ marginBottom: 'var(--s-3)' }}>
              The Claude desktop app was not found either. You can get it from Anthropic&apos;s own
              download page — this app will never fetch Claude from anywhere else.
            </p>
            <Button size="sm" onClick={() => void window.bcs.openExternal(DESKTOP_DOWNLOAD)}>
              Open the official download page
            </Button>
          </Notice>
        ) : null}

        <Panel raised accent={canAutoInstall}>
          <PanelHeader
            icon="↓"
            tone={canAutoInstall ? 'accent' : 'neutral'}
            title="Install Claude Code"
            end={canAutoInstall ? <Badge tone="accent">One command</Badge> : null}
          />
          <PanelBody>
            {canAutoInstall ? (
              <>
                <p className="body" style={{ marginBottom: 'var(--s-3)' }}>
                  Better Claude Setup can run one command using {manager}, which fetches Claude Code
                  from Anthropic and checks the publisher signature itself. Your operating system
                  may ask you to approve it.
                </p>
                <Disclosure summary="Show the exact command">
                  <pre className="code selectable">{command}</pre>
                  <p className="small muted">
                    The one-line installer that pipes a downloaded script into a shell is
                    deliberately not used, even though Anthropic documents it. A package manager
                    verifies what it installs; a piped script does not.
                  </p>
                </Disclosure>
              </>
            ) : (
              <p className="body">
                {route?.reason ?? 'Automatic installation is not available on this machine.'}{' '}
                Anthropic&apos;s installation page has step-by-step instructions for your system.
              </p>
            )}
          </PanelBody>
          <PanelFooter>
            <div className="cluster">
              {canAutoInstall ? (
                <Button variant="primary" bracket onClick={() => void install()} disabled={busy}>
                  {busy ? 'Installing…' : 'Install Claude Code'}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void window.bcs.openExternal(CLI_DOCS)}>
                  Open the official instructions
                </Button>
              )}
              <Button onClick={() => void onRescan()} disabled={busy}>
                Check again
              </Button>
              <Button variant="ghost" onClick={onContinue} disabled={busy}>
                Skip for now
              </Button>
            </div>
          </PanelFooter>
        </Panel>

        {result ? (
          <Panel>
            <PanelHeader
              icon={result.ok ? '✓' : '!'}
              tone={result.ok ? 'ok' : 'bad'}
              title={result.ok ? 'Installed' : 'Did not finish'}
            />
            <PanelBody>
              <p className="body" style={{ marginBottom: 'var(--s-3)' }}>
                {result.summary}
              </p>
              <StepList steps={result.steps} />
            </PanelBody>
            {result.ok ? (
              <PanelFooter>
                <Button variant="primary" bracket onClick={onContinue}>
                  Continue
                </Button>
              </PanelFooter>
            ) : null}
          </Panel>
        ) : null}

        <Panel sunken>
          <PanelBody>
            <p className="small">
              <strong>You can carry on without it.</strong> The instructions and skills are ordinary
              files in your Claude folder, waiting there for whenever Claude Code is installed. Only
              the optional add-ons need it right now.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
