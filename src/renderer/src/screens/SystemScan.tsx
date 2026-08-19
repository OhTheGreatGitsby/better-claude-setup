import type { ReactNode } from 'react'
import type { DetectionResult } from '@shared/types'
import { Button, Card, Disclosure, Notice, Pill, Row } from '../components/ui'

const PLATFORM_NAMES: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

export function SystemScan({
  scan,
  scanning,
  onRescan,
  onContinue,
  onBack
}: {
  scan: DetectionResult | null
  scanning: boolean
  onRescan: () => void
  onContinue: () => void
  onBack: () => void
}): ReactNode {
  if (scanning || !scan) {
    return (
      <div className="container">
        <h1>Checking your computer</h1>
        <p className="lede">
          <span className="spinner" aria-hidden="true" /> Looking at what is already installed.
          Nothing is being changed.
        </p>
      </div>
    )
  }

  const corrupt = scan.existingConfig.settingsJsonExists && !scan.existingConfig.settingsJsonValid

  return (
    <div className="container">
      <h1>Here is what you already have</h1>
      <p className="lede">Nothing has been changed. This is only what was found.</p>

      {corrupt ? (
        <Notice tone="bad">
          Your Claude Code settings file exists but is not valid JSON, so it cannot be read safely.
          Better Claude Setup will not touch it until that is fixed — otherwise it would risk
          destroying settings it cannot understand. You can still install the instruction and skill
          components, which do not use that file.
        </Notice>
      ) : null}

      <Card>
        <Row label="Operating system">
          {PLATFORM_NAMES[scan.platform] ?? scan.platform} ({scan.arch})
        </Row>
        <Row label="Claude desktop app">
          {scan.claudeDesktop.state === 'installed' ? (
            <Pill tone="ok">Installed</Pill>
          ) : scan.claudeDesktop.state === 'uncertain' ? (
            <Pill tone="warn">Used before, not found now</Pill>
          ) : (
            <Pill tone="off">Not found</Pill>
          )}
        </Row>
        <Row label="Claude Code">
          {scan.claudeCode.state === 'installed' ? (
            <Pill tone="ok">{scan.claudeCode.version ?? 'Installed'}</Pill>
          ) : (
            <Pill tone="off">Not installed</Pill>
          )}
        </Row>
        <Row label="Your existing Claude instructions">
          {scan.existingConfig.claudeMdExists ? (
            <Pill tone="accent">{scan.existingConfig.claudeMdLines} lines</Pill>
          ) : (
            <Pill tone="off">None yet</Pill>
          )}
        </Row>
        <Row label="Skills you already have">
          {scan.existingConfig.otherSkills.length > 0 ? (
            <Pill tone="accent">{scan.existingConfig.otherSkills.length}</Pill>
          ) : (
            <Pill tone="off">None</Pill>
          )}
        </Row>
        <Row label="Better Claude Setup">
          {scan.betterClaudeSetup.everInstalled ? (
            <Pill tone="ok">
              {scan.betterClaudeSetup.installedComponentIds.length} components installed
            </Pill>
          ) : (
            <Pill tone="off">Not set up yet</Pill>
          )}
        </Row>
      </Card>

      <Card flat>
        <Disclosure summary="Technical details">
          <dl className="meta-grid">
            <dt>Claude folder</dt>
            <dd className="selectable">{scan.claudeHome}</dd>
            <dt>Folder exists</dt>
            <dd>{String(scan.claudeHomeExists)}</dd>
            <dt>Claude Code found via</dt>
            <dd>{scan.claudeCode.foundVia ?? 'not on PATH'}</dd>
            <dt>settings.json</dt>
            <dd>
              {scan.existingConfig.settingsJsonExists
                ? scan.existingConfig.settingsJsonValid
                  ? 'present, valid'
                  : `present, invalid: ${scan.existingConfig.settingsJsonError ?? 'unknown'}`
                : 'absent'}
            </dd>
            <dt>Other skills</dt>
            <dd>{scan.existingConfig.otherSkills.join(', ') || 'none'}</dd>
            <dt>Restore points</dt>
            <dd>{scan.betterClaudeSetup.backupCount}</dd>
            <dt>Scanned at</dt>
            <dd>{scan.scannedAtIso}</dd>
          </dl>
        </Disclosure>
      </Card>

      <div className="actions" style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onContinue}>
          Continue
        </Button>
        <Button onClick={onRescan}>Scan again</Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
