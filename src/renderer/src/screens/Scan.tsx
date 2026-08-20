import type { ReactNode } from 'react'
import type { DetectedProduct, DetectionResult } from '@shared/types'
import { Mascot } from '../components/Mascot'
import {
  Badge,
  Button,
  DataRow,
  Disclosure,
  Notice,
  Panel,
  PanelFooter,
  PanelHeader,
  Track
} from '../components/kit'

/** The scan stages, in the order the engine reports them. */
const STAGES = [
  { id: 'system', icon: '▤', label: 'Your computer' },
  { id: 'claude-code', icon: '›_', label: 'Claude Code' },
  { id: 'claude-desktop', icon: '◱', label: 'Claude desktop app' },
  { id: 'configuration', icon: '⚙', label: 'Existing Claude settings' },
  { id: 'better-claude-setup', icon: '◈', label: 'Better Claude Setup' },
  { id: 'chat-skills', icon: '◇', label: 'Claude Chat & Web' }
] as const

const PLATFORM_NAMES: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux'
}

function productBadge(product: DetectedProduct): ReactNode {
  if (product.state === 'installed') {
    return (
      <Badge tone="ok" dot>
        {product.version ? `Installed · ${product.version}` : 'Installed'}
      </Badge>
    )
  }
  if (product.state === 'uncertain') {
    return (
      <Badge tone="warn" dot>
        Not certain
      </Badge>
    )
  }
  return <Badge dot>Not found</Badge>
}

function productSub(product: DetectedProduct, missingHint: string): string {
  if (product.state === 'installed') return product.location ?? 'Found on this computer'
  if (product.state === 'uncertain') {
    return 'Settings from it are here, but the app itself could not be found. It may have been removed.'
  }
  return missingHint
}

