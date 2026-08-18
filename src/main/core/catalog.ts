import type { Category, ComponentMeta } from '@shared/types'
import { SKILLS } from './content'

/**
 * The curated component manifest.
 *
 * Every component declares, up front, what it writes, whether it touches the network,
 * whether it runs a command, and what it costs in context. The permission screen and the
 * "What will change?" view are rendered directly from this data, so the app can never
 * claim to do less than it actually does.
 *
 * VERIFICATION POLICY: `verifiedOn` is the date a maintainer last confirmed the upstream
 * source against first-party documentation. Components sourced from this project are
 * verified by reading the code in this repository.
 */

const VERIFIED = '2026-08-18'
const APP_SOURCE = 'better-claude-setup (this repository)'
const PUBLISHER = 'KC8 — OhTheGreatGitsby'

export const CATEGORIES: Category[] = [
  {
    id: 'core',
    title: 'Core improvements',
    blurb: 'A short set of working rules Claude reads at the start of every conversation.'
  },
  {
    id: 'writing',
    title: 'Writing and editing',
    blurb: 'Better essays, articles and edits that keep your voice.'
  },
  {
    id: 'research',
    title: 'Research and fact checking',
    blurb: 'Answers with sources, confidence levels, and honest gaps.'
  },
  {
    id: 'coding',
    title: 'Coding',
    blurb: 'Careful, minimal, verified changes and plain-language explanations.'
  },
  {
    id: 'planning',
    title: 'Planning and decisions',
    blurb: 'Realistic plans and decisions that end in a recommendation.'
  },
  {
    id: 'design',
    title: 'Design and ideas',
    blurb: 'Specific design critique and genuinely varied brainstorming.'
  },
  {
    id: 'integrations',
    title: 'Extras',
    blurb: 'Optional add-ons from Anthropic’s own plugin catalogue. Off by default.'
  }
]

/** Components whose kind is `skill` install these skill directories. */
export const SKILL_GROUPS: Record<string, string[]> = {
  'writing-toolkit': ['bcs-essay', 'bcs-rewrite'],
  'research-toolkit': ['bcs-deep-research', 'bcs-fact-check'],
  'coding-toolkit': ['bcs-explain-code', 'bcs-safe-change'],
  'planning-toolkit': ['bcs-plan', 'bcs-decide'],
  'design-toolkit': ['bcs-design-critique', 'bcs-brainstorm']
}

/** Components whose kind is `setting` merge exactly these keys into settings.json. */
export const SETTING_VALUES: Record<string, Record<string, unknown>> = {
  'deeper-thinking': { alwaysThinkingEnabled: true }
}

/** Components whose kind is `plugin` install exactly this marketplace reference. */
export const PLUGIN_REFS: Record<string, string> = {
  'plugin-security-guidance': 'security-guidance@claude-plugins-official',
  'plugin-commit-commands': 'commit-commands@claude-plugins-official'
}

/** The single CLAUDE.md block id this app owns. */
export const CORE_BLOCK_ID = 'core-behaviour'

function skillWrites(componentId: string): string[] {
  return (SKILL_GROUPS[componentId] ?? []).map((id) => `<claude-home>/skills/${id}/SKILL.md`)
}

function skillNames(componentId: string): string {
  return (SKILL_GROUPS[componentId] ?? []).map((id) => `/${SKILLS[id]?.dir ?? id}`).join(', ')
}

