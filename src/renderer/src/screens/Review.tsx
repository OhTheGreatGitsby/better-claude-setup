import type { ReactNode } from 'react'
import type { ComponentMeta, InstallPlan, PermissionId } from '@shared/types'
import { Button, Card, Disclosure, Notice } from '../components/ui'

const PERMISSION_TEXT: Record<PermissionId, string> = {
  'write-claude-md': 'Add instructions to your Claude instructions file',
  'write-skill-files': 'Add skill files to your Claude folder',
  'write-settings': 'Change specific Claude Code settings',
  'run-claude-cli': 'Run the Claude Code command line tool',
  network: 'Download add-ons from Anthropic over the internet'
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

  return (
    <div className="container">
      <h1>What will change?</h1>
      <p className="lede">
        Nothing has happened yet. This is the complete list of what Better Claude Setup will do if
        you continue.
      </p>

      <Card>
        <h2>Better Claude Setup would like permission to</h2>
        <ul className="change-list">
          {[...permissions].map((permission) => (
            <li key={permission}>{PERMISSION_TEXT[permission]}</li>
          ))}
          <li className="change-list__keep">
            Save a copy of your current Claude configuration first
          </li>
          <li className="change-list__keep">Leave every other setting you already have alone</li>
        </ul>
      </Card>

      <Card>
        <h2>Exactly what gets written</h2>
        {plan ? (
          <ul className="change-list">
            {plan.changes.map((change, index) => (
              <li key={`${change.componentId}-${index}`}>
                {change.label}
                <div className="muted small selectable">{change.target}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">
            <span className="spinner" aria-hidden="true" /> Working out the changes…
          </p>
        )}

        {plan && plan.alreadyInstalled.length > 0 ? (
          <p className="muted small" style={{ marginTop: 12, marginBottom: 0 }}>
            {plan.alreadyInstalled.length} of these are already installed at this version and will
            simply be rewritten to match.
          </p>
        ) : null}
      </Card>

      {usesNetwork ? (
        <Notice tone="warn">
          One or more of your choices downloads an add-on from Anthropic&apos;s official plugin
          catalogue. That is the only part of this setup that uses the internet.
        </Notice>
      ) : null}

      <Card flat>
        <Disclosure summary="What is not touched">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Your existing instructions file keeps everything you wrote in it.</li>
            <li>Your existing settings keep every key you already had.</li>
            <li>Skills you installed yourself are not read, moved or removed.</li>
            <li>Your Claude account, conversations and projects are not accessed at all.</li>
          </ul>
        </Disclosure>
      </Card>

      <div className="actions" style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onConfirm} disabled={busy || !plan}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Setting up…
            </>
          ) : (
            'Approve and set up'
          )}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
      </div>
    </div>
  )
}
