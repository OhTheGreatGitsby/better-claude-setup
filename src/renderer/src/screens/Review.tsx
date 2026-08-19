import type { ReactNode } from 'react'
import type { ComponentMeta, InstallPlan, PermissionId } from '@shared/types'
import { Mascot } from '../components/Mascot'
import {
  Badge,
  Button,
  DataRow,
  Disclosure,
  Notice,
  Panel,
  PanelBody,
  PanelHeader,
  Track
} from '../components/kit'

const PERMISSION_TEXT: Record<PermissionId, string> = {
  'write-claude-md': 'Add instructions to your Claude instructions file',
  'write-skill-files': 'Add skill files to your Claude folder',
  'write-settings': 'Change specific Claude Code settings',
  'run-claude-cli': 'Run the Claude Code command line tool',
  network: 'Download add-ons from Anthropic'
}

export function Review({
  plan,
  components,
  selected,
  busy,
  onConfirm,
  onBack
}: {
  plan: InstallPlan | null
  components: ComponentMeta[]
  selected: string[]
  busy: boolean
  onConfirm: () => void
  onBack: () => void
}): ReactNode {
  const chosen = components.filter((c) => selected.includes(c.id))
  const permissions = new Set<PermissionId>()
  for (const component of chosen) {
    for (const permission of component.permissions) permissions.add(permission)
  }
  const usesNetwork = chosen.some((c) => c.network)

  const instructionChanges = plan?.changes.filter((c) => c.kind === 'claude-md-block') ?? []
  const skillChanges = plan?.changes.filter((c) => c.kind === 'skill-dir') ?? []
  const settingChanges = plan?.changes.filter((c) => c.kind === 'settings-keys') ?? []
  const pluginChanges = plan?.changes.filter((c) => c.kind === 'plugin-install') ?? []

  const skillsByComponent = new Map<string, number>()
  for (const change of skillChanges) {
    skillsByComponent.set(change.componentId, (skillsByComponent.get(change.componentId) ?? 0) + 1)
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>What will change?</h1>
          <p className="lead">
            Nothing has happened yet. This is everything Better Claude Setup will do if you
            continue.
          </p>
        </div>
        <div className="hero__art">
          <Mascot state="thinking" size="lg" />
        </div>
      </div>

      {!plan ? (
        <Panel>
          <PanelBody>
            <p className="small" style={{ marginBottom: 'var(--s-3)' }}>
              Working out the exact changes…
            </p>
            <Track value={null} />
          </PanelBody>
        </Panel>
      ) : (
        <div className="stack-4">
          {instructionChanges.length > 0 ? (
            <Panel raised>
              <PanelHeader icon="✎" tone="accent" title="Claude instructions" />
              <DataRow
                icon="◆"
                tone="accent"
                label="Better Claude Core"
                sub="About 40 lines of working rules Claude reads at the start of every conversation."
                end={<Badge tone="accent">Added safely</Badge>}
              />
              <DataRow
                icon="✓"
                tone="ok"
                label="Anything already in that file"
                sub="Kept exactly as it is. The new text goes in its own marked block."
                end={<Badge tone="ok">Preserved</Badge>}
              />
            </Panel>
          ) : null}

          {skillChanges.length > 0 ? (
            <Panel raised>
              <PanelHeader
                icon="◈"
                tone="accent"
                title="Skills"
                end={<span className="mono">{skillChanges.length} total</span>}
              />
              {[...skillsByComponent.entries()].map(([componentId, count]) => {
                const meta = components.find((c) => c.id === componentId)
                return (
                  <DataRow
                    key={componentId}
                    icon="◈"
                    label={meta?.name ?? componentId}
                    sub="Loaded only when Claude needs it, so it costs nothing the rest of the time."
                    end={
                      <Badge>
                        {count} {count === 1 ? 'skill' : 'skills'}
                      </Badge>
                    }
                  />
                )
              })}
            </Panel>
          ) : null}

          {settingChanges.length > 0 || pluginChanges.length > 0 ? (
            <Panel raised>
              <PanelHeader icon="⚙" title="Settings and add-ons" />
              {settingChanges.map((change, index) => (
                <DataRow
                  key={`s-${index}`}
                  icon="⚙"
                  label={components.find((c) => c.id === change.componentId)?.name ?? 'Setting'}
                  sub="Every other setting you already have is kept."
                  end={<Badge>1 setting</Badge>}
                />
              ))}
              {pluginChanges.map((change, index) => (
                <DataRow
                  key={`p-${index}`}
                  icon="＋"
                  tone="warn"
                  label={components.find((c) => c.id === change.componentId)?.name ?? 'Add-on'}
                  sub="Downloaded from Anthropic's official catalogue."
                  end={<Badge tone="warn">Downloads</Badge>}
                />
              ))}
            </Panel>
          ) : null}

          <Panel raised>
            <PanelHeader icon="↺" tone="ok" title="Your existing setup" />
            <DataRow
              icon="✓"
              tone="ok"
              label="A restore point"
              sub="Saved before the first change, so everything can be put back exactly."
              end={<Badge tone="ok">Created first</Badge>}
            />
            <DataRow
              icon="✓"
              tone="ok"
              label="Skills you installed yourself"
              sub="Not read, not moved, not removed."
              end={<Badge tone="ok">Untouched</Badge>}
            />
          </Panel>

          {usesNetwork ? (
            <Notice tone="warn" icon="↓">
              One of your choices downloads an add-on from Anthropic&apos;s official catalogue. That
              is the only part of this setup that uses the internet.
            </Notice>
          ) : null}

          <Panel sunken>
            <PanelBody>
              <Disclosure summary="Permissions and exact file paths">
                <div className="stack-3">
                  <div>
                    <p className="mono" style={{ marginBottom: 'var(--s-2)' }}>
                      Better Claude Setup will
                    </p>
                    <ul className="small" style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                      {[...permissions].map((permission) => (
                        <li key={permission}>{PERMISSION_TEXT[permission]}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mono" style={{ marginBottom: 'var(--s-2)' }}>
                      Files written
                    </p>
                    <pre className="code selectable">
                      {plan.changes.map((change) => change.target).join('\n')}
                    </pre>
                  </div>
                </div>
              </Disclosure>
            </PanelBody>
          </Panel>
        </div>
      )}

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant="primary" size="lg" bracket onClick={onConfirm} disabled={busy || !plan}>
          {busy ? 'Setting up…' : 'Approve and set up'}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </div>
    </div>
  )
}
