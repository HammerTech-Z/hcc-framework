import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  handleHccUnattendedAppIpcRequest,
  defaultNoGoReadyResult,
  type HCCUnattendedAppIpcRequest,
} from "../../src/main/ipc-handlers/hcc-unattended-app";
import * as entrypointModule from "../../src/shared/lib/hcc-unattended-app-entrypoint";

const REPO_ROOT = resolve(__dirname, "../..");

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(
  overrides: Partial<HCCUnattendedAppIpcRequest> = {},
): HCCUnattendedAppIpcRequest {
  return {
    app_session_id: "app-sess-001",
    app_invocation_id: "app-inv-001",
    user_confirmation: true,
    explicit_unattended_trigger_token: "app-trigger-001",
    feature_flag_enabled: true,
    task_id: "PLAN-UNATT-RR-001",
    source_plan_ref: "plan:2026-06:task-unatt-rr-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-rr-001",
    schedule_id: "sched-rr-001",
    planned_action_id: "act-unatt-rr-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/unatt-rr-001.md",
    scheduler_window_start_iso: "2026-06-15T20:00:00Z",
    scheduler_window_end_iso: "2026-06-15T22:00:00Z",
    scheduler_window_tz: "Asia/Shanghai",
    ...overrides,
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
    task_id: "PLAN-UNATT-RR-001",
    source_plan_ref: "plan:2026-06:task-unatt-rr-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-rr-001",
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

describe("HCC app IPC: ready_result injection", () => {
  it("missing deps.ready_result -> uses default scaffold, real entrypoint returns NO-GO (UNATTENDED-READY-CANDIDATE)", async () => {
    const r = await handleHccUnattendedAppIpcRequest(makeRequest(), {});
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("UNATTENDED-READY-CANDIDATE");
  });

  it("defaultNoGoReadyResult produces verdict: NO-GO, unattended_ready: false", () => {
    const rr = defaultNoGoReadyResult(makeRequest());
    expect(rr.verdict).toBe("NO-GO");
    expect(rr.unattended_ready).toBe(false);
    expect(rr.night_run_ready).toBe(false);
    expect(rr.go_no_go).toBe("NO-GO");
  });

  it("injected ready_result is passed into entrypoint input exactly", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const rr = makeReadyResult();
    await handleHccUnattendedAppIpcRequest(makeRequest(), {
      ready_result: rr,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const input = spy.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    expect(input.scheduler_input.ready_result).toBe(rr);
  });

  it("injected ready_result identity fields are not mutated by the handler", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const rr = makeReadyResult();
    await handleHccUnattendedAppIpcRequest(makeRequest(), {
      ready_result: rr,
    });
    const passed = spy.mock.calls[0]?.[0].scheduler_input.ready_result;
    expect(passed?.task_id).toBe(rr.task_id);
    expect(passed?.source_plan_ref).toBe(rr.source_plan_ref);
    expect(passed?.authorization_id).toBe(rr.authorization_id);
  });

  it("malformed IPC payload short-circuits, does NOT call entrypoint, does NOT require ready_result", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const rr = makeReadyResult();
    const r = await handleHccUnattendedAppIpcRequest(null, {
      ready_result: rr,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("ready_result injected + no dispatch_adapter -> entrypoint still returns NO-GO (default no-op adapter blocks)", async () => {
    // With a valid ready_result and the default no-op adapter,
    // the entrypoint's adapter support check fails because the
    // default adapter's `supportsKind` returns false. The block
    // is the adapter gate, NOT the ready_result gate.
    const r = await handleHccUnattendedAppIpcRequest(makeRequest(), {
      ready_result: makeReadyResult(),
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(
      /dispatch_adapter does not support planned_action_kind/,
    );
  });

  it("both ready_result + dispatch_adapter injected with mocked entrypoint -> both passed through together", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const rr = makeReadyResult();
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(async () => ({ controlled_command_id: "cc-rr-001" })),
    };
    await handleHccUnattendedAppIpcRequest(makeRequest(), {
      ready_result: rr,
      dispatch_adapter: adapter as never,
    });
    const input = spy.mock.calls[0]?.[0];
    expect(input.scheduler_input.ready_result).toBe(rr);
    expect(input.scheduler_input.dispatch_adapter).toBe(adapter);
  });
});

describe("HCC app IPC: static guard — handler source ready_result safety", () => {
  function readSrc(f: string) {
    return readFileSync(resolve(REPO_ROOT, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("handler source has no direct execution surfaces", () => {
    const src = readSrc("src/main/ipc-handlers/hcc-unattended-app.ts");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/ipcMain\.handle/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\.hermes\//);
    expect(src).not.toMatch(/\.hermes\*\*/);
  });

  it("handler source has no runtime go_no_go: GO and no runtime night_run_ready: true", () => {
    const src = readSrc("src/main/ipc-handlers/hcc-unattended-app.ts");
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("handler source preserves night_run_ready:false + go_no_go:NO-GO literals (fallback still present)", () => {
    const src = readSrc("src/main/ipc-handlers/hcc-unattended-app.ts");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});
