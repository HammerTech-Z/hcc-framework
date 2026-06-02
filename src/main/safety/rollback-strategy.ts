// P2.5 Rollback Strategy — pure main helper
// No IPC, no HCC, no CLI, no executor.
// Manages named rollback points on worktree resources.
// createRollbackPoint: records git state + diff, does NOT touch working tree.
// rollbackToPoint: validates, then applies reverse diff to revert changes.
// All writes go to rollbackDir / auditDir (never real project dirs).

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { AuditActor } from "@shared/lib/safety/types";
import { createAuditLogStore, DEFAULT_AUDIT_DIR } from "./audit-log";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface RollbackPoint {
  rollbackId: string;
  taskId: string;
  createdAt: string; // ISO 8601
  worktreePath: string;
  /** The git commit ref at the time the rollback point was created. */
  gitRef: string;
  /** Current status snapshot (git status --porcelain) at creation time. */
  statusSnapshot: string;
  /**
   * Forward diff (same as `git diff HEAD`).
   * Applying this diff with `git apply -R` reverses the changes made since
   * the rollback point was created (tracked files only).
   */
  diffContent: string;
  /**
   * Files that were CREATED by this task (untracked/new files).
   * These can be safely deleted during rollback.
   */
  createdFiles: string[];
  changedFiles: string[];
  actor: AuditActor;
  evidenceRef: string;
  /**
   * SHA-256 of statusSnapshot + diffContent + createdFiles.
   * Detects uncommitted worktree changes since the rollback point was created.
   * Does NOT include gitRef (new commits are allowed between create and rollback).
   */
  contentHash: string;
}

export interface CreateRollbackPointInput {
  taskId: string;
  worktreePath: string;
  actor: AuditActor;
  evidenceRef: string;
  reason: string;
  /** Files the task created (new, untracked) — used to determine deletability during rollback. */
  createdFiles?: string[];
}

export interface InspectRollbackPointInput {
  taskId: string;
  rollbackId: string;
}

export interface RollbackToPointInput {
  taskId: string;
  rollbackId: string;
  worktreePath: string;
  actor: AuditActor;
  evidenceRef: string;
}

export type RollbackDecision = "allow" | "deny" | "require_user_action" | "failed";
export type RollbackStatus = "success" | "deny" | "require_user_action" | "failed";

export interface RollbackResult {
  decision: RollbackDecision;
  status: RollbackStatus;
  rollbackPoint: RollbackPoint | null;
  reasons: string[];
  chainClean: number;
}

export interface InspectResult {
  rollbackPoint: RollbackPoint | null;
  exists: boolean;
  chainClean: number;
}

// -----------------------------------------------------------------
// Audit context builder
// -----------------------------------------------------------------

interface AuditContextLike {
  trust_level: "trusted_user" | "semi_trusted_local" | "untrusted_external" | "unattended_cron" | "archive_locked";
  requested_capability: "read_public" | "read_local" | "write_artifact" | "write_project" | "run_command" | "browser_action" | "credential_access" | "external_publish";
  allowed_capability_set: ("read_public" | "read_local" | "write_artifact" | "write_project" | "run_command" | "browser_action" | "credential_access" | "external_publish")[];
  matched_rule: string;
  allowlist_hit: string | null;
  path_check: "pass" | "fail" | "not_applicable";
  risk_level: "low" | "medium" | "high";
  resource_type?: "worktree" | "local_llm" | "gateway" | "browser";
  resource_id?: string;
  [key: string]: unknown;
}

function buildRollbackAuditContext(
  worktreePath: string,
  rollbackId: string,
  gitRef: string,
  changedFiles: string[],
  rollbackReason: string,
): AuditContextLike {
  return {
    trust_level: "trusted_user",
    requested_capability: "write_project",
    allowed_capability_set: [],
    matched_rule: "rollback",
    allowlist_hit: null,
    path_check: "not_applicable",
    risk_level: "medium",
    resource_type: "worktree",
    resource_id: worktreePath,
    rollback_id: rollbackId,
    git_ref: gitRef,
    changed_files: changedFiles,
    rollback_reason: rollbackReason,
  };
}

