import type { ReactNode } from 'react'
import type { ComponentMeta, OperationResult } from '@shared/types'
import { Button, Card, Notice, StepList } from '../components/ui'

export function Result({
  result,
  components,
  installedIds,
  onDone,
  onRetry
}: {
  result: OperationResult
  components: ComponentMeta[]
  installedIds: string[]
  onDone: () => void
  onRetry: () => void
}): ReactNode {
  const installed = components.filter((c) => installedIds.includes(c.id))

  return (
    <div className="container">
      <h1>{result.ok ? 'Claude is ready.' : 'Setup did not finish'}</h1>
      <p className="lede">{result.summary}</p>

      {!result.ok ? (
        <Notice tone={result.rolledBack ? 'warn' : 'bad'}>
          {result.rolledBack
            ? 'Every change that had been made was undone, so your Claude configuration is exactly as it was before you pressed the button.'
            : 'Some changes could not be undone automatically. You can use Restore original configuration on the main screen.'}
        </Notice>
      ) : null}

      {result.ok && installed.length > 0 ? (
        <Card>
          <h2>Installed</h2>
          <ul className="change-list">
            {installed.map((component) => (
              <li key={component.id} className="change-list__keep">
                {component.name}
              </li>
            ))}
            <li className="change-list__keep">
              A copy of your previous setup, so you can undo this
            </li>
          </ul>
        </Card>
      ) : null}

      <Card flat>
        <h3>Everything that happened</h3>
        <StepList steps={result.steps} />
      </Card>

      {result.ok ? (
        <Card flat>
          <h3>What to do next</h3>
          <p className="muted small" style={{ marginBottom: 6 }}>
            Close and reopen Claude Code, or start a new conversation, so it reads the new
            instructions. The skills appear as commands: type <code>/</code> to see them.
          </p>
          <p className="muted small" style={{ marginBottom: 0 }}>
            You can reopen Better Claude Setup at any time to change, disable, update or restore
            your configuration.
          </p>
        </Card>
      ) : null}

      <div className="actions" style={{ marginTop: 20 }}>
        <Button variant="primary" onClick={onDone}>
          {result.ok ? 'Done' : 'Go to my setup'}
        </Button>
        {!result.ok ? <Button onClick={onRetry}>Try again</Button> : null}
      </div>
    </div>
  )
}
