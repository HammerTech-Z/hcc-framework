import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { HccUnattendedArming } from "../../src/renderer/src/components/HccUnattendedArming/HccUnattendedArming";
import { HCC_UNATTENDED_APP_IPC_CHANNEL } from "../../src/main/ipc-handlers/hcc-unattended-app";
import { HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL } from "../../src/main/ipc-handlers/wire-hcc-unattended-app-ipc";
import * as wireModule from "../../src/main/ipc-handlers/wire-hcc-unattended-app-ipc";

// Preload-style arming bridge. In production this is a thin
// wrapper around `ipcRenderer.invoke("hcc:unattended-app-ipc-install", ...)`.
// In this smoke test we call the main-side wire helper
// directly (bypassing the IPC layer) to keep the test purely
// in-process.
// Shared state store across multiple arming gestures. The wire
// helper mutates this object on successful arm; the second
// arming gesture sees `installed: true` and returns
// ALREADY-INSTALLED (idempotent).
let sharedArmStateStore: { installed: boolean } = { installed: false };
let originalHermesAPI:
  | { armHccUnattendedAppIpc: typeof preloadArmBridge; [k: string]: unknown }
  | undefined;

async function preloadArmBridge(payload: {
  user_confirmation: true;
  explicit_unattended_trigger_token: string;
  feature_flag_enabled: true;
}): Promise<unknown> {
  return wireModule.handleHccUnattendedAppIpcInstallGesture(payload, {
    ipcMainLike: ipcMainLike,
    buildProductionHandlerDeps,
    stateStore: sharedArmStateStore,
  });
}

const SHARED = {
  task_id: "PLAN-UNATT-E2E-SMOKE-001",
  source_plan_ref: "plan:2026-06:task-unatt-e2e-smoke-001",
  requested_by_user: "u-requester",
  authorization_id: "auth-unatt-e2e-smoke-001",
  planned_action_id: "act-unatt-e2e-smoke-001",
  planned_action_kind: "file_write" as const,
  target_path: "src/shared/lib/notes/unatt-e2e-smoke-001.md",
};

const dispatch = vi.fn(async () => ({
  controlled_command_id: "cc-e2e-smoke-001",
}));

