import type { ReactNode } from 'react'
import type { ComponentMeta } from '@shared/types'
import { Mascot } from '../components/Mascot'
import { Badge, Button, DataRow, Panel, PanelBody, PanelHeader } from '../components/kit'

/**
 * Where the app explains, precisely, which Claude surfaces it can and cannot affect.
 *
 * Version 1.0.0 claimed setup "also improves the Claude desktop app". That was too broad.
 * Anthropic's documentation is specific: Desktop and the CLI read the same configuration
 * files, which covers the desktop app's Code tab in local sessions — but the Cowork tab
 * sources its skills and connectors from the claude.ai account rather than the local
 * folder, and Chat is governed by account settings and Styles. So most of what a person
 * means by "the Claude app" is not affected, and saying otherwise would be marketing.
 */
const SURFACES = [
  {
    name: 'Claude Code',
    detail: 'In the terminal, and in the VS Code and JetBrains extensions.',
    tone: 'ok' as const,
    verdict: 'Fully configured',
    icon: '›_'
  },
  {
    name: 'Claude desktop app — Code tab',
    detail: 'Local sessions read the same instructions, skills and settings files.',
    tone: 'ok' as const,
    verdict: 'Fully configured',
    icon: '◱'
  },
  {
    name: 'Claude desktop app — Chat tab',
    detail: 'Governed by your Anthropic account settings and Styles, which live online.',
    tone: 'neutral' as const,
    verdict: 'Not affected',
    icon: '◱'
  },
  {
    name: 'Claude desktop app — Cowork tab',
    detail: 'Takes its skills and connectors from your claude.ai account, not this folder.',
    tone: 'neutral' as const,
    verdict: 'Not affected',
    icon: '◱'
  },
  {
    name: 'claude.ai in a browser',
    detail: 'Entirely account-side. No local application can change it.',
    tone: 'neutral' as const,
    verdict: 'Not affected',
    icon: '◎'
  }
]

export function Explain({
  components,
  onBack
}: {
  components: ComponentMeta[]
  onBack: () => void
}): ReactNode {
  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>What this changes</h1>
          <p className="lead">
            Claude reads a short instructions file at the start of every conversation, and can load
            extra skills when a task needs them. Better Claude Setup writes good versions of both.
          </p>
        </div>
        <div className="hero__art">
          <Mascot state="thinking" size="lg" />
        </div>
      </div>

      <div className="stack-4">
        <Panel raised>
          <PanelHeader icon="◎" tone="accent" title="Why it stays small" />
          <PanelBody>
            <p className="body">
              Claude has a limited working memory, and everything loaded at the start of a
              conversation uses some of it up. So only one short block of instructions is always
              present. Everything else is a <strong>skill</strong>, which Claude reads only when the
              task calls for it — costing you nothing the rest of the time.
            </p>
          </PanelBody>
        </Panel>

        <Panel raised>
          <PanelHeader icon="◱" title="Which Claude this affects" />
          {SURFACES.map((surface) => (
            <DataRow
              key={surface.name}
              icon={surface.icon}
              tone={surface.tone}
              label={surface.name}
              sub={surface.detail}
              end={<Badge tone={surface.tone}>{surface.verdict}</Badge>}
            />
          ))}
          <PanelBody>
            <p className="small muted">
              Better Claude Setup configures Claude Code and the files the desktop app&apos;s Code
              tab shares with it. It cannot change the personal instructions or Styles you set
              inside the Claude app, because those are stored on your Anthropic account rather than
              on this computer.
            </p>
          </PanelBody>
        </Panel>

        <Panel raised>
          <PanelHeader
            icon="◈"
            title="What can be installed"
            end={<span className="mono">{components.length} parts</span>}
          />
          {components.map((component) => (
            <DataRow
              key={component.id}
              icon={component.recommended ? '★' : '○'}
              tone={component.recommended ? 'accent' : 'neutral'}
              label={component.name}
              sub={component.summary}
              end={
                component.recommended ? (
                  <Badge tone="accent">Recommended</Badge>
                ) : (
                  <Badge>Optional</Badge>
                )
              }
            />
          ))}
        </Panel>
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant="primary" size="lg" bracket onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
