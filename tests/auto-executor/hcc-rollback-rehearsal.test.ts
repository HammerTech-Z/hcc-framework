import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  rehearseRollback,
  isForbiddenRollbackStrategy,
  getHccRollbackRehearsalPosture,
  HCC_ROLLBACK_REHEARSAL_SCHEMA_VERSION,
  HCC_ROLLBACK_ALLOWED_STRATEGIES,
  HCC_ROLLBACK_FORBIDDEN_STRATEGIES,
  type HCCRollbackRehearsalPlan,
  type HCCRollbackStrategy,
} from "../../src/shared/lib/hcc-rollback-rehearsal";

const REPO_ROOT = resolve(__dirname, "../..");

function mkPlan(
  overrides: Partial<HCCRollbackRehearsalPlan> = {},
): HCCRollbackRehearsalPlan {
  return {
    schema_version: "1.0.0",
    plan_id: "RHB-001",
    target_commit: "ec1e8febc96d982638044caa544c356be0c2dc12",
    strategy: "git_revert_commit",
    proposed_commands: [
      "[DRY-RUN] git revert --no-edit ec1e8fe",
    ],
    verifier_checklist: [
      { id: "V-1", description: "revert commit is dry-run only", expected_outcome: "would_execute=false" },
      { id: "V-2", description: "executed_commands=[]", expected_outcome: "empty" },
    ],
    ...overrides,
  };
}

describe("HCC rollback rehearsal: forbidden strategies", () => {
  it("git_reset_hard is forbidden", () => {
    expect(isForbiddenRollbackStrategy("git_reset_hard")).toBe(true);
  });

  it("git_checkout_destructive is forbidden", () => {
    expect(isForbiddenRollbackStrategy("git_checkout_destructive")).toBe(true);
  });

  it("git_push is forbidden", () => {
    expect(isForbiddenRollbackStrategy("git_push")).toBe(true);
  });

  it("shell_spawn is forbidden", () => {
    expect(isForbiddenRollbackStrategy("shell_spawn")).toBe(true);
  });

  it("hermes_config_write is forbidden", () => {
    expect(isForbiddenRollbackStrategy("hermes_config_write")).toBe(true);
  });

  it("package_mutation is forbidden", () => {
    expect(isForbiddenRollbackStrategy("package_mutation")).toBe(true);
  });

  it("ipc_register is forbidden", () => {
    expect(isForbiddenRollbackStrategy("ipc_register")).toBe(true);
  });

  it("timer_register is forbidden", () => {
    expect(isForbiddenRollbackStrategy("timer_register")).toBe(true);
  });

  it("git_revert_commit is NOT forbidden", () => {
    expect(isForbiddenRollbackStrategy("git_revert_commit")).toBe(false);
  });

  it("drop_commit is NOT forbidden", () => {
    expect(isForbiddenRollbackStrategy("drop_commit")).toBe(false);
  });

  it("restore_file_from_origin is NOT forbidden", () => {
    expect(isForbiddenRollbackStrategy("restore_file_from_origin")).toBe(false);
  });

  it("abort_if_dirty_worktree is NOT forbidden", () => {
    expect(isForbiddenRollbackStrategy("abort_if_dirty_worktree")).toBe(false);
  });

  it("allowed list has 4 entries; forbidden list has 8 entries", () => {
    expect(HCC_ROLLBACK_ALLOWED_STRATEGIES.length).toBe(4);
    expect(HCC_ROLLBACK_FORBIDDEN_STRATEGIES.length).toBe(8);
  });
});

describe("HCC rollback rehearsal: clean rehearsal plan", () => {
  it("git_revert_commit rehearsal records would_execute=false and executed_commands=[]", () => {
    const r = rehearseRollback({ plan: mkPlan(), worktree_dirty: false });
    expect(r.decision).toBe("rehearse");
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.implies_real_execution).toBe(false);
    expect(r.implies_unattended).toBe(false);
  });

  it("drop_commit rehearsal is non-executing", () => {
    const r = rehearseRollback({
      plan: mkPlan({
        plan_id: "RHB-002",
        strategy: "drop_commit",
        proposed_commands: ["[DRY-RUN] git revert --no-commit ec1e8fe"],
      }),
      worktree_dirty: false,
    });
    expect(r.decision).toBe("rehearse");
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
  });

  it("restore_file_from_origin rehearsal is non-executing", () => {
    const r = rehearseRollback({
      plan: mkPlan({
        plan_id: "RHB-003",
        strategy: "restore_file_from_origin",
        proposed_commands: ["[DRY-RUN] git checkout origin/hermes-pro-main -- path/to/file"],
      }),
      worktree_dirty: false,
    });
    expect(r.decision).toBe("rehearse");
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
  });

  it("abort_if_dirty_worktree on clean worktree is rehearse (inert)", () => {
    const r = rehearseRollback({
      plan: mkPlan({ plan_id: "RHB-004", strategy: "abort_if_dirty_worktree" }),
      worktree_dirty: false,
    });
    expect(r.decision).toBe("rehearse");
    expect(r.reason).toContain("clean");
  });
});

