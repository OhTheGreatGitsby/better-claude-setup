import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatSkillsState } from '@shared/types'
import { Mascot } from '../components/Mascot'
import { Icon } from '../components/Icon'
import {
  Badge,
  Button,
  DataRow,
  Disclosure,
  Notice,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader
} from '../components/kit'

const CLAUDE_SETTINGS_URL = 'https://claude.ai/settings/profile'
const SKILLS_HELP_URL = 'https://support.claude.com/en/articles/12512198-creating-custom-skills'

/**
 * Setting up the Claude account surface.
 *
 * Anthropic publishes no consumer API for adding a skill to somebody's personal Claude
 * account, so this screen does the part that can be automated — building the exact upload
 * packages — and guides the one manual step honestly. Nothing here signs in, reads a
 * session, or inspects Claude's own storage.
 */
export function ChatSetup({
  state,
  onPrepare,
  onOpenFolder,
  onConfirm,
  onBack,
  busy
}: {
  state: ChatSkillsState | null
  onPrepare: () => void
  onOpenFolder: () => void
  onConfirm: () => void
  onBack: () => void
  busy: boolean
}): ReactNode {
  const [prepared, setPrepared] = useState(false)
  const ready = state?.state === 'confirmed'
  const needsUpdate = state?.state === 'update-available'
  const hasPackages = prepared || state?.packageDirExists === true

  return (
    <div className="page">
      <div className="hero" style={{ marginBottom: 'var(--s-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--s-3)' }}>
            {ready ? 'Claude Chat is set up' : 'Use these skills in ordinary Claude chats'}
          </h1>
          <p className="lead">
            {ready
              ? 'You told us these are uploaded to your Claude account. They work in Claude chats, the desktop app and Cowork.'
              : 'The same skills you have in Claude Code, packaged for your Claude account so typing /research in a normal conversation works too.'}
          </p>
        </div>
        <div className="hero__art">
          <Mascot state={ready ? 'success' : 'thinking'} size="lg" />
        </div>
      </div>

      <div className="stack-4">
        {needsUpdate ? (
          <Notice tone="warn" icon={<Icon name="refresh" />}>
            These skills have changed since you last uploaded them. Prepare the packages again and
            re-upload the ones you use.
          </Notice>
        ) : null}

        <Notice tone="info" icon={<Icon name="info" />}>
          Claude Code and your Claude account store skills in completely different places, and
          Anthropic does not sync between them. That is why this part needs one manual step: there
          is no supported way for an app to put a skill into your account, and Better Claude Setup
          will not pretend otherwise by handling your login.
        </Notice>

        <Panel raised>
          <PanelHeader
            icon={<Icon name="chat" />}
            tone="accent"
            title="Three steps, once"
            end={
              ready ? (
                <Badge tone="ok" dot>
                  Done
                </Badge>
              ) : null
            }
          />

          <DataRow
            icon={<span className="step-number">1</span>}
            label="Turn on code execution in Claude"
            sub="Settings → Capabilities → “Code execution and file creation”. Custom skills need it. Requires a Pro, Max, Team or Enterprise plan."
            end={
              <Button size="sm" onClick={() => void window.bcs.openExternal(CLAUDE_SETTINGS_URL)}>
                Open Claude settings
              </Button>
            }
          />

          <DataRow
            icon={<span className="step-number">2</span>}
            label="Get the skill files"
            sub={
              hasPackages
                ? 'Prepared. The folder contains one .zip per skill, plus written instructions.'
                : 'Better Claude Setup writes one .zip per skill into a folder on this computer.'
            }
            end={
              hasPackages ? (
                <Button size="sm" onClick={onOpenFolder}>
                  Open the folder
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => {
                    setPrepared(true)
                    onPrepare()
                  }}
                >
                  Prepare files
                </Button>
              )
            }
          />

          <DataRow
            icon={<span className="step-number">3</span>}
            label="Upload them in Claude"
            sub="In Claude, open Settings → Skills — in the desktop app it is under “Customize”. Choose Add skill and pick each .zip."
            end={
              <Button size="sm" onClick={() => void window.bcs.openExternal(SKILLS_HELP_URL)}>
                Anthropic’s guide
              </Button>
            }
          />

          <PanelFooter>
            {ready ? (
              <div className="cluster">
                <Badge tone="ok" dot>
                  Marked as done by you
                </Badge>
                <span className="small muted">
                  {state?.confirmedAtIso
                    ? `Confirmed ${new Date(state.confirmedAtIso).toLocaleDateString()}`
                    : ''}
                </span>
              </div>
            ) : (
              <div className="cluster">
                <Button
                  variant="primary"
                  bracket
                  disabled={busy || !hasPackages}
                  onClick={onConfirm}
                >
                  I have uploaded them
                </Button>
                <span className="small muted">
                  This records your answer. Better Claude Setup cannot see inside your Claude
                  account, so it will never claim to have checked.
                </span>
              </div>
            )}
          </PanelFooter>
        </Panel>

        <Panel>
          <PanelHeader
            icon={<Icon name="sparkle" />}
            title="What you get in a normal conversation"
            end={<span className="mono">{state?.skills.length ?? 0} skills</span>}
          />
          {(state?.skills ?? []).map((skill) => (
            <DataRow
              key={skill.id}
              icon={<Icon name="arrow-right" />}
              label={`/${skill.command}`}
              sub={skill.description}
              end={<span className="mono">{skill.fileName}</span>}
            />
          ))}
          <PanelBody>
            <Disclosure summary="How typing a command works in Claude chat">
              <p className="small" style={{ marginBottom: 'var(--s-2)' }}>
                Claude chats do not have a slash-command menu the way Claude Code does. Skills there
                are triggered by what you write, matched against each skill’s description.
              </p>
              <p className="small">
                Each of these skills names its own command in its description, so typing{' '}
                <code>/research something</code> matches the research skill and Claude follows it.
                Writing “research something for me” works just as well.
              </p>
            </Disclosure>
          </PanelBody>
        </Panel>

        <Panel sunken>
          <PanelBody>
            <Disclosure summary="Where these skills reach">
              <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
                <li>Claude chats on claude.ai — yes, once uploaded</li>
                <li>Chat in the Claude desktop app — yes, same account</li>
                <li>Cowork — yes, it loads the skills enabled for your account</li>
                <li>Claude Code — already covered by the local setup, separately</li>
                <li>The Claude API — no. Account skills and API skills are separate uploads.</li>
              </ul>
            </Disclosure>
          </PanelBody>
        </Panel>
      </div>

      <div className="cluster" style={{ marginTop: 'var(--s-6)' }}>
        <Button variant={ready ? 'primary' : 'secondary'} bracket={ready} onClick={onBack}>
          {ready ? 'Done' : 'Back'}
        </Button>
      </div>
    </div>
  )
}
