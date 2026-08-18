# Contributing

Thanks for considering it. This project has an unusually narrow scope on purpose, so the
most useful thing you can do before writing code is open an issue describing the problem
you want solved.

## Getting set up

Requires Node.js 20.19 or newer.

```bash
npm ci
npm test            # vitest, ~75 tests
npm run typecheck   # both TypeScript projects
npm run format      # prettier
npm run dev         # run the app
```

## Ground rules

**Never test against your own Claude configuration.** Every core function takes an `Env`
object so tests can point at a temporary directory. `tests/helpers.ts` has `makeTempEnv()`.
A test that reads or writes the real `~/.claude` will be rejected.

**Everything the app can add, it must know how to remove.** If you add a component, it must
record artifacts in the manifest that describe precisely what to delete, and there must be
a test proving that removal restores the previous state exactly.

**Do not grow the always-loaded context.** The core preset in `src/main/core/content.ts` is
deliberately about 40 lines, because it is loaded at the start of every Claude conversation.
New guidance almost always belongs in a skill, which loads only when used. A pull request
that grows `CORE_PRESET` needs to argue why the benefit is worth the permanent cost.

**No shell strings.** Process execution goes through `core/exec.ts` with an argument array.
Never build a command as a string, and never pass user input to a process.

**No new runtime dependencies without a strong reason.** The shipped app depends on React
and React DOM. Anything else needs justification in the pull request.

## Adding a component

1. Add the text to `src/main/core/content.ts`.
2. Add metadata to `COMPONENTS` in `src/main/core/catalog.ts`, filled in honestly —
   `writes`, `network`, `executesCommands`, `contextCost` and `securityNotes` are rendered
   directly into the interface and the permission screen.
3. Wire it into `SKILL_GROUPS`, `SETTING_VALUES` or `PLUGIN_REFS`.
4. Add tests: it installs, it preserves existing content, and it removes cleanly.
5. New third-party components must state a source, a publisher, a licence and a
   verification date. See `docs/research.md` for the standard applied to the current set.

## Writing skills

- Put the key use case first in `description`; the combined description is truncated at
  1,536 characters by Claude Code.
- Keep the body tight. Once a skill loads, its content stays in context for the rest of the
  session, so every line is a recurring cost.
- State what to do, not why. Claude does not need the essay.
- Never set `allowed-tools`. This project does not pre-approve tool permissions on a user's
  behalf.

## Pull requests

- Keep the diff to one concern.
- Run `npm test`, `npm run typecheck` and `npm run format:check` before pushing.
- Update `CHANGELOG.md` under "Unreleased".
- Say what you actually tested and on which operating system. "Should work on macOS" is
  fine as long as it is written as that and not as "works on macOS".
