import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  handleHccUnattendedAppIpcInstallGesture,
  HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
  type HCCUnattendedAppIpcInstallGestureDeps,
} from "../../src/main/ipc-handlers/wire-hcc-unattended-app-ipc";
import * as installerModule from "../../src/main/ipc-handlers/install-hcc-unattended-app";
import * as handlerModule from "../../src/main/ipc-handlers/hcc-unattended-app";
import { HCC_UNATTENDED_APP_IPC_CHANNEL } from "../../src/main/ipc-handlers/hcc-unattended-app";

const REPO_ROOT = resolve(__dirname, "../..");

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeMockIpcMain() {
  return { handle: vi.fn() };
}

function makeGesturePayload() {
  return {
    user_confirmation: true,
    explicit_unattended_trigger_token: "wire-prod-001",
    feature_flag_enabled: true,
  };
}

function makeMockDeps(overrides: Partial<HCCUnattendedAppIpcInstallGestureDeps> = {}) {
  return {
    ipcMainLike: makeMockIpcMain(),
    stateStore: { installed: false },
    ...overrides,
  } as HCCUnattendedAppIpcInstallGestureDeps;
}

function makeOkInstallResult() {
  return {
    schema_version: "1.0.0" as const,
    verdict: "INSTALLED" as const,
    reason: "armed",
    channel: "hcc:unattended-scheduled-dispatch",
    handler_count: 1,
    installed_at: "2026-06-15T12:00:00.000Z",
  };
}

describe("HCC production wiring: no production deps provided", () => {
  it("installer called with handler_deps undefined -> safe NO-GO fallback", async () => {
    const installSpy = vi
      .spyOn(installerModule, "installHccUnattendedAppIpc")
      .mockReturnValue(makeOkInstallResult());
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makeGesturePayload(),
      makeMockDeps(),
    );
    expect(r.gesture_verdict).toBe("INSTALLED");
    // installer was called with handler_deps undefined (no
    // production wiring provided).
    expect(installSpy).toHaveBeenCalledTimes(1);
    const installerDeps = installSpy.mock.calls[0]?.[1];
    expect(installerDeps?.handler_deps).toBeUndefined();
  });
});

describe("HCC production wiring: buildProductionHandlerDeps provided", () => {
  it("factory is called once; installer receives both ready_result + dispatch_adapter", async () => {
    const installSpy = vi
      .spyOn(installerModule, "installHccUnattendedAppIpc")
      .mockReturnValue(makeOkInstallResult());
    const factory = vi.fn(() => ({
      ready_result: {
        schema_version: "1.0.0" as const,
        verdict: "UNATTENDED-READY-CANDIDATE" as const,
        reason: "all gates satisfied",
        task_id: "P",
        source_plan_ref: "R",
        requested_by_user: "u",
        authorization_id: "a",
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
      },
      dispatch_adapter: {
        supportsKind: vi.fn(() => true),
        dispatch: vi.fn(async () => ({ controlled_command_id: "cc-prod-001" })),
      },
    }));
    await handleHccUnattendedAppIpcInstallGesture(
      makeGesturePayload(),
      makeMockDeps({ buildProductionHandlerDeps: factory }),
    );
    expect(factory).toHaveBeenCalledTimes(1);
    expect(installSpy).toHaveBeenCalledTimes(1);
    const installerDeps = installSpy.mock.calls[0]?.[1];
    expect(installerDeps?.handler_deps).toBeDefined();
    const handlerDeps = installerDeps?.handler_deps as {
      ready_result: { verdict: string };
      dispatch_adapter: { supportsKind: () => boolean };
    };
    expect(handlerDeps.ready_result.verdict).toBe("UNATTENDED-READY-CANDIDATE");
    expect(handlerDeps.dispatch_adapter.supportsKind("file_write")).toBe(true);
  });

  it("repeated valid arming calls factory once (idempotent — cached deps are reused)", async () => {
    const installSpy = vi
      .spyOn(installerModule, "installHccUnattendedAppIpc")
      .mockReturnValue(makeOkInstallResult());
    const factory = vi.fn(() => ({
      ready_result: { schema_version: "1.0.0", verdict: "UNATTENDED-READY-CANDIDATE" } as never,
      dispatch_adapter: {
        supportsKind: () => true,
        dispatch: async () => ({ controlled_command_id: "x" }),
      } as never,
    }));
    const stateStore = { installed: false };
    const deps = makeMockDeps({
      buildProductionHandlerDeps: factory,
      stateStore,
    });
    await handleHccUnattendedAppIpcInstallGesture(makeGesturePayload(), deps);
    // Second arming gesture — factory should NOT be re-called.
    await handleHccUnattendedAppIpcInstallGesture(makeGesturePayload(), deps);
    // factory called once across two arming gestures.
    expect(factory).toHaveBeenCalledTimes(1);
    // installer called once (idempotent).
    expect(installSpy).toHaveBeenCalledTimes(1);
  });
});

