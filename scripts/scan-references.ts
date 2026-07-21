#!/usr/bin/env -S npx tsx
/**
 * Scan the parent repo for references to a `skills/<target>` folder.
 *
 * Emits a grouped report of variants → hits so the agent (Claude) can review,
 * categorize as real-reference / coincidental / ambiguous, and confirm with
 * the user before rewriting.
 *
 * Usage:
 *   npx tsx .agents/skills/extractor/scripts/scan-references.ts --target <folder-name>
 *
 * The script intentionally errs on the side of recall (more variants, more hits).
 * The agent must apply judgment to the output.
 */

import { execSync } from "node:child_process";
import { argv, exit } from "node:process";

/**
 * One labeled ripgrep search variant used when scanning for references to a skill folder.
 *
 * @remarks
 * Each variant ties a human-readable label to a fixed-string pattern plus triage guidance for the agent.
 */
interface Variant {
  label: string;
  pattern: string;
  note: string;
}

/**
 * A single ripgrep hit attributed to the variant that produced the match.
 *
 * @remarks
 * Paths are relative to the Git repository root used as ripgrep's working directory.
 */
interface Hit {
  variant: string;
  file: string;
  line: number;
  text: string;
}

/**
 * Builds high-recall search patterns for a `skills/<target>` folder name.
 *
 * @remarks
 * When `target` begins with `skill-`, adds slug-based patterns that may need manual verification.
 */
function buildVariants(target: string): Variant[] {
  const variants: Variant[] = [
    {
      label: "exact-folder-name",
      pattern: target,
      note: "Most reliable. Likely a real reference.",
    },
    {
      label: "skill-path",
      pattern: `skills/${target}`,
      note: "Always a real reference.",
    },
  ];

  if (target.startsWith("skill-")) {
    const slug = target.replace(/^skill-/, "");
    variants.push({
      label: "without-skill-prefix",
      pattern: slug,
      note: "Often coincidental. Verify each hit individually.",
    });
    variants.push({
      label: "run-skill-projection",
      pattern: `run-skill-${slug}`,
      note: "Generated `run-skill-*` script targets. Real reference if present.",
    });
  }

  return variants;
}

/**
 * Resolves the enclosing Git repository root used as ripgrep's working directory.
 *
 * @remarks
 * I/O: synchronous `git rev-parse` via child process.
 */
function repoRoot(): string {
  return execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
}

/**
 * Runs fixed-string ripgrep across the repo for one variant, excluding the skill tree under scan.
 *
 * @remarks
 * I/O: synchronous `rg` invocation; maps stdout lines into hits and treats exit status 1 as zero matches.
 */
function scanWithRipgrep(pattern: string, label: string, target: string): Hit[] {
  const excludeFolder = `skills/${target}`;
  const args = [
    "rg",
    "--line-number",
    "--no-heading",
    "--color=never",
    "--fixed-strings",
    `--glob '!${excludeFolder}/**'`,
    "--glob '!.git/**'",
    "--glob '!node_modules/**'",
    "--glob '!**/node_modules/**'",
    "--glob '!**/.next/**'",
    "--glob '!**/dist/**'",
    "--glob '!**/.turbo/**'",
    "--glob '!.tmp/**'",
    "--glob '!**/.cache/**'",
    JSON.stringify(pattern),
    ".",
  ];

  try {
    const cmd = args.join(" ");
    if (process.env.DEBUG_SCAN) {
      console.error(`[debug] ${cmd}`);
    }
    const result = execSync(cmd, {
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
      cwd: repoRoot(),
    });
    return result
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line): Hit | null => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (!match) return null;
        return {
          variant: label,
          file: match[1],
          line: Number.parseInt(match[2], 10),
          text: match[3],
        };
      })
      .filter((h): h is Hit => h !== null);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 1
    ) {
      // ripgrep exits 1 when no matches found — not an error.
      return [];
    }
    throw err;
  }
}

/**
 * CLI entry: parses `--target`, scans variants, dedupes hits, and prints a markdown-style report.
 *
 * @remarks
 * Exits with code 1 when `--target` is missing or has no value.
 */
function main(): void {
  const targetIdx = argv.indexOf("--target");
  if (targetIdx === -1 || !argv[targetIdx + 1]) {
    console.error("Usage: scan-references.ts --target <folder-name>");
    exit(1);
  }
  const target = argv[targetIdx + 1];
  const variants = buildVariants(target);

  const allHits: Hit[] = [];
  for (const v of variants) {
    allHits.push(...scanWithRipgrep(v.pattern, v.label, target));
  }

  const seen = new Set<string>();
  const deduped = allHits.filter((h) => {
    const key = `${h.file}:${h.line}:${h.variant}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const byVariant = new Map<string, Hit[]>();
  for (const h of deduped) {
    if (!byVariant.has(h.variant)) byVariant.set(h.variant, []);
    byVariant.get(h.variant)!.push(h);
  }

  console.log(`# Reference scan for: ${target}`);
  console.log(`Total hits across all variants: ${deduped.length}`);
  console.log("");
  console.log(
    "NOTE: variant labels are hints. The agent must verify each hit by context — `without-skill-prefix` matches in particular are often coincidental.",
  );
  console.log("");

  for (const variant of variants) {
    const hits = byVariant.get(variant.label) ?? [];
    console.log(`## ${variant.label}  (${hits.length} hits)`);
    console.log(`Pattern: \`${variant.pattern}\``);
    console.log(`Note: ${variant.note}`);
    console.log("");
    if (hits.length === 0) {
      console.log("_no hits_");
    } else {
      for (const h of hits) {
        console.log(`- ${h.file}:${h.line}: \`${h.text.trim()}\``);
      }
    }
    console.log("");
  }
}

main();
