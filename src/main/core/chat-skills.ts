import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ChatSkillsState, ChatSkillSummary } from '@shared/types'
import { SKILLS, toChatSkill } from './content'
import { SKILL_GROUPS } from './catalog'
import { appStateDir } from './env'
import type { Env } from './env'
import { loadJson, saveJson } from './json-config'
import { ensureDir, pathExists, removeIfExists } from './safe-fs'
import { createZip } from './zip'

/**
 * Making Better Claude skills usable in ordinary Claude conversations.
 *
 * Claude Code reads skills from the filesystem. A Claude account does not: custom skills
 * are uploaded to the account, and Anthropic's documentation is explicit that skills do
 * not sync between surfaces — "Skills uploaded to claude.ai must be separately uploaded to
 * the API", and Claude Code skills "are filesystem-based and separate from both".
 *
 * There is no documented consumer API for adding a skill to somebody's personal Claude
 * account. This application therefore does the half it legitimately can — building the
 * exact upload packages from the same canonical content the Claude Code skills come from —
 * and hands the user a short, guided manual step for the half it cannot. It does not
 * touch the user's Claude session, cookies, tokens or local application data to fake
 * the rest.
 *
 * Once uploaded to the account, those skills also reach Cowork sessions, which Anthropic
 * documents as loading "the skills enabled for your claude.ai account".
 */

/** Where the generated packages are written, inside this app's own state directory. */
export function chatPackageDir(env: Env): string {
  return join(appStateDir(env), 'chat-skills')
}

function chatStatePath(env: Env): string {
  return join(appStateDir(env), 'chat-skills.json')
}

interface StoredChatState {
  confirmedAtIso: string | null
  /** Hash of the package contents the user last confirmed uploading. */
  confirmedHash: string | null
  skillIds: string[]
}

/** Which skills belong in the chat package, based on what is installed locally. */
export function chatSkillIdsFor(componentIds: string[]): string[] {
  const ids: string[] = []
  for (const componentId of componentIds) {
    for (const skillId of SKILL_GROUPS[componentId] ?? []) ids.push(skillId)
  }
  // A user who installed nothing locally still gets the full set offered, because the
  // chat skills are useful on their own and do not depend on the local setup.
  return ids.length > 0 ? ids : Object.keys(SKILLS)
}

/**
 * A stable fingerprint of exactly what the packages contain.
 *
 * Comparing this against what the user last confirmed is how the manager can honestly say
 * "an update is available" without ever asking Claude what is in the account.
 */
export function chatPackageHash(skillIds: string[]): string {
  const hash = createHash('sha256')
  for (const id of [...skillIds].sort()) {
    hash.update(id)
    hash.update('\0')
    hash.update(toChatSkill(id))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

export function chatSkillSummaries(skillIds: string[]): ChatSkillSummary[] {
  return skillIds
    .map((id) => SKILLS[id])
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill))
    .map((skill) => ({
      id: skill.id,
      command: skill.command,
      title: skill.title,
      description: skill.chatDescription,
      fileName: `${skill.command}.zip`
    }))
}

/**
 * Writes one zip per skill.
 *
 * Anthropic's upload takes a single skill per archive, with the skill's own folder at the
 * root of the zip, so this produces one file per skill rather than a bundle.
 */
export async function buildChatPackages(
  env: Env,
  skillIds: string[]
): Promise<{ directory: string; files: string[] }> {
  const directory = chatPackageDir(env)
  // Rebuilt from scratch each time so a skill removed from the selection cannot linger
  // as a stale zip the user then uploads.
  await removeIfExists(directory)
  await ensureDir(directory)

  const files: string[] = []
  // A fixed timestamp keeps repeated builds byte-identical, which is what makes the
  // update check a content comparison rather than a guess.
  const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, 0))

  for (const id of skillIds) {
    const skill = SKILLS[id]
    if (!skill) continue
    const zip = createZip([{ path: `${skill.command}/SKILL.md`, contents: toChatSkill(id) }], stamp)
    const fileName = `${skill.command}.zip`
    await fs.writeFile(join(directory, fileName), zip)
    files.push(fileName)
  }

  await fs.writeFile(join(directory, 'HOW-TO-INSTALL.txt'), instructionsText(files), 'utf8')
  return { directory, files }
}

function instructionsText(files: string[]): string {
  return [
    'Better Claude Setup — skills for ordinary Claude conversations',
    '==============================================================',
    '',
    'These skills work in Claude Code already. This folder contains the same skills',
    'packaged for your Claude account, so they also work in normal Claude chats.',
    '',
    'To add them:',
    '',
    '  1. Open Claude and go to Settings, then Capabilities, and turn on',
    '     "Code execution and file creation". Custom skills need it.',
    '  2. Go to Settings and open the Skills section. In the Claude desktop app this is',
    '     under "Customize" in the sidebar.',
    '  3. Choose "Add skill" or "Upload skill" and pick one of the .zip files below.',
    '     Repeat for each one you want.',
    '',
    'Files in this folder:',
    ...files.map((file) => `  - ${file}`),
    '',
    'Requires a Claude Pro, Max, Team or Enterprise plan.',
    '',
    'Nothing here uploads itself. Better Claude Setup never signs in to your Claude',
    'account and never handles your credentials.',
    ''
  ].join('\n')
}

export async function loadChatState(env: Env): Promise<StoredChatState> {
  const loaded = await loadJson<StoredChatState>(chatStatePath(env))
  const value = loaded.valid ? loaded.value : null
  return {
    confirmedAtIso: value?.confirmedAtIso ?? null,
    confirmedHash: value?.confirmedHash ?? null,
    skillIds: Array.isArray(value?.skillIds) ? value.skillIds : []
  }
}

/**
 * Records that the user says they completed the upload.
 *
 * This is the user's word, not a detection. Nothing here can see into a Claude account,
 * and the interface is careful to describe it that way.
 */
export async function confirmChatSetup(env: Env, skillIds: string[]): Promise<void> {
  await ensureDir(appStateDir(env))
  await saveJson(chatStatePath(env), {
    confirmedAtIso: env.now().toISOString(),
    confirmedHash: chatPackageHash(skillIds),
    skillIds
  } satisfies StoredChatState)
}

export async function clearChatSetup(env: Env): Promise<void> {
  await removeIfExists(chatStatePath(env))
  await removeIfExists(chatPackageDir(env))
}

/** Everything the interface needs to describe the chat surface honestly. */
export async function readChatSkillsState(
  env: Env,
  installedComponentIds: string[]
): Promise<ChatSkillsState> {
  const skillIds = chatSkillIdsFor(installedComponentIds)
  const currentHash = chatPackageHash(skillIds)
  const stored = await loadChatState(env)
  const packaged = await pathExists(chatPackageDir(env))

  let state: ChatSkillsState['state'] = 'not-set-up'
  if (stored.confirmedAtIso) {
    state = stored.confirmedHash === currentHash ? 'confirmed' : 'update-available'
  } else if (packaged) {
    state = 'prepared'
  }

  return {
    state,
    confirmedAtIso: stored.confirmedAtIso,
    packageDirExists: packaged,
    currentHash,
    confirmedHash: stored.confirmedHash,
    skills: chatSkillSummaries(skillIds)
  }
}
