import type { ReactNode } from 'react'
import type { StepResult } from '@shared/types'

/**
 * The component kit. Screens compose these and add layout only; none of them should be
 * inventing colours, radii or durations of their own.
 */

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad'

const TONE_SUFFIX: Record<Tone, string> = {
  neutral: '',
  accent: '--accent',
  ok: '--ok',
  warn: '--warn',
  bad: '--bad'
}

/** The small square glyph that opens a panel header — the reference's defining motif. */
export function Tile({
  children,
  tone = 'neutral',
  large = false
}: {
  children: ReactNode
  tone?: Tone
  large?: boolean
}): ReactNode {
  const classes = [
    'tile',
    tone === 'neutral' ? '' : `tile${TONE_SUFFIX[tone]}`,
    large ? 'tile--lg' : ''
  ]
  return (
    <span className={classes.filter(Boolean).join(' ')} aria-hidden="true">
      {children}
    </span>
  )
}

export function Panel({
  children,
  raised = false,
  sunken = false,
  accent = false,
  interactive = false,
  className = ''
}: {
  children: ReactNode
  raised?: boolean
  sunken?: boolean
  accent?: boolean
  interactive?: boolean
  className?: string
}): ReactNode {
  const classes = [
    'panel',
    raised ? 'panel--raised' : '',
    sunken ? 'panel--sunken' : '',
    accent ? 'panel--accent' : '',
    interactive ? 'panel--interactive' : '',
    className
  ]
  return <section className={classes.filter(Boolean).join(' ')}>{children}</section>
}

export function PanelHeader({
  icon,
  tone = 'neutral',
  title,
  end
}: {
  icon: ReactNode
  tone?: Tone
  title: string
  end?: ReactNode
}): ReactNode {
  return (
    <header className="panel__header">
      <Tile tone={tone}>{icon}</Tile>
      <h2 className="panel__title">{title}</h2>
      {end ? <div className="panel__header-end">{end}</div> : null}
    </header>
  )
}

export function PanelBody({
  children,
  tight = false
}: {
  children: ReactNode
  tight?: boolean
}): ReactNode {
  return <div className={tight ? 'panel__body panel__body--tight' : 'panel__body'}>{children}</div>
}

export function PanelFooter({ children }: { children: ReactNode }): ReactNode {
  return <div className="panel__footer">{children}</div>
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  bracket = false,
  title
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  /** Wraps the label in the reference's angle brackets. Primary actions only. */
  bracket?: boolean
  title?: string
}): ReactNode {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'md' ? '' : `btn--${size}`,
    bracket ? 'btn--bracket' : ''
  ]
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  live = false
}: {
  children: ReactNode
  tone?: Tone
  dot?: boolean
  live?: boolean
}): ReactNode {
  const classes = [
    'badge',
    tone === 'neutral' ? '' : `badge${TONE_SUFFIX[tone]}`,
    live ? 'badge--live' : ''
  ]
  return (
    <span className={classes.filter(Boolean).join(' ')}>
      {dot || live ? <span className="badge__dot" /> : null}
      {children}
    </span>
  )
}

export function DataRow({
  icon,
  tone = 'neutral',
  label,
  sub,
  end,
  appear = false
}: {
  icon?: ReactNode
  tone?: Tone
  label: ReactNode
  sub?: ReactNode
  end?: ReactNode
  appear?: boolean
}): ReactNode {
  return (
    <div className={appear ? 'datarow datarow--appear' : 'datarow'}>
      {icon ? <Tile tone={tone}>{icon}</Tile> : null}
      <div style={{ minWidth: 0 }}>
        <div className="datarow__label">{label}</div>
        {sub ? <div className="datarow__sub">{sub}</div> : null}
      </div>
      {end ? <div className="datarow__end">{end}</div> : null}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Read out by assistive technology, since the control itself is a graphic. */
  label: string
  disabled?: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  )
}

export function Disclosure({
  summary,
  children
}: {
  summary: string
  children: ReactNode
}): ReactNode {
  return (
    <details className="disclosure">
      <summary>{summary}</summary>
      <div className="disclosure__body">{children}</div>
    </details>
  )
}

export function Notice({
  tone = 'info',
  icon,
  children
}: {
  tone?: 'info' | 'ok' | 'warn' | 'bad'
  icon?: ReactNode
  children: ReactNode
}): ReactNode {
  return (
    <div className={`notice notice--${tone}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <div>{children}</div>
    </div>
  )
}

export function Track({ value }: { value: number | null }): ReactNode {
  if (value === null) {
    return (
      <div className="track track--indeterminate" role="progressbar" aria-label="Working">
        <div className="track__fill" />
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div
      className="track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="track__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

const STEP_GLYPH: Record<StepResult['status'], string> = {
  pending: '',
  running: '',
  done: '✓',
  failed: '✕',
  'rolled-back': '↺',
  skipped: '–'
}

export function StepList({ steps }: { steps: StepResult[] }): ReactNode {
  return (
    <div className="steps">
      {steps.map((step) => (
        <div className="step" key={step.id} data-status={step.status}>
          <span className="step__mark" style={{ position: 'relative' }} aria-hidden="true">
            {STEP_GLYPH[step.status]}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="step__label">{step.label}</div>
            {step.message ? <div className="datarow__sub">{step.message}</div> : null}
            {step.detail ? (
              <Disclosure summary="Technical detail">
                <pre className="code selectable">{step.detail}</pre>
              </Disclosure>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="eyebrow">
      <span className="mono">{children}</span>
    </div>
  )
}
