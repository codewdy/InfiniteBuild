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

## Unit death handling

- In all logic, use only the unit death flag (`isDead` in the current codebase,
  referred to as `is_dead`) to decide whether death prevents further event
  processing. Do not use `hp <= 0` or require `hp > 0` as an additional event
  processing guard.
- HP-based death resolution sets the death flag; until that flag is set, a unit
  must not be treated as dead when deciding whether to process subsequent events.

## Tests

- Do not add tests unless the user explicitly requests them.
