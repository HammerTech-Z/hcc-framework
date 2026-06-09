#!/usr/bin/env node
// AGENT-BRIDGE-007 — authorization report generator.
//
// Reads an Agent Bridge task packet, result JSON, and audit JSON, then
// produces a user-facing authorization report. The report is a markdown
// document that states the audit verdict, the recommended action, and the
// exact phrases the user must speak to authorize (or reject) the work.
//
// This script does NOT:
//   - commit / push / amend / rebase / squash
//   - write repo files (outside ignored .agent-bridge/authorizations/)
//   - write to ~/.hermes/*
//   - call Claude or Codex
//   - execute any command from the task/result/audit
//   - enable live apply / LOOP-010.A
//   - act as an authorization dashboard or executor
//
// The user remains the final gate. The report is informational only.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, isAbsolute, sep } from "node:path";

// -----------------------------------------------------------------
// Safe authorization-id pattern
// -----------------------------------------------------------------

const AUTHORIZATION_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function validateAuthorizationId(id) {
  if (!id || typeof id !== "string" || id.length === 0) {
    return "authorization-id must be a non-empty string";
  }
  if (id.includes("/") || id.includes("\\")) {
    return "authorization-id must not contain path separators";
  }
  if (id.includes("..")) {
    return "authorization-id must not contain path traversal";
  }
  if (isAbsolute(id)) {
    return "authorization-id must not be an absolute path";
  }
  if (!AUTHORIZATION_ID_PATTERN.test(id)) {
    return "authorization-id must match [A-Za-z0-9._-]+";
  }
  return null;
}

// -----------------------------------------------------------------
// CLI
// -----------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    repo: null,
    task: null,
    result: null,
    audit: null,
    authorizationId: null,
    dryRun: false,
    writeReport: false,
    bridgeRoot: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i] ?? null;
    else if (a === "--task") out.task = argv[++i] ?? null;
    else if (a === "--result") out.result = argv[++i] ?? null;
    else if (a === "--audit") out.audit = argv[++i] ?? null;
    else if (a === "--authorization-id") out.authorizationId = argv[++i] ?? null;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--write-report") out.writeReport = true;
    else if (a === "--bridge-root") out.bridgeRoot = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/agent-bridge/generate-authorization-report.mjs [options]",
      "",
      "Options:",
      "  --repo <path>             Path to repo root",
      "  --task <path>             Path to task packet JSON",
      "  --result <path>           Path to Claude result JSON",
      "  --audit <path>            Path to Codex audit JSON",
      "  --authorization-id <id>   Report identifier (required for --write-report)",
      "  --dry-run                 Print report to stdout; do not write",
      "  --write-report            Write under <bridge-root>/authorizations/",
      "  --bridge-root <path>      Optional; default = <repo>/.agent-bridge",
      "  --help, -h                Print this message",
      "",
      "Exactly one of --dry-run or --write-report must be provided.",
      "",
      "The report does NOT commit, push, write repo files, or execute live apply.",
      "User remains the final gate — this is informational only.",
      "",
    ].join("\n"),
  );
}

// -----------------------------------------------------------------
// Bridge-root sandboxing
// -----------------------------------------------------------------

function resolveBridgeRoot(args, repoRoot) {
  const repoBridgeRoot = resolve(repoRoot, ".agent-bridge");
  const bridgeRoot = args.bridgeRoot
    ? resolve(args.bridgeRoot)
    : repoBridgeRoot;
  const within =
    bridgeRoot === repoBridgeRoot ||
    bridgeRoot.startsWith(repoBridgeRoot + sep);
  if (!within) {
    process.stderr.write(
      `error: --bridge-root must resolve inside ${repoBridgeRoot}\n`,
    );
    process.exit(2);
  }
  return bridgeRoot;
}

// -----------------------------------------------------------------
// Consistency checks
// -----------------------------------------------------------------

function validateConsistency(task, result, audit) {
  const errors = [];
  if (task.task_id !== result.task_id) {
    errors.push(
      `task.task_id="${task.task_id}" does not match result.task_id="${result.task_id}"`,
    );
  }
  if (task.task_id !== audit.task_id) {
    errors.push(
      `task.task_id="${task.task_id}" does not match audit.task_id="${audit.task_id}"`,
    );
  }
  // result_task_id is mandatory for consistency.
  if (!audit.claimed_facts || typeof audit.claimed_facts !== "object") {
    errors.push("audit.claimed_facts is missing or not an object");
  } else {
    const t = audit.claimed_facts.result_task_id;
    if (t === undefined || t === null) {
      errors.push(
        "audit.claimed_facts.result_task_id is missing or null (required for consistency)",
      );
    } else if (typeof t !== "string") {
      errors.push(
        `audit.claimed_facts.result_task_id must be a string, got ${typeof t}`,
      );
    } else if (t !== task.task_id) {
      errors.push(
        `audit.claimed_facts.result_task_id="${t}" does not match task.task_id="${task.task_id}"`,
      );
    }
  }
  if (!audit.final_decision) {
    errors.push("audit.final_decision is missing or empty");
  }
  if (typeof audit.verified_correct !== "boolean") {
    errors.push(
      `audit.verified_correct must be a boolean, got ${typeof audit.verified_correct}`,
    );
  }
  return errors;
}

