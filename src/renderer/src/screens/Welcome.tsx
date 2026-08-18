import type { ReactNode } from 'react'
import type { AppInfo } from '@shared/types'
import { Button, Card, Disclosure } from '../components/ui'

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
    <div className="container">
      <p className="brand">{info?.author ?? 'Made by KC8 — OhTheGreatGitsby'}</p>
      <h1>Welcome to Better Claude Setup</h1>
      <p className="lede">{info?.tagline}</p>

      <Card>
        <h2>What this does</h2>
        <p className="muted">
          Claude is very good out of the box, and noticeably better when it is told how you want it
          to work. This app writes a small, carefully chosen set of instructions and skills into
          Claude&apos;s own settings for you, so you get the benefit without learning any of the
          technical machinery behind it.
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          It shows you every change before making it, keeps a copy of your current setup, and can
          undo everything later.
        </p>
      </Card>

      <Card flat>
        <Disclosure summary="What it will not do">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>It does not read your conversations, files or projects.</li>
            <li>It does not send anything anywhere. There is no account and no tracking.</li>
            <li>It does not change Claude&apos;s safety behaviour or your Anthropic account.</li>
            <li>It does not delete or overwrite settings you already had.</li>
          </ul>
        </Disclosure>
      </Card>

      <div className="actions" style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onStart}>
          Get started
        </Button>
        <Button variant="ghost" onClick={onLearn}>
          Learn what this changes
        </Button>
      </div>
    </div>
  )
}
