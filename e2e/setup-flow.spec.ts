import { expect, test } from './fixtures'

/**
 * The critical path, driven through the real interface against a fixture home directory:
 * launch, scan, recommended setup, review, install, success, manager, disable one
 * component, restore.
 */
test.describe.configure({ mode: 'serial' })

/**
 * Whether Claude Code is installed is a property of the machine, not of the fixture home,
 * so it differs between a developer's computer and a clean CI runner. When it is missing
 * the app offers to install it first; these tests decline and carry on, which also
 * exercises that screen's skip path.
 */
async function continuePastScan(window: import('@playwright/test').Page): Promise<void> {
  await window.getByRole('button', { name: /^continue$/i }).click({ timeout: 30_000 })

  const skip = window.getByRole('button', { name: /skip for now/i })
  if (await skip.isVisible().catch(() => false)) {
    await skip.click()
  }

  await expect(
    window.getByRole('heading', { name: /how much do you want to change/i })
  ).toBeVisible()
}

test('the whole setup path works end to end', async ({ window, home }) => {
  // --- launch -------------------------------------------------------------------
  await expect(window.getByRole('heading', { name: /make claude/i })).toBeVisible({
    timeout: 20_000
  })
  await expect(window.getByRole('button', { name: /set up claude/i })).toBeEnabled()

  // Nothing may be written before the user agrees to anything.
  expect(home.readClaudeMd()).toBe('# My own notes\n\nAlways run make test.\n')

  // --- scan ---------------------------------------------------------------------
  await window.getByRole('button', { name: /set up claude/i }).click()
  await expect(window.getByText(/here is what you already have/i)).toBeVisible({
    timeout: 30_000
  })
  // The scan reports the fixture's own instructions file and skill without changing them.
  await expect(window.getByText(/your instructions file has 4 lines/i)).toBeVisible()
  expect(home.hasSkill('my-own-skill')).toBe(true)

  // --- choose -------------------------------------------------------------------
  await continuePastScan(window)
  await window.getByRole('button', { name: /use recommended/i }).click()

  // --- review -------------------------------------------------------------------
  await expect(window.getByRole('heading', { name: /what will change/i })).toBeVisible()
  await expect(window.getByText(/better claude core/i)).toBeVisible()
  await expect(window.getByText(/preserved/i).first()).toBeVisible()
  // Still nothing written: the review screen is a preview.
  expect(home.hasSkill('write')).toBe(false)

  // --- install ------------------------------------------------------------------
  await window.getByRole('button', { name: /approve and set up/i }).click()

  // --- success ------------------------------------------------------------------
  await expect(window.getByRole('heading', { name: /claude is ready/i })).toBeVisible({
    timeout: 30_000
  })
  await expect(window.getByText(/now active/i)).toBeVisible()

  // The files really are on disk, and the user's own content survived.
  expect(home.hasSkill('write')).toBe(true)
  expect(home.hasSkill('plan-work')).toBe(true)
  expect(home.hasSkill('my-own-skill')).toBe(true)
  const afterInstall = home.readClaudeMd() ?? ''
  expect(afterInstall).toContain('Always run make test.')
  expect(afterInstall).toContain('better-claude-setup:core-behaviour')

  // --- manager ------------------------------------------------------------------
  await window.getByRole('button', { name: /open setup manager/i }).click()
  await expect(window.getByRole('heading', { name: /your claude setup/i })).toBeVisible()
  // Claude Code is set up but the account surface is not, and the manager says so
  // specifically rather than calling the whole thing "active".
  await expect(window.getByText(/still needs setting up/i)).toBeVisible()
  await expect(window.getByText(/claude chat & web/i).first()).toBeVisible()

  // --- disable one component ----------------------------------------------------
  const writingSwitch = window.getByRole('switch', { name: /writing and editing: enabled/i })
  await expect(writingSwitch).toBeVisible()
  await writingSwitch.click()

  await expect(window.getByRole('switch', { name: /writing and editing: disabled/i })).toBeVisible({
    timeout: 30_000
  })

  // Only that component's files went; everything else stayed.
  expect(home.hasSkill('write')).toBe(false)
  expect(home.hasSkill('plan-work')).toBe(true)
  expect(home.hasSkill('my-own-skill')).toBe(true)

  // --- restore ------------------------------------------------------------------
  await window.getByRole('button', { name: /restore original setup/i }).click()
  await window.getByRole('button', { name: /yes, restore that version/i }).click()

  // The Claude Code surface goes back to offering setup rather than reporting it done.
  await expect(window.getByRole('button', { name: /set up claude code/i })).toBeVisible({
    timeout: 30_000
  })

  // The fixture home is back exactly as it started.
  expect(home.readClaudeMd()).toBe('# My own notes\n\nAlways run make test.\n')
  expect(home.listSkills()).toEqual(['my-own-skill'])
})

