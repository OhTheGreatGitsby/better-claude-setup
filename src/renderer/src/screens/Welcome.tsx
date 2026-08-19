import type { ReactNode } from 'react'
import type { AppInfo } from '@shared/types'
import { Mascot } from '../components/Mascot'
import { Button, Disclosure, Eyebrow, Panel, PanelBody, PanelHeader } from '../components/kit'

const PROMISES = [
  {
    icon: '✎',
    title: 'Better instructions',
    body: 'A short set of working rules Claude reads at the start of every conversation.'
  },
  {
    icon: '◈',
    title: 'Skills, loaded on demand',
    body: 'Writing, research, coding and planning know-how that costs nothing until it is needed.'
  },
  {
    icon: '↺',
    title: 'Completely reversible',
    body: 'A restore point before the first change, and one button to put everything back.'
  }
]

export function Welcome({
  info,
  onStart,
  onLearn
}: {
  info: AppInfo | null
  onStart: () => void
  onLearn: () => void
}): ReactNode {
  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <Eyebrow>Setup · v{info?.version ?? '—'}</Eyebrow>
          <h1 className="display" style={{ marginBottom: 'var(--s-4)' }}>
            Make Claude
            <br />
            noticeably better.
          </h1>
          <p className="lead" style={{ marginBottom: 'var(--s-6)' }}>
            Give Claude sharper instructions and a set of on-demand skills — without opening a
            terminal or editing a single file.
          </p>
          <div className="cluster">
            <Button variant="primary" size="lg" bracket onClick={onStart}>
              Set up Claude
            </Button>
            <Button variant="ghost" size="lg" onClick={onLearn}>
              See what changes
            </Button>
          </div>
        </div>
        <div className="hero__art">
          <Mascot state="idle" size="xl" />
        </div>
      </div>

      <div
        className="split"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--s-4)' }}
      >
        {PROMISES.map((promise) => (
          <Panel key={promise.title}>
            <PanelHeader icon={promise.icon} tone="accent" title={promise.title} />
            <PanelBody>
              <p className="small">{promise.body}</p>
            </PanelBody>
          </Panel>
        ))}
      </div>

      <Panel sunken className="anim-rise">
        <PanelBody tight>
          <Disclosure summary="What this will not do">
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>It never reads your conversations, projects or documents.</li>
              <li>It never sends anything anywhere. No account, no tracking.</li>
              <li>It never changes Claude&apos;s safety behaviour or your Anthropic account.</li>
              <li>It never overwrites a setting you already chose.</li>
            </ul>
          </Disclosure>
        </PanelBody>
      </Panel>
    </div>
  )
}
