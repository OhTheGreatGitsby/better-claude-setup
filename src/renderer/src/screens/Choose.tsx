import type { ReactNode } from 'react'
import { Button, Panel, PanelBody, PanelFooter, PanelHeader } from '../components/kit'

const BENEFITS = [
  'Smarter default behaviour — accurate before agreeable',
  'Better writing, editing and fact checking',
  'Research that shows its sources',
  'Careful, verified help with code',
  'Plans and decisions that actually decide',
  'A restore point before anything changes'
]

export function Choose({
  recommendedCount,
  onRecommended,
  onCustomize,
  onCancel
}: {
  recommendedCount: number
  onRecommended: () => void
  onCustomize: () => void
  onCancel: () => void
}): ReactNode {
  return (
    <div className="page page--narrow">
      <h1 style={{ marginBottom: 'var(--s-3)' }}>How much do you want to change?</h1>
      <p className="lead" style={{ marginBottom: 'var(--s-6)' }}>
        You will see the exact list of changes before anything happens.
      </p>

      <div className="stack-4">
        <Panel accent raised>
          <PanelHeader icon="★" tone="accent" title="Recommended setup" />
          <PanelBody>
            <p className="body" style={{ marginBottom: 'var(--s-4)' }}>
              Best for most people. {recommendedCount} improvements covering everyday use — the ones
              that make the clearest difference.
            </p>
            <ul
              className="small"
              style={{ margin: 0, paddingLeft: 0, listStyle: 'none', lineHeight: 1.9 }}
            >
              {BENEFITS.map((benefit) => (
                <li key={benefit}>
                  <span style={{ color: 'var(--accent)', marginRight: 8 }}>✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </PanelBody>
          <PanelFooter>
            <Button variant="primary" size="lg" bracket onClick={onRecommended}>
              Use recommended
            </Button>
          </PanelFooter>
        </Panel>

        <Panel interactive>
          <PanelHeader icon="◎" title="Custom setup" />
          <PanelBody>
            <p className="body">
              Choose exactly what Claude receives, and read what each part writes before you turn it
              on.
            </p>
          </PanelBody>
          <PanelFooter>
            <div className="cluster">
              <Button onClick={onCustomize}>Customise</Button>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </PanelFooter>
        </Panel>
      </div>
    </div>
  )
}
