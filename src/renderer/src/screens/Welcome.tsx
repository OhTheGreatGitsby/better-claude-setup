import type { ReactNode } from 'react'
import type { AppInfo } from '@shared/types'
import { Mascot } from '../components/Mascot'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import { Button } from '../components/kit'

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'terminal',
    title: 'Claude Code, set up for you',
    body: 'Better working habits and ten skills, written into Claude’s own settings.'
  },
  {
    icon: 'chat',
    title: 'The same skills in normal chats',
    body: 'Packaged for your Claude account, so /research works in an ordinary conversation.'
  },
  {
    icon: 'undo',
    title: 'Nothing you can’t undo',
    body: 'Every change is shown first, backed up before it happens, and reversible.'
  }
]

export function Welcome({
  onStart,
  onLearn
}: {
  info: AppInfo | null
  onStart: () => void
  onLearn: () => void
}): ReactNode {
  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-10)' }}>
        <div>
          <h1 className="display" style={{ marginBottom: 'var(--s-4)' }}>
            Make Claude
            <br />
            noticeably better.
          </h1>
          <p className="lead" style={{ marginBottom: 'var(--s-6)' }}>
            A safe setup manager for Claude. It improves Claude Code automatically, helps you add
            the same skills to normal Claude chats, and can undo all of it.
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

      <div className="plain-list" style={{ maxWidth: 640, margin: '0 auto' }}>
        {POINTS.map((point) => (
          <div className="plain-item" key={point.title}>
            <span className="plain-item__icon">
              <Icon name={point.icon} size={17} />
            </span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{point.title}</div>
              <p className="small">{point.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
