---
name: extractor
description: when configuring skills/ to standalone repo — rename and rewrite references, re-integrate as gitignored clone or submodule. MCP-compatible. Not for non-skill folders.
---

# GG → Extractor → extractor

Extract a `skills/` folder into a standalone GitHub repository, with optional rename plus reference rewrite, and re-integrate it back into the host project as either a gitignored local clone or a git submodule.

This skill is **gitignored from the host project** and lives only on the user's machine. It is intentionally not part of the skills sync system.

For a direct command lookup, see [Quick Commands](#quick-commands) below.

## When to Use This Skill

**TRIGGER when:**
- User asks to "extract", "spin off", or "give its own repo to" a folder under `skills/`.
- User wants to rename a skill and update all internal references before extracting.
- Need to convert an in-repo skill folder to a submodule.
- Need to untrack a skill from the host project while keeping it locally editable.

**SKIP when:**
- The target is already a submodule (must be a plain folder).
- Multi-skill batch extraction is requested (one target per invocation).
- The target does not exist under `skills/`.

## Common Misconceptions

| # | Misconception | Correction | Key concept |
|---|---------------|------------|-------------|
| 1 | Extraction is fully automatic | The skill prompts at every decision point (rename, repo name, visibility, integration mode) | Interactive procedure |
| 2 | The `.env` defaults are applied silently | Defaults are presented for confirmation only; never silently assumed | Explicit consent |
| 3 | Submodule mode preserves local files | Submodule mode removes the working tree and re-adds it as a submodule | Destructive re-integration |
| 4 | Reference rewriting happens automatically | The agent reviews scan output, categorizes hits, and gets user approval before editing | Supervised rewrite |
| 5 | Batch extraction of multiple skills is supported | Only one target per invocation; multi-skill requests must be sequential | Single target |
| 6 | gh auth is not needed for extraction | GitHub auth required for gh repo create and push | Auth requirement |

## Quick Commands

```bash
# Verify GitHub auth
gh auth status

# Scan repo for references to a skill name
# Runner alternatives: bunx tsx / pnpm dlx tsx / deno run -A npm:tsx / node --import tsx / yarn dlx tsx
npx tsx .agents/skills/extractor/scripts/scan-references.ts --target <folder-name>

# Initialize repo inside skill folder and push to GitHub
cd skills/<name>
git init -b main
git add .
git commit -m "Initial commit"
gh repo create <owner>/<name> --<visibility> --source . --remote origin --push

# Verify remote exists
gh repo view <owner>/<name>
```

For the full command surface, see [references/quick-reference.md](references/quick-reference.md).

## Preconditions

Verify all of the following before starting. If any fail, stop and report.

1. `gh auth status` succeeds.
2. The target folder exists under `skills/`.
3. The target does **not** contain a `.git/` directory of its own.
4. The target is **not** listed in `.gitmodules`.
5. The parent working tree is clean. If not, name the dirty files and ask whether to proceed.

## Procedure

### Step 1 — Identify the target

Confirm the absolute path under `skills/`. Verify all preconditions above.

## Extractor Quality Checklist

Use this checklist before and during any extraction operation.

| # | Checklist Item | Why It Matters | Gate |
|---|---------------|---------------|------|
| 1 | **Auth verified** — gh auth status succeeds | Required for gh repo create | Pre-op |
| 2 | **Target exists** — Folder under skills/ confirmed | Prevents wrong target | Pre-op |
| 3 | **Preconditions met** — No .git/, not in .gitmodules, parent clean | Safe to proceed | Pre-op |
| 4 | **Rename confirmed** — User explicitly chose rename or skip | Explicit consent | Draft |
| 5 | **Repo created** — gh repo create succeeds | Integration | Draft |
| 6 | **References scanned** — scan-references.ts ran | Impact assessment | Draft |
| 7 | **Rewrite approved** — User approved categorization before edit | Supervised rewrite | Closeout |
| 8 | **Integration mode chosen** — Clone or submodule, user confirmed | Correct integration | Closeout |

### Quality Tiers

| Tier | Criteria | Use When |
|------|----------|----------|
| **Minimal** | Items 1-3, 5, 8 | Quick extraction |
| **Standard** | Items 1-6, 8 | Full extraction |
| **Full** | All 8 items | Extraction with rewrite |

### Pre-Op Verification

```
□ gh auth status succeeds
□ Target folder exists under skills/
□ No .git/ directory in target
□ Not listed in .gitmodules
□ Parent working tree is clean
```

## Extractor Consistency Validator

Before finalizing, verify:

### Consistency Check Matrix

| Check | What to Verify | How to Fix |
|-------|---------------|------------|
| **Auth vs Operation** | gh auth status succeeds | Run gh auth login |
| **Target vs Existence** | Folder exists under skills/ | Verify path |
| **Rename vs Consent** | User explicitly chose rename or skip | Confirm choice |
| **Rewrite vs Approval** | User approved categorization before editing | Supervised rewrite |

### Red Flags (Never Present)

- [ ] gh auth status fails
- [ ] Target has .git/ directory
- [ ] Target in .gitmodules
- [ ] Dirty parent without user consent
- [ ] Rewrite without user approval

### Step 2 — Optional rename

Ask: "Rename this skill before extracting? Current folder name is `<name>`."

If yes:

1. Get the new name from the user.
2. Run the reference scan (see [Quick Commands](#quick-commands)).
3. **Review the scan output yourself.** Each hit is either:
   - **Real reference** — file mentions this skill and should be updated.
   - **Coincidental substring match** — e.g. the slug appears as part of a larger unrelated identifier.
   - **Ambiguous** — needs the user to decide.
   Categorize every hit. Do not trust variant labels blindly.
4. Show the user your categorization (real / coincidental / ambiguous) with file:line:context for the ambiguous bucket. Get explicit approval before rewriting.
5. For approved hits, apply edits. Use `git mv` to rename the folder itself.
6. Commit in the host project: `chore(skill): rename <old> to <new>`.

If no, skip to Step 3.

### Step 3 — Confirm GitHub repo name

Default = current folder name (post-rename). Ask the user to confirm or supply a different name.

### Step 4 — Confirm visibility

Default from `.env` (see [references/configuration.md](references/configuration.md)). Ask: "Repo visibility? (private/public)".

### Step 5 — Create GitHub repo and push initial contents

From inside the skill folder:

```bash
cd skills/<name>
git init -b main
git add .
git commit -m "Initial commit"
gh repo create <owner>/<name> --<visibility> --source . --remote origin --push
```

Verify the remote was created and push succeeded (`gh repo view <owner>/<name>`).

### Step 6 — Confirm integration mode

Default from `.env`. Ask: "Integration mode? (gitignore/submodule)".

### Step 7a — Gitignore mode

Goal: host project no longer tracks the folder; folder stays in place as a local-only clone.

1. Untrack from parent: `git rm -r --cached skills/<name>`
2. Add an entry to root `.gitignore` under the existing "Local-only nested clone" block:
   ```
   skills/<name>/
   ```
3. Commit in source project: `chore(gitignore): extract <name> as local-only clone`.

### Step 7b — Submodule mode

Goal: source project references the new GitHub repo as a submodule at the same path.

1. Untrack from source: `git rm -r --cached skills/<name>`
2. Remove the working tree (the new repo's contents are already pushed): `rm -rf skills/<name>`
3. Commit: `chore(skills): remove <name> ahead of submodule add`.
4. Add as submodule: `git submodule add <repo-url> skills/<name>`
5. Commit: `chore(submodules): add <name> as submodule`.

### Step 8 — Push source project and verify

1. `git status` — confirm only the expected changes.
2. Push the source project branch.
3. `gh repo view <owner>/<name>` — confirm the new repo is reachable.
4. Summarize for the user: new repo URL, integration mode chosen, parent commits added.

### Step 9 — Delegate to `skills-manager/SKILL.md`

If the extracted skill belongs to the GG category, hand off to `skills-manager/SKILL.md` for:
- Icon asset generation (if not already present or if `SKILL.md` description changed).
- Skill structure validation (`npm run skills:manager:validate -- skills/<name>`).
- Shared repo checks (`check:skills-assets`, `check:skills-naming`, `check:guidance-skills-alignment`).

Do not run these yourself; load `skills-manager/SKILL.md` and follow its workflow.

## Command Decision Guide

| Scenario | Recommended approach | Trade-off |
|----------|---------------------|-----------|
| Keep editing skill locally, simplest path | gitignore mode | Parent repo no longer tracks changes; skill edits are local-only |
| Share skill across multiple repos with version pinning | submodule mode | Adds submodule management overhead; exact commit tracking |
| Quick extraction with minimal source project changes | gitignore mode | One `.gitignore` line, one commit |
| Team needs reproducible skill state via source project history | submodule mode | Submodule must be initialized by every clone |

**Rule of thumb:** Use gitignore mode unless the skill must be shared as a versioned dependency across multiple projects.

## Reference Loading by Task Type

| Task type | Load these files | Skip |
|-----------|-----------------|------|
| Diagnostic / inspection-first | Run `gh auth status` and verify target folder exists | None |
| Rename + reference rewrite | `references/quick-reference.md`, `references/troubleshooting.md` | `references/configuration.md` |
| Integration mode decision | `references/quick-reference.md` | `references/troubleshooting.md` |
| Post-extraction failure recovery | `references/troubleshooting.md` | `references/configuration.md` |

For diagnostic requests, run the inspection commands first before loading any reference files. Load only the subset the task needs.

## Non-Negotiable Policy

1. **One target per invocation.** Do not attempt multi-skill batch extraction.
2. **Use the scan script to locate references before rewriting.** Never reconstruct reference locations from memory.
3. **Never reconstruct shell commands, CLI flags, or setup steps from memory** — always read the relevant reference file first.
4. **Always prompt for explicit confirmation** at rename, repo name, visibility, and integration mode decisions. Never silently apply `.env` defaults.
5. **Categorize every scan hit** as real, coincidental, or ambiguous before showing results to the user.
6. **For destructive operations** (submodule mode `rm -rf`, `git rm --cached`), confirm the expected state before and after.
7. **For any answer about GitHub CLI behavior or repository settings:** treat bundled data as likely stale and verify with `gh --help` or the live docs before stating specifics.

## Troubleshooting

See [references/troubleshooting.md](references/troubleshooting.md) for the full failure-mode matrix.

Common quick fixes:

- **`gh repo create` fails because repo already exists.** Offer to (a) use the existing remote, or (b) pick a new name.
- **Pre-existing `.git/` inside target.** Refuse and tell the user it already looks like a repo.
- **Reference scan returns >100 hits.** Pause and ask the user before continuing. The slug is likely too generic.
- **Mid-extraction failure** (e.g. `git rm --cached` succeeded but submodule add failed). Walk the user through the partial state — do not autorecover destructively.

## Cross-Skill Coordination

### Dependencies
- `skills-manager/SKILL.md` for the canonical GG skill structure, icon generation, and validation gates. After extraction, the resulting skill must pass `skills:manager:validate` and the shared repo checks.

### Delegated concerns
Do not duplicate the following in this skill; delegate to `skills-manager/SKILL.md`:
- Generating or regenerating icon assets (`icon-master.png`, `icon-large.png`, `icon-small.svg`, and the `icon-*.txt` prompts).
- Validating skill structure, naming, or guidance alignment (`skills:manager:validate`, `check:skills-naming`, `check:guidance-skills-alignment`).
- Bootstrapping a brand-new GG skill from scratch (use `npm run skills:init` via `skills-manager/SKILL.md` instead).

## Out of Scope

- Submodule extraction (the target must be a plain folder, not already a submodule).
- Multi-skill batch extraction. One target per invocation.
- Updating IDE projection scripts (`scripts/canonical-workflows/*`) to handle the new submodule — surface this as a follow-up if needed.
- Icon generation and skill validation — handled by `skills-manager/SKILL.md` after extraction.

## Local Corpus Layout

The `references/` folder contains **3 files** (no subfolders):

### Operational references

- `quick-reference.md` — Command cheat sheet for all `gh`, `git`, and scan operations.
- `configuration.md` — Environment variables, defaults, and override behavior.
- `troubleshooting.md` — Failure-mode matrix with symptoms, causes, and recovery steps.

### Assets

- `assets/icon-small.svg` — Skill icon (small, SVG). Generated via `skills-manager/SKILL.md`.
- `assets/icon-large.png` — Skill icon (large, raster). Generated via `skills-manager/SKILL.md`.
- `assets/icon-master.png` — High-resolution master icon. Generated via `skills-manager/SKILL.md`.
- `assets/icon-prompt.txt` — Prompt used to generate the icon. Generated via `skills-manager/SKILL.md`.
- `assets/icon-summary.txt` — Summary prompt for icon generation. Generated via `skills-manager/SKILL.md`.
- `assets/icon-metaphor.txt` — Metaphor prompt for icon generation. Generated via `skills-manager/SKILL.md`.

[^rt]: `npx tsx` accepts any standard runner — `bunx tsx`, `pnpm dlx tsx`, `deno run -A npm:tsx`, `node --import tsx`, or `yarn dlx tsx`. The first five auto-fetch `tsx` on demand; only `node --import tsx` requires `tsx` to be installed locally first (`npm i -D tsx`, or `npm i -g tsx` if you cannot reach the npm registry). Bun users can also skip `tsx` entirely and run TypeScript directly via `bun <script>`. Pick whichever your project ships. The canonical runtime decision table lives in the `skills-manager` skill under `Runtime Selection` (only available when working in the full `gg-skills` monorepo).
