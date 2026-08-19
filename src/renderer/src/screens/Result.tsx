import type { ReactNode } from 'react'
import type { ComponentMeta, OperationResult } from '@shared/types'
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
  StepList
} from '../components/kit'

export function Result({
  result,
  components,
  installedIds,
  onDone,
  onRetry,
  onUndo,
  busy
}: {
  result: OperationResult
  components: ComponentMeta[]
  installedIds: string[]
  onDone: () => void
  onRetry: () => void
  onUndo: () => void
  busy: boolean
}): ReactNode {
  const installed = components.filter((c) => installedIds.includes(c.id))
  const failedStep = result.steps.find((s) => s.status === 'failed')

  if (!result.ok) {
    return (
      <div className="page">
        <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
          <div>
            <h1 style={{ marginBottom: 'var(--s-3)' }}>Something needs attention</h1>
            <p className="lead">
              {failedStep
                ? `Better Claude Setup could not finish “${failedStep.label.toLowerCase()}”.`
                : 'Better Claude Setup could not finish.'}
            </p>
          </div>
          <div className="hero__art">
            <Mascot state="error" size="lg" />
          </div>
        </div>

        <div className="stack-4">
          <Notice tone={result.rolledBack ? 'warn' : 'bad'} icon={result.rolledBack ? '↺' : '!'}>
            {result.rolledBack
              ? 'Every change that had been made was undone. Your Claude setup is exactly as it was before you pressed the button.'
              : 'Some changes could not be undone automatically. Use Restore original setup on the manager screen.'}
          </Notice>

          {failedStep ? (
            <Panel>
              <PanelHeader icon="!" tone="bad" title="What went wrong" />
              <PanelBody>
                <p className="body">{failedStep.message}</p>
                {failedStep.detail ? (
                  <div style={{ marginTop: 'var(--s-3)' }}>
                    <Disclosure summary="Technical details">
                      <pre className="code selectable">{failedStep.detail}</pre>
                    </Disclosure>
                  </div>
                ) : null}
              </PanelBody>
            </Panel>
          ) : null}

          <Panel sunken>
            <PanelBody>
              <Disclosure summary="Everything that happened">
                <StepList steps={result.steps} />
              </Disclosure>
            </PanelBody>
          </Panel>
        </div>

        <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
          <Button variant="primary" size="lg" bracket onClick={onRetry} disabled={busy}>
            Try again
          </Button>
          <Button onClick={onUndo} disabled={busy}>
            Undo changes
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Go to my setup
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 className="display" style={{ marginBottom: 'var(--s-3)' }}>
            Claude is ready.
          </h1>
          <p className="lead">Your Better Claude Setup is active.</p>
        </div>
        <div className="hero__art">
          <Mascot state="success" size="lg" />
        </div>
      </div>

      <div className="stack-4">
        <Panel raised>
          <PanelHeader
            icon="✓"
            tone="ok"
            title="Now active"
            end={<Badge tone="ok">{installed.length}</Badge>}
          />
          {installed.map((component) => (
            <DataRow
              key={component.id}
              icon="✓"
              tone="ok"
              label={component.name}
              sub={component.summary}
            />
          ))}
          <DataRow
            icon="↺"
            tone="ok"
            label="Restore point saved"
            sub="Taken before the first change, so all of this can be undone."
          />
        </Panel>

        <Panel sunken>
          <PanelHeader icon="→" title="What to do next" />
          <PanelBody>
            <p className="body" style={{ marginBottom: 'var(--s-2)' }}>
              Start a new Claude conversation so it picks up the new instructions. Your new skills
              appear when you type <code>/</code>.
            </p>
            <p className="small muted">
              Reopen Better Claude Setup at any time to change, disable or restore anything.
            </p>
          </PanelBody>
        </Panel>

        <Panel sunken>
          <PanelBody>
            <Disclosure summary="Everything that happened">
              <StepList steps={result.steps} />
            </Disclosure>
          </PanelBody>
        </Panel>
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant="primary" size="lg" bracket onClick={onDone}>
          Open setup manager
        </Button>
      </div>
    </div>
  )
}
