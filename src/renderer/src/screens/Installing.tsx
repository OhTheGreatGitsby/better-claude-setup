import type { ReactNode } from 'react'
import type { StepResult } from '@shared/types'
import { Mascot } from '../components/Mascot'
import { Badge, Panel, PanelHeader, StepList, Track } from '../components/kit'

/**
 * The live installation screen.
 *
 * Every row here comes from a step the engine has genuinely finished; the progress bar is
 * completed-steps over planned-steps. Nothing advances on a timer, so if an operation
 * stalls the interface stalls with it rather than pretending to make progress.
 */
export function Installing({
  steps,
  done,
  total
}: {
  steps: StepResult[]
  done: number
  total: number
}): ReactNode {
  const pending = Math.max(0, total - done)

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>Setting up Claude…</h1>
          <p className="lead" style={{ marginBottom: 'var(--s-5)' }}>
            Making the changes you approved. This usually takes a few seconds.
          </p>
          <div style={{ maxWidth: 340 }}>
            <Track value={total > 0 ? done / total : null} />
            <p className="mono" style={{ marginTop: 'var(--s-2)' }}>
              {done} of {total} done
            </p>
          </div>
        </div>
        <div className="hero__art">
          <Mascot state="installing" size="lg" />
        </div>
      </div>

      <Panel raised>
        <PanelHeader
          icon="◈"
          tone="accent"
          title="Progress"
          end={
            <Badge tone="accent" live>
              Working
            </Badge>
          }
        />
        <div style={{ padding: '0 var(--s-4)' }}>
          <StepList steps={steps} />
          {pending > 0
            ? Array.from({ length: pending }).map((_, index) => (
                <div className="step" data-status="pending" key={`pending-${index}`}>
                  <span className="step__mark" aria-hidden="true">
                    ○
                  </span>
                  <div className="step__label">Waiting…</div>
                </div>
              ))
            : null}
        </div>
      </Panel>
    </div>
  )
}
