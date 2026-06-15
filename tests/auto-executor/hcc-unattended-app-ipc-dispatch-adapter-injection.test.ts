import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  handleHccUnattendedAppIpcRequest,
  defaultNoOpDispatchAdapter,
  type HCCUnattendedAppIpcRequest,
  type HCCUnattendedAppIpcHandlerDeps,
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
    task_id: "PLAN-UNATT-ADAPTER-001",
    source_plan_ref: "plan:2026-06:task-unatt-adapter-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-adapter-001",
    schedule_id: "sched-adapter-001",
    planned_action_id: "act-unatt-adapter-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/unatt-adapter-001.md",
    scheduler_window_start_iso: "2026-06-15T20:00:00Z",
    scheduler_window_end_iso: "2026-06-15T22:00:00Z",
    scheduler_window_tz: "Asia/Shanghai",
    ...overrides,
  };
}

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-adapter-001" })),
  };
}

describe("HCC app IPC: dispatch adapter injection", () => {
  it("missing deps.dispatch_adapter -> uses default no-op, real entrypoint returns typed NO-GO", async () => {
    const r = await handleHccUnattendedAppIpcRequest(makeRequest(), {});
    expect(r.verdict).toBe("NO-GO");
    // The real entrypoint is called and blocks because
    // ready_result.verdict must be UNATTENDED-READY-CANDIDATE.
    // The scheduler window is valid here (makeRequest provides
    // valid window_start_iso / window_end_iso). The default
    // no-op adapter is used; the ready_result scaffold gate
    // is the blocking surface.
    expect(r.reason).toContain("UNATTENDED-READY-CANDIDATE");
  });

  it("injected dispatch_adapter is passed into entrypoint input via spy", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const adapter = makeMockAdapter();
    await handleHccUnattendedAppIpcRequest(makeRequest(), {
      dispatch_adapter: adapter as never,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const input = spy.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    // The adapter was passed through to scheduler_input.
    expect(input.scheduler_input.dispatch_adapter).toBe(adapter);
  });

  it("injected adapter supportsKind/dispatch are NOT called by the handler itself (handler only passes adapter through)", async () => {
    vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const adapter = makeMockAdapter();
    await handleHccUnattendedAppIpcRequest(makeRequest(), {
      dispatch_adapter: adapter as never,
    });
    // The handler should NOT call supportsKind or dispatch on the
    // adapter — the handler only passes the adapter to the
    // entrypoint's scheduler_input. The entrypoint itself calls
    // those functions, but the handler's own code never touches
    // the adapter beyond passing it through.
    expect(adapter.supportsKind).not.toHaveBeenCalled();
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("real entrypoint with injected adapter still returns NO-GO because ready_result is still not provided", async () => {
    const r = await handleHccUnattendedAppIpcRequest(makeRequest(), {
      dispatch_adapter: makeMockAdapter() as never,
    });
    // The entrypoint's gate is `ready_result.verdict must be
    // UNATTENDED-READY-CANDIDATE`. The injected adapter is
    // passed into the scheduler input, but the ready_result
    // scaffold is still NO-GO, so the entrypoint returns NO-GO.
    // This proves adapter injection AND ready_result are
    // independent concerns — the adapter can be injected now
    // but the dispatch still won't fire until ready_result is
    // also fixed (next slice).
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("UNATTENDED-READY-CANDIDATE");
  });

  it("malformed IPC payload does NOT call entrypoint, does NOT require adapter", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runAppUnattendedScheduledDispatch",
    );
    const r = await handleHccUnattendedAppIpcRequest(null, {
      dispatch_adapter: makeMockAdapter() as never,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("HCC app IPC: defaultNoOpDispatchAdapter", () => {
  it("supportsKind returns false", () => {
    const a = defaultNoOpDispatchAdapter();
    expect(a.supportsKind("shell_command")).toBe(false);
    expect(a.supportsKind("file_write")).toBe(false);
    expect(a.supportsKind("config_patch")).toBe(false);
  });

  it("dispatch throws", () => {
    const a = defaultNoOpDispatchAdapter();
    expect(() => a.dispatch("x", "file_write", "y")).toThrow(
      "no dispatch adapter injected",
    );
  });
});

describe("HCC app IPC: static guard — handler source does NOT contain direct execution surfaces", () => {
  function readSrc(f: string) {
    return readFileSync(resolve(REPO_ROOT, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("handler source does NOT call spawn/exec/child_process/timer/BrowserWindow/contextBridge", () => {
    const src = readSrc(
      "src/main/ipc-handlers/hcc-unattended-app.ts",
    );
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/ipcMain\.handle/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("handler source does NOT call submitDryRunAction", () => {
    const src = readSrc(
      "src/main/ipc-handlers/hcc-unattended-app.ts",
    );
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("handler source does NOT write to ~/.hermes/**", () => {
    const src = readSrc(
      "src/main/ipc-handlers/hcc-unattended-app.ts",
    );
    expect(src).not.toMatch(/\.hermes\//);
    expect(src).not.toMatch(/\.hermes\*\*/);
  });

  it("handler source has no runtime go_no_go: GO and no runtime night_run_ready: true", () => {
    const src = readSrc(
      "src/main/ipc-handlers/hcc-unattended-app.ts",
    );
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("handler source has night_run_ready:false + go_no_go:NO-GO literals", () => {
    const src = readSrc(
      "src/main/ipc-handlers/hcc-unattended-app.ts",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});
