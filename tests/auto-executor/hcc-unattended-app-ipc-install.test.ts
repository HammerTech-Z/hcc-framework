import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installHccUnattendedAppIpc,
  HCC_UNATTENDED_APP_IPC_INSTALL_SCHEMA_VERSION,
  type HCCUnattendedAppIpcInstallResult,
} from "../../src/main/ipc-handlers/install-hcc-unattended-app";
import * as handlerModule from "../../src/main/ipc-handlers/hcc-unattended-app";
import {
  HCC_UNATTENDED_APP_IPC_CHANNEL,
  type HCCUnattendedAppIpcResult,
} from "../../src/main/ipc-handlers/hcc-unattended-app";

const REPO_ROOT = resolve(__dirname, "../..");

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeMockIpcMain() {
  return {
    handle: vi.fn(),
  };
}

describe("HCC unattended app IPC installer: success path", () => {
  it("registers exactly one handler on HCC_UNATTENDED_APP_IPC_CHANNEL", () => {
    const ipc = makeMockIpcMain();
    const r = installHccUnattendedAppIpc(ipc);
    expect(r.verdict).toBe("INSTALLED");
    expect(r.channel).toBe(HCC_UNATTENDED_APP_IPC_CHANNEL);
    expect(r.handler_count).toBe(1);
    expect(ipc.handle).toHaveBeenCalledTimes(1);
    expect(ipc.handle).toHaveBeenCalledWith(
      HCC_UNATTENDED_APP_IPC_CHANNEL,
      expect.any(Function),
    );
  });

  it("registered handler delegates to handleHccUnattendedAppIpcRequest", async () => {
    const spy = vi.spyOn(
      handlerModule,
      "handleHccUnattendedAppIpcRequest",
    );
    const ipc = makeMockIpcMain();
    installHccUnattendedAppIpc(ipc);
    expect(spy).not.toHaveBeenCalled(); // not called yet
    // Pull the registered handler and call it with a payload.
    const registeredHandler = ipc.handle.mock.calls[0]?.[1] as (
      p: unknown,
    ) => Promise<HCCUnattendedAppIpcResult>;
    expect(registeredHandler).toBeDefined();
    await registeredHandler({ app_session_id: "x" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ app_session_id: "x" }, undefined);
  });

  it("success returns deterministic installed_at timestamp from deps.now", () => {
    const ipc = makeMockIpcMain();
    const fixed = Date.parse("2026-06-15T12:00:00.000Z");
    const r = installHccUnattendedAppIpc(ipc, { now: () => fixed });
    expect(r.installed_at).toBe("2026-06-15T12:00:00.000Z");
  });

  it("injected handleHccUnattendedAppIpcRequest is used instead of the real one", async () => {
    const ipc = makeMockIpcMain();
    const realSpy = vi.spyOn(
      handlerModule,
      "handleHccUnattendedAppIpcRequest",
    );
    const fakeResult: HCCUnattendedAppIpcResult = {
      schema_version: "1.0.0" as const,
      verdict: "APP-UNATTENDED-SCHEDULED-DISPATCHED" as const,
      reason: "mocked",
      handled_at: "2026-06-15T12:00:00.000Z",
      app_session_id: "app-sess-001",
      app_invocation_id: "app-inv-001",
      user_confirmation: true,
      explicit_unattended_trigger_token: "tok",
      schedule_id: "s",
      task_id: "P",
      source_plan_ref: "R",
      requested_by_user: "u",
      authorization_id: "a",
      planned_action_id: "act",
      planned_action_kind: "file_write",
      controlled_command_id: "cc-1",
      any_command_executed: true,
      executed_commands: ["cc-1"] as const,
      subprocess_count: 1,
      would_execute: false as const,
      auto_executor_started: false as const,
      unattended_ready: true,
      night_run_ready: false as const,
      go_no_go: "NO-GO" as const,
      real_execution_ready: false as const,
    };
    const mockHandler = vi.fn(async () => fakeResult);
    installHccUnattendedAppIpc(ipc, {
      handleHccUnattendedAppIpcRequest: mockHandler,
    });
    const registeredHandler = ipc.handle.mock.calls[0]?.[1] as (
      p: unknown,
    ) => Promise<HCCUnattendedAppIpcResult>;
    const out = await registeredHandler({ app_session_id: "x" });
    expect(out).toBe(fakeResult);
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(realSpy).not.toHaveBeenCalled();
  });

  it("registered handler passes payload + handler_deps to the handler", async () => {
    const ipc = makeMockIpcMain();
    const mockHandler = vi.fn(
      async (
        _payload: unknown,
        _handlerDeps?: unknown,
      ): Promise<HCCUnattendedAppIpcResult> => ({
        schema_version: "1.0.0" as const,
        verdict: "APP-UNATTENDED-SCHEDULED-DISPATCHED" as const,
        reason: "ok",
        handled_at: "2026-06-15T12:00:00.000Z",
        app_session_id: "app-sess-001",
        app_invocation_id: "app-inv-001",
        user_confirmation: true,
        explicit_unattended_trigger_token: "tok",
        schedule_id: "s",
        task_id: "P",
        source_plan_ref: "R",
        requested_by_user: "u",
        authorization_id: "a",
        planned_action_id: "act",
        planned_action_kind: "file_write",
        controlled_command_id: "cc-1",
        any_command_executed: true,
        executed_commands: ["cc-1"] as const,
        subprocess_count: 1,
        would_execute: false as const,
        auto_executor_started: false as const,
        unattended_ready: true,
        night_run_ready: false as const,
        go_no_go: "NO-GO" as const,
        real_execution_ready: false as const,
      }),
    );
    const handlerDeps = { now: () => 1700000000000 };
    installHccUnattendedAppIpc(ipc, {
      handleHccUnattendedAppIpcRequest: mockHandler,
      handler_deps: handlerDeps,
    });
    const registeredHandler = ipc.handle.mock.calls[0]?.[1] as (
      p: unknown,
    ) => Promise<HCCUnattendedAppIpcResult>;
    await registeredHandler({ app_session_id: "x" });
    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(
      { app_session_id: "x" },
      handlerDeps,
    );
  });

  it("real-handler delegation: handler_deps.now controls handled_at for a malformed payload", async () => {
    // Use the real handler (no mock) with a fixed `now` injected
    // via handler_deps. The malformed payload surfaces a NO-GO
    // result with a deterministic `handled_at` derived from
    // handler_deps.now — proving the installer's handler_deps
    // passthrough reaches the real handler.
    const ipc = makeMockIpcMain();
    const fixed = Date.parse("2030-01-01T00:00:00.000Z");
    installHccUnattendedAppIpc(ipc, {
      handler_deps: { now: () => fixed },
    });
    const registeredHandler = ipc.handle.mock.calls[0]?.[1] as (
      p: unknown,
    ) => Promise<HCCUnattendedAppIpcResult>;
    const out = await registeredHandler(null);
    expect(out.verdict).toBe("NO-GO");
    expect(out.handled_at).toBe("2030-01-01T00:00:00.000Z");
  });

  it("installer's own installed_at is independent of handler_deps.now", () => {
    const ipc = makeMockIpcMain();
    const fixed = Date.parse("2026-06-15T12:00:00.000Z");
    const r = installHccUnattendedAppIpc(ipc, {
      now: () => fixed,
      handler_deps: { now: () => Date.parse("2099-12-31T23:59:59.000Z") },
    });
    // installer's own `installed_at` uses `deps.now`, not
    // `handler_deps.now`.
    expect(r.installed_at).toBe("2026-06-15T12:00:00.000Z");
  });
});

