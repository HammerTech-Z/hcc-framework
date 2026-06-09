#!/usr/bin/env node
// AGENT-BRIDGE-004 — deterministic local audit runner.
//
// This script audits a Claude result report against local repo reality.
// It does NOT:
//   - call codex
//   - call claude
//   - perform commit / push
//   - execute commands from the task packet or result report
//   - write to ~/.hermes/*
//   - write outside .agent-bridge/audits/ under --write-audit
//
// Claude result content is treated as untrusted text/data.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

function runGit(repo, args) {
  // Run git in repo; return { code, stdout, stderr }.
  const r = spawnSync("git", args, {
    encoding: "utf8",
    cwd: repo,
    timeout: 30000,
  });
  if (r.error) {
    return { code: -1, stdout: "", stderr: r.error.message };
  }
  return {
    code: r.status ?? -1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function statHer() {
  return {
    config_yaml: safeStatMtime("/Users/midoudou/.hermes/config.yaml"),
    handoff_packs: safeStatMtime("/Users/midoudou/.hermes/handoff/packs"),
    audit: safeStatMtime("/Users/midoudou/.hermes/audit"),
  };
}

function safeStatMtime(p) {
  const r = spawnSync("stat", ["-f", "%m", p], { encoding: "utf8", timeout: 5000 });
  if (r.status !== 0) return null;
  const v = (r.stdout ?? "").trim();
  return v.length > 0 ? Number(v) : null;
}

function readJsonOrText(p) {
  const raw = readFileSync(p, "utf8");
  let parsed = null;
  let parseError = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    parseError = e.message;
  }
  return { raw, parsed, parseError };
}

// -----------------------------------------------------------------
// CLI
// -----------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    repo: null,
    task: null,
    result: null,
    dryRun: false,
    writeAudit: false,
    auditId: null,
    bridgeRoot: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i] ?? null;
    else if (a === "--task") out.task = argv[++i] ?? null;
    else if (a === "--result") out.result = argv[++i] ?? null;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--write-audit") out.writeAudit = true;
    else if (a === "--audit-id") out.auditId = argv[++i] ?? null;
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
      "  node scripts/agent-bridge/audit-claude-result.mjs [options]",
      "",
      "Options:",
      "  --repo <path>          Path to repo root",
      "  --task <path>          Path to task packet JSON",
      "  --result <path>        Path to Claude result JSON or .md",
      "  --dry-run              Validate and print JSON; do not write",
      "  --write-audit          Write audit under <bridge-root>/audits/",
      "  --audit-id <id>        Audit identifier (required for --write-audit)",
      "  --bridge-root <path>   Optional; default = <repo>/.agent-bridge",
      "  --help, -h             Print this message",
      "",
      "Exactly one of --dry-run or --write-audit must be provided.",
      "Output schema: audit_id, verified_correct, final_decision, local_reality_snapshot,",
      "  claimed_facts, verified_facts, mismatches, ai_hallucinations_or_overclaims,",
      "  bugs_or_risks, unknowns, forbidden_path_findings.",
      "",
      "final_decision: ACCEPT | NEED_FIX | NO_GO | READY_FOR_USER_AUTHORIZATION",
      "",
    ].join("\n"),
  );
}

// -----------------------------------------------------------------
// Bridge-root sandboxing (mirror AGENT-BRIDGE-003A)
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
// Forbidden path detection
// -----------------------------------------------------------------

const HARD_FORBIDDEN_PATHS = [
  "~/.hermes/config.yaml",
  "~/.hermes/handoff/packs",
  "~/.hermes/audit",
  "docs/roadmap-locked-2026-05-28.md",
];

function isHardForbiddenPath(p) {
  if (typeof p !== "string") return false;
  for (const f of HARD_FORBIDDEN_PATHS) {
    if (p === f) return true;
  }
  if (p === "~/.hermes" || p.startsWith("~/.hermes/")) return true;
  return false;
}

// -----------------------------------------------------------------
// Task packet validation (audit-side)
// -----------------------------------------------------------------

