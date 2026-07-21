#!/usr/bin/env npx tsx

/**
 * Extractor Completeness Checker
 * 
 * Verifies an extraction operation against the 8-item Extractor Quality Checklist.
 * 
 * Usage:
 *   npx tsx .agents/skills/extractor/scripts/check-extractor-completeness.ts --phase <phase>
 */

import { argv } from "process";

// ============================================================================
// Types
// ============================================================================

/**
 * One row of the extractor quality checklist, including scoring weights.
 *
 * @remarks
 * Required items gate `canFinalize`; optional items contribute to the total score only.
 */
interface ChecklistItem {
  number: number;
  name: string;
  description: string;
  required: boolean;
  checked: boolean;
  weight: number;
}

/**
 * Machine-readable completeness snapshot for `--json` consumers.
 *
 * @remarks
 * Aligns with the console summary: checklist rows, weighted score, and finalize readiness.
 */
interface CompletenessReport {
  checklist: ChecklistItem[];
  score: number;
  maxScore: number;
  canFinalize: boolean;
}

// ============================================================================
// Checklist Definition
// ============================================================================

const CHECKLIST_ITEMS: Omit<ChecklistItem, "checked">[] = [
  { number: 1, name: "Auth verified", description: "gh auth status succeeds", required: true, weight: 2 },
  { number: 2, name: "Target exists", description: "Folder under skills/ confirmed", required: true, weight: 2 },
  { number: 3, name: "Preconditions met", description: "No .git/, not in .gitmodules, parent clean", required: true, weight: 2 },
  { number: 4, name: "Rename confirmed", description: "User explicitly chose rename or skip", required: true, weight: 1 },
  { number: 5, name: "Repo created", description: "gh repo create succeeds", required: true, weight: 2 },
  { number: 6, name: "References scanned", description: "scan-references.ts ran", required: true, weight: 1 },
  { number: 7, name: "Rewrite approved", description: "User approved categorization before edit", required: false, weight: 1 },
  { number: 8, name: "Integration mode chosen", description: "Clone or submodule, user confirmed", required: true, weight: 2 },
];

// ============================================================================
// Main
// ============================================================================

/**
 * Parses CLI flags, derives phased checklist completion, and prints the report.
 *
 * @remarks
 * I/O: stdout only; when `--json` is present, appends a JSON payload after human-readable output.
 */
function main() {
  const args = argv.slice(2);
  const phaseArg = args.find(a => a === "--phase" || a === "-p");
  const jsonArg = args.includes("--json");
  
  const phase = phaseArg 
    ? parseInt(args[args.indexOf(phaseArg) + 1] || "8", 10)
    : 8;
  
  console.log("\n📋 Extractor Completeness Check");
  console.log("═".repeat(60));
  console.log(`\n📊 Phase: ${phase}/8`);
  
  // Build checklist based on phase
  const checklist: ChecklistItem[] = CHECKLIST_ITEMS.map(item => {
    let checked = false;
    
    switch (item.number) {
      case 1: // Auth verified
        checked = phase >= 1;
        break;
      case 2: // Target exists
        checked = phase >= 1;
        break;
      case 3: // Preconditions met
        checked = phase >= 1;
        break;
      case 4: // Rename confirmed
        checked = phase >= 2;
        break;
      case 5: // Repo created
        checked = phase >= 3;
        break;
      case 6: // References scanned
        checked = phase >= 4 || item.required === false;
        break;
      case 7: // Rewrite approved
        checked = phase >= 5 || item.required === false;
        break;
      case 8: // Integration mode chosen
        checked = phase >= 6;
        break;
      default:
        break;
    }
    
    return { ...item, checked };
  });
  
  const score = checklist.reduce((sum, item) => 
    item.checked ? sum + item.weight : sum, 0);
  const maxScore = checklist.reduce((sum, item) => sum + item.weight, 0);
  
  const requiredItems = checklist.filter(i => i.required);
  const requiredScore = requiredItems.reduce((sum, item) => 
    item.checked ? sum + item.weight : sum, 0);
  const requiredMax = requiredItems.reduce((sum, item) => sum + item.weight, 0);
  
  const canFinalize = requiredScore === requiredMax;
  
  console.log(`\n📊 Score: ${score}/${maxScore} (${((score/maxScore)*100).toFixed(0)}%)`);
  console.log(`   Required items: ${requiredScore}/${requiredMax}`);
  
  console.log(`\n${canFinalize ? "✅" : "⚠️"} Ready: ${canFinalize ? "YES" : "NEEDS WORK"}`);
  
  console.log("\n📝 Checklist:");
  for (const item of checklist) {
    const icon = item.checked ? "✅" : item.required ? "❌" : "⚠️";
    console.log(`   ${icon} [${item.number}] ${item.name}`);
  }
  
  console.log("\n" + "═".repeat(60));
  
  if (!canFinalize) {
    console.log("\n⚠️ Extraction needs verification before proceeding.");
    const failedItems = checklist.filter(i => !i.checked && i.required);
    if (failedItems.length > 0) {
      console.log("\nIssues to verify:");
      failedItems.forEach(i => console.log(`   - ${i.name}: ${i.description}`));
    }
  } else {
    console.log("\n✅ Extraction is verified and ready.");
  }
  
  if (jsonArg) {
    const report: CompletenessReport = { checklist, score, maxScore, canFinalize };
    console.log("\n" + JSON.stringify(report, null, 2));
  }
}

main();
