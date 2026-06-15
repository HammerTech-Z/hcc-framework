import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  handleHccUnattendedAppIpcInstallGesture,
  HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
  type HCCUnattendedAppIpcInstallGesturePayload,
  type HCCUnattendedAppIpcInstallGestureResult,
} from "../../src/main/ipc-handlers/wire-hcc-unattended-app-ipc";
import * as installerModule from "../../src/main/ipc-handlers/install-hcc-unattended-app";
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

function makePayload(
  overrides: Partial<HCCUnattendedAppIpcInstallGesturePayload> = {},
): HCCUnattendedAppIpcInstallGesturePayload {
  return {
    user_confirmation: true,
    explicit_unattended_trigger_token: "wire-trigger-001",
    feature_flag_enabled: true,
    ...overrides,
  };
}

function freshStateStore() {
  return { installed: false };
}

describe("HCC unattended app IPC wire: success path", () => {
  it("valid explicit install gesture calls installer once and returns INSTALLED", async () => {
    const ipc = makeMockIpcMain();
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makePayload(),
      { ipcMainLike: ipc, stateStore: freshStateStore() },
    );
    expect(r.gesture_verdict).toBe("INSTALLED");
    expect(r.verdict).toBe("INSTALLED");
    expect(r.channel).toBe(HCC_UNATTENDED_APP_IPC_CHANNEL);
    expect(r.handler_count).toBe(1);
    expect(r.channel_armed).toBe(HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL);
    expect(spy).toHaveBeenCalledTimes(1);
    // Installer was called with the injected ipcMainLike and
    // a deps bag that includes handler_deps (undefined here,
    // but the wrapper was passed).
    expect(spy).toHaveBeenCalledWith(
      ipc,
      expect.objectContaining({ handler_deps: undefined }),
    );
  });

  it("success preserves deterministic gesture_handled_at from deps.now", async () => {
    const fixed = Date.parse("2026-06-15T12:00:00.000Z");
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makePayload(),
      {
        ipcMainLike: makeMockIpcMain(),
        now: () => fixed,
        stateStore: freshStateStore(),
      },
    );
    expect(r.gesture_handled_at).toBe("2026-06-15T12:00:00.000Z");
    // The installer's own installed_at is a separate ISO 8601
    // stamp; we don't constrain its exact value here, but it
    // should also be a valid ISO 8601 timestamp.
    expect(r.installed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("HCC unattended app IPC wire: NO-GO gates", () => {
  it("missing user_confirmation -> NO-GO, installer NOT called", async () => {
    const ipc = makeMockIpcMain();
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makePayload({ user_confirmation: false }),
      { ipcMainLike: ipc, stateStore: freshStateStore() },
    );
    expect(r.gesture_verdict).toBe("NO-GO");
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing or malformed");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing explicit_unattended_trigger_token -> NO-GO, installer NOT called", async () => {
    const ipc = makeMockIpcMain();
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makePayload({ explicit_unattended_trigger_token: "" }),
      { ipcMainLike: ipc, stateStore: freshStateStore() },
    );
    expect(r.gesture_verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("feature_flag_enabled false -> NO-GO, installer NOT called", async () => {
    const ipc = makeMockIpcMain();
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const r = await handleHccUnattendedAppIpcInstallGesture(
      makePayload({ feature_flag_enabled: false }),
      { ipcMainLike: ipc, stateStore: freshStateStore() },
    );
    expect(r.gesture_verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("null payload -> NO-GO, installer NOT called", async () => {
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const r = await handleHccUnattendedAppIpcInstallGesture(null, {
      ipcMainLike: makeMockIpcMain(),
      stateStore: freshStateStore(),
    });
    expect(r.gesture_verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("HCC unattended app IPC wire: idempotency", () => {
  it("repeated valid install gesture is idempotent and does NOT register twice", async () => {
    const ipc = makeMockIpcMain();
    const spy = vi.spyOn(
      installerModule,
      "installHccUnattendedAppIpc",
    );
    const stateStore = freshStateStore();
    const r1 = await handleHccUnattendedAppIpcInstallGesture(
      makePayload(),
      { ipcMainLike: ipc, stateStore },
    );
    const r2 = await handleHccUnattendedAppIpcInstallGesture(
      makePayload(),
      { ipcMainLike: ipc, stateStore },
    );
    expect(r1.gesture_verdict).toBe("INSTALLED");
    expect(r2.gesture_verdict).toBe("ALREADY-INSTALLED");
    // The installer was called exactly ONCE — not twice.
    expect(spy).toHaveBeenCalledTimes(1);
    // Both responses share the same channel + handler_count.
    expect(r1.channel).toBe(r2.channel);
    expect(r1.handler_count).toBe(1);
    expect(r2.handler_count).toBe(1);
  });

  it("a NO-GO payload does not lock the state store (next valid gesture still installs)", async () => {
    const ipc = makeMockIpcMain();
    const stateStore = freshStateStore();
    // First call: invalid payload, installer NOT called.
    const r1 = await handleHccUnattendedAppIpcInstallGesture(
      makePayload({ user_confirmation: false }),
      { ipcMainLike: ipc, stateStore },
    );
    expect(r1.gesture_verdict).toBe("NO-GO");
    // Second call: valid payload, installer IS called.
    const r2 = await handleHccUnattendedAppIpcInstallGesture(
      makePayload(),
      { ipcMainLike: ipc, stateStore },
    );
    expect(r2.gesture_verdict).toBe("INSTALLED");
  });
});

describe("HCC unattended app IPC wire: src/main/index.ts integration", () => {
  it("src/main/index.ts imports the wire helper", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/index.ts"),
      "utf8",
    );
    expect(src).toContain(
      'from "./ipc-handlers/wire-hcc-unattended-app-ipc"',
    );
  });

  it("src/main/index.ts registers only the arming channel inside setupIPC", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/index.ts"),
      "utf8",
    );
    // The arming channel constant is referenced by name in
    // src/main/index.ts; the channel string literal is
    // defined in the wire helper module.
    expect(src).toContain("HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL");
    // The arming channel handle is registered exactly once.
    const matches = src.match(
      /ipcMain\.handle\(\s*HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL/g,
    );
    expect(matches?.length).toBe(1);
  });

  it("src/main/index.ts does NOT register the final HCC dispatch channel", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/index.ts"),
      "utf8",
    );
    // The final dispatch channel is the one from 56ed9d0; it
    // must NOT appear in src/main/index.ts.
    const matches = src.match(
      new RegExp(
        `ipcMain\\.handle\\(\\s*${HCC_UNATTENDED_APP_IPC_CHANNEL}`,
        "g",
      ),
    );
    expect(matches).toBeNull();
  });

  it("src/main/index.ts does NOT import or call runAppUnattendedScheduledDispatch", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/index.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/runAppUnattendedScheduledDispatch/);
    expect(src).not.toMatch(/hcc-unattended-app-entrypoint/);
  });

  it("src/main/index.ts does NOT call the final dispatch handler on app boot", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/main/index.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // The final dispatch channel constant must NOT appear
    // anywhere in src/main/index.ts (after comments are
    // stripped) — the dispatcher is registered only by the
    // installer, which only runs on explicit user gesture.
    expect(src).not.toMatch(/HCC_UNATTENDED_APP_IPC_CHANNEL/);
    // The dispatch handler function must NOT be called or
    // imported from src/main/index.ts.
    expect(src).not.toMatch(/runAppUnattendedScheduledDispatch/);
    expect(src).not.toMatch(/handleHccUnattendedAppIpcRequest/);
    expect(src).not.toMatch(/hcc-unattended-app-entrypoint/);
  });
});

describe("HCC unattended app IPC wire: schema + static guards", () => {
  it("wire helper source does NOT call spawn / exec / child_process / timer / BrowserWindow / contextBridge", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts",
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

  it("wire helper source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("wire helper source does NOT write to ~/.hermes", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.hermes/);
  });

  it("wire helper source does NOT import auto-executor-bootstrap/arm/start/host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts",
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

  it("wire helper source does NOT set go_no_go: GO or night_run_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });
});