const REQUIRED_FIELDS = [
  "schema_version",
  "task_id",
  "mode",
  "objective",
  "allowed_files",
  "forbidden_files",
  "allowed_commands",
  "forbidden_actions",
  "required_verification",
  "report_schema",
  "expected_authorization_type",
];

function validateTaskPacket(packet) {
  if (packet === null || typeof packet !== "object" || Array.isArray(packet)) {
    throw new Error("validate: task packet must be a JSON object");
  }
  for (const f of REQUIRED_FIELDS) {
    if (!(f in packet)) {
      throw new Error(`validate: task packet missing required field: ${f}`);
    }
  }
}

// -----------------------------------------------------------------
// Claim extraction (best-effort, schema-flexible)
// -----------------------------------------------------------------

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function extractClaims(result) {
  // result may be:
  //   (a) { final_verdict, files_modified:[], commands_run:[], claimed_changes, ... }
  //   (b) markdown text
  // We try (a) first; fall back to empty arrays.
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return {
      final_verdict: typeof result.final_verdict === "string" ? result.final_verdict : null,
      claimed_changes:
        typeof result.claimed_changes === "string" ? result.claimed_changes : null,
      files_modified: asArray(result.files_modified).map((x) =>
        typeof x === "string" ? x : x && typeof x.path === "string" ? x.path : null,
      ).filter((x) => typeof x === "string"),
      commands_run: asArray(result.commands_run).map((x) =>
        typeof x === "string" ? x : null,
      ).filter((x) => typeof x === "string"),
      raw_outputs_summary:
        typeof result.raw_outputs_summary === "string" ? result.raw_outputs_summary : null,
      not_done: typeof result.not_done === "string" ? result.not_done : null,
      known_unknowns: asArray(result.known_unknowns).map((x) =>
        typeof x === "string" ? x : null,
      ).filter((x) => typeof x === "string"),
      claimed_commit:
        typeof result.claimed_commit === "string" ? result.claimed_commit : null,
      claimed_pushed: result.claimed_pushed === true,
      claimed_push_state:
        result.claimed_push_state && typeof result.claimed_push_state === "object"
          ? result.claimed_push_state
          : null,
    };
  }
  return {
    final_verdict: null,
    claimed_changes: null,
    files_modified: [],
    commands_run: [],
    raw_outputs_summary: null,
    not_done: null,
    known_unknowns: [],
    claimed_commit: null,
    claimed_pushed: false,
    claimed_push_state: null,
  };
}

// -----------------------------------------------------------------
// Local reality snapshot
// -----------------------------------------------------------------

function snapshotLocalReality(repoRoot) {
  const branch = runGit(repoRoot, ["branch", "--show-current"]).stdout.trim();
  const headShort = runGit(repoRoot, ["rev-parse", "--short=12", "HEAD"]).stdout.trim();
  const headFull = runGit(repoRoot, ["rev-parse", "HEAD"]).stdout.trim();
  const originHeadShort = runGit(repoRoot, ["rev-parse", "--short=12", "origin/hermes-pro-main"]).stdout.trim();
  const originHeadFull = runGit(repoRoot, ["rev-parse", "origin/hermes-pro-main"]).stdout.trim();
  const ahead = Number(
    runGit(repoRoot, ["rev-list", "--count", "origin/hermes-pro-main..HEAD"]).stdout.trim(),
  );
  const behind = Number(
    runGit(repoRoot, ["rev-list", "--count", "HEAD..origin/hermes-pro-main"]).stdout.trim(),
  );
  const status = runGit(repoRoot, ["status", "--short", "-uall"]).stdout;
  const diffCheck = runGit(repoRoot, ["diff", "--check"]);
  const diffCheckEmpty = diffCheck.code === 0 && diffCheck.stdout === "" && diffCheck.stderr === "";
  const roadmapDiff = runGit(repoRoot, [
    "diff",
    "--",
    "docs/roadmap-locked-2026-05-28.md",
  ]);
  const roadmapEmpty = roadmapDiff.code === 0 && roadmapDiff.stdout === "";
  const gitignoreDiff = runGit(repoRoot, ["diff", "--", ".gitignore"]);
  const gitignoreEmpty = gitignoreDiff.code === 0 && gitignoreDiff.stdout === "";
  const hermes = statHer();
  return {
    repo_root: repoRoot,
    branch,
    head: headFull,
    head_short: headShort,
    origin_head_short: originHeadShort,
    origin_head: originHeadFull,
    ahead,
    behind,
    working_tree_status: status,
    working_tree_dirty: status.length > 0,
    diff_check_empty: diffCheckEmpty,
    roadmap_diff_empty: roadmapEmpty,
    gitignore_diff_empty: gitignoreEmpty,
    hermes_mtime: hermes,
  };
}

