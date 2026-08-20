import { useState } from 'react'
import type { ReactNode } from 'react'
import type {
  BackupRecord,
  ChatSkillsState,
  ComponentMeta,
  DetectedProduct,
  DetectionResult,
  OperationResult
} from '@shared/types'
import { Mascot } from '../components/Mascot'
import type { MascotState } from '../components/Mascot'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
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

const CATEGORY_ICON: Record<string, IconName> = {
  core: 'sparkle',
  writing: 'pen',
  research: 'search',
  coding: 'code',
  planning: 'route',
  design: 'palette',
  integrations: 'plus'
}

function productBadge(product: DetectedProduct): ReactNode {
  if (product.state === 'installed') {
    return (
      <Badge tone="ok" dot>
        {product.version ?? 'Installed'}
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
  chatSkills,
  components,
  installedIds,
  backups,
  onOpenCustomize,
  onOpenChatSetup,
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
  chatSkills: ChatSkillsState | null
  components: ComponentMeta[]
  installedIds: string[]
  backups: BackupRecord[]
  onOpenCustomize: () => void
  onOpenChatSetup: () => void
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
  const codeReady = bcs.state === 'configured'
  const codePartial = bcs.state === 'partial'
  const chatReady = chatSkills?.state === 'confirmed'
  const chatUpdate = chatSkills?.state === 'update-available'

  // The overall line names how many things still want attention rather than saying
  // "active", which never made clear which Claude it meant.
  const outstanding = [!codeReady, !chatReady].filter(Boolean).length
  const headline = codePartial
    ? 'Some local files are missing'
    : outstanding === 0
      ? 'Everything is ready'
      : outstanding === 1
        ? '1 thing still needs setting up'
        : '2 things still need setting up'

  const mascotState: MascotState = codePartial ? 'warning' : outstanding === 0 ? 'success' : 'idle'

  return (
    <div className="page page--wide">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-2)' }}>Your Claude setup</h1>
          <p className="lead">{headline}.</p>
        </div>
        <div className="hero__art">
          <Mascot state={mascotState} size="md" />
        </div>
      </div>

      {lastResult ? (
        <div style={{ marginBottom: 'var(--s-4)' }}>
          <Panel raised>
            <PanelHeader
              icon={<Icon name={lastResult.ok ? 'check' : 'alert'} />}
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

      {codePartial ? (
        <div style={{ marginBottom: 'var(--s-4)' }}>
          <Notice tone="warn" icon={<Icon name="alert" />}>
            {bcs.missingComponentIds.length} improvement
            {bcs.missingComponentIds.length === 1 ? '' : 's'} recorded as installed could not be
            found on disk. Something removed them outside this app.
          </Notice>
        </div>
      ) : null}

      {/* The two surfaces, which are genuinely different systems and are never merged. */}
      <div className="split" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="surface-card" data-tone={codeReady ? 'ok' : codePartial ? 'warn' : ''}>
          <div className="surface-card__head">
            <span className="plain-item__icon">
              <Icon name="terminal" size={17} />
            </span>
            <div>
              <div className="surface-card__title">Claude Code</div>
              <p className="small muted">On this computer</p>
            </div>
          </div>
          <div className="cluster">
            {codeReady ? (
              <Badge tone="ok" dot>
                Ready
              </Badge>
            ) : codePartial ? (
              <Badge tone="warn" dot>
                Needs repair
              </Badge>
            ) : (
              <Badge dot>Not set up</Badge>
            )}
            <span className="small muted">
              {installedIds.length} improvement{installedIds.length === 1 ? '' : 's'} installed
            </span>
          </div>
          <div className="cluster">
            <Button size="sm" onClick={onOpenCustomize} disabled={busy}>
              {codeReady ? 'Change what is installed' : 'Set up Claude Code'}
            </Button>
            {codePartial ? (
              <Button size="sm" variant="primary" onClick={onRepair} disabled={busy}>
                Repair
              </Button>
            ) : null}
          </div>
        </div>

        <div
          className="surface-card"
          data-tone={chatReady && !chatUpdate ? 'ok' : chatUpdate ? 'warn' : ''}
        >
          <div className="surface-card__head">
            <span className="plain-item__icon">
              <Icon name="chat" size={17} />
            </span>
            <div>
              <div className="surface-card__title">Claude Chat &amp; Web</div>
              <p className="small muted">In your Claude account</p>
            </div>
          </div>
          <div className="cluster">
            {chatUpdate ? (
              <Badge tone="warn" dot>
                Update available
              </Badge>
            ) : chatReady ? (
              <Badge tone="ok" dot>
                Ready — you confirmed
              </Badge>
            ) : (
              <Badge dot>Setup needed</Badge>
            )}
            <span className="small muted">
              {chatSkills?.skills.length ?? 0} skills ready to upload
            </span>
          </div>
          <div className="cluster">
            <Button
              size="sm"
              variant={chatReady && !chatUpdate ? 'secondary' : 'primary'}
              onClick={onOpenChatSetup}
              disabled={busy}
            >
              {chatUpdate
                ? 'Update chat skills'
                : chatReady
                  ? 'Review chat setup'
                  : 'Set up chat skills'}
            </Button>
          </div>
        </div>
      </div>

      <div className="split split--wide-first">
        <div className="stack-4">
          <Panel raised>
            <PanelHeader
              icon={<Icon name="sparkle" />}
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
                  icon={<Icon name={CATEGORY_ICON[component.category] ?? 'sparkle'} />}
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
          </Panel>

          <Panel>
            <PanelHeader icon={<Icon name="window" />} title="Detected on this computer" />
            <DataRow
              icon={<Icon name="terminal" />}
              label="Claude Code"
              sub={scan.claudeCode.location ?? 'Not installed'}
              end={productBadge(scan.claudeCode)}
            />
            <DataRow
              icon={<Icon name="window" />}
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
            <PanelHeader icon={<Icon name="refresh" />} title="Maintenance" />
            <PanelBody>
              <div className="stack-2">
                <Button onClick={onRescan} disabled={busy}>
                  Check setup again
                </Button>
                <Button onClick={onOpenCustomize} disabled={busy}>
                  Add or remove improvements
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void window.bcs.revealConfig('claude')}
                >
                  Open my Claude folder
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void window.bcs.buildDiagnostics().then(setDiagnostics)
                  }}
                >
                  View diagnostic report
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

          {/* Destructive actions are deliberately quieter than everyday ones. */}
          <Panel sunken>
            <PanelHeader icon={<Icon name="undo" />} title="Undo" />
            <PanelBody>
              <p className="small" style={{ marginBottom: 'var(--s-3)' }}>
                {latestBackup
                  ? `Most recent restore point: ${new Date(latestBackup.createdAtIso).toLocaleString()}.`
                  : 'No restore points yet. One is created before the first change.'}
              </p>

              {confirmRestore && latestBackup ? (
                <Notice tone="warn" icon={<Icon name="alert" />}>
                  <p style={{ marginBottom: 'var(--s-3)' }}>
                    This replaces your Claude instructions, settings and skills folder with the copy
                    saved on {new Date(latestBackup.createdAtIso).toLocaleString()}. Anything you
                    changed in those files since then will be lost. Skills you uploaded to your
                    Claude account are not affected.
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
                    size="sm"
                    variant="ghost"
                    disabled={busy || installedIds.length === 0}
                    onClick={onRemoveAll}
                  >
                    Turn everything off
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy || !latestBackup}
                    onClick={() => setConfirmRestore(true)}
                  >
                    Restore original setup
                  </Button>
                </div>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  )
}
