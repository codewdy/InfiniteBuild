# Repository instructions

## Formatting

- After editing files, format every file changed by the task before running final
  checks and reporting completion. If you edit a file again, format it again.
- Use Prettier for JavaScript, TypeScript, JSX, TSX, JSON, JSONC, YAML, HTML, CSS,
  SCSS, Less, Markdown, and MDX.
- Prefer the nearest applicable `node_modules/.bin/prettier`; fall back to
  `prettier` on PATH when no local version is available. The repository currently
  does not declare a Prettier dependency.
- Run the formatter from the project with `--write` and explicit changed file
  paths, for example: `prettier --write packages/core/src/game-data/buff.ts`.
- Use normal Prettier configuration and EditorConfig discovery without overriding
  style options. Do not implicitly download a formatter with `npx` or `pnpm dlx`.
- Format only files touched by the task. Avoid unrelated repository-wide
  formatting changes.
- If the formatter is unavailable, report the limitation instead of silently
  substituting another formatter.

## Validation

- Use `pnpm` for workspace commands.
- After formatting, run checks appropriate to the change. Use `pnpm build` for
  changes spanning package interfaces; a targeted package build is sufficient for
  isolated changes.
- Run `pnpm exec eslint` with explicit changed TypeScript file paths.
- Run `git diff --check` before reporting completion.
- Documentation-only changes need formatting and diff checks, not a build.
- Report which checks passed and any checks that could not be completed.