// -----------------------------------------------------------------
// Comparison
// -----------------------------------------------------------------

function arrayEq(a, b) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  for (const x of a) if (!sb.has(x)) return false;
  return true;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function compare(repoRoot, snapshot, claims) {
  const verified_correct = [];
  const mismatches = [];
  const ai_hallucinations_or_overclaims = [];
  const bugs_or_risks = [];
  const unknowns = [];
  const forbidden_path_findings = [];

  // Working tree: if clean, any "files modified" claim must match HEAD.
  // If dirty, claim must be a subset of `git status` output.
  const modifiedFromStatus = parseModifiedFromStatus(snapshot.working_tree_status);
  if (snapshot.working_tree_dirty) {
    for (const f of claims.files_modified) {
      if (modifiedFromStatus.has(f)) {
        verified_correct.push(`claimed file modified present in working tree: ${f}`);
      } else {
        mismatches.push(
          `claimed file modified not present in working tree (git status --short -uall): ${f}`,
        );
      }
    }
  } else {
    if (claims.files_modified.length > 0) {
      // Working tree is clean. Compare against HEAD.
      const headFiles = runGit(repoRoot, [
        "show",
        "--name-only",
        "--pretty=",
        "HEAD",
      ]);
      const headSet = new Set(
        headFiles.stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0),
      );
      for (const f of claims.files_modified) {
        if (headSet.has(f)) {
          verified_correct.push(`claimed file modified matches HEAD: ${f}`);
        } else {
          mismatches.push(
            `claimed file modified not in HEAD (working tree clean): ${f}`,
          );
        }
      }
    } else {
      verified_correct.push("no files_modified claim; working tree clean");
    }
  }

  // Forbidden paths.
  for (const f of claims.files_modified) {
    if (isHardForbiddenPath(f)) {
      forbidden_path_findings.push(
        `claimed file modified is hard-forbidden: ${f}`,
      );
    }
  }

  // Push / commit claims.
  if (claims.claimed_commit !== null) {
    // The result names a commit hash. Check that it exists locally.
    const claimed = claims.claimed_commit.trim();
    if (claimed.length === 0) {
      ai_hallucinations_or_overclaims.push(
        "result.claimed_commit is empty string",
      );
    } else {
      const exists = runGit(repoRoot, ["cat-file", "-t", claimed]);
      if (exists.code !== 0) {
        ai_hallucinations_or_overclaims.push(
          `result.claimed_commit not found in local repo: ${claimed}`,
        );
      } else {
        verified_correct.push(
          `result.claimed_commit exists in local repo: ${claimed}`,
        );
        if (claimed !== snapshot.head) {
          // Claimed commit exists but is not HEAD.
          if (
            claims.claimed_pushed &&
            snapshot.ahead === 0 &&
            snapshot.behind === 0
          ) {
            mismatches.push(
              `result.claimed_commit=${claimed} is not HEAD; ahead=0 and behind=0 suggest a stale or fabricated claim`,
            );
          } else {
            unknowns.push(
              `result.claimed_commit=${claimed} exists but is not HEAD; verify rebase state`,
            );
          }
        }
      }
    }
  }
  if (claims.claimed_pushed) {
    // A successful post-push state is consistent when:
    //   - claimed_commit exists locally AND equals local HEAD, and
    //     local is fully in sync with origin (ahead=0, behind=0)
    //   - OR claimed_push_state proves ALL of: head, origin_head, head==origin_head,
    //     ahead, behind, and ahead==0, behind==0
    // Otherwise, the push claim is suspect.
    const claimedCommit = claims.claimed_commit;
    if (claimedCommit === null) {
      // No claimed_commit. claimed_push_state must prove the post-push
      // invariants, including origin_head.
      const s = claims.claimed_push_state;
      const hasOriginHead =
        s && typeof s.origin_head === "string" && s.origin_head.length > 0;
      const headMatch = s && typeof s.head === "string" && s.head === snapshot.head;
      const originHeadMatch = hasOriginHead && s.origin_head === snapshot.origin_head;
      const aheadMatch = s && typeof s.ahead === "number" && s.ahead === snapshot.ahead;
      const behindMatch = s && typeof s.behind === "number" && s.behind === snapshot.behind;
      const bothZero = aheadMatch && behindMatch && s.ahead === 0 && s.behind === 0;
      const headEqualsOrigin = headMatch && originHeadMatch && s.head === s.origin_head;
      const canProve =
        s &&
        headMatch &&
        originHeadMatch &&
        aheadMatch &&
        behindMatch &&
        bothZero &&
        headEqualsOrigin;
      if (canProve) {
        verified_correct.push(
          "result.claimed_pushed=true consistent with claimed_push_state (head, origin_head, ahead, behind all match)",
        );
      } else if (!s) {
        // No claimed_push_state at all.
        unknowns.push(
          "result.claimed_pushed=true with no claimed_commit and no claimed_push_state; cannot verify push claim",
        );
      } else if (!hasOriginHead) {
        // claimed_push_state present but missing origin_head — required
        // to prove the pushed state when claimed_commit is absent.
        unknowns.push(
          "result.claimed_pushed=true with no claimed_commit and claimed_push_state missing origin_head; cannot verify push claim",
        );
      } else if (!originHeadMatch) {
        // origin_head provided but differs from local origin_head.
        mismatches.push(
          `result.claimed_push_state.origin_head=${s.origin_head} differs from local origin/hermes-pro-main=${snapshot.origin_head}`,
        );
        unknowns.push(
          "result.claimed_pushed=true with claimed_commit absent and origin_head mismatching; push state is suspect",
        );
      } else {
        // origin_head matches, but other invariants failed.
        unknowns.push(
          "result.claimed_pushed=true with no claimed_commit and claimed_push_state insufficient to prove pushed state (head/ahead/behind/head==origin_head); cannot fully verify",
        );
      }
    } else {
      // Has claimed_commit: verify it exists locally and equals HEAD.
      const exists = runGit(repoRoot, ["cat-file", "-t", claimedCommit]);
      if (exists.code !== 0) {
        ai_hallucinations_or_overclaims.push(
          `result.claimed_commit not found in local repo: ${claimedCommit}`,
        );
      } else if (
        claimedCommit !== snapshot.head ||
        snapshot.ahead !== 0 ||
        snapshot.behind !== 0
      ) {
        // Commit exists locally, but local state is not consistent with a
        // successful pushed claim. If local ahead > 0, it means there are
        // local unpushed commits — that is a real mismatch with the push
        // claim. If local behind > 0, origin is ahead of local — also
        // inconsistent with a successful push. If local is at the right
        // head but not at origin, the push claim is suspect.
        if (snapshot.ahead > 0) {
          mismatches.push(
            `result.claimed_pushed=true and claimed_commit=${claimedCommit} exists locally but local ahead=${snapshot.ahead} > 0 (unpushed commits remain)`,
          );
        } else if (snapshot.behind > 0) {
          mismatches.push(
            `result.claimed_pushed=true and local behind=${snapshot.behind} > 0 (origin is ahead of local)`,
          );
        } else {
          mismatches.push(
            `result.claimed_pushed=true and claimed_commit=${claimedCommit} exists but does not equal local HEAD=${snapshot.head}`,
          );
        }
      } else {
        // Commit exists, equals local HEAD, and local is fully in sync with
        // origin. The post-push state is verified.
        verified_correct.push(
          "result.claimed_pushed=true consistent with local HEAD and origin (ahead=0, behind=0)",
        );
      }
    }
  }
  if (
    claims.claimed_push_state &&
    typeof claims.claimed_push_state === "object"
  ) {
    const s = claims.claimed_push_state;
    if (typeof s.ahead === "number" && s.ahead !== snapshot.ahead) {
      mismatches.push(
        `result.claimed_push_state.ahead=${s.ahead} differs from local ahead=${snapshot.ahead}`,
      );
    }
    if (typeof s.behind === "number" && s.behind !== snapshot.behind) {
      mismatches.push(
        `result.claimed_push_state.behind=${s.behind} differs from local behind=${snapshot.behind}`,
      );
    }
    if (
      typeof s.head === "string" &&
      s.head !== snapshot.head
    ) {
      mismatches.push(
        `result.claimed_push_state.head=${s.head} differs from local HEAD=${snapshot.head}`,
      );
    }
  }
  if (snapshot.ahead > 0) {
    unknowns.push(
      `local ahead=${snapshot.ahead} > 0; result may be claiming a push that has not actually happened`,
    );
  }
  if (snapshot.behind > 0) {
    bugs_or_risks.push(
      `local behind=${snapshot.behind} > 0; HEAD is behind origin (verify rebase state)`,
    );
  }
  if (snapshot.working_tree_dirty && claims.files_modified.length === 0) {
    ai_hallucinations_or_overclaims.push(
      "working tree is dirty but result claims no files modified",
    );
  }
  if (!snapshot.diff_check_empty) {
    bugs_or_risks.push("git diff --check is not empty");
  } else {
    verified_correct.push("git diff --check empty");
  }
  if (!snapshot.roadmap_diff_empty) {
    bugs_or_risks.push("docs/roadmap-locked-2026-05-28.md has uncommitted changes");
  } else {
    verified_correct.push("roadmap diff empty");
  }
  if (!snapshot.gitignore_diff_empty) {
    bugs_or_risks.push(".gitignore has uncommitted changes");
  } else {
    verified_correct.push(".gitignore diff empty");
  }
  // Hermes baseline mtime presence check.
  if (
    snapshot.hermes_mtime.config_yaml === null ||
    snapshot.hermes_mtime.handoff_packs === null ||
    snapshot.hermes_mtime.audit === null
  ) {
    unknowns.push("~/.hermes baseline mtime not all readable");
  } else {
    verified_correct.push("~/.hermes baseline mtime readable");
  }

  // Raw outputs presence check.
  if (claims.raw_outputs_summary === null) {
    unknowns.push("result.raw_outputs_summary missing; cannot verify raw outputs");
  } else {
    verified_correct.push("result.raw_outputs_summary present");
  }

  return {
    verified_correct,
    mismatches,
    ai_hallucinations_or_overclaims,
    bugs_or_risks,
    unknowns,
    forbidden_path_findings,
  };
}

