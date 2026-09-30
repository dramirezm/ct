# 01 — Claude Issue Triage Workflow

File: `.github/workflows/claude-issue-triage.yml`

## Purpose
Automatically triage every new issue (and every edit to its title/body) with Claude:
apply labels and publish a technical diagnosis (Spanish) used later to implement the fix.

## Triggers
- `issues.opened`
- `issues.edited` — only when `title` or `body` changed.
- Skipped for bot actors (`*[bot]`) to avoid loops.
- `concurrency` per issue with `cancel-in-progress`: rapid edits only analyze the latest version.

## Authentication
- Claude: `secrets.CLAUDE_CODE_OAUTH_TOKEN` (same as `claude.yml` and `claude-code-review.yml`).
- GitHub API: Claude GitHub App token obtained via OIDC (`id-token: write`), exposed as
  `steps.claude.outputs.github_token` and reused by the comment step. No `GITHUB_TOKEN` or extra secrets.
- Limitation: the action only runs for actors with write access to the repo.

## Label taxonomy
| Group | Labels |
|-------|--------|
| Type (existing, exactly 1) | `bug`, `enhancement`, `documentation`, `question`, `accessibility`, `duplicate`, `invalid` |
| Priority (exactly 1) | `priority:critical`, `priority:high`, `priority:medium`, `priority:low` |
| Area (1+) | `area:gameplay`, `area:rendering`, `area:ui`, `area:controls`, `area:scoring`, `area:ci` |
| Complexity (exactly 1) | `complexity:small`, `complexity:medium`, `complexity:large` |
| Status | `needs-info` |

Missing labels are created idempotently by Claude (`gh label create --force`).
On re-triage, stale managed labels are removed; unmanaged labels are never touched.

## Diagnosis comment
- Claude writes `.claude-triage.md` in the workspace; a shell step publishes it.
- Single comment per issue, identified by the hidden marker `<!-- claude-issue-triage -->`;
  updated in place (PATCH) on each edit.
- Sections: Resumen, Clasificación, Componentes afectados, Análisis / causa probable,
  Propuesta de solución, Riesgos y casos borde, Criterios de aceptación, Preguntas abiertas.

## Security
- Issue title/body are never interpolated into the prompt or shell; Claude reads them via `gh issue view`.
- Prompt instructs Claude to treat issue content as untrusted data.
- Tool allowlist: `Read`, `Glob`, `Grep`, `Write`, `gh issue view|edit`, `gh label list|create`.

## Verification
1. Merge to `main` (issue workflows run from the default branch).
2. `gh issue create --title "..." --body "..."` → labels applied + diagnosis comment.
3. `gh issue edit N --body "..."` → same comment updated, labels re-evaluated.
4. `gh issue edit N --add-label x` → no run.
