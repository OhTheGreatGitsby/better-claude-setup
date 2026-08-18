/**
 * Shared type definitions used by the main process, the preload bridge and the renderer.
 * Keep this file free of Node or DOM imports so both sides can consume it.
 */

export type Platform = 'win32' | 'darwin' | 'linux'

export type CategoryId =
  | 'core'
  | 'writing'
  | 'research'
  | 'coding'
  | 'planning'
  | 'design'
  | 'integrations'

export interface Category {
  id: CategoryId
  title: string
  blurb: string
}

export type ComponentKind = 'preset' | 'skill' | 'setting' | 'plugin'

/** What a component is allowed to touch. Shown verbatim on the permission screen. */
export type PermissionId =
  | 'write-claude-md'
  | 'write-skill-files'
  | 'write-settings'
  | 'run-claude-cli'
  | 'network'

export type ContextCost = 'none' | 'always-on-small' | 'on-demand'

export interface ComponentMeta {
  id: string
  name: string
  category: CategoryId
  kind: ComponentKind
  /** Plain-language description aimed at somebody who has never opened a terminal. */
  summary: string
  /** Why this makes Claude better. */
  why: string
  /** Expandable technical detail for experienced users. */
  technical: string
  source: string
  publisher: string
  version: string
  license: string
  /** ISO date on which the upstream source was last verified by a maintainer. */
  verifiedOn: string
  homepage?: string
  recommended: boolean
  permissions: PermissionId[]
  network: boolean
  executesCommands: boolean
  /** Human-readable list of what is written, using <claude-home> style placeholders. */
  writes: string[]
  contextCost: ContextCost
  securityNotes: string
}

/** A single reversible change the installer will make. */
export interface PlannedChange {
  componentId: string
  kind: 'claude-md-block' | 'skill-dir' | 'settings-keys' | 'plugin-install'
  /** One-line, beginner-readable statement of the change. */
  label: string
  /** Path relative to the Claude home directory, or a marketplace id for plugins. */
  target: string
  detail?: string
}

export interface InstallPlan {
  componentIds: string[]
  changes: PlannedChange[]
  backupWillBeCreated: boolean
  /** Components already installed at the same version; these are skipped. */
  alreadyInstalled: string[]
}

export interface DetectionResult {
  platform: Platform
  arch: string
  osRelease: string
  claudeHome: string
  claudeHomeExists: boolean
  claudeCode: {
    installed: boolean
    version: string | null
    /** How Claude Code was found, e.g. "PATH". Never contains a home directory path. */
    foundVia: string | null
  }
  claudeDesktop: {
    installed: boolean
    configDirExists: boolean
  }
  existingConfig: {
    settingsJsonExists: boolean
    settingsJsonValid: boolean
    settingsJsonError: string | null
    claudeMdExists: boolean
    claudeMdLines: number
    /** Skill directory names already present, excluding ours. */
    otherSkills: string[]
  }
  betterClaudeSetup: {
    everInstalled: boolean
    installedComponentIds: string[]
    manifestVersion: string | null
    lastRunIso: string | null
    backupCount: number
  }
  scannedAtIso: string
}

export interface InstalledComponentRecord {
  componentId: string
  version: string
  installedAtIso: string
  /** Exactly what was written, so removal can be precise. */
  artifacts: Artifact[]
}

export type Artifact =
  | { type: 'claude-md-block'; blockId: string }
  | { type: 'skill-dir'; relPath: string }
  | { type: 'settings-keys'; keys: string[] }
  | { type: 'plugin'; pluginRef: string }

export interface Manifest {
  manifestVersion: 1
  appVersion: string
  createdAtIso: string
  updatedAtIso: string
  components: InstalledComponentRecord[]
  backups: BackupRecord[]
}

export interface BackupRecord {
  id: string
  createdAtIso: string
  reason: string
  /** Relative paths inside the backup folder that were captured. */
  files: string[]
}

export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'rolled-back' | 'skipped'

export interface StepResult {
  id: string
  label: string
  status: StepStatus
  /** Beginner-readable outcome or error explanation. */
  message: string
  /** Full technical detail, shown behind "Show technical details". */
  detail?: string
  exitCode?: number
}

export interface OperationResult {
  ok: boolean
  steps: StepResult[]
  backupId: string | null
  /** Set when the whole operation was rolled back. */
  rolledBack: boolean
  summary: string
}

export interface AppInfo {
  version: string
  name: string
  tagline: string
  author: string
  disclaimer: string
}