function parseModifiedFromStatus(statusText) {
  const out = new Set();
  for (const line of statusText.split("\n")) {
    if (!line || !line.trim()) continue;
    // Lines look like "M  path" or "?? path" or " M path"; path is the field after the 2-char status.
    const trimmed = line.replace(/^\?\? /, "").replace(/^.[AMDRC?!] /, "").replace(/^.[AMDRC?!]/, "");
    // Be defensive: just take the last whitespace-separated token.
    const parts = trimmed.split(/\s+/);
    const path = parts[parts.length - 1];
    if (path) out.add(path);
  }
  return out;
}

// -----------------------------------------------------------------
// Final decision
// -----------------------------------------------------------------

function decide(auditReport) {
  if (auditReport.forbidden_path_findings.length > 0) return "NO_GO";
  if (auditReport.bugs_or_risks.length > 0) return "NEED_FIX";
  if (auditReport.mismatches.length > 0) return "NEED_FIX";
  if (auditReport.ai_hallucinations_or_overclaims.length > 0) return "NEED_FIX";
  // unknowns (e.g. unprovable push state) must also block
  // READY_FOR_USER_AUTHORIZATION in AGENT-BRIDGE-004.
  if (auditReport.unknowns.length > 0) return "NEED_FIX";
  return "READY_FOR_USER_AUTHORIZATION";
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

  if (args.dryRun && args.writeAudit) {
    process.stderr.write(
      "error: --dry-run and --write-audit are mutually exclusive.\n",
    );
    process.exit(2);
  }
  if (!args.dryRun && !args.writeAudit) {
    process.stderr.write(
      "error: exactly one of --dry-run or --write-audit must be provided.\n",
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
  if (args.writeAudit && !args.auditId) {
    process.stderr.write("error: --audit-id <id> is required for --write-audit\n");
    process.exit(2);
  }

  const repoRootRaw = args.repo;
  if (!isAbsolute(repoRootRaw)) {
    process.stderr.write("error: --repo path must be absolute\n");
    process.exit(2);
  }
  const repoRoot = resolve(repoRootRaw);

  const bridgeRoot = resolveBridgeRoot(args, repoRoot);

  // Load task packet.
  let taskRaw;
  try {
    taskRaw = readFileSync(args.task, "utf8");
  } catch (e) {
    process.stderr.write(`error: failed to read task packet: ${e.message}\n`);
    process.exit(2);
  }
  let taskPacket;
  try {
    taskPacket = JSON.parse(taskRaw);
  } catch (e) {
    process.stderr.write(`error: task packet is not valid JSON: ${e.message}\n`);
    process.exit(2);
  }
  try {
    validateTaskPacket(taskPacket);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }

  // Load result.
  let resultRaw, resultParsed = null, resultParseError = null;
  try {
    resultRaw = readFileSync(args.result, "utf8");
  } catch (e) {
    process.stderr.write(`error: failed to read result: ${e.message}\n`);
    process.exit(2);
  }
  try {
    resultParsed = JSON.parse(resultRaw);
  } catch {
    // Result is not JSON; treat as markdown text.
    resultParsed = null;
    resultParseError = "result is not valid JSON; treating as markdown text";
  }
  const claims = extractClaims(resultParsed);

  const snapshot = snapshotLocalReality(repoRoot);
  const audit = compare(repoRoot, snapshot, claims);
  const final_decision = decide(audit);

  const auditReport = {
    audit_id: args.auditId ?? `audit-${snapshot.head_short}-${Date.now()}`,
    generated_at: nowIso(),
    task_id: taskPacket.task_id,
    claimed_facts: claims,
    local_reality_snapshot: snapshot,
    verified_facts: audit.verified_correct,
    verified_correct:
      final_decision === "READY_FOR_USER_AUTHORIZATION" ||
      final_decision === "ACCEPT",
    mismatches: audit.mismatches,
    ai_hallucinations_or_overclaims: audit.ai_hallucinations_or_overclaims,
    bugs_or_risks: audit.bugs_or_risks,
    unknowns: audit.unknowns,
    forbidden_path_findings: audit.forbidden_path_findings,
    final_decision,
    parse_notes: {
      result_parse_error: resultParseError,
    },
    note: "AGENT-BRIDGE-004 deterministic local audit; no Codex; no Claude; no commit/push.",
  };

  if (args.dryRun) {
    process.stdout.write(JSON.stringify(auditReport, null, 2) + "\n");
    process.exit(0);
  }

  // --write-audit
  const auditsDir = join(bridgeRoot, "audits");
  mkdirSync(auditsDir, { recursive: true });
  const auditPath = join(auditsDir, `${args.auditId}.audit.json`);
  writeFileSync(auditPath, JSON.stringify(auditReport, null, 2) + "\n", "utf8");
  process.stdout.write(
    JSON.stringify({ audit_id: args.auditId, audit_path: auditPath, final_decision }, null, 2) + "\n",
  );
  process.exit(0);
}

main();
