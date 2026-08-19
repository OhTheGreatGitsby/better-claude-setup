import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BackupRecord, ComponentMeta, DetectionResult, OperationResult } from '@shared/types'
import { Button, Card, Disclosure, Notice, Pill, Row, StepList } from '../components/ui'

export function Manager({
  scan,
  components,
  installedIds,
  backups,
  onManage,
  onRescan,
  onRemove,
  onRestore,
  busy,
  lastResult
}: {
  scan: DetectionResult
  components: ComponentMeta[]
  installedIds: string[]
  backups: BackupRecord[]
  onManage: () => void
  onRescan: () => void
  onRemove: (ids: string[]) => void
  onRestore: (backupId: string) => void
  busy: boolean
  lastResult: OperationResult | null
}): ReactNode {
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [diagnostics, setDiagnostics] = useState<string | null>(null)
  const latestBackup = backups[0]

  return (
    <div className="container container--wide">
      <h1>Your Claude setup</h1>
      <p className="lede">Everything below can be changed or undone individually.</p>

      {lastResult ? (
        <Card flat>
          <h3>{lastResult.summary}</h3>
          <StepList steps={lastResult.steps} />
        </Card>
      ) : null}

      <Card>
        <Row label="Claude desktop app">
          {scan.claudeDesktop.state === 'installed' ? (
            <Pill tone="ok">Installed</Pill>
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
        {components.map((component) => (
          <Row key={component.id} label={component.name}>
            {installedIds.includes(component.id) ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Pill tone="ok">Enabled</Pill>
                <Button variant="ghost" disabled={busy} onClick={() => onRemove([component.id])}>
                  Remove
                </Button>
              </span>
            ) : (
              <Pill tone="off">Not installed</Pill>
            )}
          </Row>
        ))}
      </Card>

      <div className="actions" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={onManage} disabled={busy}>
          Manage setup
        </Button>
        <Button onClick={onRescan} disabled={busy}>
          Re-run system scan
        </Button>
        <Button onClick={() => onRemove(installedIds)} disabled={busy || installedIds.length === 0}>
          Disable all Better Claude defaults
        </Button>
      </div>

      <Card>
        <h2>Restore your original configuration</h2>
        <p className="muted">
          {latestBackup
            ? `The most recent restore point was saved on ${new Date(latestBackup.createdAtIso).toLocaleString()}. Restoring puts your Claude instructions, settings and skills folder back exactly as they were at that moment.`
            : 'There are no restore points yet. One is created automatically before the first change.'}
        </p>

        {confirmRestore && latestBackup ? (
          <Notice tone="warn">
            <strong>
              This replaces your current Claude instructions, settings and skills folder
            </strong>{' '}
            with the copy saved on {new Date(latestBackup.createdAtIso).toLocaleString()}. Anything
            you changed in those files since then will be lost. Other Claude data is not affected.
            <div className="actions" style={{ marginTop: 12 }}>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setConfirmRestore(false)
                  onRestore(latestBackup.id)
                }}
              >
                Yes, restore that version
              </Button>
              <Button variant="ghost" onClick={() => setConfirmRestore(false)}>
                Cancel
              </Button>
            </div>
          </Notice>
        ) : (
          <div className="actions">
            <Button
              variant="danger"
              disabled={busy || !latestBackup}
              onClick={() => setConfirmRestore(true)}
            >
              Restore original Claude setup
            </Button>
            <Button variant="ghost" onClick={() => void window.bcs.revealConfig('backups')}>
              Open the restore points folder
            </Button>
          </div>
        )}

        {backups.length > 1 ? (
          <Disclosure summary={`All ${backups.length} restore points`}>
            {backups.map((backup) => (
              <div className="row" key={backup.id}>
                <span className="row__label">
                  {new Date(backup.createdAtIso).toLocaleString()}
                  <br />
                  <span className="small">{backup.reason}</span>
                </span>
                <Button variant="ghost" disabled={busy} onClick={() => onRestore(backup.id)}>
                  Restore
                </Button>
              </div>
            ))}
          </Disclosure>
        ) : null}
      </Card>

      <Card flat>
        <h2>Troubleshooting</h2>
        <div className="actions" style={{ flexWrap: 'wrap' }}>
          <Button
            onClick={() => {
              void window.bcs.buildDiagnostics().then(setDiagnostics)
            }}
          >
            View diagnostic report
          </Button>
          <Button onClick={() => void window.bcs.saveDiagnostics()}>Save report to a file</Button>
          <Button variant="ghost" onClick={() => void window.bcs.revealConfig('claude')}>
            Open my Claude folder
          </Button>
        </div>
        {diagnostics ? (
          <>
            <p className="muted small" style={{ marginTop: 12, marginBottom: 4 }}>
              Personal paths, your username and anything that looks like a password or key have
              already been removed from this report.
            </p>
            <pre className="log selectable">{diagnostics}</pre>
          </>
        ) : null}
      </Card>
    </div>
  )
}