describe("HCC production wiring: end-to-end via REAL installer + REAL registered final handler", () => {
  it("valid IPC request reaches the injected adapter.dispatch exactly once via the real handler chain", async () => {
    // Use the REAL installer (do NOT mock it). Provide a fake
    // ipcMainLike that captures the registered final handler.
    const dispatch = vi.fn(async () => ({
      controlled_command_id: "cc-prod-e2e-001",
    }));
    const supportsKind = vi.fn(() => true);

    // Identity fields that the real handler/entrypoint
    // cross-checks against the request payload.
    const task_id = "PLAN-UNATT-E2E-001";
    const source_plan_ref = "plan:2026-06:task-unatt-e2e-001";
    const requested_by_user = "u-requester";
    const authorization_id = "auth-unatt-e2e-001";
    const planned_action_id = "act-unatt-e2e-001";
    const planned_action_kind = "file_write" as const;
    const target_path = "src/shared/lib/notes/unatt-e2e-001.md";

    // The factory returns deps whose identity fields exactly
    // match the request fields the test will send below.
    const factory = () => ({
      ready_result: {
        schema_version: "1.0.0" as const,
        verdict: "UNATTENDED-READY-CANDIDATE" as const,
        reason: "all gates satisfied",
        task_id,
        source_plan_ref,
        requested_by_user,
        authorization_id,
        enablement_verdict: "ENABLEMENT-CANDIDATE" as const,
        final_dispatch_verdict:
          "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" as const,
        unattended_ready: true,
        night_run_ready: false as const,
        go_no_go: "NO-GO" as const,
        auto_executor_started: false as const,
        would_execute: false as const,
        executed_commands: [] as readonly [] as const,
        subprocess_count: 0 as const,
        any_command_executed: false as const,
        real_execution_ready: false as const,
      },
      dispatch_adapter: { supportsKind, dispatch },
    });

    // Fake ipcMainLike captures the handler the REAL installer
    // registers. We do NOT mock installHccUnattendedAppIpc.
    let registeredFinal:
      | ((payload: unknown) => Promise<unknown>)
      | undefined;
    const ipcMainLike = {
      handle: (channel: string, handler: (p: unknown) => Promise<unknown>) => {
        // The real installer registers exactly one channel:
        // the final dispatch channel.
        expect(channel).toBe(HCC_UNATTENDED_APP_IPC_CHANNEL);
        registeredFinal = handler;
      },
    };

    const armRes = await handleHccUnattendedAppIpcInstallGesture(
      makeGesturePayload(),
      {
        ipcMainLike,
        buildProductionHandlerDeps: factory,
        stateStore: { installed: false },
      },
    );
    expect(armRes.gesture_verdict).toBe("INSTALLED");
    expect(registeredFinal).toBeDefined();

    // Invoke the captured REAL final handler with a real
    // HCCUnattendedAppIpcRequest.
    const finalResult = (await registeredFinal!({
      app_session_id: "app-sess-e2e-001",
      app_invocation_id: "app-inv-e2e-001",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok-e2e-001",
      feature_flag_enabled: true,
      task_id,
      source_plan_ref,
      requested_by_user,
      authorization_id,
      schedule_id: "sched-e2e-001",
      planned_action_id,
      planned_action_kind,
      target_path,
      scheduler_window_start_iso: "2026-06-15T20:00:00Z",
      scheduler_window_end_iso: "2026-06-15T22:00:00Z",
      scheduler_window_tz: "Asia/Shanghai",
    })) as {
      verdict: string;
      controlled_command_id: string;
      night_run_ready: boolean;
      go_no_go: string;
    };

    expect(finalResult.verdict).toBe("APP-UNATTENDED-SCHEDULED-DISPATCHED");
    expect(finalResult.controlled_command_id).toBe("cc-prod-e2e-001");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      planned_action_id,
      planned_action_kind,
      target_path,
    );
    expect(finalResult.night_run_ready).toBe(false);
    expect(finalResult.go_no_go).toBe("NO-GO");
  });

  it("ready_result task_id mismatch through the real captured handler returns NO-GO and dispatch is NOT called", async () => {
    // The factory builds a ready_result whose task_id does NOT
    // match the request task_id. The real entrypoint's
    // cross-check blocks at "ready_result.task_id does not
    // match request.task_id" and surfaces a typed NO-GO. The
    // adapter's dispatch is never reached.
    const dispatch = vi.fn(async () => ({
      controlled_command_id: "should-not-fire",
    }));
    const supportsKind = vi.fn(() => true);

    const request_task_id = "PLAN-REQUEST-001";
    const ready_task_id = "WRONG-TASK-001"; // mismatched

    const factory = () => ({
      ready_result: {
        schema_version: "1.0.0" as const,
        verdict: "UNATTENDED-READY-CANDIDATE" as const,
        reason: "all gates satisfied",
        task_id: ready_task_id,
        source_plan_ref: "plan:2026-06:task-unatt-e2e-mismatch",
        requested_by_user: "u-requester",
        authorization_id: "auth-unatt-e2e-mismatch",
        enablement_verdict: "" as const,
        final_dispatch_verdict: "" as const,
        unattended_ready: true,
        night_run_ready: false as const,
        go_no_go: "NO-GO" as const,
        auto_executor_started: false as const,
        would_execute: false as const,
        executed_commands: [] as readonly [] as const,
        subprocess_count: 0 as const,
        any_command_executed: false as const,
        real_execution_ready: false as const,
      },
      dispatch_adapter: { supportsKind, dispatch },
    });

    let registeredFinal:
      | ((payload: unknown) => Promise<unknown>)
      | undefined;
    const ipcMainLike = {
      handle: (_channel: string, handler: (p: unknown) => Promise<unknown>) => {
        registeredFinal = handler;
      },
    };

    const armRes = await handleHccUnattendedAppIpcInstallGesture(
      makeGesturePayload(),
      {
        ipcMainLike,
        buildProductionHandlerDeps: factory,
        stateStore: { installed: false },
      },
    );
    expect(armRes.gesture_verdict).toBe("INSTALLED");
    expect(registeredFinal).toBeDefined();

    const finalResult = (await registeredFinal!({
      app_session_id: "app-sess-mismatch",
      app_invocation_id: "app-inv-mismatch",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok-mismatch",
      feature_flag_enabled: true,
      task_id: request_task_id,
      source_plan_ref: "plan:2026-06:task-unatt-e2e-mismatch",
      requested_by_user: "u-requester",
      authorization_id: "auth-unatt-e2e-mismatch",
      schedule_id: "sched-mismatch",
      planned_action_id: "act-mismatch",
      planned_action_kind: "file_write" as const,
      target_path: "/tmp/mismatch",
      scheduler_window_start_iso: "2026-06-15T20:00:00Z",
      scheduler_window_end_iso: "2026-06-15T22:00:00Z",
      scheduler_window_tz: "Asia/Shanghai",
    })) as { verdict: string; reason: string };

    expect(finalResult.verdict).toBe("NO-GO");
    expect(finalResult.reason).toContain("task_id does not match");
    expect(dispatch).not.toHaveBeenCalled();
  });
});


