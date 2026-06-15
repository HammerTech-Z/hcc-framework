import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  handleHccUnattendedAppIpcRequest,
  HCC_UNATTENDED_APP_IPC_SCHEMA_VERSION,
  HCC_UNATTENDED_APP_IPC_CHANNEL,
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
    task_id: "PLAN-UNATT-IPC-001",
    source_plan_ref: "plan:2026-06:task-unatt-ipc-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-ipc-001",
    schedule_id: "sched-ipc-001",
    planned_action_id: "act-unatt-ipc-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/unatt-ipc-001.md",
    scheduler_window_start_iso: "2026-06-15T20:00:00Z",
    scheduler_window_end_iso: "2026-06-15T22:00:00Z",
    scheduler_window_tz: "Asia/Shanghai",
    ...overrides,
  };
}

describe("HCC app IPC handler: success path", () => {
  it("valid request -> entrypoint called once, returns dispatched result (entrypoint returns NO-GO via the no-op ready_result scaffold)", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(makeRequest());
    // The IPC handler's ready_result is a no-op scaffold; the
    // real entrypoint will surface that as NO-GO. The test
    // exercises the handler's own gate plumbing end-to-end.
    expect(r.verdict).toBe("NO-GO");
    expect(r.app_session_id).toBe("app-sess-001");
    expect(r.app_invocation_id).toBe("app-inv-001");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("with mocked entrypoint success -> APP-UNATTENDED-SCHEDULED-DISPATCHED", async () => {
    vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    ).mockResolvedValueOnce({
      schema_version: "1.0.0" as const,
      verdict: "APP-UNATTENDED-SCHEDULED-DISPATCHED" as const,
      reason: "all app identity gates satisfied and feature_flag_enabled=true",
      app_session_id: "app-sess-001",
      app_invocation_id: "app-inv-001",
      user_confirmation: true,
      explicit_unattended_trigger_token: "app-trigger-001",
      schedule_id: "sched-ipc-001",
      task_id: "PLAN-UNATT-IPC-001",
      source_plan_ref: "plan:2026-06:task-unatt-ipc-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-unatt-ipc-001",
      planned_action_id: "act-unatt-ipc-001",
      planned_action_kind: "file_write",
      controlled_command_id: "cc-ipc-001",
      any_command_executed: true,
      executed_commands: ["cc-ipc-001"] as const,
      subprocess_count: 1,
      would_execute: false as const,
      auto_executor_started: false as const,
      unattended_ready: true,
      night_run_ready: false as const,
      go_no_go: "NO-GO" as const,
      real_execution_ready: false as const,
    });
    const r = await handleHccUnattendedAppIpcRequest(makeRequest());
    expect(r.verdict).toBe("APP-UNATTENDED-SCHEDULED-DISPATCHED");
    expect(r.controlled_command_id).toBe("cc-ipc-001");
  });

  it("success preserves night_run_ready=false, go_no_go=NO-GO, auto_executor_started=false, would_execute=false, real_execution_ready=false", async () => {
    const r = await handleHccUnattendedAppIpcRequest(makeRequest());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });

  it("success includes a deterministic handled_at timestamp from deps.now", async () => {
    const fixed = Date.parse("2026-06-15T12:00:00.000Z");
    const r = await handleHccUnattendedAppIpcRequest(makeRequest(), {
      now: () => fixed,
    });
    expect(r.handled_at).toBe("2026-06-15T12:00:00.000Z");
  });
});

describe("HCC app IPC handler: NO-GO gates", () => {
  it("missing app_session_id -> NO-GO, entrypoint NOT called", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ app_session_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing or malformed");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing app_invocation_id -> NO-GO, entrypoint NOT called", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ app_invocation_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("user_confirmation=false -> NO-GO, entrypoint NOT called", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ user_confirmation: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing explicit trigger token -> NO-GO, entrypoint NOT called", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ explicit_unattended_trigger_token: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("feature_flag_enabled=false -> NO-GO, entrypoint NOT called", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ feature_flag_enabled: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing planned_action_kind -> NO-GO", async () => {
    const r = await handleHccUnattendedAppIpcRequest(
      makeRequest({ planned_action_kind: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("non-object payload (e.g. string) -> NO-GO", async () => {
    const r = await handleHccUnattendedAppIpcRequest("garbage");
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing or malformed");
  });

  it("null payload -> NO-GO", async () => {
    const r = await handleHccUnattendedAppIpcRequest(null);
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC app IPC handler: entrypoint propagation", () => {
  it("entrypoint returns NO-GO -> propagated deterministic NO-GO", async () => {
    vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    ).mockResolvedValueOnce({
      schema_version: "1.0.0" as const,
      verdict: "NO-GO" as const,
      reason: "entrypoint refused for testing",
      app_session_id: "app-sess-001",
      app_invocation_id: "app-inv-001",
      user_confirmation: true,
      explicit_unattended_trigger_token: "app-trigger-001",
      schedule_id: "sched-ipc-001",
      task_id: "PLAN-UNATT-IPC-001",
      source_plan_ref: "plan:2026-06:task-unatt-ipc-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-unatt-ipc-001",
      planned_action_id: "act-unatt-ipc-001",
      planned_action_kind: "file_write",
      controlled_command_id: "",
      any_command_executed: false,
      executed_commands: [] as const,
      subprocess_count: 0,
      would_execute: false as const,
      auto_executor_started: false as const,
      unattended_ready: false,
      night_run_ready: false as const,
      go_no_go: "NO-GO" as const,
      real_execution_ready: false as const,
    });
    const r = await handleHccUnattendedAppIpcRequest(makeRequest());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("entrypoint refused for testing");
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("entrypoint throws -> typed NO-GO with propagated reason", async () => {
    vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    ).mockRejectedValueOnce(new Error("entrypoint boom"));
    const r = await handleHccUnattendedAppIpcRequest(makeRequest());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("entrypoint boom");
  });
});

describe("HCC app IPC handler: schema + static guards", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_APP_IPC_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("channel name is hcc:unattended-scheduled-dispatch", () => {
    expect(HCC_UNATTENDED_APP_IPC_CHANNEL).toBe(
      "hcc:unattended-scheduled-dispatch",
    );
  });

  it("handler source preserves night_run_ready:false + go_no_go:NO-GO literals", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("handler source does NOT call ipcMain.handle (registration is out of scope)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/ipcMain\.handle/);
  });

  it("handler source does NOT call spawn / exec / child_process / timer / BrowserWindow / contextBridge", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("handler source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("handler source does NOT write to ~/.hermes", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.hermes/);
  });

  it("handler source does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/hcc-unattended-app.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
