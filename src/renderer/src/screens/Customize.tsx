import type { ReactNode } from 'react'
import type { Category, ComponentMeta } from '@shared/types'
import { Button, Card, Disclosure, Pill, Toggle } from '../components/ui'

const CONTEXT_LABEL: Record<ComponentMeta['contextCost'], string> = {
  none: 'No effect on Claude’s memory budget',
  'always-on-small': 'Small, always loaded',
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
    <div className="container container--wide">
      <h1>Choose what to set up</h1>
      <p className="lede">
        Everything here is optional and every one can be removed later on its own.
      </p>

      {categories.map((category) => {
        const inCategory = components.filter((c) => c.category === category.id)
        if (inCategory.length === 0) return null
        return (
          <div key={category.id}>
            <h2 className="category-heading">{category.title}</h2>
            <p className="muted small" style={{ marginTop: -4 }}>
              {category.blurb}
            </p>
            {inCategory.map((component) => {
              const needsCli = component.permissions.includes('run-claude-cli')
              const blocked = needsCli && !claudeCodeInstalled
              return (
                <Card key={component.id}>
                  <div className="card__header">
                    <Toggle
                      checked={selected.includes(component.id)}
                      disabled={blocked}
                      onChange={() => onToggle(component.id)}
                      label={component.name}
                      description={component.summary}
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 'none' }}>
                      {installed.includes(component.id) ? (
                        <Pill tone="ok">Installed</Pill>
                      ) : component.recommended ? (
                        <Pill tone="accent">Recommended</Pill>
                      ) : (
                        <Pill tone="off">Optional</Pill>
                      )}
                    </div>
                  </div>

                  {blocked ? (
                    <p className="small" style={{ color: 'var(--warning)', marginTop: 10 }}>
                      Needs Claude Code, which is not installed on this computer.
                    </p>
                  ) : null}

                  <div style={{ marginTop: 10 }}>
                    <Disclosure summary="Why this helps, and exactly what it changes">
                      <p>
                        <strong>Why it helps.</strong> {component.why}
                      </p>
                      <p>
                        <strong>What it writes.</strong>
                      </p>
                      <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                        {component.writes.map((path) => (
                          <li key={path} className="selectable">
                            {path}
                          </li>
                        ))}
                      </ul>
                      <p>{component.technical}</p>
                      <dl className="meta-grid">
                        <dt>Source</dt>
                        <dd>{component.source}</dd>
                        <dt>Publisher</dt>
                        <dd>{component.publisher}</dd>
                        <dt>Version</dt>
                        <dd>{component.version}</dd>
                        <dt>Licence</dt>
                        <dd>{component.license}</dd>
                        <dt>Checked on</dt>
                        <dd>{component.verifiedOn}</dd>
                        <dt>Internet</dt>
                        <dd>{component.network ? 'Yes — downloads from Anthropic' : 'No'}</dd>
                        <dt>Runs commands</dt>
                        <dd>{component.executesCommands ? 'Yes' : 'No'}</dd>
                        <dt>Memory cost</dt>
                        <dd>{CONTEXT_LABEL[component.contextCost]}</dd>
                        <dt>Security</dt>
                        <dd>{component.securityNotes}</dd>
                      </dl>
                      {component.homepage ? (
                        <p style={{ marginTop: 10, marginBottom: 0 }}>
                          <button
                            className="link"
                            onClick={() => void window.bcs.openExternal(component.homepage ?? '')}
                          >
                            Open the official page for this add-on
                          </button>
                        </p>
                      ) : null}
                    </Disclosure>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      })}

      <div className="actions" style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onContinue} disabled={selected.length === 0}>
          Review {selected.length} {selected.length === 1 ? 'change' : 'changes'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
