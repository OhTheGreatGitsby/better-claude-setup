import type { ReactNode } from 'react'
import type { Category, CategoryId, ComponentMeta } from '@shared/types'
import { Badge, Button, Disclosure, Panel, PanelHeader, Switch } from '../components/kit'

const CATEGORY_ICON: Record<CategoryId, string> = {
  core: '◆',
  writing: '✎',
  research: '◎',
  coding: '›_',
  planning: '▤',
  design: '◈',
  integrations: '＋'
}

const CONTEXT_LABEL: Record<ComponentMeta['contextCost'], string> = {
  none: 'No memory cost',
  'always-on-small': 'Always loaded · small',
  'on-demand': 'Loaded only when needed'
}

export function Customize({
  categories,
  components,
  selected,
  installed,
  claudeCodeInstalled,
  onToggle,
  onContinue,
  onBack
}: {
  categories: Category[]
  components: ComponentMeta[]
  selected: string[]
  installed: string[]
  claudeCodeInstalled: boolean
  onToggle: (id: string) => void
  onContinue: () => void
  onBack: () => void
}): ReactNode {
  return (
    <div className="page">
      <div className="row-between" style={{ marginBottom: 'var(--s-6)', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-2)' }}>Choose what to set up</h1>
          <p className="lead">Everything here can be removed later, on its own.</p>
        </div>
        <Badge tone="accent">{selected.length} selected</Badge>
      </div>

      <div className="stack-6">
        {categories.map((category) => {
          const inCategory = components.filter((c) => c.category === category.id)
          if (inCategory.length === 0) return null
          const onCount = inCategory.filter((c) => selected.includes(c.id)).length

          return (
            <Panel key={category.id} raised>
              <PanelHeader
                icon={CATEGORY_ICON[category.id]}
                tone={onCount > 0 ? 'accent' : 'neutral'}
                title={category.title}
                end={
                  <span className="mono">
                    {onCount}/{inCategory.length}
                  </span>
                }
              />
              <div
                style={{
                  padding: 'var(--s-2) var(--s-4)',
                  borderBottom: '1px solid var(--line)',
                  background: 'var(--surface-2)'
                }}
              >
                <p className="small muted">{category.blurb}</p>
              </div>

              {inCategory.map((component, index) => {
                const needsCli = component.permissions.includes('run-claude-cli')
                const blocked = needsCli && !claudeCodeInstalled
                const isOn = selected.includes(component.id)

                return (
                  <div
                    key={component.id}
                    style={{
                      borderTop: index === 0 ? '0' : '1px solid var(--line)',
                      padding: 'var(--s-3) var(--s-4)',
                      background: isOn ? 'var(--accent-soft)' : 'transparent',
                      transition: 'background-color var(--dur) var(--ease)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cluster" style={{ marginBottom: 2 }}>
                          <strong>{component.name}</strong>
                          {installed.includes(component.id) ? (
                            <Badge tone="ok" dot>
                              Installed
                            </Badge>
                          ) : component.recommended ? (
                            <Badge tone="accent">Recommended</Badge>
                          ) : null}
                        </div>
                        <p className="small">{component.summary}</p>
                      </div>
                      <Switch
                        checked={isOn}
                        disabled={blocked}
                        label={`${component.name}: ${isOn ? 'on' : 'off'}`}
                        onChange={() => onToggle(component.id)}
                      />
                    </div>

                    {blocked ? (
                      <p
                        className="small"
                        style={{ color: 'var(--warn)', marginTop: 'var(--s-2)' }}
                      >
                        Needs Claude Code, which is not installed on this computer.
                      </p>
                    ) : null}

                    <div style={{ marginTop: 'var(--s-2)' }}>
                      <Disclosure summary="What it writes">
                        <div className="stack-3">
                          <p className="small">
                            <strong>Why it helps.</strong> {component.why}
                          </p>
                          <ul
                            className="small mono mono--plain selectable"
                            style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}
                          >
                            {component.writes.map((path) => (
                              <li key={path}>{path}</li>
                            ))}
                          </ul>
                          <p className="small muted">{component.technical}</p>
                          <div className="cluster">
                            <Badge>{CONTEXT_LABEL[component.contextCost]}</Badge>
                            <Badge tone={component.network ? 'warn' : 'neutral'}>
                              {component.network ? 'Uses the internet' : 'Offline'}
                            </Badge>
                            <Badge tone={component.executesCommands ? 'warn' : 'neutral'}>
                              {component.executesCommands ? 'Runs a command' : 'Writes files only'}
                            </Badge>
                            <Badge>{component.license}</Badge>
                            <Badge>Checked {component.verifiedOn}</Badge>
                          </div>
                          <p className="small muted">{component.securityNotes}</p>
                          {component.homepage ? (
                            <button
                              className="linkish small"
                              onClick={() => void window.bcs.openExternal(component.homepage ?? '')}
                            >
                              Open the official page
                            </button>
                          ) : null}
                        </div>
                      </Disclosure>
                    </div>
                  </div>
                )
              })}
            </Panel>
          )
        })}
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button
          variant="primary"
          size="lg"
          bracket
          onClick={onContinue}
          disabled={selected.length === 0}
        >
          Review changes
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