export function Scan({
  scan,
  stagesDone,
  onContinue,
  onRescan,
  onBack
}: {
  scan: DetectionResult | null
  /** Stage ids the engine has actually finished. Never advanced on a timer. */
  stagesDone: string[]
  onContinue: () => void
  onRescan: () => void
  onBack: () => void
}): ReactNode {
  const running = !scan || !stagesDone.includes('done')
  const completed = STAGES.filter((stage) => stagesDone.includes(stage.id)).length
  const currentIndex = Math.min(completed, STAGES.length - 1)

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>
            {running ? 'Checking your Claude setup' : 'Here is what you already have'}
          </h1>
          <p className="lead">
            {running
              ? 'Reading what is installed on this computer. Nothing is being changed.'
              : 'Nothing has been changed. This is only what was found.'}
          </p>
          {running ? (
            <div style={{ maxWidth: 320, marginTop: 'var(--s-5)' }}>
              <Track value={completed / STAGES.length} />
              <p className="mono" style={{ marginTop: 'var(--s-2)' }}>
                {STAGES[currentIndex]?.label ?? 'Finishing'}
              </p>
            </div>
          ) : null}
        </div>
        <div className="hero__art">
          <Mascot state={running ? 'scanning' : 'thinking'} size="lg" />
        </div>
      </div>

      <Panel raised>
        <PanelHeader
          icon="◎"
          tone={running ? 'accent' : 'ok'}
          title="System check"
          end={
            running ? (
              <Badge tone="accent" live>
                Scanning
              </Badge>
            ) : (
              <Badge tone="ok" dot>
                Complete
              </Badge>
            )
          }
        />

        <DataRow
          icon={STAGES[0].icon}
          label="Your computer"
          sub={
            scan ? `${PLATFORM_NAMES[scan.platform] ?? scan.platform} · ${scan.arch}` : 'Checking…'
          }
          end={
            stagesDone.includes('system') ? (
              <Badge tone="ok" dot>
                Ready
              </Badge>
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('system')}
        />

        <DataRow
          icon={STAGES[1].icon}
          tone="accent"
          label="Claude Code"
          sub={
            scan && stagesDone.includes('claude-code')
              ? productSub(
                  scan.claudeCode,
                  'Not installed. This is the part Better Claude Setup configures, and it can install it for you.'
                )
              : 'Checking…'
          }
          end={
            scan && stagesDone.includes('claude-code') ? (
              productBadge(scan.claudeCode)
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('claude-code')}
        />

        <DataRow
          icon={STAGES[2].icon}
          label="Claude desktop app"
          sub={
            scan && stagesDone.includes('claude-desktop')
              ? productSub(scan.claudeDesktop, 'Not installed on this computer.')
              : 'Checking…'
          }
          end={
            scan && stagesDone.includes('claude-desktop') ? (
              productBadge(scan.claudeDesktop)
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('claude-desktop')}
        />

        <DataRow
          icon={STAGES[3].icon}
          label="Existing Claude settings"
          sub={
            scan && stagesDone.includes('configuration')
              ? scan.existingConfig.found
                ? `${scan.existingConfig.claudeMdExists ? `Your instructions file has ${scan.existingConfig.claudeMdLines} lines. ` : 'No instructions file yet. '}${scan.existingConfig.otherSkills.length} of your own skills.`
                : 'No Claude settings folder yet — one will be created.'
              : 'Checking…'
          }
          end={
            scan && stagesDone.includes('configuration') ? (
              scan.existingConfig.found ? (
                <Badge tone="accent" dot>
                  Found
                </Badge>
              ) : (
                <Badge dot>None yet</Badge>
              )
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('configuration')}
        />

        <DataRow
          icon={STAGES[4].icon}
          label="Better Claude Setup"
          sub={
            scan && stagesDone.includes('better-claude-setup')
              ? scan.betterClaudeSetup.state === 'configured'
                ? `${scan.betterClaudeSetup.installedComponentIds.length} improvements already active.`
                : scan.betterClaudeSetup.state === 'partial'
                  ? 'Some pieces are missing from a previous setup. Repair will put them back.'
                  : 'Not set up yet.'
              : 'Checking…'
          }
          end={
            scan && stagesDone.includes('better-claude-setup') ? (
              scan.betterClaudeSetup.state === 'configured' ? (
                <Badge tone="ok" dot>
                  Active
                </Badge>
              ) : scan.betterClaudeSetup.state === 'partial' ? (
                <Badge tone="warn" dot>
                  Partly set up
                </Badge>
              ) : (
                <Badge dot>Not set up</Badge>
              )
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('better-claude-setup')}
        />

        <DataRow
          icon={STAGES[5].icon}
          label="Claude Chat &amp; Web"
          sub={
            scan && stagesDone.includes('chat-skills')
              ? scan.chatSkills.state === 'confirmed'
                ? 'You have set these up in your Claude account.'
                : scan.chatSkills.state === 'update-available'
                  ? 'Set up, but the skills have changed since you uploaded them.'
                  : 'Not set up yet. The same skills can work in ordinary Claude chats.'
              : 'Checking…'
          }
          end={
            scan && stagesDone.includes('chat-skills') ? (
              scan.chatSkills.state === 'confirmed' ? (
                <Badge tone="ok" dot>
                  Ready
                </Badge>
              ) : scan.chatSkills.state === 'update-available' ? (
                <Badge tone="warn" dot>
                  Update available
                </Badge>
              ) : (
                <Badge dot>Setup needed</Badge>
              )
            ) : (
              <Badge>…</Badge>
            )
          }
          appear={stagesDone.includes('chat-skills')}
        />

        {scan && !running ? (
          <PanelFooter>
            <Disclosure summary="Detection details">
              <div className="stack-3">
                <DetectionDetail title="Claude desktop app" product={scan.claudeDesktop} />
                <DetectionDetail title="Claude Code" product={scan.claudeCode} />
                <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>
                  Locations are described rather than printed in full, so this panel stays safe to
                  screenshot.
                </p>
              </div>
            </Disclosure>
          </PanelFooter>
        ) : null}
      </Panel>

      {scan && !scan.existingConfig.settingsJsonValid && scan.existingConfig.settingsJsonExists ? (
        <div style={{ marginTop: 'var(--s-4)' }}>
          <Notice tone="bad" icon="!">
            Your Claude Code settings file cannot be read as valid JSON. Better Claude Setup will
            not touch it, because it cannot safely edit a file it does not understand. Everything
            else can still be installed.
          </Notice>
        </div>
      ) : null}

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant="primary" size="lg" bracket onClick={onContinue} disabled={running}>
          Continue
        </Button>
        <Button onClick={onRescan} disabled={running}>
          Scan again
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  )
}

function DetectionDetail({
  title,
  product
}: {
  title: string
  product: DetectedProduct
}): ReactNode {
  return (
    <div>
      <p className="mono" style={{ marginBottom: 'var(--s-1)' }}>
        {title}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {product.probes.map((probe) => (
            <tr key={probe.method}>
              <td
                className="small"
                style={{
                  padding: '3px 0',
                  width: 22,
                  color: probe.found ? 'var(--ok)' : 'var(--ink-3)'
                }}
              >
                {probe.found ? '✓' : '·'}
              </td>
              <td className="small" style={{ padding: '3px 0', width: '40%' }}>
                {probe.method}
              </td>
              <td className="small muted" style={{ padding: '3px 0' }}>
                {probe.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
