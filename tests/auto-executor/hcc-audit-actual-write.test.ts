import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  executeAuditActualWrite,
  HCC_AUDIT_ACTUAL_WRITE_SCHEMA_VERSION,
  planAuditActualWrite,
  type HCCAuditActualWriteInput,
  type HCCAuditWriteDeps,
} from "../../src/shared/lib/hcc-audit-actual-write";

const REPO_ROOT = resolve(__dirname, "../..");
const HASH = "sha256:abc123";

function makePayload() {
  return {
    would_execute: false as const,
    real_execution_ready: false as const,
    unattended_ready: false as const,
    any_command_executed: false as const,
    executed_commands: [] as const,
    go_no_go: "NO-GO" as const,
    body: "explicit audit body for HCC real-execution readiness",
  };
}

function makeInput(
  overrides: Partial<HCCAuditActualWriteInput> = {},
): HCCAuditActualWriteInput {
  return {
    task_id: "PLAN-AUDIT-001",
    source_plan_ref: "plan:2026-06:task-audit-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-audit-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-001",
    planned_action_kind: "shell_command",
    whitelist_action_id: "wl-001",
    target_path: "docs/audit/hcc/2026-06-14/PLAN-AUDIT-001.md",
    audit_payload: makePayload(),
    ...overrides,
  };
}

function makeMockDeps() {
  const writes: Array<{ path: string; content: string }> = [];
  const dirs: Array<{ dir: string; recursive: boolean }> = [];
  const deps: HCCAuditWriteDeps = {
    writeFile: vi.fn((path: string, content: string) => {
      writes.push({ path, content });
    }),
    mkdir: vi.fn((dir: string, opts: { recursive: boolean }) => {
      dirs.push({ dir, recursive: opts.recursive });
    }),
  };
  return { deps, writes, dirs };
}

describe("HCC audit actual-write: plan (pure)", () => {
  it("valid input -> AUDIT-ACTUAL-WRITE-CANDIDATE", () => {
    const r = planAuditActualWrite(makeInput());
    expect(r.verdict).toBe("AUDIT-ACTUAL-WRITE-CANDIDATE");
  });

  it("candidate preserves task_id / source_plan_ref / authorization_id", () => {
    const r = planAuditActualWrite(makeInput());
    expect(r.task_id).toBe("PLAN-AUDIT-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-audit-001");
    expect(r.authorization_id).toBe("auth-audit-001");
    expect(r.target_path).toBe(
      "docs/audit/hcc/2026-06-14/PLAN-AUDIT-001.md",
    );
  });

  it("candidate keeps execution fields literal-false", () => {
    const r = planAuditActualWrite(makeInput());
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

  it("candidate has written=false (planning does not perform I/O)", () => {
    const r = planAuditActualWrite(makeInput());
    expect(r.written).toBe(false);
  });
});

describe("HCC audit actual-write: path guards (NO-GO)", () => {
  it("missing target_path -> NO-GO", () => {
    const r = planAuditActualWrite(makeInput({ target_path: "" }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("target_path");
  });

  it("target_path under ~/.hermes/** -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ target_path: "~/.hermes/audit/x.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/\.hermes|forbidden/);
  });

  it("target_path outside docs/audit/hcc/** -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ target_path: "docs/elsewhere/x.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("docs/audit/hcc");
  });

  it("target_path with disallowed extension -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ target_path: "docs/audit/hcc/x.txt" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/extension|\.md|\.json/);
  });

  it("target_path that is just the allowed prefix (no file) -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ target_path: "docs/audit/hcc" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("target_path that escapes via .. segments -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ target_path: "docs/audit/hcc/../escape.md" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC audit actual-write: input guards (NO-GO)", () => {
  it("missing task_id -> NO-GO", () => {
    const r = planAuditActualWrite(makeInput({ task_id: "" }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("missing authorization_id -> NO-GO", () => {
    const r = planAuditActualWrite(makeInput({ authorization_id: "" }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_id");
  });

  it("wrong runner_verdict -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({ runner_verdict: "NO-GO" as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("runner_verdict");
  });

  it("missing planned_action_id -> NO-GO", () => {
    const r = planAuditActualWrite(makeInput({ planned_action_id: "" }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_id");
  });
});

describe("HCC audit actual-write: payload shape guards (NO-GO)", () => {
  it("payload with would_execute=true (cast) -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({
        audit_payload: {
          ...makePayload(),
          would_execute: true as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/payload|would_execute|literal-false/);
  });

  it("payload with real_execution_ready=true (cast) -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({
        audit_payload: {
          ...makePayload(),
          real_execution_ready: true as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("payload with non-empty executed_commands (cast) -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({
        audit_payload: {
          ...makePayload(),
          executed_commands: ["ls"] as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("payload with go_no_go != NO-GO (cast) -> NO-GO", () => {
    const r = planAuditActualWrite(
      makeInput({
        audit_payload: {
          ...makePayload(),
          go_no_go: "GO" as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC audit actual-write: execute (injected writer)", () => {
  it("valid -> AUDIT-ACTUAL-WRITTEN, written=true, content includes body", async () => {
    const { deps, writes, dirs } = makeMockDeps();
    const r = await executeAuditActualWrite(makeInput(), deps);
    expect(r.verdict).toBe("AUDIT-ACTUAL-WRITTEN");
    expect(r.written).toBe(true);
    expect(dirs.length).toBe(1);
    expect(dirs[0].dir).toBe("docs/audit/hcc/2026-06-14");
    expect(dirs[0].recursive).toBe(true);
    expect(writes.length).toBe(1);
    expect(writes[0].path).toBe(
      "docs/audit/hcc/2026-06-14/PLAN-AUDIT-001.md",
    );
    expect(writes[0].content).toContain(
      "explicit audit body for HCC real-execution readiness",
    );
    expect(writes[0].content).toContain("would_execute: false");
    expect(writes[0].content).toContain("real_execution_ready: false");
    expect(writes[0].content).toContain('go_no_go: "NO-GO"');
  });

  it("NO-GO -> short-circuits, no writer / no mkdir calls", async () => {
    const { deps, writes, dirs } = makeMockDeps();
    const r = await executeAuditActualWrite(
      makeInput({ task_id: "" }),
      deps,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(writes.length).toBe(0);
    expect(dirs.length).toBe(0);
  });

  it("writer failure propagates as a thrown error (no swallowed I/O)", async () => {
    const deps: HCCAuditWriteDeps = {
      writeFile: vi.fn(() => {
        throw new Error("disk full");
      }),
      mkdir: vi.fn(),
    };
    await expect(executeAuditActualWrite(makeInput(), deps)).rejects.toThrow(
      "disk full",
    );
  });
});

describe("HCC audit actual-write: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_AUDIT_ACTUAL_WRITE_SCHEMA_VERSION).toBe("1.0.0");
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
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/real_execution_ready:\s*true/);
  });

  it("lib does NOT set would_execute: true", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/would_execute:\s*true/);
  });

  it("lib does NOT set any_command_executed: true", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/any_command_executed:\s*true/);
  });

  it("lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call ipcMain / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-actual-write.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });
});
