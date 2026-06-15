import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPlanFixtureObject,
  buildPlanFixtureJson,
  generatePlanFixture,
  validatePlanFixtureInput,
  buildDispatchAdapterFromPlanFixture,
  HCC_PLAN_FIXTURE_GENERATOR_SCHEMA_VERSION,
  type HCCPlanFixtureGeneratorInput,
} from "../../src/shared/lib/hcc-plan-fixture-generator";
import { parsePlanFixture } from "../../src/cli/hcc-terminal-plan-invoker";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import { planAuditActualWrite } from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");
const NOW = "2026-06-16T12:00:00.000Z";
const ISSUED = "2026-06-16T11:00:00.000Z";
const EXPIRES = "2026-06-16T13:00:00.000Z";
const HASH = "sha256:abc123";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-FIX-001",
      source_plan_ref: "plan:2026-06:task-fix-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-fix-001",
      authorization_scope: "controlled_real_execution_candidate",
      issued_at: ISSUED,
      expires_at: EXPIRES,
      one_shot: true,
      dry_run_verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
      dry_run_artifact_hash: HASH,
      reason: "explicit user authorization",
    },
    NOW,
  );
}

function makeRunner(authorization: ReturnType<typeof makeAuthorization>) {
  return evaluateControlledRealRunnerCandidate({
    task_id: "PLAN-FIX-001",
    source_plan_ref: "plan:2026-06:task-fix-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-fix-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-fix-001",
  });
}

function makeAuditPlan() {
  const plan = planAuditActualWrite({
    task_id: "PLAN-FIX-001",
    source_plan_ref: "plan:2026-06:task-fix-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-fix-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-fix-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-fix-001",
    target_path: "docs/audit/hcc/2026-06-16/PLAN-FIX-001.md",
    audit_payload: {
      would_execute: false as const,
      real_execution_ready: false as const,
      unattended_ready: false as const,
      any_command_executed: false as const,
      executed_commands: [] as const,
      go_no_go: "NO-GO" as const,
      body: "audit body",
    },
  });
  return { ...plan, verdict: "AUDIT-ACTUAL-WRITTEN" as const, written: true };
}

