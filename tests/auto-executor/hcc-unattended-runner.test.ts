import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  runUnattendedControlledDispatch,
  HCC_UNATTENDED_RUNNER_SCHEMA_VERSION,
  type HCCUnattendedRunnerInput,
} from "../../src/shared/lib/hcc-unattended-runner";

const REPO_ROOT = resolve(__dirname, "../..");

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-unattended-001" })),
  };
}

function makeReadyResult(
  overrides: Partial<{
    verdict: "UNATTENDED-READY-CANDIDATE" | "NO-GO";
    unattended_ready: boolean;
  }> = {},
) {
  return {
    schema_version: "1.0.0" as const,
    verdict: "UNATTENDED-READY-CANDIDATE" as const,
    reason: "all gates satisfied",
    task_id: "PLAN-UNATT-RUN-001",
    source_plan_ref: "plan:2026-06:task-unatt-run-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-run-001",
    enablement_verdict: "ENABLEMENT-CANDIDATE" as const,
    final_dispatch_verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" as const,
    unattended_ready: true,
    night_run_ready: false as const,
    go_no_go: "NO-GO" as const,
    auto_executor_started: false as const,
    would_execute: false as const,
    executed_commands: [] as const,
    subprocess_count: 0 as const,
    any_command_executed: false as const,
    real_execution_ready: false as const,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<HCCUnattendedRunnerInput> = {},
): HCCUnattendedRunnerInput {
  const adapter = makeMockAdapter();
  return {
    task_id: "PLAN-UNATT-RUN-001",
    source_plan_ref: "plan:2026-06:task-unatt-run-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-run-001",
    feature_flag_enabled: true,
    ready_result: makeReadyResult(),
    planned_action: {
      planned_action_id: "act-unatt-run-001",
      planned_action_kind: "file_write" as const,
      target_path: "src/shared/lib/notes/unatt-run-001.md",
    },
    dispatch_adapter: adapter,
    ...overrides,
  };
}

describe("HCC unattended runner: success path", () => {
  it("all gates pass -> CONTROLLED-UNATTENDED-RUNNER-DISPATCHED with controlled_command_id", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({ dispatch_adapter: adapter }),
    );
    expect(r.verdict).toBe("CONTROLLED-UNATTENDED-RUNNER-DISPATCHED");
    expect(r.controlled_command_id).toBe("cc-unattended-001");
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      "act-unatt-run-001",
      "file_write",
      "src/shared/lib/notes/unatt-run-001.md",
    );
  });

  it("success preserves any_command_executed=true, subprocess_count=1, executed_commands=[controlled_command_id]", async () => {
    const r = await runUnattendedControlledDispatch(makeInput());
    expect(r.any_command_executed).toBe(true);
    expect(r.subprocess_count).toBe(1);
    expect(r.executed_commands).toEqual(["cc-unattended-001"]);
  });

  it("success keeps night_run_ready=false, go_no_go=NO-GO, auto_executor_started=false, would_execute=false", async () => {
    const r = await runUnattendedControlledDispatch(makeInput());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });

  it("success keeps unattended_ready=true (owned by prior consumer)", async () => {
    const r = await runUnattendedControlledDispatch(makeInput());
    expect(r.unattended_ready).toBe(true);
  });
});

describe("HCC unattended runner: ready-result gate", () => {
  it("ready_result.verdict=NO-GO -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({
        ready_result: makeReadyResult({ verdict: "NO-GO" }),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("UNATTENDED-READY-CANDIDATE");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("ready_result.unattended_ready=false -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({
        ready_result: makeReadyResult({ unattended_ready: false }),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });
});

describe("HCC unattended runner: feature flag + identity", () => {
  it("feature_flag_enabled=false -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({ feature_flag_enabled: false, dispatch_adapter: adapter }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("ready_result.task_id mismatch -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({
        ready_result: makeReadyResult(),
        task_id: "OTHER",
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("ready_result.authorization_id mismatch -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runUnattendedControlledDispatch(
      makeInput({
        ready_result: makeReadyResult(),
        authorization_id: "auth-OTHER",
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });
});

describe("HCC unattended runner: adapter gates", () => {
  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await runUnattendedControlledDispatch(
      makeInput({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("adapter.supportsKind returns false -> NO-GO, dispatch NOT called", async () => {
    const adapter = {
      supportsKind: vi.fn(() => false),
      dispatch: vi.fn(async () => ({ controlled_command_id: "x" })),
    };
    const r = await runUnattendedControlledDispatch(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("does not support");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("adapter throws -> NO-GO with propagated reason", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("dispatch boom");
      }),
    };
    const r = await runUnattendedControlledDispatch(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch boom");
  });

  it("adapter returns empty controlled_command_id -> NO-GO", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(async () => ({ controlled_command_id: "" })),
    };
    const r = await runUnattendedControlledDispatch(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended runner: planned_action guards", () => {
  it("missing planned_action_id -> NO-GO", async () => {
    const r = await runUnattendedControlledDispatch(
      makeInput({
        planned_action: {
          planned_action_id: "",
          planned_action_kind: "file_write" as const,
          target_path: "x",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("unsupported planned_action_kind -> NO-GO", async () => {
    const r = await runUnattendedControlledDispatch(
      makeInput({
        planned_action: {
          planned_action_id: "act",
          planned_action_kind: "remote_exec" as never,
          target_path: "x",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended runner: NO-GO always keeps side-effect fields literal", () => {
  it("any NO-GO path preserves any_command_executed=false, subprocess_count=0, executed_commands=[]", async () => {
    const cases = [
      makeInput({ feature_flag_enabled: false }),
      makeInput({ ready_result: makeReadyResult({ verdict: "NO-GO" }) }),
      makeInput({ dispatch_adapter: undefined as never }),
    ];
    for (const c of cases) {
      const r = await runUnattendedControlledDispatch(c);
      expect(r.any_command_executed).toBe(false);
      expect(r.subprocess_count).toBe(0);
      expect(r.executed_commands).toEqual([]);
      expect(r.unattended_ready).toBe(false);
      expect(r.night_run_ready).toBe(false);
      expect(r.go_no_go).toBe("NO-GO");
    }
  });
});

describe("HCC unattended runner: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_RUNNER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT call spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-runner.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-runner.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-runner.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });
});