test('the review screen can be left without changing anything', async ({ window, home }) => {
  await window.getByRole('button', { name: /set up claude/i }).click()
  await continuePastScan(window)
  await window.getByRole('button', { name: /use recommended/i }).click()
  await expect(window.getByRole('heading', { name: /what will change/i })).toBeVisible()

  await window.getByRole('button', { name: /^back$/i }).click()
  await expect(window.getByRole('heading', { name: /choose what to set up/i })).toBeVisible()

  expect(home.listSkills()).toEqual(['my-own-skill'])
})

test('detection reports what it found and how', async ({ window }) => {
  await window.getByRole('button', { name: /set up claude/i }).click()
  await expect(window.getByText(/here is what you already have/i)).toBeVisible({
    timeout: 30_000
  })

  await window.getByText(/detection details/i).click()
  // Every route the engine tried is listed, whether or not it found anything.
  await expect(
    window.getByText(/windows app packages|applications folder|installed package/i).first()
  ).toBeVisible()
})

test('the custom path lets a single component be chosen', async ({ window, home }) => {
  await window.getByRole('button', { name: /set up claude/i }).click()
  await continuePastScan(window)
  await window.getByRole('button', { name: /customise/i }).click()

  await expect(window.getByRole('heading', { name: /choose what to set up/i })).toBeVisible()

  // Turn everything off, then enable only the core improvements.
  for (const name of [
    /writing and editing: on/i,
    /research and fact checking: on/i,
    /coding: on/i,
    /planning and decisions: on/i
  ]) {
    const control = window.getByRole('switch', { name })
    if (await control.count()) await control.click()
  }

  await window.getByRole('button', { name: /review changes/i }).click()
  await window.getByRole('button', { name: /approve and set up/i }).click()

  await expect(window.getByRole('heading', { name: /claude is ready/i })).toBeVisible({
    timeout: 30_000
  })

  expect(home.readClaudeMd()).toContain('better-claude-setup:core-behaviour')
  expect(home.hasSkill('write')).toBe(false)
})

test.describe('when Claude Code is not installed', () => {
  test.use({ hideClaudeCode: true })

  test('the setup offers to install it and can be skipped', async ({ window, home }) => {
    await window.getByRole('button', { name: /set up claude/i }).click()
    await expect(window.getByText(/here is what you already have/i)).toBeVisible({
      timeout: 30_000
    })
    await expect(window.getByText(/not installed\./i).first()).toBeVisible()

    await window.getByRole('button', { name: /^continue$/i }).click()
    await expect(
      window.getByRole('heading', { name: /claude code is not installed/i })
    ).toBeVisible()

    // Declining still leaves the rest of the setup available, because the instructions and
    // skills are ordinary files that do not need the tool to be present.
    await window.getByRole('button', { name: /skip for now/i }).click()
    await window.getByRole('button', { name: /use recommended/i }).click()
    await window.getByRole('button', { name: /approve and set up/i }).click()

    await expect(window.getByRole('heading', { name: /claude is ready/i })).toBeVisible({
      timeout: 30_000
    })
    expect(home.hasSkill('write')).toBe(true)
  })
})

test.describe('the Claude account surface', () => {
  test('is offered separately, and is never claimed to be detected', async ({ window, home }) => {
    await window.getByRole('button', { name: /set up claude/i }).click()
    await continuePastScan(window)
    await window.getByRole('button', { name: /use recommended/i }).click()
    await window.getByRole('button', { name: /approve and set up/i }).click()
    await expect(window.getByRole('heading', { name: /claude is ready/i })).toBeVisible({
      timeout: 30_000
    })

    await window.getByRole('button', { name: /set up claude chat skills/i }).click()
    await expect(
      window.getByRole('heading', { name: /use these skills in ordinary claude chats/i })
    ).toBeVisible()

    // The wording must never imply the app can see into a Claude account.
    await expect(window.getByText(/cannot see inside your claude account/i)).toBeVisible()

    // Confirming is only possible once the packages exist.
    const confirm = window.getByRole('button', { name: /i have uploaded them/i })
    await expect(confirm).toBeDisabled()

    await window.getByRole('button', { name: /prepare files/i }).click()
    await expect(confirm).toBeEnabled({ timeout: 30_000 })

    // Real archives, on disk, one per skill.
    const packaged = home.listChatPackages()
    expect(packaged).toContain('research.zip')
    expect(packaged).toContain('HOW-TO-INSTALL.txt')

    await confirm.click()
    await expect(window.getByText(/marked as done by you/i)).toBeVisible({ timeout: 30_000 })
  })
})