// -----------------------------------------------------------------
// Report generation
// -----------------------------------------------------------------

function generateReport(authorizationId, task, result, audit, errors) {
  const heading = errors.length > 0
    ? "AUTHORIZATION REPORT INVALID: INPUTS DO NOT MATCH"
    : "Authorization Report";

  const decision = audit.final_decision;
  const verified = audit.verified_correct === true;
  const isReady = decision === "READY_FOR_USER_AUTHORIZATION" && verified;

  let recommendation;
  if (isReady) {
    recommendation = "READY FOR USER AUTHORIZATION";
  } else if (decision === "NO_GO") {
    recommendation = "NO-GO";
  } else {
    recommendation = "DO NOT AUTHORIZE; REQUEST FIX";
  }

  const lines = [];
  lines.push(`# ${heading} — ${authorizationId}`);
  lines.push("");
  lines.push("> This report does **not** commit, push, write repo files, or execute live apply.");
  lines.push("> The user remains the final authorization gate.");
  lines.push("");

  if (errors.length > 0) {
    lines.push("## Consistency Errors");
    lines.push("");
    for (const e of errors) lines.push(`- **${e}**`);
    lines.push("");
    lines.push("**DO NOT AUTHORIZE.** The inputs do not match. Fix and re-run.");
    return { report: lines.join("\n"), recommendation, isReady, errors };
  }

  const local = audit.local_reality_snapshot;

  lines.push("## 1. Task");
  lines.push(`- task_id: \`${task.task_id}\``);
  lines.push(`- mode: \`${task.mode}\``);
  lines.push(`- objective: ${task.objective}`);
  lines.push("");

  lines.push("## 2. Executor Result");
  lines.push(`- final_verdict: \`${result.final_verdict}\``);
  lines.push(`- claimed_changes: ${result.claimed_changes ?? "(none)"}`);
  lines.push(`- files_modified: ${(result.files_modified ?? []).length === 0 ? "(none)" : result.files_modified.join(", ")}`);
  lines.push(`- commands_run: ${(result.commands_run ?? []).length === 0 ? "(none)" : result.commands_run.join(", ")}`);
  lines.push("");

  lines.push("## 3. Audit Result");
  lines.push(`- audit_id: \`${audit.audit_id ?? "N/A"}\``);
  lines.push(`- final_decision: \`${decision}\``);
  lines.push(`- verified_correct: ${verified}`);
  lines.push("");

  if (audit.mismatches && audit.mismatches.length > 0) {
    lines.push("### Mismatches");
    for (const m of audit.mismatches) lines.push(`- ${m}`);
    lines.push("");
  }
  if (audit.ai_hallucinations_or_overclaims && audit.ai_hallucinations_or_overclaims.length > 0) {
    lines.push("### AI Hallucinations / Overclaims");
    for (const h of audit.ai_hallucinations_or_overclaims) lines.push(`- ${h}`);
    lines.push("");
  }
  if (audit.bugs_or_risks && audit.bugs_or_risks.length > 0) {
    lines.push("### Bugs / Risks");
    for (const b of audit.bugs_or_risks) lines.push(`- ${b}`);
    lines.push("");
  }
  if (audit.unknowns && audit.unknowns.length > 0) {
    lines.push("### Unknowns");
    for (const u of audit.unknowns) lines.push(`- ${u}`);
    lines.push("");
  }
  if (audit.forbidden_path_findings && audit.forbidden_path_findings.length > 0) {
    lines.push("### Forbidden Path Findings");
    for (const f of audit.forbidden_path_findings) lines.push(`- ${f}`);
    lines.push("");
  }

  lines.push("## 4. Local Reality Summary");
  if (local) {
    lines.push(`- branch: \`${local.branch ?? "?"}\``);
    lines.push(`- HEAD: \`${local.head_short ?? local.head ?? "?"}\``);
    lines.push(`- origin: \`${local.origin_head_short ?? "?"}\``);
    lines.push(`- ahead: ${local.ahead ?? "?"} / behind: ${local.behind ?? "?"}`);
    lines.push(`- working tree: ${local.working_tree_dirty ? "dirty" : "clean"}`);
    lines.push(`- diff --check empty: ${local.diff_check_empty === true ? "yes" : "no"}`);
    lines.push(`- roadmap diff empty: ${local.roadmap_diff_empty === true ? "yes" : "no"}`);
    lines.push(`- .gitignore diff empty: ${local.gitignore_diff_empty === true ? "yes" : "no"}`);
  }
  lines.push("");

  lines.push("## 5. Recommendation");
  lines.push(`**${recommendation}**`);
  lines.push("");

  lines.push("## 6. User Authorization Required");
  lines.push("Reply with ONE of:");
  lines.push("- `yes, authorize this result`");
  lines.push("- `no, request fix`");
  lines.push("- `abort task`");
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("This report does **not** commit, push, write repo files, or execute live apply.");
  lines.push("Generated by AGENT-BRIDGE-007 authorization report generator.");

  return { report: lines.join("\n"), recommendation, isReady, errors };
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    printUsage();
    process.exit(2);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.dryRun && args.writeReport) {
    process.stderr.write("error: --dry-run and --write-report are mutually exclusive.\n");
    process.exit(2);
  }
  if (!args.dryRun && !args.writeReport) {
    process.stderr.write(
      "error: exactly one of --dry-run or --write-report must be provided.\n",
    );
    printUsage();
    process.exit(2);
  }

  if (!args.repo) {
    process.stderr.write("error: --repo <path> is required\n");
    printUsage();
    process.exit(2);
  }
  if (!args.task) {
    process.stderr.write("error: --task <path> is required\n");
    printUsage();
    process.exit(2);
  }
  if (!args.result) {
    process.stderr.write("error: --result <path> is required\n");
    printUsage();
    process.exit(2);
  }
  if (!args.audit) {
    process.stderr.write("error: --audit <path> is required\n");
    printUsage();
    process.exit(2);
  }
  if (args.writeReport && !args.authorizationId) {
    process.stderr.write("error: --authorization-id <id> is required for --write-report\n");
    process.exit(2);
  }
  if (args.authorizationId) {
    const idErr = validateAuthorizationId(args.authorizationId);
    if (idErr !== null) {
      process.stderr.write(`error: invalid --authorization-id: ${idErr}\n`);
      process.exit(2);
    }
  }

  const repoRootRaw = args.repo;
  if (!isAbsolute(repoRootRaw)) {
    process.stderr.write("error: --repo path must be absolute\n");
    process.exit(2);
  }
  const repoRoot = resolve(repoRootRaw);
  const bridgeRoot = resolveBridgeRoot(args, repoRoot);

  // Load inputs.
  function loadJson(path, label) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      process.stderr.write(`error: failed to read ${label}: ${e.message}\n`);
      process.exit(2);
    }
  }

  const task = loadJson(args.task, "task packet");
  const result = loadJson(args.result, "result");
  const audit = loadJson(args.audit, "audit");

  const consistencyErrors = validateConsistency(task, result, audit);
  const { report, isReady } = generateReport(
    args.authorizationId ?? "DRY-RUN",
    task,
    result,
    audit,
    consistencyErrors,
  );

  if (args.dryRun) {
    process.stdout.write(report + "\n");
    process.exit(0);
  }

  // --write-report
  const hasErrors = consistencyErrors.length > 0;
  const authorizationsDir = join(bridgeRoot, "authorizations");
  mkdirSync(authorizationsDir, { recursive: true });
  const reportPath = resolve(authorizationsDir, `${args.authorizationId}.authorization.md`);

  // Enforce output path containment: the resolved reportPath must be
  // strictly inside the authorizations directory (not equal to it, not
  // outside it, not containing path traversal).
  const within =
    reportPath.startsWith(authorizationsDir + sep) &&
    reportPath !== authorizationsDir;
  if (!within) {
    process.stderr.write(
      `error: authorization report path must be inside ${authorizationsDir}/, got ${reportPath}\n`,
    );
    process.exit(2);
  }

  writeFileSync(reportPath, report + "\n", "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        authorization_id: args.authorizationId,
        report_path: reportPath,
        recommendation: hasErrors
          ? "DO NOT AUTHORIZE; INPUTS DO NOT MATCH"
          : isReady
            ? "READY FOR USER AUTHORIZATION"
            : "DO NOT AUTHORIZE; REQUEST FIX",
        inputs_consistent: !hasErrors,
      },
      null,
      2,
    ) + "\n",
  );

  process.exit(hasErrors ? 1 : 0);
}

main();