describe("HCC unattended app IPC installer: NO-GO gates", () => {
  it("missing ipcMainLike -> typed NO-GO, handle() NOT called", () => {
    const r = installHccUnattendedAppIpc(undefined);
    expect(r.verdict).toBe("NO-GO");
    expect(r.channel).toBe("");
    expect(r.handler_count).toBe(0);
    expect(r.reason).toContain("ipcMainLike");
  });

  it("null ipcMainLike -> NO-GO", () => {
    const r = installHccUnattendedAppIpc(null);
    expect(r.verdict).toBe("NO-GO");
  });

  it("ipcMainLike without handle() method -> NO-GO", () => {
    const r = installHccUnattendedAppIpc({ removeListener: () => {} });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("handle");
  });

  it("ipcMainLike with non-function handle -> NO-GO", () => {
    const r = installHccUnattendedAppIpc({ handle: "not-a-function" });
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended app IPC installer: schema + static guards", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_APP_IPC_INSTALL_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("installer source does NOT call spawn / exec / child_process / timer / BrowserWindow / contextBridge", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
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

  it("installer source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("installer source does NOT import auto-executor-bootstrap/arm/start/host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("installer source does NOT write to ~/.hermes", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.hermes/);
  });

  it("installer source does NOT set go_no_go: GO or night_run_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("installer source does NOT import src/main/index.ts (no app-boot coupling)", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["'].*index\.ts["']/);
  });

  it("installer source imports the channel constant from the handler module", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/install-hcc-unattended-app.ts",
      ),
      "utf8",
    );
    expect(src).toContain("HCC_UNATTENDED_APP_IPC_CHANNEL");
  });
});

describe("HCC unattended app IPC installer: success result shape", () => {
  it("returns { installed: true (verdict INSTALLED), channel, handler_count: 1, installed_at }", () => {
    const ipc = makeMockIpcMain();
    const r: HCCUnattendedAppIpcInstallResult = installHccUnattendedAppIpc(ipc);
    expect(r.verdict).toBe("INSTALLED");
    expect(r.channel).toBe("hcc:unattended-scheduled-dispatch");
    expect(r.handler_count).toBe(1);
    expect(typeof r.installed_at).toBe("string");
    expect(r.installed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
