import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppInfo,
  BackupRecord,
  Category,
  ComponentMeta,
  DetectionResult,
  InstallPlan,
  ChatSkillsState,
  OperationResult,
  StepResult
} from '@shared/types'
import { Mascot } from './components/Mascot'
import logoMark from './assets/logo-mark.png'
import { Notice, Track } from './components/kit'
import { Welcome } from './screens/Welcome'
import { Explain } from './screens/Explain'
import { Scan } from './screens/Scan'
import { InstallClaudeCode } from './screens/InstallClaudeCode'
import { Choose } from './screens/Choose'
import { Customize } from './screens/Customize'
import { Review } from './screens/Review'
import { Installing } from './screens/Installing'
import { Result } from './screens/Result'
import { Manager } from './screens/Manager'
import { ChatSetup } from './screens/ChatSetup'

type Screen =
  | 'loading'
  | 'welcome'
  | 'explain'
  | 'scan'
  | 'claude-code'
  | 'choose'
  | 'customize'
  | 'review'
  | 'installing'
  | 'result'
  | 'manager'
  | 'chat-setup'

export function App(): ReactNode {
  const [screen, setScreen] = useState<Screen>('loading')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [components, setComponents] = useState<ComponentMeta[]>([])
  const [recommended, setRecommended] = useState<string[]>([])
  const [scan, setScan] = useState<DetectionResult | null>(null)
  const [scanStages, setScanStages] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [plan, setPlan] = useState<InstallPlan | null>(null)
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [result, setResult] = useState<OperationResult | null>(null)
  const [liveSteps, setLiveSteps] = useState<StepResult[]>([])
  const [liveProgress, setLiveProgress] = useState({ done: 0, total: 0 })
  const [chatSkills, setChatSkills] = useState<ChatSkillsState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [fullscreen, setFullscreen] = useState(false)

  // The main process owns the truth about window chrome, because only it can see
  // fullscreen transitions and the platform's control layout.
  useEffect(() => {
    return window.bcs.onWindowState((state) => setFullscreen(state.fullscreen))
  }, [])

  /** Scan stages arrive from the engine as each one genuinely finishes. */
  useEffect(() => {
    return window.bcs.onScanStep((step) => {
      setScanStages((current) => (current.includes(step) ? current : [...current, step]))
    })
  }, [])

  useEffect(() => {
    return window.bcs.onInstallStep(({ step, done, total }) => {
      setLiveSteps((current) => [...current, step])
      setLiveProgress({ done, total })
    })
  }, [])

  const refreshState = useCallback(async (): Promise<DetectionResult> => {
    setScanStages([])
    const [nextScan, nextInstalled, nextBackups] = await Promise.all([
      window.bcs.scanSystem(),
      window.bcs.installedComponents(),
      window.bcs.listBackups()
    ])
    setScan(nextScan)
    setInstalledIds(nextInstalled)
    setBackups(nextBackups)
    setChatSkills(nextScan.chatSkills)
    return nextScan
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
        setSelected(installed.length > 0 ? installed : catalog.recommended)
        setScreen(installed.length > 0 ? 'manager' : 'welcome')
        // The scan continues behind the first screen so nothing waits on it.
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

  // A new screen starts at its own top, not wherever the previous one was scrolled to.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [screen])

  const toggle = useCallback((id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    )
  }, [])

  const goToReview = useCallback(async () => {
    setPlan(null)
    setScreen('review')
    setPlan(await window.bcs.buildPlan(selected))
  }, [selected])

  const runInstall = useCallback(
    async (ids: string[]) => {
      setBusy(true)
      setLiveSteps([])
      setLiveProgress({ done: 0, total: 0 })
      setScreen('installing')
      try {
        const outcome = await window.bcs.install(ids)
        setResult(outcome)
        await refreshState()
        setScreen('result')
      } catch (installError) {
        setError(installError instanceof Error ? installError.message : 'Setup failed.')
        setScreen('review')
      } finally {
        setBusy(false)
      }
    },
    [refreshState]
  )

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
        const next = await refreshState()
        setSelected(next.betterClaudeSetup.installedComponentIds)
        setScreen('manager')
      } finally {
        setBusy(false)
      }
    },
    [refreshState]
  )

  /** Enabling from the manager installs just that component; disabling removes just it. */
  const toggleInstalled = useCallback(
    async (id: string, next: boolean) => {
      if (next) {
        setBusy(true)
        try {
          const outcome = await window.bcs.install([id])
          setResult(outcome)
          await refreshState()
        } finally {
          setBusy(false)
        }
      } else {
        await removeComponents([id])
      }
    },
    [refreshState, removeComponents]
  )

  const afterScan = useCallback(() => {
    setScreen(scan && scan.claudeCode.state !== 'installed' ? 'claude-code' : 'choose')
  }, [scan])

  const platform = scan?.platform ?? 'win32'

  /*
   * The status label names which Claude it is talking about. "Active" was ambiguous: the
   * local setup being installed says nothing about the account surface.
   */
  const statusLabel = ((): string => {
    if (!scan) return ''
    if (scan.betterClaudeSetup.state === 'partial') return 'NEEDS REPAIR'
    const codeReady = scan.betterClaudeSetup.state === 'configured'
    const chatReady = chatSkills?.state === 'confirmed'
    if (chatSkills?.state === 'update-available') return 'CHAT UPDATE AVAILABLE'
    if (codeReady && chatReady) return 'ALL READY'
    if (codeReady) return 'CODE READY · CHAT SETUP NEEDED'
    if (chatReady) return 'CHAT READY · CODE NOT SET UP'
    return 'NOT SET UP'
  })()

  return (
    <div className="app" data-platform={platform} data-fullscreen={String(fullscreen)}>
      <header className="titlebar">
        <div className="titlebar__inner">
          <span
            className="titlebar__mark"
            style={{ backgroundImage: `url(${logoMark})` }}
            aria-hidden="true"
          />
          <span className="titlebar__name">Better Claude Setup</span>
          <span className="titlebar__spacer" />
          <span className="titlebar__meta">{statusLabel}</span>
        </div>
      </header>

      <main className="app__body" ref={bodyRef}>
        <div className="grid-field" aria-hidden="true" />

        {error ? (
          <div className="page page--narrow">
            <Notice tone="bad" icon="!">
              {error}
            </Notice>
          </div>
        ) : null}

        {screen === 'loading' ? (
          <div className="page page--narrow">
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                gap: 'var(--s-5)',
                paddingTop: 'var(--s-16)'
              }}
            >
              <Mascot state="idle" size="lg" />
              <p className="mono">Starting up</p>
              <div style={{ width: 200 }}>
                <Track value={null} />
              </div>
            </div>
          </div>
        ) : null}

        {screen === 'welcome' ? (
          <Welcome
            info={info}
            onStart={() => {
              setScreen('scan')
              void refreshState()
            }}
            onLearn={() => setScreen('explain')}
          />
        ) : null}

        {screen === 'explain' ? (
          <Explain components={components} onBack={() => setScreen('welcome')} />
        ) : null}

        {screen === 'scan' ? (
          <Scan
            scan={scan}
            stagesDone={scanStages}
            onContinue={afterScan}
            onRescan={() => void refreshState()}
            onBack={() => setScreen(installedIds.length > 0 ? 'manager' : 'welcome')}
          />
        ) : null}

        {screen === 'claude-code' && scan ? (
          <InstallClaudeCode
            scan={scan}
            onContinue={() => setScreen('choose')}
            onBack={() => setScreen('scan')}
            onRescan={async () => {
              await refreshState()
            }}
          />
        ) : null}

        {screen === 'choose' ? (
          <Choose
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
            onBack={() => setScreen(installedIds.length > 0 ? 'manager' : 'choose')}
          />
        ) : null}

        {screen === 'review' ? (
          <Review
            plan={plan}
            components={components}
            selected={selected}
            busy={busy}
            onConfirm={() => void runInstall(selected)}
            onBack={() => setScreen('customize')}
          />
        ) : null}

        {screen === 'installing' ? (
          <Installing
            steps={liveSteps}
            done={liveProgress.done}
            total={liveProgress.total || selected.length + 1}
          />
        ) : null}

        {screen === 'result' && result ? (
          <Result
            result={result}
            components={components}
            installedIds={installedIds}
            busy={busy}
            onDone={() => {
              setResult(null)
              setScreen('manager')
            }}
            onChatSetup={() => setScreen('chat-setup')}
            onRetry={() => setScreen('review')}
            onUndo={() => {
              const latest = backups[0]
              if (latest) void restore(latest.id)
            }}
          />
        ) : null}

        {screen === 'manager' && !scan ? (
          <div className="page page--narrow">
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                gap: 'var(--s-5)',
                paddingTop: 'var(--s-12)'
              }}
            >
              <Mascot state="scanning" size="lg" />
              <p className="mono">Checking what is installed</p>
            </div>
          </div>
        ) : null}

        {screen === 'manager' && scan ? (
          <Manager
            scan={scan}
            chatSkills={chatSkills}
            components={components}
            installedIds={installedIds}
            backups={backups}
            busy={busy}
            lastResult={result}
            onDismissResult={() => setResult(null)}
            onOpenCustomize={() => {
              setResult(null)
              setSelected(installedIds.length > 0 ? installedIds : recommended)
              setScreen('customize')
            }}
            onOpenChatSetup={() => setScreen('chat-setup')}
            onRescan={() => void refreshState()}
            onToggleComponent={(id, next) => void toggleInstalled(id, next)}
            onRepair={() => void runInstall(scan.betterClaudeSetup.missingComponentIds)}
            onRemoveAll={() => void removeComponents(installedIds)}
            onRestore={(id) => void restore(id)}
          />
        ) : null}
        {screen === 'chat-setup' ? (
          <ChatSetup
            state={chatSkills}
            busy={busy}
            onPrepare={() => {
              setBusy(true)
              void window.bcs
                .prepareChatSkills()
                .then(() => window.bcs.revealChatSkills())
                .then(() => window.bcs.chatSkillsState())
                .then(setChatSkills)
                .finally(() => setBusy(false))
            }}
            onOpenFolder={() => void window.bcs.revealChatSkills()}
            onConfirm={() => {
              setBusy(true)
              void window.bcs
                .confirmChatSkills()
                .then(setChatSkills)
                .finally(() => setBusy(false))
            }}
            onBack={() => setScreen(installedIds.length > 0 ? 'manager' : 'welcome')}
          />
        ) : null}
      </main>

      <footer className="app__footer">
        <span className="app__footer__note">
          {info?.disclaimer ??
            'Better Claude Setup is an independent community project, not affiliated with Anthropic.'}
        </span>
        <span className="mono">
          {info?.author ?? 'KC8 — OhTheGreatGitsby'} · v{info?.version ?? '—'}
        </span>
      </footer>
    </div>
  )
}
