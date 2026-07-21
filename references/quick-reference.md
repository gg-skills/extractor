---
title: Quick Reference
---

# Quick Reference

Cheat sheet for all commands used during skill extraction.

## Pre-extraction checks

```bash
# Verify GitHub CLI auth
gh auth status

# Verify target exists and is not already a submodule
ls skills/<name>
git submodule status | grep <name>
grep <name> .gitmodules
```

## Rename scan

```bash
# Find all references to a skill name across the repo
npx tsx .agents/skills/extractor/scripts/scan-references.ts --target <folder-name>
```

## Repo creation

```bash
cd skills/<name>
git init -b main
git add .
git commit -m "Initial commit"
gh repo create <owner>/<name> --private --source . --remote origin --push
gh repo view <owner>/<name>
```

## Gitignore mode integration

```bash
git rm -r --cached skills/<name>
# Add to root .gitignore: skills/<name>/
git commit -m "chore(gitignore): extract <name> as local-only clone"
```

## Submodule mode integration

```bash
git rm -r --cached skills/<name>
rm -rf skills/<name>
git commit -m "chore(skills): remove <name> ahead of submodule add"
git submodule add <repo-url> skills/<name>
git commit -m "chore(submodules): add <name> as submodule"
```

## Post-extraction verification

```bash
git status
gh repo view <owner>/<name>
```

## Post-extraction validation (delegate to `skills-manager/SKILL.md`)

Run these from the repo root after extraction if the target is a GG skill:

```bash
# Generate icons
npx tsx .agents/skills/skills-manager/scripts/generate-icons.ts \
  --skill skills/<name>

# Validate structure and shared checks
npm run skills:manager:validate -- skills/<name>
npm run check:skills-assets
npm run check:skills-naming
npm run check:guidance-skills-alignment
```

## Scan script variants

The scan script searches for these patterns automatically:

| Variant | Pattern | Reliability |
|---------|---------|-------------|
| exact-folder-name | `<target>` | High |
| skill-path | `skills/<target>` | Always real |
| without-skill-prefix | `<slug>` | Often coincidental |
| run-skill-projection | `run-skill-<slug>` | Real if present |

> Source: `scripts/scan-references.ts`