export const COMPONENTS: ComponentMeta[] = [
  {
    id: 'core-behaviour',
    name: 'Core improvements',
    category: 'core',
    kind: 'preset',
    summary:
      'Teaches Claude a short set of working habits: be accurate rather than agreeable, admit uncertainty, never claim something works without checking, and keep answers as short as the question deserves.',
    why: 'This is the change most people notice immediately. Without it, Claude tends to agree with whatever you say and to describe untested work as finished.',
    technical:
      'Adds a single fenced block, marked BEGIN/END better-claude-setup:core-behaviour, to the end of <claude-home>/CLAUDE.md. Roughly 40 lines. Claude Code loads user CLAUDE.md at the start of every session; official guidance is to keep such files under 200 lines. Removing the component deletes only the marked block; anything you wrote in the same file is untouched.',
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: true,
    permissions: ['write-claude-md'],
    network: false,
    executesCommands: false,
    writes: ['<claude-home>/CLAUDE.md (one marked block appended)'],
    contextCost: 'always-on-small',
    securityNotes:
      'Plain text only. No commands, no network access, no tool permissions granted. Does not attempt to change Claude’s safety behaviour.'
  },
  {
    id: 'writing-toolkit',
    name: 'Writing and editing',
    category: 'writing',
    kind: 'skill',
    summary:
      'Gives Claude a proper method for long-form writing and for editing text you already wrote — including keeping your voice instead of flattening it into generic business prose.',
    why: 'Claude writes noticeably better when it settles the claim, reader and evidence before drafting, and when it knows whether you asked for a proofread or a rewrite.',
    technical: `Installs skills ${skillNames('writing-toolkit')} as SKILL.md files under <claude-home>/skills/. Only each skill's name and description sit in the context window; the body loads only when Claude judges the skill relevant or you type the command.`,
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: true,
    permissions: ['write-skill-files'],
    network: false,
    executesCommands: false,
    writes: skillWrites('writing-toolkit'),
    contextCost: 'on-demand',
    securityNotes:
      'Markdown instructions only. No allowed-tools grants, no scripts, no network access.'
  },
  {
    id: 'research-toolkit',
    name: 'Research and fact checking',
    category: 'research',
    kind: 'skill',
    summary:
      'Makes Claude research properly: check more than one source, label how confident it is in each claim, and say plainly what it could not find out.',
    why: 'The common failure when asking an assistant to research something is a confident, tidy answer that nobody can check. This makes the sources and the uncertainty visible.',
    technical: `Installs skills ${skillNames('research-toolkit')} as SKILL.md files under <claude-home>/skills/. The skills themselves make no network requests; they instruct Claude how to use whatever search or browsing tools it already has.`,
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: true,
    permissions: ['write-skill-files'],
    network: false,
    executesCommands: false,
    writes: skillWrites('research-toolkit'),
    contextCost: 'on-demand',
    securityNotes:
      'Markdown instructions only. Grants no tool permissions; Claude still asks before using tools exactly as it did before.'
  },
  {
    id: 'coding-toolkit',
    name: 'Coding',
    category: 'coding',
    kind: 'skill',
    summary:
      'Two habits that make Claude much safer around code you care about: explain before changing, and make the smallest change that works — then actually run the check.',
    why: 'Most bad outcomes with an AI coding assistant come from large unrequested rewrites and from work reported as done but never run.',
    technical: `Installs skills ${skillNames('coding-toolkit')} under <claude-home>/skills/. These deliberately do not duplicate Claude Code's bundled /code-review, /debug or /verify commands; they cover explanation and minimal-diff discipline instead.`,
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: true,
    permissions: ['write-skill-files'],
    network: false,
    executesCommands: false,
    writes: skillWrites('coding-toolkit'),
    contextCost: 'on-demand',
    securityNotes:
      'Markdown instructions only. Nothing here loosens Claude Code’s permission prompts.'
  },
  {
    id: 'planning-toolkit',
    name: 'Planning and decisions',
    category: 'planning',
    kind: 'skill',
    summary:
      'Turns vague goals into ordered plans with real dependencies and risks, and turns "which should I pick?" into a recommendation with the reason and what would change it.',
    why: 'Assistants tend to produce plans that look thorough and decisions that list every option without choosing. Both are easy to fix with method.',
    technical: `Installs skills ${skillNames('planning-toolkit')} under <claude-home>/skills/.`,
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: true,
    permissions: ['write-skill-files'],
    network: false,
    executesCommands: false,
    writes: skillWrites('planning-toolkit'),
    contextCost: 'on-demand',
    securityNotes: 'Markdown instructions only.'
  },
  {
    id: 'design-toolkit',
    name: 'Design and ideas',
    category: 'design',
    kind: 'skill',
    summary:
      'Design feedback that names specific fixes instead of generic advice, and brainstorming that produces genuinely different ideas rather than ten versions of one.',
    why: 'Useful if you work on interfaces or need idea generation. Left off by default so people who never do design work do not carry it.',
    technical: `Installs skills ${skillNames('design-toolkit')} under <claude-home>/skills/.`,
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: false,
    permissions: ['write-skill-files'],
    network: false,
    executesCommands: false,
    writes: skillWrites('design-toolkit'),
    contextCost: 'on-demand',
    securityNotes: 'Markdown instructions only.'
  },
  {
    id: 'deeper-thinking',
    name: 'Always think before answering',
    category: 'core',
    kind: 'setting',
    summary:
      'Makes Claude Code reason through problems before replying, every time. Answers get better on hard questions and slower and more expensive on easy ones.',
    why: 'Genuinely helps on analysis, debugging and planning. Left off by default because it costs tokens on every message, including trivial ones.',
    technical:
      'Sets "alwaysThinkingEnabled": true in <claude-home>/settings.json. If the key already exists with a different value, Better Claude Setup leaves your value alone and reports the conflict rather than overwriting it. Removal deletes the key only if its value is still the one we wrote.',
    source: APP_SOURCE,
    publisher: PUBLISHER,
    version: '1.0.0',
    license: 'MIT',
    verifiedOn: VERIFIED,
    recommended: false,
    permissions: ['write-settings'],
    network: false,
    executesCommands: false,
    writes: ['<claude-home>/settings.json (one key: alwaysThinkingEnabled)'],
    contextCost: 'none',
    securityNotes:
      'Adds exactly one boolean key. All other settings are preserved byte-for-byte apart from reformatting.'
  },
  {
    id: 'plugin-security-guidance',
    name: 'Automatic security review of code changes',
    category: 'integrations',
    kind: 'plugin',
    summary:
      'Anthropic’s own add-on that checks the code Claude writes for common security mistakes and fixes what it finds.',
    why: 'Worth having if you use Claude to write code that will run somewhere real. It is published by Anthropic on their curated catalogue, so it is not third-party code from an unknown author.',
    technical:
      'Runs `claude plugin install security-guidance@claude-plugins-official`. Claude Code downloads the plugin from Anthropic’s official marketplace and records it in your own Claude Code plugin state, not in Better Claude Setup’s files. Removal runs `claude plugin uninstall`.',
    source: 'Anthropic official plugin marketplace (claude-plugins-official)',
    publisher: 'Anthropic',
    version: 'marketplace-managed',
    license: 'See plugin homepage',
    verifiedOn: VERIFIED,
    homepage: 'https://code.claude.com/docs/en/security-guidance',
    recommended: false,
    permissions: ['run-claude-cli', 'network'],
    network: true,
    executesCommands: true,
    writes: ['Claude Code plugin state (managed by Claude Code, not by this app)'],
    contextCost: 'on-demand',
    securityNotes:
      'This is the only kind of component that downloads anything. It runs the official Claude Code CLI with fixed arguments; nothing you type is passed to a shell. Version is whatever the official marketplace currently serves, because Claude Code owns that resolution — Better Claude Setup cannot pin it.'
  },
  {
    id: 'plugin-commit-commands',
    name: 'Git commit helpers',
    category: 'integrations',
    kind: 'plugin',
    summary:
      'Anthropic’s own add-on with ready-made commands for committing work and opening pull requests.',
    why: 'Convenient if you already use Git. Skip it if you do not know what Git is — it will not help you.',
    technical:
      'Runs `claude plugin install commit-commands@claude-plugins-official`. Removal runs `claude plugin uninstall`.',
    source: 'Anthropic official plugin marketplace (claude-plugins-official)',
    publisher: 'Anthropic',
    version: 'marketplace-managed',
    license: 'See plugin homepage',
    verifiedOn: VERIFIED,
    homepage: 'https://code.claude.com/docs/en/discover-plugins',
    recommended: false,
    permissions: ['run-claude-cli', 'network'],
    network: true,
    executesCommands: true,
    writes: ['Claude Code plugin state (managed by Claude Code, not by this app)'],
    contextCost: 'on-demand',
    securityNotes:
      'Downloads from Anthropic’s official marketplace via the Claude Code CLI. Version resolution is owned by Claude Code and cannot be pinned by this app.'
  }
]

export function componentById(id: string): ComponentMeta | undefined {
  return COMPONENTS.find((c) => c.id === id)
}

export function recommendedComponentIds(): string[] {
  return COMPONENTS.filter((c) => c.recommended).map((c) => c.id)
}
