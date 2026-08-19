import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppInfo,
  BackupRecord,
  Category,
  ComponentMeta,
  DetectionResult,
  InstallPlan,
  OperationResult
} from '@shared/types'
import { Button, Card, Notice } from './components/ui'
import { Welcome } from './screens/Welcome'
import { SystemScan } from './screens/SystemScan'
import { ClaudeCodeStep } from './screens/ClaudeCodeStep'
import { Customize } from './screens/Customize'
import { Review } from './screens/Review'
import { Result } from './screens/Result'
import { Manager } from './screens/Manager'

type Screen =
  | 'loading'
  | 'welcome'
  | 'learn'
  | 'scan'
  | 'claude-code'
  | 'choose'
  | 'customize'
  | 'review'
  | 'result'
  | 'manager'

export function App(): ReactNode {
  const [screen, setScreen] = useState<Screen>('loading')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [components, setComponents] = useState<ComponentMeta[]>([])
  const [recommended, setRecommended] = useState<string[]>([])
  const [scan, setScan] = useState<DetectionResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [plan, setPlan] = useState<InstallPlan | null>(null)
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [result, setResult] = useState<OperationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The scan asks the Claude Code binary for its version, which can take a couple of
  // seconds. It therefore runs on its own rather than blocking the first paint.
  const refreshState = useCallback(async (): Promise<DetectionResult> => {
    setScanning(true)
    try {
      const [nextScan, nextInstalled, nextBackups] = await Promise.all([
        window.bcs.scanSystem(),
        window.bcs.installedComponents(),
        window.bcs.listBackups()
      ])
      setScan(nextScan)
      setInstalledIds(nextInstalled)
      setBackups(nextBackups)
      return nextScan
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function boot(): Promise<void> {
      try {
        const [appInfo, catalog, installed] = await Promise.all([
          window.bcs.getAppInfo(),
          window.bcs.getCatalog(),
          window.bcs.installedComponents()
        ])
        if (!active) return
        setInfo(appInfo)
        setCategories(catalog.categories)
        setComponents(catalog.components)
        setRecommended(catalog.recommended)
        setInstalledIds(installed)
        setSelected(catalog.recommended)
        setScreen(installed.length > 0 ? 'manager' : 'welcome')

        // The full scan continues in the background so the first screen appears at once.
        await refreshState()
      } catch (bootError) {
        if (!active) return
        setError(bootError instanceof Error ? bootError.message : 'Could not start.')
        setScreen('welcome')
      }
    }
    void boot()
    return () => {
      active = false
    }
  }, [refreshState])

  // Moving to a new screen should start at the top of it, not wherever the previous
  // screen happened to be scrolled to.
  useEffect(() => {
    document.querySelector('.app__body')?.scrollTo({ top: 0 })
  }, [screen])

  const toggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }, [])

  const goToReview = useCallback(async () => {
    setPlan(null)
    setScreen('review')
    const nextPlan = await window.bcs.buildPlan(selected)
    setPlan(nextPlan)
  }, [selected])

  const confirmInstall = useCallback(async () => {
    setBusy(true)
    try {
      const outcome = await window.bcs.install(selected)
      setResult(outcome)
      await refreshState()
      setScreen('result')
    } catch (installError) {
      setError(installError instanceof Error ? installError.message : 'Setup failed.')
    } finally {
      setBusy(false)
    }
  }, [selected, refreshState])

  const removeComponents = useCallback(
    async (ids: string[]) => {
      setBusy(true)
      try {
        const outcome = await window.bcs.remove(ids)
        setResult(outcome)
        await refreshState()
        setScreen('manager')
      } finally {
        setBusy(false)
      }
    },
    [refreshState]
  )

  const restore = useCallback(
    async (backupId: string) => {
      setBusy(true)
      try {
        const outcome = await window.bcs.restore(backupId)
        setResult(outcome)
        await refreshState()
        setScreen('manager')
      } finally {
        setBusy(false)
      }
    },
    [refreshState]
  )

  function afterScan(): void {
    if (scan && scan.claudeCode.state !== 'installed') {
      setScreen('claude-code')
    } else {
      setScreen('choose')
    }
  }

  return (
    <div className="app">
      <div className="app__body">
        {error ? (
          <div className="container">
            <Notice tone="bad">{error}</Notice>
          </div>
        ) : null}

        {screen === 'loading' ? (
          <div className="container">
            <h1>Better Claude Setup</h1>
            <p className="lede">
              <span className="spinner" aria-hidden="true" /> Starting up…
            </p>
          </div>
        ) : null}

        {screen === 'welcome' ? (
          <Welcome
            info={info}
            onStart={() => {
              setScreen('scan')
              void refreshState()
            }}
            onLearn={() => setScreen('learn')}
          />
        ) : null}

        {screen === 'learn' ? (
          <LearnMore components={components} onBack={() => setScreen('welcome')} />
        ) : null}

        {screen === 'scan' ? (
          <SystemScan
            scan={scan}
            scanning={scanning}
            onRescan={() => void refreshState()}
            onContinue={afterScan}
            onBack={() => setScreen('welcome')}
          />
        ) : null}

        {screen === 'claude-code' && scan ? (
          <ClaudeCodeStep
            scan={scan}
            onContinue={() => setScreen('choose')}
            onBack={() => setScreen('scan')}
            onRescan={async () => {
              await refreshState()
            }}
          />
        ) : null}

        {screen === 'choose' ? (
          <ChooseSetup
            recommendedCount={recommended.length}
            onRecommended={() => {
              setSelected(recommended)
              void goToReview()
            }}
            onCustomize={() => setScreen('customize')}
            onCancel={() => setScreen(installedIds.length > 0 ? 'manager' : 'welcome')}
          />
        ) : null}

        {screen === 'customize' ? (
          <Customize
            categories={categories}
            components={components}
            selected={selected}
            installed={installedIds}
            claudeCodeInstalled={scan?.claudeCode.state === 'installed'}
            onToggle={toggle}
            onContinue={() => void goToReview()}
            onBack={() => setScreen('choose')}
          />
        ) : null}

        {screen === 'review' ? (
          <Review
            plan={plan}
            components={components}
            selected={selected}
            busy={busy}
            onConfirm={() => void confirmInstall()}
            onBack={() => setScreen('customize')}
          />
        ) : null}

        {screen === 'result' && result ? (
          <Result
            result={result}
            components={components}
            installedIds={installedIds}
            onDone={() => {
              setResult(null)
              setScreen('manager')
            }}
            onRetry={() => setScreen('review')}
          />
        ) : null}

        {screen === 'manager' && !scan ? (
          <div className="container">
            <h1>Your Claude setup</h1>
            <p className="lede">
              <span className="spinner" aria-hidden="true" /> Checking what is installed…
            </p>
          </div>
        ) : null}

        {screen === 'manager' && scan ? (
          <Manager
            scan={scan}
            components={components}
            installedIds={installedIds}
            backups={backups}
            busy={busy}
            lastResult={result}
            onManage={() => {
              setResult(null)
              setSelected(installedIds.length > 0 ? installedIds : recommended)
              setScreen('customize')
            }}
            onRescan={() => void refreshState()}
            onRemove={(ids) => void removeComponents(ids)}
            onRestore={(id) => void restore(id)}
          />
        ) : null}
      </div>

      <footer className="app__footer">
        <span className="footer-note">
          {info?.disclaimer ??
            'Better Claude Setup is an independent community project. It is not affiliated with, endorsed by, or supported by Anthropic.'}
        </span>
        <span className="brand">
          {info?.author} · v{info?.version ?? '—'}
        </span>
      </footer>
    </div>
  )
}