describe("HCC rollback rehearsal: dirty worktree abort", () => {
  it("abort_if_dirty_worktree on dirty worktree refuses", () => {
    const r = rehearseRollback({
      plan: mkPlan({ plan_id: "RHB-005", strategy: "abort_if_dirty_worktree" }),
      worktree_dirty: true,
    });
    expect(r.decision).toBe("abort_dirty_worktree");
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
  });

  it("git_revert_commit on dirty worktree STILL rehearses (doesn't auto-abort)", () => {
    const r = rehearseRollback({
      plan: mkPlan(),
      worktree_dirty: true,
    });
    expect(r.decision).toBe("rehearse");
    expect(r.would_execute).toBe(false);
  });
});

describe("HCC rollback rehearsal: forbidden rollback strategy deny", () => {
  it.each(HCC_ROLLBACK_FORBIDDEN_STRATEGIES)(
    "denies forbidden strategy '%s'",
    (strategy) => {
      const r = rehearseRollback({
        plan: mkPlan({ strategy: strategy as HCCRollbackStrategy }),
        worktree_dirty: false,
      });
      expect(r.decision).toBe("deny");
      expect(r.reason).toContain("forbidden");
      expect(r.would_execute).toBe(false);
      expect(r.executed_commands).toEqual([]);
    },
  );
});

describe("HCC rollback rehearsal: does not imply real execution", () => {
  it("denies when caller claims implies_real_execution=true", () => {
    const r = rehearseRollback({
      plan: mkPlan(),
      worktree_dirty: false,
      implies_real_execution: true,
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("implies_real_execution");
  });
});

describe("HCC rollback rehearsal: does not imply unattended execution", () => {
  it("denies when caller claims implies_unattended=true", () => {
    const r = rehearseRollback({
      plan: mkPlan(),
      worktree_dirty: false,
      implies_unattended: true,
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("implies_unattended");
  });
});

describe("HCC rollback rehearsal: posture", () => {
  it("posture: would_execute=false, implies_real_execution=false, implies_unattended=false", () => {
    const p = getHccRollbackRehearsalPosture();
    expect(p.would_execute).toBe(false);
    expect(p.implies_real_execution).toBe(false);
    expect(p.implies_unattended).toBe(false);
    expect(p.night_run_ready).toBe(false);
    expect(p.go_no_go).toBe("NO-GO");
  });

  it("posture: total_allowed + total_forbidden = strategy enum size", () => {
    const p = getHccRollbackRehearsalPosture();
    expect(p.total_allowed).toBe(4);
    expect(p.total_forbidden).toBe(8);
  });
});

describe("HCC rollback rehearsal: schema + invariants", () => {
  it("schema version is 1.0.0", () => {
    expect(HCC_ROLLBACK_REHEARSAL_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor invariants: night_run_ready=false / go_no_go=NO-GO preserved", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC rollback rehearsal: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-rollback-rehearsal.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-rollback-rehearsal.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-rollback-rehearsal.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT contain git reset --hard / git checkout destructive / git push literals outside doc comments", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-rollback-rehearsal.ts"),
      "utf8",
    );
    // The literal string "git reset --hard" must not appear as a
    // command in the contract. The enum value `git_reset_hard` (no
    // spaces) is allowed because it is a strategy identifier.
    expect(src).not.toMatch(/git\s+reset\s+--hard/);
    expect(src).not.toMatch(/git\s+checkout\s+(?!--)/);
    // The enum value `git_push` is the only allowed form.
    expect(src).toMatch(/git_push/);
  });

  it("does NOT mention ~/.hermes outside forbidden-strategy doc list", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-rollback-rehearsal.ts"),
      "utf8",
    );
    // The contract has `hermes_config_write` as a forbidden enum
    // value. The path `~/.hermes` should not appear as a write
    // instruction in the contract. The string `~/.hermes` only
    // appears in doc comments listing forbidden surfaces; stripping
    // comments and re-counting write operations yields zero.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const writeMatches = stripped.match(/~\/\.hermes/g) ?? [];
    expect(writeMatches.length).toBe(0);
  });
});