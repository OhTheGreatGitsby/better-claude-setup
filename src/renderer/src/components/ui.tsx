import type { ReactNode } from 'react'
import type { StepResult } from '@shared/types'

export function Card({
  children,
  flat = false
}: {
  children: ReactNode
  flat?: boolean
}): ReactNode {
  return <section className={flat ? 'card card--flat' : 'card'}>{children}</section>
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  type = 'button'
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
  type?: 'button' | 'submit'
}): ReactNode {
  return (
    <button className={`btn btn--${variant}`} onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}): ReactNode {
  return (
    <button
      className="toggle"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span
        className={[
          'toggle__box',
          checked ? 'toggle__box--on' : '',
          disabled ? 'toggle__box--disabled' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        {checked ? '✓' : ''}
      </span>
      <span>
        <span style={{ fontWeight: 600, display: 'block' }}>{label}</span>
        {description ? <span className="muted small">{description}</span> : null}
      </span>
    </button>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__value">{children}</span>
    </div>
  )
}

export function Pill({
  tone,
  children
}: {
  tone: 'ok' | 'warn' | 'off' | 'bad' | 'accent'
  children: ReactNode
}): ReactNode {
  return <span className={`pill pill--${tone}`}>{children}</span>
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

const STEP_ICON: Record<StepResult['status'], string> = {
  pending: '·',
  running: '·',
  done: '✓',
  failed: '✕',
  'rolled-back': '↩',
  skipped: '–'
}

export function StepList({ steps }: { steps: StepResult[] }): ReactNode {
  return (
    <div>
      {steps.map((step) => (
        <div className="step" key={step.id}>
          <span className={`step__icon step__icon--${step.status}`} aria-hidden="true">
            {STEP_ICON[step.status]}
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 550 }}>{step.label}</span>
            <span className="muted small">{step.message}</span>
            {step.detail ? (
              <Disclosure summary="Show technical details">
                <pre className="log selectable">{step.detail}</pre>
              </Disclosure>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Notice({
  tone,
  children
}: {
  tone: 'warn' | 'bad' | 'ok'
  children: ReactNode
}): ReactNode {
  return <div className={`notice notice--${tone}`}>{children}</div>
}