describe("HCC production wiring: invalid arming payload", () => {
  it("invalid payload -> installer NOT called, factory NOT built", async () => {
    const installSpy = vi
      .spyOn(installerModule, "installHccUnattendedAppIpc")
      .mockReturnValue(makeOkInstallResult());
    const factory = vi.fn(() => ({ ready_result: {}, dispatch_adapter: {} }));
    const r = await handleHccUnattendedAppIpcInstallGesture(
      { user_confirmation: false }, // missing fields
      {
        ipcMainLike: makeMockIpcMain(),
        buildProductionHandlerDeps: factory,
        stateStore: { installed: false },
      },
    );
    expect(r.gesture_verdict).toBe("NO-GO");
    expect(installSpy).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });
});

describe("HCC production wiring: static guard — wire helper does NOT introduce execution surfaces", () => {
  function readSrc() {
    return readFileSync(
      resolve(REPO_ROOT, "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("wire helper source does NOT call spawn/exec/child_process/timer/ipcMain/BrowserWindow/contextBridge/submitDryRunAction", () => {
    const src = readSrc();
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/ipcMain\.handle/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("wire helper source does NOT write to ~/.hermes", () => {
    const src = readSrc();
    expect(src).not.toMatch(/\.hermes\//);
    expect(src).not.toMatch(/\.hermes\*\*/);
  });

  it("wire helper source has no runtime go_no_go: GO and no runtime night_run_ready: true", () => {
    const src = readSrc();
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });
});
