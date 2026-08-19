import { useState } from 'react'
import type { ReactNode } from 'react'
import type {
  BackupRecord,
  ComponentMeta,
  DetectedProduct,
  DetectionResult,
  OperationResult
} from '@shared/types'
import { Mascot } from '../components/Mascot'
import type { MascotState } from '../components/Mascot'
import {
  Badge,
  Button,
  DataRow,
  Disclosure,
  Notice,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  StepList,
  Switch
} from '../components/kit'

function productBadge(product: DetectedProduct): ReactNode {
  if (product.state === 'installed') {
    return (
      <Badge tone="ok" dot>
        {product.version ? product.version : 'Installed'}
      </Badge>
    )
  }
  if (product.state === 'uncertain') {
    return (
      <Badge tone="warn" dot>
        Not certain
      </Badge>
    )
  }
  return <Badge dot>Not found</Badge>
}

export function Manager({
  scan,
  components,
  installedIds,
  backups,
  onOpenCustomize,
  onRescan,
  onToggleComponent,
  onRepair,
  onRemoveAll,
  onRestore,
  busy,
  lastResult,
  onDismissResult
}: {
  scan: DetectionResult
  components: ComponentMeta[]
  installedIds: string[]
  backups: BackupRecord[]
  onOpenCustomize: () => void
  onRescan: () => void
  onToggleComponent: (id: string, next: boolean) => void
  onRepair: () => void
  onRemoveAll: () => void
  onRestore: (backupId: string) => void
  busy: boolean
  lastResult: OperationResult | null
  onDismissResult: () => void
}): ReactNode {
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [diagnostics, setDiagnostics] = useState<string | null>(null)
  const latestBackup = backups[0]

  const bcs = scan.betterClaudeSetup
  const healthy = bcs.state === 'configured'
  const partial = bcs.state === 'partial'

  const headline = partial
    ? 'Some pieces are missing'
    : healthy
      ? 'Everything looks good'
      : 'Not set up yet'

  const mascotState: MascotState = partial ? 'warning' : healthy ? 'success' : 'idle'

  return (
    <div className="page page--wide">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-2)' }}>Your Claude setup</h1>
          <p className="lead" style={{ marginBottom: 'var(--s-4)' }}>
            {headline}
            {partial ? '. Repair will put back what was removed.' : '.'}
          </p>
          <div className="cluster">
            <Badge tone={scan.claudeCode.state === 'installed' ? 'ok' : 'neutral'} dot>
              Claude Code {scan.claudeCode.version ?? ''}
            </Badge>
            <Badge
              tone={
                scan.claudeDesktop.state === 'installed'
                  ? 'ok'
                  : scan.claudeDesktop.state === 'uncertain'
                    ? 'warn'
                    : 'neutral'
              }
              dot
            >
              Desktop app{' '}
              {scan.claudeDesktop.state === 'installed'
                ? (scan.claudeDesktop.version ?? 'installed')
                : scan.claudeDesktop.state === 'uncertain'
                  ? 'uncertain'
                  : 'not found'}
            </Badge>
            <Badge tone={healthy ? 'ok' : partial ? 'warn' : 'neutral'} dot>
              {healthy ? 'Active' : partial ? 'Needs repair' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <div className="hero__art">
          <Mascot state={mascotState} size="lg" />
        </div>
      </div>

      {lastResult ? (
        <div style={{ marginBottom: 'var(--s-4)' }}>
          <Panel raised>
            <PanelHeader
              icon={lastResult.ok ? '✓' : '!'}
              tone={lastResult.ok ? 'ok' : 'bad'}
              title={lastResult.ok ? 'Done' : 'Did not finish'}
              end={
                <Button size="sm" variant="ghost" onClick={onDismissResult}>
                  Dismiss
                </Button>
              }
            />
            <PanelBody>
              <p className="body" style={{ marginBottom: 'var(--s-2)' }}>
                {lastResult.summary}
              </p>
              <Disclosure summary="What happened">
                <StepList steps={lastResult.steps} />
              </Disclosure>
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      {partial ? (
        <div style={{ marginBottom: 'var(--s-4)' }}>
          <Notice tone="warn" icon="!">
            {bcs.missingComponentIds.length} improvement
            {bcs.missingComponentIds.length === 1 ? '' : 's'} recorded as installed could not be
            found on disk. Something removed them outside this app.
          </Notice>
        </div>
      ) : null}

      <div className="split split--wide-first">
        <div className="stack-4">
          <Panel raised>
            <PanelHeader
              icon="◈"
              tone="accent"
              title="Improvements"
              end={
                <span className="mono">
                  {installedIds.length}/{components.length}
                </span>
              }
            />
            {components.map((component) => {
              const on = installedIds.includes(component.id)
              const missing = bcs.missingComponentIds.includes(component.id)
              const blocked =
                component.permissions.includes('run-claude-cli') &&
                scan.claudeCode.state !== 'installed'
              return (
                <DataRow
                  key={component.id}
                  icon={on ? '✓' : '○'}
                  tone={missing ? 'warn' : on ? 'ok' : 'neutral'}
                  label={component.name}
                  sub={missing ? 'Files are missing — repair to restore' : component.summary}
                  end={
                    <>
                      {missing ? <Badge tone="warn">Missing</Badge> : null}
                      <Switch
                        checked={on}
                        disabled={busy || blocked}
                        label={`${component.name}: ${on ? 'enabled' : 'disabled'}`}
                        onChange={(next) => onToggleComponent(component.id, next)}
                      />
                    </>
                  }
                />
              )
            })}
            <PanelFooter>
              <Button size="sm" onClick={onOpenCustomize} disabled={busy}>
                Open full component list
              </Button>
            </PanelFooter>
          </Panel>

          <Panel>
            <PanelHeader icon="⚙" title="Detected on this computer" />
            <DataRow
              icon="›_"
              label="Claude Code"
              sub={scan.claudeCode.location ?? 'Not installed'}
              end={productBadge(scan.claudeCode)}
            />
            <DataRow
              icon="◱"
              label="Claude desktop app"
              sub={
                scan.claudeDesktop.state === 'installed'
                  ? (scan.claudeDesktop.location ?? 'Installed')
                  : scan.claudeDesktop.state === 'uncertain'
                    ? 'Settings found, but the app itself was not'
                    : 'Not installed'
              }
              end={productBadge(scan.claudeDesktop)}
            />
            <PanelFooter>
              <Disclosure summary="Detection details">
                <div className="stack-3">
                  {[
                    { title: 'Claude desktop app', product: scan.claudeDesktop },
                    { title: 'Claude Code', product: scan.claudeCode }
                  ].map(({ title, product }) => (
                    <div key={title}>
                      <p className="mono" style={{ marginBottom: 'var(--s-1)' }}>
                        {title}
                      </p>
                      {product.probes.map((probe) => (
                        <div
                          key={probe.method}
                          className="small"
                          style={{ display: 'flex', gap: 8 }}
                        >
                          <span style={{ color: probe.found ? 'var(--ok)' : 'var(--ink-3)' }}>
                            {probe.found ? '✓' : '·'}
                          </span>
                          <span style={{ width: 190, flex: 'none' }}>{probe.method}</span>
                          <span className="muted">{probe.note}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </Disclosure>
            </PanelFooter>
          </Panel>
        </div>

        <div className="stack-4">
          <Panel>
            <PanelHeader icon="↻" title="Maintenance" />
            <PanelBody>
              <div className="stack-2">
                <Button onClick={onRescan} disabled={busy}>
                  Check setup again
                </Button>
                <Button onClick={onRepair} disabled={busy || !partial}>
                  Repair missing pieces
                </Button>
                <Button onClick={onOpenCustomize} disabled={busy}>
                  Add or remove improvements
                </Button>
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader icon="↺" tone="warn" title="Safety" />
            <PanelBody>
              <p className="small" style={{ marginBottom: 'var(--s-3)' }}>
                {latestBackup
                  ? `Most recent restore point: ${new Date(latestBackup.createdAtIso).toLocaleString()}.`
                  : 'No restore points yet. One is created before the first change.'}
              </p>

              {confirmRestore && latestBackup ? (
                <Notice tone="warn" icon="!">
                  <p style={{ marginBottom: 'var(--s-3)' }}>
                    This replaces your Claude instructions, settings and skills folder with the copy
                    saved on {new Date(latestBackup.createdAtIso).toLocaleString()}. Anything you
                    changed in those files since then will be lost.
                  </p>
                  <div className="cluster">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setConfirmRestore(false)
                        onRestore(latestBackup.id)
                      }}
                    >
                      Yes, restore that version
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRestore(false)}>
                      Cancel
                    </Button>
                  </div>
                </Notice>
              ) : (
                <div className="stack-2">
                  <Button
                    variant="danger"
                    disabled={busy || !latestBackup}
                    onClick={() => setConfirmRestore(true)}
                  >
                    Restore original setup
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || installedIds.length === 0}
                    onClick={onRemoveAll}
                  >
                    Turn everything off
                  </Button>
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel sunken>
            <PanelHeader icon="▤" title="Advanced" />
            <PanelBody>
              <div className="stack-2">
                <Button size="sm" onClick={() => void window.bcs.revealConfig('claude')}>
                  Open my Claude folder
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    void window.bcs.buildDiagnostics().then(setDiagnostics)
                  }}
                >
                  View diagnostic report
                </Button>
                <Button size="sm" onClick={() => void window.bcs.saveDiagnostics()}>
                  Save report to a file
                </Button>
              </div>
              {diagnostics ? (
                <div style={{ marginTop: 'var(--s-3)' }}>
                  <p className="small muted" style={{ marginBottom: 'var(--s-2)' }}>
                    Personal paths, your username and anything resembling a password have already
                    been removed.
                  </p>
                  <pre className="code selectable">{diagnostics}</pre>
                </div>
              ) : null}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