// -----------------------------------------------------------------
// Constants & path helpers
// -----------------------------------------------------------------

const DEFAULT_ROLLBACK_DIR = path.join(require("os").homedir(), ".hermes", "rollback");

function taskDir(rollbackDir: string, taskId: string): string {
  return path.join(rollbackDir, taskId);
}

function rollbackPointFile(rollbackDir: string, taskId: string, rollbackId: string): string {
  return path.join(taskDir(rollbackDir, taskId), `${rollbackId}.json`);
}

// -----------------------------------------------------------------
// Content hash — stable across new commits, detects uncommitted changes
// Does NOT include gitRef (new commits don't affect rollback validity).
// -----------------------------------------------------------------

function computeContentHash(statusSnapshot: string, diffContent: string, createdFiles: string[]): string {
  return crypto
    .createHash("sha256")
    .update([statusSnapshot, diffContent, [...createdFiles].sort().join("\n")].join("\n"))
    .digest("hex");
}

// -----------------------------------------------------------------
// Git helpers (spawn-based, no library)
// -----------------------------------------------------------------

/** Run `git -C {worktreePath} diff HEAD`. Returns empty if no changes. */
function getGitDiff(worktreePath: string): string {
  const { execSync } = require("child_process");
  try {
    return execSync("git -C " + JSON.stringify(worktreePath) + " diff HEAD", {
      encoding: "utf8",
      timeout: 10_000,
    });
  } catch (e: unknown) {
    if (typeof e === "object" && e && "status" in e && (e as { status: number }).status === 0) {
      return "";
    }
    throw e;
  }
}

/** Get current git commit short hash. */
function getGitRef(worktreePath: string): string {
  const { execSync } = require("child_process");
  return execSync(
    "git -C " + JSON.stringify(worktreePath) + " rev-parse --short HEAD",
    { encoding: "utf8", timeout: 10_000 },
  ).trim();
}

/** Get `git status --porcelain`. Returns empty string if clean. */
function getGitStatus(worktreePath: string): string {
  const { execSync } = require("child_process");
  try {
    return execSync(
      "git -C " + JSON.stringify(worktreePath) + " status --porcelain",
      { encoding: "utf8", timeout: 10_000 },
    );
  } catch (e: unknown) {
    if (typeof e === "object" && e && "status" in e && (e as { status: number }).status === 0) {
      return "";
    }
    throw e;
  }
}