const buildProductionHandlerDeps = () => ({
  ready_result: {
    schema_version: "1.0.0" as const,
    verdict: "UNATTENDED-READY-CANDIDATE" as const,
    reason: "all gates satisfied",
    task_id: SHARED.task_id,
    source_plan_ref: SHARED.source_plan_ref,
    requested_by_user: SHARED.requested_by_user,
    authorization_id: SHARED.authorization_id,
    enablement_verdict: "ENABLEMENT-CANDIDATE" as const,
    final_dispatch_verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" as const,
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
  dispatch_adapter: {
    supportsKind: (k: string) =>
      k === "shell_command" || k === "file_write" || k === "config_patch",
    dispatch: dispatch,
  } as never,
});

let ipcMainLike: {
  handle: (channel: string, handler: (p: unknown) => Promise<unknown>) => void;
};
let registeredHandler:
  | ((payload: unknown) => Promise<unknown>)
  | undefined;
let registerCount: number;

beforeEach(() => {
  dispatch.mockClear();
  registeredHandler = undefined;
  sharedArmStateStore = { installed: false };
  registerCount = 0;
  // Save the original `window.hermesAPI` (if any) so
  // afterEach can restore it instead of replacing
  // `globalThis.window` outright.
  originalHermesAPI = (globalThis as { window?: {
    hermesAPI?: { armHccUnattendedAppIpc: typeof preloadArmBridge; [k: string]: unknown };
  } }).window?.hermesAPI as
    | { armHccUnattendedAppIpc: typeof preloadArmBridge; [k: string]: unknown }
    | undefined;
  ipcMainLike = {
    handle: (channel, handler) => {
      registerCount += 1;
      expect(channel).toBe(HCC_UNATTENDED_APP_IPC_CHANNEL);
      registeredHandler = handler;
    },
  };
  (globalThis as {
    window?: {
      hermesAPI?: {
        armHccUnattendedAppIpc: typeof preloadArmBridge;
        [k: string]: unknown;
      };
    };
  }).window = {
    hermesAPI: {
      armHccUnattendedAppIpc: preloadArmBridge as never,
    } as never,
  } as never;
});

afterEach(() => {
  // Restore the original `window.hermesAPI` (if any) so
  // other tests are not polluted by the in-process arming
  // bridge the smoke test installs.
  const w = (globalThis as { window?: {
    hermesAPI?: { [k: string]: unknown };
  } }).window;
  if (w) {
    if (originalHermesAPI === undefined) {
      delete w.hermesAPI;
    } else {
      w.hermesAPI = originalHermesAPI;
    }
  }
  vi.restoreAllMocks();
});

describe("HCC E2E smoke: renderer button -> confirmation -> arming -> final dispatch", () => {
  it("end-to-end: render, confirm, IPC request, dispatch fires exactly once", async () => {
    render(createElement(HccUnattendedArming));
    // Render does NOT arm.
    expect(registerCount).toBe(0);
    expect(registeredHandler).toBeUndefined();

    // First button click only opens confirmation.
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    expect(registerCount).toBe(0);
    // The dialog's confirm button is the one with text 确认执行.
    const confirmButton = screen.getByText("确认执行", {
      selector: "button",
    });
    expect(confirmButton).toBeDefined();

    // Confirm click — this is the only call into the arming
    // bridge.
    fireEvent.click(confirmButton);
    // The confirm click is async (handleConfirm awaits the
    // arming bridge). Use a polling loop until the bridge has
    // been called and the final handler captured.
    for (let i = 0; i < 200 && registerCount === 0; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(registerCount).toBe(1);
    expect(registeredHandler).toBeDefined();

    // Invoke the captured real final handler with a valid
    // HCCUnattendedAppIpcRequest.
    const finalResult = (await registeredHandler!({
      app_session_id: "app-sess-e2e-smoke",
      app_invocation_id: "app-inv-e2e-smoke",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok-e2e-smoke",
      feature_flag_enabled: true,
      task_id: SHARED.task_id,
      source_plan_ref: SHARED.source_plan_ref,
      requested_by_user: SHARED.requested_by_user,
      authorization_id: SHARED.authorization_id,
      schedule_id: "sched-e2e-smoke",
      planned_action_id: SHARED.planned_action_id,
      planned_action_kind: SHARED.planned_action_kind,
      target_path: SHARED.target_path,
      scheduler_window_start_iso: "2026-06-15T20:00:00Z",
      scheduler_window_end_iso: "2026-06-15T22:00:00Z",
      scheduler_window_tz: "Asia/Shanghai",
    })) as {
      verdict: string;
      controlled_command_id: string;
      night_run_ready: boolean;
      go_no_go: string;
    };

    expect(finalResult.verdict).toBe(
      "APP-UNATTENDED-SCHEDULED-DISPATCHED",
    );
    expect(finalResult.controlled_command_id).toBe("cc-e2e-smoke-001");
    expect(finalResult.night_run_ready).toBe(false);
    expect(finalResult.go_no_go).toBe("NO-GO");

    // The injected dispatch_adapter.dispatch was called
    // exactly once with the request's planned_action_id /
    // planned_action_kind / target_path.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      SHARED.planned_action_id,
      SHARED.planned_action_kind,
      SHARED.target_path,
    );
  });

  it("cancel does NOT arm and final handler is NOT registered", async () => {
    render(createElement(HccUnattendedArming));
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    // The dialog is now open. Click the cancel button (text 取消).
    fireEvent.click(screen.getByText("取消"));
    expect(registerCount).toBe(0);
    expect(registeredHandler).toBeUndefined();
  });

  it("ready_result task_id mismatch returns NO-GO and dispatch is NOT called", async () => {
    render(createElement(HccUnattendedArming));
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    // The confirm click is async (handleConfirm awaits the
    // arming bridge). Use a polling loop until the bridge has
    // been called and the final handler captured.
    for (let i = 0; i < 200 && registerCount === 0; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(registerCount).toBe(1);
    expect(registeredHandler).toBeDefined();

    // Send a final request whose task_id does NOT match the
    // factory's ready_result.task_id.
    const finalResult = (await registeredHandler!({
      app_session_id: "app-sess-mismatch",
      app_invocation_id: "app-inv-mismatch",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok-mismatch",
      feature_flag_enabled: true,
      task_id: "WRONG-TASK-001",
      source_plan_ref: SHARED.source_plan_ref,
      requested_by_user: SHARED.requested_by_user,
      authorization_id: SHARED.authorization_id,
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

  it("repeated confirm is idempotent: second arm returns ALREADY-INSTALLED and does not register the final handler twice", async () => {
    render(createElement(HccUnattendedArming));
    // First confirm.
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    for (let i = 0; i < 200 && registerCount === 0; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(registerCount).toBe(1);
    // Trigger the first final handler invocation.
    await registeredHandler!({
      app_session_id: "x",
      app_invocation_id: "y",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok",
      feature_flag_enabled: true,
      task_id: SHARED.task_id,
      source_plan_ref: SHARED.source_plan_ref,
      requested_by_user: SHARED.requested_by_user,
      authorization_id: SHARED.authorization_id,
      schedule_id: "sched",
      planned_action_id: SHARED.planned_action_id,
      planned_action_kind: SHARED.planned_action_kind,
      target_path: SHARED.target_path,
      scheduler_window_start_iso: "2026-06-15T20:00:00Z",
      scheduler_window_end_iso: "2026-06-15T22:00:00Z",
      scheduler_window_tz: "Asia/Shanghai",
    });
    const dispatchCountAfterFirst = dispatch.mock.calls.length;

    // Second confirm — click the button again, click confirm.
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    // The second arming gesture's status update is async.
    for (let i = 0; i < 200; i++) {
      await act(async () => {
        await Promise.resolve();
      });
      if (
        (screen.getByTestId("hcc-unattended-arming-status").textContent ?? "")
          .includes("already armed")
      ) {
        break;
      }
    }
    expect(
      screen.getByTestId("hcc-unattended-arming-status").textContent,
    ).toContain("already armed");
    // registerCount stays at 1 — the final handler is NOT
    // registered a second time.
    expect(registerCount).toBe(1);
    // dispatch not called again by the second arming gesture.
    expect(dispatch.mock.calls.length).toBe(dispatchCountAfterFirst);
  });
});

describe("HCC E2E smoke: arming channel constant matches", () => {
  it("arming channel is the documented constant", () => {
    expect(HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL).toBe(
      "hcc:unattended-app-ipc-install",
    );
  });
});

describe("HCC E2E smoke: static guard — wire helper has no execution surfaces", () => {
  function readSrc() {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    return fs
      .readFileSync(
        path.resolve(
          __dirname,
          "..",
          "..",
          "src",
          "main",
          "ipc-handlers",
          "wire-hcc-unattended-app-ipc.ts",
        ),
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

  it("wire helper source has no runtime go_no_go: GO and no runtime night_run_ready: true", () => {
    const src = readSrc();
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });
});