function ChooseSetup({
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
    <div className="container">
      <h1>How would you like to set Claude up?</h1>
      <p className="lede">You will see every change before anything happens.</p>

      <Card>
        <h2>Recommended setup</h2>
        <p className="muted">
          The {recommendedCount} improvements that help almost everyone: better working habits,
          writing and editing, research and fact checking, coding, and planning. This is the right
          choice if you are not sure.
        </p>
        <Button variant="primary" onClick={onRecommended}>
          Install recommended setup
        </Button>
      </Card>

      <Card>
        <h2>Customise</h2>
        <p className="muted">
          Turn each part on or off yourself, and see exactly what each one writes.
        </p>
        <Button onClick={onCustomize}>Customise</Button>
      </Card>

      <div className="actions" style={{ marginTop: 12 }}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function LearnMore({
  components,
  onBack
}: {
  components: ComponentMeta[]
  onBack: () => void
}): ReactNode {
  return (
    <div className="container">
      <h1>What this changes</h1>
      <p className="lede">
        Claude reads a small instructions file at the start of every conversation, and can load
        extra &ldquo;skills&rdquo; when a task needs them. Better Claude Setup writes good versions
        of both for you.
      </p>

      <Card>
        <h2>Why it is kept small</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Claude has a limited working memory, and everything loaded at the start of a conversation
          uses some of it up. So only one short block of instructions is always loaded. Everything
          else is a skill, which Claude reads only when the task actually calls for it — costing you
          nothing the rest of the time.
        </p>
      </Card>

      <Card>
        <h2>What can be installed</h2>
        {components.map((component) => (
          <div className="row" key={component.id}>
            <span className="row__label">
              <strong style={{ color: 'var(--text)' }}>{component.name}</strong>
              <br />
              <span className="small">{component.summary}</span>
            </span>
          </div>
        ))}
      </Card>

      <div className="actions" style={{ marginTop: 16 }}>
        <Button variant="primary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}