/** Apply a forward diff in reverse via `git apply -R`. */
function applyReverseDiff(worktreePath: string, diffContent: string): { success: boolean; stderr?: string } {
  if (!diffContent.trim()) return { success: true };
  const { execSync } = require("child_process");
  try {
    execSync(
      "git -C " + JSON.stringify(worktreePath) + " apply -R --whitespace=nowarn",
      { input: diffContent, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    return { success: true };
  } catch (e: unknown) {
    const stderr =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "stderr" in e
          ? String((e as { stderr: unknown }).stderr)
          : String(e);
    return { success: false, stderr };
  }
}

// -----------------------------------------------------------------
// Rollback Manager
// -----------------------------------------------------------------

export interface RollbackManagerOptions {
  /** Parent rollback dir (default: ~/.hermes/rollback) */
  rollbackDir?: string;
  /** Audit dir (default: ~/.hermes/audit) */
  auditDir?: string;
}

export interface RollbackManager {
  createRollbackPoint(input: CreateRollbackPointInput): {
    decision: "allow" | "deny";
    rollbackPoint: RollbackPoint | null;
    reasons: string[];
    chainClean: number;
  };
  inspectRollbackPoint(input: InspectRollbackPointInput): InspectResult;
  rollbackToPoint(input: RollbackToPointInput): RollbackResult;
  listRollbackPoints(taskId: string): RollbackPoint[];
}

/**
 * Create a RollbackManager bound to the given rollback/audit directories.
 * These become the defaults for all operations on this manager instance.
 * Individual method calls can override via the per-method options if needed,
 * but here we bind them at construction time for testability.
 */
export function createRollbackManager(opts: RollbackManagerOptions = {}): RollbackManager {
  const _rollbackDir = opts.rollbackDir ?? DEFAULT_ROLLBACK_DIR;
  const _auditDir = opts.auditDir ?? DEFAULT_AUDIT_DIR;
  const _store = createAuditLogStore({ auditDir: _auditDir });

  // -----------------------------------------------------------------
  // createRollbackPoint
  // -----------------------------------------------------------------
  function doCreateRollbackPoint(input: CreateRollbackPointInput): {
    decision: "allow" | "deny";
    rollbackPoint: RollbackPoint | null;
    reasons: string[];
    chainClean: number;
  } {
    const reasons: string[] = [];
    let gitRef: string;
    let statusSnapshot: string;
    let diffContent: string;

    try {
      gitRef = getGitRef(input.worktreePath);
      statusSnapshot = getGitStatus(input.worktreePath);
      diffContent = getGitDiff(input.worktreePath);
    } catch (e: unknown) {
      const reason = `cannot read git state in worktree ${input.worktreePath}: ${e instanceof Error ? e.message : String(e)}`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "deny",
        context: buildRollbackAuditContext(input.worktreePath, "(error)", "(error)", [], reason),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "deny", rollbackPoint: null, reasons, chainClean: _store.verify(input.taskId) };
    }

    const changedFiles = statusSnapshot
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter((f) => f && !f.startsWith("?? "));

    const createdFiles = input.createdFiles ?? [];
    // contentHash excludes gitRef — new commits between create and rollback are allowed
    const contentHash = computeContentHash(statusSnapshot, diffContent, createdFiles);
    const rollbackId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const rollbackPoint: RollbackPoint = {
      rollbackId,
      taskId: input.taskId,
      createdAt,
      worktreePath: input.worktreePath,
      gitRef,
      statusSnapshot,
      diffContent,
      createdFiles,
      changedFiles,
      actor: input.actor,
      evidenceRef: input.evidenceRef,
      contentHash,
    };

    // Persist to rollbackDir (never touches the worktree itself)
    const td = taskDir(_rollbackDir, input.taskId);
    fs.mkdirSync(td, { recursive: true });
    fs.writeFileSync(rollbackPointFile(_rollbackDir, input.taskId, rollbackId), JSON.stringify(rollbackPoint), "utf8");

    _store.append({
      task_id: input.taskId,
      actor: input.actor,
      event: "rollback",
      decision: "allow",
      context: buildRollbackAuditContext(input.worktreePath, rollbackId, gitRef, changedFiles, input.reason),
      evidence_ref: input.evidenceRef,
    });

    return { decision: "allow", rollbackPoint, reasons, chainClean: _store.verify(input.taskId) };
  }

  // -----------------------------------------------------------------
  // inspectRollbackPoint
  // -----------------------------------------------------------------
  function doInspectRollbackPoint(input: InspectRollbackPointInput): InspectResult {
    const filePath = rollbackPointFile(_rollbackDir, input.taskId, input.rollbackId);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const rp = JSON.parse(raw) as RollbackPoint;
        return { rollbackPoint: rp, exists: true, chainClean: _store.verify(input.taskId) };
      } catch {
        return { rollbackPoint: null, exists: false, chainClean: _store.verify(input.taskId) };
      }
    }
    return { rollbackPoint: null, exists: false, chainClean: _store.verify(input.taskId) };
  }

  // -----------------------------------------------------------------
  // rollbackToPoint
  // -----------------------------------------------------------------
  function doRollbackToPoint(input: RollbackToPointInput): RollbackResult {
    const reasons: string[] = [];
    const filePath = rollbackPointFile(_rollbackDir, input.taskId, input.rollbackId);

    if (!fs.existsSync(filePath)) {
      const reason = `rollback point ${input.rollbackId} not found for task ${input.taskId}`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "deny",
        context: buildRollbackAuditContext(input.worktreePath, input.rollbackId, "(not_found)", [], reason),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "deny", status: "deny", rollbackPoint: null, reasons, chainClean: _store.verify(input.taskId) };
    }

    let rollbackPoint: RollbackPoint;
    try {
      rollbackPoint = JSON.parse(fs.readFileSync(filePath, "utf8")) as RollbackPoint;
    } catch (e) {
      const reason = `corrupt rollback point file: ${e instanceof Error ? e.message : String(e)}`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "deny",
        context: buildRollbackAuditContext(input.worktreePath, input.rollbackId, "(corrupt)", [], reason),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "failed", status: "failed", rollbackPoint: null, reasons, chainClean: _store.verify(input.taskId) };
    }

    // Rule: rollback must target the same worktree that created the rollback point
    if (rollbackPoint.worktreePath !== input.worktreePath) {
      const reason = `worktree mismatch: rollback point was created for ${rollbackPoint.worktreePath}, but rollback targets ${input.worktreePath}`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "deny",
        context: buildRollbackAuditContext(input.worktreePath, input.rollbackId, rollbackPoint.gitRef, [], reason),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "deny", status: "deny", rollbackPoint, reasons, chainClean: _store.verify(input.taskId) };
    }

    // Verify content hash — detects uncommitted worktree changes since the rollback point
    // Note: does NOT check gitRef; new commits are allowed
    const currentStatus = getGitStatus(input.worktreePath);
    const currentDiff = getGitDiff(input.worktreePath);
    const currentHash = computeContentHash(currentStatus, currentDiff, rollbackPoint.createdFiles);

    if (currentHash !== rollbackPoint.contentHash) {
      const reason = `uncommitted changes detected in worktree since rollback point was created. Manual resolution required.`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "need_approval",
        context: buildRollbackAuditContext(
          input.worktreePath,
          input.rollbackId,
          rollbackPoint.gitRef,
          rollbackPoint.changedFiles,
          reason,
        ),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "require_user_action", status: "require_user_action", rollbackPoint, reasons, chainClean: _store.verify(input.taskId) };
    }

    // Apply reverse diff to revert tracked file changes
    const applyResult = applyReverseDiff(input.worktreePath, rollbackPoint.diffContent);
    if (!applyResult.success) {
      const reason = `git apply -R failed: ${applyResult.stderr ?? "unknown error"}. The diff could not be cleanly reversed. Manual resolution required.`;
      reasons.push(reason);
      _store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "rollback",
        decision: "need_approval",
        context: buildRollbackAuditContext(
          input.worktreePath,
          input.rollbackId,
          rollbackPoint.gitRef,
          rollbackPoint.changedFiles,
          reason,
        ),
        evidence_ref: input.evidenceRef,
      });
      return { decision: "require_user_action", status: "require_user_action", rollbackPoint, reasons, chainClean: _store.verify(input.taskId) };
    }

    // Delete files created by this task that still exist after the reverse diff
    for (const file of rollbackPoint.createdFiles) {
      const abs = path.isAbsolute(file) ? file : path.join(input.worktreePath, file);
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch {
          // Non-fatal: file may have been removed by the reverse diff already
        }
      }
    }

    _store.append({
      task_id: input.taskId,
      actor: input.actor,
      event: "rollback",
      decision: "allow",
      context: buildRollbackAuditContext(
        input.worktreePath,
        input.rollbackId,
        rollbackPoint.gitRef,
        rollbackPoint.changedFiles,
        "rollback completed",
      ),
      evidence_ref: input.evidenceRef,
    });

    return { decision: "allow", status: "success", rollbackPoint, reasons, chainClean: _store.verify(input.taskId) };
  }

  // -----------------------------------------------------------------
  // listRollbackPoints
  // -----------------------------------------------------------------
  function doListRollbackPoints(taskId: string): RollbackPoint[] {
    const td = taskDir(_rollbackDir, taskId);
    if (!fs.existsSync(td)) return [];
    const files = fs.readdirSync(td).filter((f) => f.endsWith(".json"));
    const points: RollbackPoint[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(td, file), "utf8");
        points.push(JSON.parse(raw) as RollbackPoint);
      } catch {
        // Skip corrupt entries
      }
    }
    return points.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    createRollbackPoint: doCreateRollbackPoint,
    inspectRollbackPoint: doInspectRollbackPoint,
    rollbackToPoint: doRollbackToPoint,
    listRollbackPoints: doListRollbackPoints,
  };
}