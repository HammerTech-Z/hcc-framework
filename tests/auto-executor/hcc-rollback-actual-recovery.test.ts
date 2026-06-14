import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  HCC_ROLLBACK_ACTUAL_RECOVERY_SCHEMA_VERSION,
  planRollbackActualRecovery,
  resolveRollbackActualRecovery,
  type HCCRollbackActualRecoveryInput,
  type HCCRollbackRecoveryAdapter,
} from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");

function makeInput(
  overrides: Partial<HCCRollbackActualRecoveryInput> = {},
): HCCRollbackActualRecoveryInput {
  return {
    task_id: "PLAN-RB-001",
    source_plan_ref: "plan:2026-06:task-rb-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-rb-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/rb-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
    ...overrides,
  };
}

describe("HCC rollback actual-recovery: valid plan", () => {
  it("all checks pass -> ROLLBACK-ACTUAL-RECOVERY-CANDIDATE", () => {
    const r = planRollbackActualRecovery(makeInput());
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
  });

  it("candidate preserves task / action / strategy identity", () => {
    const r = planRollbackActualRecovery(makeInput());
    expect(r.task_id).toBe("PLAN-RB-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-rb-001");
    expect(r.authorization_id).toBe("auth-rb-001");
    expect(r.planned_action_id).toBe("act-001");
    expect(r.planned_action_kind).toBe("file_write");
    expect(r.target_path).toBe("src/shared/lib/notes/rb-001.md");
    expect(r.before_hash).toBe("sha256:before");
    expect(r.after_hash).toBe("sha256:after");
    expect(r.recovery_strategy).toBe("restore_file_from_snapshot");
  });

  it("candidate keeps execution fields literal-false", () => {
    const r = planRollbackActualRecovery(makeInput());
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate has performed=false (planning does not roll back)", () => {
    const r = planRollbackActualRecovery(makeInput());
    expect(r.performed).toBe(false);
  });
});

describe("HCC rollback actual-recovery: strategy allow-list", () => {
  it("restore_file_from_snapshot is allowed", () => {
    const r = planRollbackActualRecovery(
      makeInput({ recovery_strategy: "restore_file_from_snapshot" }),
    );
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
  });

  it("restore_file_from_origin is allowed", () => {
    const r = planRollbackActualRecovery(
      makeInput({ recovery_strategy: "restore_file_from_origin" }),
    );
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
  });

  it("abort_if_dirty_worktree is allowed", () => {
    const r = planRollbackActualRecovery(
      makeInput({ recovery_strategy: "abort_if_dirty_worktree" }),
    );
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
  });

  it("forbidden strategy (cast) -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ recovery_strategy: "force_overwrite" as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("recovery_strategy");
  });
});

describe("HCC rollback actual-recovery: path scope (NO-GO)", () => {
  it("target_path starts with ~ -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "~/.hermes/audit/x.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/repo-local|~|forbidden/);
  });

  it("target_path uses .. traversal -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "docs/audit/hcc/../escape.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("target_path outside docs/ and src/ -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "tmp/x.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/repo-local/);
  });

  it("target_path is src/main/index.ts -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "src/main/index.ts" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/forbidden/);
  });

  it("target_path is package.json -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "package.json" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("target_path is package-lock.json -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "package-lock.json" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("target_path under docs/knowledge/** -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ target_path: "docs/knowledge/foo.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/forbidden/);
  });
});

describe("HCC rollback actual-recovery: predecessor verdicts", () => {
  it("runner_verdict missing (cast) -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ runner_verdict: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("runner_verdict");
  });

  it("audit_write_verdict missing (cast) -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ audit_write_verdict: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("audit_write_verdict");
  });
});

describe("HCC rollback actual-recovery: input guards", () => {
  it("missing task_id -> NO-GO", () => {
    const r = planRollbackActualRecovery(makeInput({ task_id: "" }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("missing authorization_id -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ authorization_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_id");
  });

  it("missing planned_action_id -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ planned_action_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_id");
  });

  it("before_hash equals after_hash -> NO-GO", () => {
    const r = planRollbackActualRecovery(
      makeInput({ before_hash: "x", after_hash: "x" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/before_hash|nothing to roll back/);
  });
});

describe("HCC rollback actual-recovery: resolve with mock adapter", () => {
  it("restore_file_from_snapshot with adapter providing blob -> resolved=true", () => {
    const adapter: HCCRollbackRecoveryAdapter = {
      readSnapshot: vi.fn(() => "snapshot content"),
    };
    const r = resolveRollbackActualRecovery(makeInput(), adapter);
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
    expect(r.resolved).toBe(true);
  });

  it("restore_file_from_snapshot with adapter returning null -> NO-GO", () => {
    const adapter: HCCRollbackRecoveryAdapter = {
      readSnapshot: vi.fn(() => null),
    };
    const r = resolveRollbackActualRecovery(makeInput(), adapter);
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/snapshot blob not found/);
  });

  it("restore_file_from_origin with adapter providing blob -> resolved=true", () => {
    const adapter: HCCRollbackRecoveryAdapter = {
      readOrigin: vi.fn(() => "origin content"),
    };
    const r = resolveRollbackActualRecovery(
      makeInput({ recovery_strategy: "restore_file_from_origin" }),
      adapter,
    );
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
    expect(r.resolved).toBe(true);
  });

  it("abort_if_dirty_worktree with clean adapter -> resolved=true", () => {
    const adapter: HCCRollbackRecoveryAdapter = {
      isWorktreeDirty: vi.fn(() => false),
    };
    const r = resolveRollbackActualRecovery(
      makeInput({ recovery_strategy: "abort_if_dirty_worktree" }),
      adapter,
    );
    expect(r.verdict).toBe("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
    expect(r.resolved).toBe(true);
  });

  it("abort_if_dirty_worktree with dirty adapter -> NO-GO", () => {
    const adapter: HCCRollbackRecoveryAdapter = {
      isWorktreeDirty: vi.fn(() => true),
    };
    const r = resolveRollbackActualRecovery(
      makeInput({ recovery_strategy: "abort_if_dirty_worktree" }),
      adapter,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/dirty/);
  });

  it("adapter is NOT called when planner already NO-GO", () => {
    const readSnapshot = vi.fn(() => "x");
    const r = resolveRollbackActualRecovery(
      makeInput({ task_id: "" }),
      { readSnapshot },
    );
    expect(r.verdict).toBe("NO-GO");
    expect(readSnapshot).not.toHaveBeenCalled();
  });
});

describe("HCC rollback actual-recovery: NO-GO preserves literal-false", () => {
  it("any NO-GO keeps execution fields literal-false and performed=false", () => {
    const r = planRollbackActualRecovery(
      makeInput({ task_id: "" }),
    );
    expect(r.performed).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC rollback actual-recovery: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_ROLLBACK_ACTUAL_RECOVERY_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT set real_execution_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/real_execution_ready:\s*true/);
  });

  it("lib does NOT set would_execute: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/would_execute:\s*true/);
  });

  it("lib does NOT set any_command_executed: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/any_command_executed:\s*true/);
  });

  it("lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("lib does NOT call git reset --hard or git checkout --", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/git\s+reset\s+--hard/);
    expect(src).not.toMatch(/git\s+checkout\s+--/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-rollback-actual-recovery.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