function makeRollbackPlan() {
  return planRollbackActualRecovery({
    task_id: "PLAN-FIX-001",
    source_plan_ref: "plan:2026-06:task-fix-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-fix-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-fix-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/fix-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeValidInput(
  overrides: Partial<HCCPlanFixtureGeneratorInput> = {},
): HCCPlanFixtureGeneratorInput {
  const authorization = makeAuthorization();
  return {
    task_id: "PLAN-FIX-001",
    source_plan_ref: "plan:2026-06:task-fix-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-fix-001",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-fix-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-fix-001",
    target_path: "src/shared/lib/notes/fix-001.md",
    authorization_result: authorization as unknown as Record<string, unknown>,
    runner_result: makeRunner(authorization) as unknown as Record<string, unknown>,
    audit_result: makeAuditPlan() as unknown as Record<string, unknown>,
    rollback_plan: makeRollbackPlan() as unknown as Record<string, unknown>,
    dispatch_backend: "file_write",
    dispatch_payload: {
      kind: "file",
      target_path: "src/shared/lib/notes/fix-001.md",
      content: "test",
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validatePlanFixtureInput
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: validatePlanFixtureInput", () => {
  it("valid input -> null", () => {
    expect(validatePlanFixtureInput(makeValidInput())).toBeNull();
  });

  it("empty task_id -> reason", () => {
    const r = validatePlanFixtureInput(makeValidInput({ task_id: "" }));
    expect(r).toContain("task_id");
  });

  it("unsupported planned_action_kind -> reason", () => {
    const r = validatePlanFixtureInput(
      makeValidInput({ planned_action_kind: "delete_file" as never }),
    );
    expect(r).toContain("planned_action_kind");
  });

  it("unsupported dispatch_backend -> reason", () => {
    const r = validatePlanFixtureInput(
      makeValidInput({ dispatch_backend: "rm_rf" as never }),
    );
    expect(r).toContain("dispatch_backend");
  });

  it("non-object authorization_result -> reason", () => {
    const r = validatePlanFixtureInput(
      makeValidInput({ authorization_result: "not-object" as never }),
    );
    expect(r).toContain("authorization_result");
  });

  it("array rollback_plan -> reason", () => {
    const r = validatePlanFixtureInput(
      makeValidInput({ rollback_plan: [] as never }),
    );
    expect(r).toContain("rollback_plan");
  });
});

// ---------------------------------------------------------------------------
// buildPlanFixtureObject / buildPlanFixtureJson
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: builders", () => {
  it("buildPlanFixtureObject includes all 15 required fields", () => {
    const obj = buildPlanFixtureObject(makeValidInput());
    const fields = [
      "task_id",
      "source_plan_ref",
      "requested_by_user",
      "authorization_id",
      "dry_run_artifact_hash",
      "planned_action_id",
      "planned_action_kind",
      "whitelist_action_id",
      "target_path",
      "authorization_result",
      "runner_result",
      "audit_result",
      "rollback_plan",
      "dispatch_backend",
      "dispatch_payload",
    ];
    for (const f of fields) {
      expect(obj).toHaveProperty(f);
    }
  });

  it("buildPlanFixtureObject preserves identity fields exactly", () => {
    const input = makeValidInput();
    const obj = buildPlanFixtureObject(input);
    expect(obj.task_id).toBe(input.task_id);
    expect(obj.source_plan_ref).toBe(input.source_plan_ref);
    expect(obj.requested_by_user).toBe(input.requested_by_user);
    expect(obj.authorization_id).toBe(input.authorization_id);
    expect(obj.dry_run_artifact_hash).toBe(input.dry_run_artifact_hash);
    expect(obj.planned_action_id).toBe(input.planned_action_id);
    expect(obj.planned_action_kind).toBe(input.planned_action_kind);
    expect(obj.whitelist_action_id).toBe(input.whitelist_action_id);
    expect(obj.target_path).toBe(input.target_path);
  });

  it("buildPlanFixtureObject does not mutate verdict objects", () => {
    const input = makeValidInput();
    const beforeAuth = JSON.stringify(input.authorization_result);
    const beforeRunner = JSON.stringify(input.runner_result);
    const beforeAudit = JSON.stringify(input.audit_result);
    const beforeRollback = JSON.stringify(input.rollback_plan);
    buildPlanFixtureObject(input);
    expect(JSON.stringify(input.authorization_result)).toBe(beforeAuth);
    expect(JSON.stringify(input.runner_result)).toBe(beforeRunner);
    expect(JSON.stringify(input.audit_result)).toBe(beforeAudit);
    expect(JSON.stringify(input.rollback_plan)).toBe(beforeRollback);
  });

  it("buildPlanFixtureJson produces valid parseable JSON", () => {
    const json = buildPlanFixtureJson(makeValidInput());
    const parsed = JSON.parse(json);
    expect(parsed.task_id).toBe("PLAN-FIX-001");
  });
});

// ---------------------------------------------------------------------------
// generatePlanFixture
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: generatePlanFixture", () => {
  it("valid input + writer -> ok and wrote_to_disk=true", async () => {
    const writer = vi.fn(async () => undefined);
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/plan-fix-001.json",
      writer,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.wrote_to_disk).toBe(true);
      expect(r.result.dry_run).toBe(false);
      expect(r.result.fixture_path).toBe("/tmp/plan-fix-001.json");
      expect(r.result.task_id).toBe("PLAN-FIX-001");
      expect(r.result.planned_action_id).toBe("act-fix-001");
      expect(r.result.go_no_go).toBe("NO-GO");
      expect(r.result.bytes).toBeGreaterThan(0);
      expect(writer).toHaveBeenCalledTimes(1);
    }
  });

  it("writer receives JSON content at fixture_path", async () => {
    const writer = vi.fn(async () => undefined);
    await generatePlanFixture(
      makeValidInput(),
      "/tmp/my-fixture.json",
      writer,
    );
    const [path, content] = writer.mock.calls[0] as [string, string];
    expect(path).toBe("/tmp/my-fixture.json");
    expect(typeof content).toBe("string");
    const parsed = JSON.parse(content);
    expect(parsed.task_id).toBe("PLAN-FIX-001");
  });

  it("no writer -> dry-run mode, wrote_to_disk=false", async () => {
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/should-not-write.json",
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.wrote_to_disk).toBe(false);
      expect(r.result.dry_run).toBe(true);
      expect(r.result.fixture_json).toContain("PLAN-FIX-001");
    }
  });

  it("input.dry_run=true forces no write even with writer", async () => {
    const writer = vi.fn(async () => undefined);
    const r = await generatePlanFixture(
      makeValidInput({ dry_run: true }),
      "/tmp/dry-run.json",
      writer,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.wrote_to_disk).toBe(false);
      expect(r.result.dry_run).toBe(true);
    }
    expect(writer).not.toHaveBeenCalled();
  });

  it("writer throws -> typed failure, no crash", async () => {
    const writer = vi.fn(async () => {
      throw new Error("EACCES: permission denied");
    });
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/no-access.json",
      writer,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("writer rejected");
  });

  it("invalid input -> typed failure, no write", async () => {
    const writer = vi.fn(async () => undefined);
    const r = await generatePlanFixture(
      makeValidInput({ task_id: "" }),
      "/tmp/bad.json",
      writer,
    );
    expect(r.ok).toBe(false);
    expect(writer).not.toHaveBeenCalled();
  });

  it("result.go_no_go is always NO-GO", async () => {
    const r1 = await generatePlanFixture(
      makeValidInput(),
      "/tmp/a.json",
    );
    const r2 = await generatePlanFixture(
      makeValidInput({ dry_run: true }),
      "/tmp/b.json",
      vi.fn(),
    );
    if (r1.ok) expect(r1.result.go_no_go).toBe("NO-GO");
    if (r2.ok) expect(r2.result.go_no_go).toBe("NO-GO");
  });

  it("result.bytes matches JSON content byte length", async () => {
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/bytestest.json",
    );
    if (r.ok) {
      const expected = Buffer.byteLength(r.result.fixture_json, "utf-8");
      expect(r.result.bytes).toBe(expected);
    }
  });

  it("result.schema_version is the canonical value", async () => {
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/sv.json",
    );
    if (r.ok) {
      expect(r.result.schema_version).toBe(
        HCC_PLAN_FIXTURE_GENERATOR_SCHEMA_VERSION,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Interop with parsePlanFixture (the CLI fixture parser)
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: parsePlanFixture interop", () => {
  it("generated fixture JSON is accepted by parsePlanFixture", async () => {
    const r = await generatePlanFixture(
      makeValidInput(),
      "/tmp/interop.json",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const parsed = parsePlanFixture(r.result.fixture_json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.fixture.task_id).toBe("PLAN-FIX-001");
      expect(parsed.fixture.planned_action_kind).toBe("file_write");
      expect(parsed.fixture.dispatch_backend).toBe("file_write");
      expect(parsed.fixture.dispatch_payload).toEqual({
        kind: "file",
        target_path: "src/shared/lib/notes/fix-001.md",
        content: "test",
      });
    }
  });

  it("generated fixture preserves verdict objects (4 prior results)", async () => {
    const input = makeValidInput();
    const r = await generatePlanFixture(input, "/tmp/verdicts.json");
    if (!r.ok) throw new Error("expected ok");
    const parsed = parsePlanFixture(r.result.fixture_json);
    if (!parsed.ok) throw new Error("parse failed");
    expect(parsed.fixture.authorization_result).toEqual(
      input.authorization_result,
    );
    expect(parsed.fixture.runner_result).toEqual(input.runner_result);
    expect(parsed.fixture.audit_result).toEqual(input.audit_result);
    expect(parsed.fixture.rollback_plan).toEqual(input.rollback_plan);
  });

  it("supports all three planned_action_kinds in interop", async () => {
    for (const kind of ["shell_command", "file_write", "config_patch"] as const) {
      const r = await generatePlanFixture(
        makeValidInput({ planned_action_kind: kind }),
        `/tmp/${kind}.json`,
      );
      if (!r.ok) throw new Error(`${kind} generation failed`);
      const parsed = parsePlanFixture(r.result.fixture_json);
      if (!parsed.ok) throw new Error(`${kind} parse failed`);
      expect(parsed.fixture.planned_action_kind).toBe(kind);
    }
  });
});

// ---------------------------------------------------------------------------
// Static source guard
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: static source guard", () => {
  it("source does not contain forbidden runtime surfaces", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-plan-fixture-generator.ts",
      ),
      "utf-8",
    );
    const stripped = src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const FORBIDDEN = [
      "spawn(",
      "exec(",
      "execSync(",
      "child_process",
      "setInterval(",
      "setTimeout(",
      "cron",
      "auto-arm",
      "auto_arm",
      "ipcMain",
      "BrowserWindow",
      "contextBridge",
      'go_no_go: "GO"',
      'go_no_go:"GO"',
      "night_run_ready: true",
      "night_run_ready:true",
      "submitDryRunAction",
      "~/.hermes",
    ];
    for (const forbidden of FORBIDDEN) {
      expect(stripped).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// buildDispatchAdapterFromPlanFixture (wiring)
// ---------------------------------------------------------------------------

describe("HCC plan fixture generator: buildDispatchAdapterFromPlanFixture", () => {
  function makeExecutors() {
    return {
      shell_executor: vi.fn(async (command_id: string) => ({ command_id })),
      writer: vi.fn(async () => ({ controlled_command_id: "wired-cc" })),
      patcher: vi.fn(async () => ({ controlled_command_id: "wired-cc" })),
    };
  }

  it("returns adapter with supportsKind true for shell/file/config", () => {
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "file_write",
        dispatch_payload: { target_path: "x", content: "y" },
      },
      makeExecutors(),
    );
    expect(adapter.supportsKind("shell_command")).toBe(true);
    expect(adapter.supportsKind("file_write")).toBe(true);
    expect(adapter.supportsKind("config_patch")).toBe(true);
  });

  it("dispatches file_write -> calls writer", async () => {
    const execs = makeExecutors();
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "file_write",
        dispatch_payload: {
          kind: "file",
          target_path: "src/notes/x.md",
          content: "hello",
        },
      },
      execs,
      () => "2026-06-16T00:00:00.000Z",
    );
    const r = await adapter.dispatch("act-wire-001", "file_write", "src/notes/x.md");
    expect(r.controlled_command_id).toBe("wired-cc");
    expect(execs.writer).toHaveBeenCalledTimes(1);
  });

  it("dispatches shell_command allowlisted -> calls shell_executor", async () => {
    const execs = makeExecutors();
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "shell_command",
        dispatch_payload: { argv: ["git", "status"] },
      },
      execs,
    );
    const r = await adapter.dispatch("act-wire-001", "shell_command", "x");
    expect(r.controlled_command_id).toContain("shell:");
    expect(execs.shell_executor).toHaveBeenCalledTimes(1);
  });

  it("dispatches config_patch -> calls patcher", async () => {
    const execs = makeExecutors();
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "config_patch",
        dispatch_payload: {
          target_path: "docs/config.json",
          patch: [{ key: "k", value: "v" }],
        },
      },
      execs,
    );
    const r = await adapter.dispatch(
      "act-wire-001",
      "config_patch",
      "docs/config.json",
    );
    expect(r.controlled_command_id).toBe("wired-cc");
    expect(execs.patcher).toHaveBeenCalledTimes(1);
  });

  it("dispatches in_memory -> no executor call", async () => {
    const execs = makeExecutors();
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "in_memory",
        dispatch_payload: null,
      },
      execs,
    );
    const r = await adapter.dispatch("act-wire-001", "in_memory", "x");
    expect(r.controlled_command_id).toContain("in-memory:");
    expect(execs.shell_executor).not.toHaveBeenCalled();
    expect(execs.writer).not.toHaveBeenCalled();
    expect(execs.patcher).not.toHaveBeenCalled();
  });

  it("non-allowlisted shell -> throws DENIED, executor not called", async () => {
    const execs = makeExecutors();
    const adapter = buildDispatchAdapterFromPlanFixture(
      {
        task_id: "PLAN-WIRE-001",
        planned_action_id: "act-wire-001",
        dispatch_backend: "shell_command",
        dispatch_payload: { argv: ["rm", "-rf", "/"] },
      },
      execs,
    );
    await expect(
      adapter.dispatch("act-wire-001", "shell_command", "x"),
    ).rejects.toThrow(/DENIED/);
    expect(execs.shell_executor).not.toHaveBeenCalled();
  });
});
