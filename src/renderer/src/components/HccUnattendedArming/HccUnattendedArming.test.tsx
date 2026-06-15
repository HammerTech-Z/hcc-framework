import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  HccUnattendedArming,
  type HccUnattendedArmingResult,
} from "./HccUnattendedArming";

const REPO_ROOT = resolve(__dirname, "..");
const COMPONENT_PATH = resolve(__dirname, "HccUnattendedArming.tsx");

function makeOkResult(
  overrides: Partial<HccUnattendedArmingResult> = {},
): HccUnattendedArmingResult {
  return {
    schema_version: "1.0.0" as const,
    verdict: "INSTALLED" as const,
    reason: "armed",
    channel: "hcc:unattended-scheduled-dispatch",
    handler_count: 1,
    installed_at: "2026-06-15T12:00:00.000Z",
    gesture_verdict: "INSTALLED" as const,
    gesture_handled_at: "2026-06-15T12:00:00.000Z",
    channel_armed: "hcc:unattended-app-ipc-install" as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("HccUnattendedArming: render and click flow", () => {
  it("renders the visible button; render does NOT call arm", () => {
    const arm = vi.fn(async () => makeOkResult());
    render(<HccUnattendedArming arm={arm} />);
    const btn = screen.getByTestId("hcc-unattended-arming-button");
    expect(btn).toBeDefined();
    // Render is safe by default — no arming call on mount.
    expect(arm).not.toHaveBeenCalled();
  });

  it("first button click opens the confirmation dialog; arm is NOT called", () => {
    const arm = vi.fn(async () => makeOkResult());
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    expect(arm).not.toHaveBeenCalled();
    // The confirmation dialog is now visible. The dialog is
    // a <div role="dialog">; the test asserts by role.
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("cancel does NOT call arm", () => {
    const arm = vi.fn(async () => makeOkResult());
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    // Cancel is the button with text 取消.
    fireEvent.click(screen.getByText("取消"));
    expect(arm).not.toHaveBeenCalled();
  });

  it("confirm calls arm exactly once with the 3 required fields", async () => {
    const arm = vi.fn(async () => makeOkResult());
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(1));
    expect(arm).toHaveBeenCalledWith({
      user_confirmation: true,
      explicit_unattended_trigger_token: expect.any(String),
      feature_flag_enabled: true,
    });
  });

  it("token is non-empty and generated per confirm click", async () => {
    const tokens: string[] = [];
    const arm = vi.fn(async (p: { explicit_unattended_trigger_token: string }) => {
      tokens.push(p.explicit_unattended_trigger_token);
      return makeOkResult();
    });
    render(<HccUnattendedArming arm={arm} />);
    // First confirm click.
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(1));
    // Open dialog again and confirm.
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(2));
    expect(tokens.length).toBe(2);
    expect(tokens[0]).toBeTruthy();
    expect(tokens[0].length).toBeGreaterThan(0);
    expect(tokens[1]).toBeTruthy();
    expect(tokens[1].length).toBeGreaterThan(0);
    // Tokens are independent per click.
    expect(tokens[0]).not.toBe(tokens[1]);
  });
});

describe("HccUnattendedArming: result display", () => {
  it("INSTALLED result is displayed", async () => {
    const arm = vi.fn(async () => makeOkResult());
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() =>
      expect(arm).toHaveBeenCalledTimes(1),
    );
    const status = screen.getByTestId("hcc-unattended-arming-status");
    expect(status.textContent).toContain("已开启");
    expect(status.textContent).toContain("armed");
  });

  it("ALREADY-INSTALLED result is displayed", async () => {
    const arm = vi.fn(async () =>
      makeOkResult({
        gesture_verdict: "ALREADY-INSTALLED",
        reason: "already armed",
      }),
    );
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(1));
    const status = screen.getByTestId("hcc-unattended-arming-status");
    expect(status.textContent).toContain("已开启");
    expect(status.textContent).toContain("already armed");
  });

  it("NO-GO result is displayed", async () => {
    const arm = vi.fn(async () =>
      makeOkResult({
        verdict: "NO-GO",
        gesture_verdict: "NO-GO",
        reason: "feature flag is not enabled",
      }),
    );
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(1));
    const status = screen.getByTestId("hcc-unattended-arming-status");
    expect(status.textContent).toContain("未开启");
    expect(status.textContent).toContain("feature flag is not enabled");
  });

  it("arm throwing is surfaced as ERROR status (not crash)", async () => {
    const arm = vi.fn(async () => {
      throw new Error("network down");
    });
    render(<HccUnattendedArming arm={arm} />);
    fireEvent.click(screen.getByTestId("hcc-unattended-arming-button"));
    fireEvent.click(screen.getByText("确认执行", { selector: "button" }));
    await waitFor(() => expect(arm).toHaveBeenCalledTimes(1));
    const status = screen.getByTestId("hcc-unattended-arming-status");
    expect(status.textContent).toContain("未开启");
    expect(status.textContent).toContain("network down");
  });
});

describe("HccUnattendedArming: source static guards", () => {
  function readSource() {
    return readFileSync(COMPONENT_PATH, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  it("component source does NOT import ipcRenderer / ipcMain / contextBridge", () => {
    const src = readSource();
    expect(src).not.toMatch(/\bipcRenderer\b/);
    expect(src).not.toMatch(/\bipcMain\b/);
    expect(src).not.toMatch(/\bcontextBridge\b/);
  });

  it("component source does NOT import from main/electron/preload", () => {
    const src = readSource();
    expect(src).not.toMatch(/from\s+["']\.\.\/\.\.\/main/);
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']\.\.\/\.\.\/preload/);
  });

  it("component source does NOT call setInterval / setTimeout / setImmediate", () => {
    const src = readSource();
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("component source does NOT call spawn / exec / child_process / submitDryRunAction", () => {
    const src = readSource();
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("component source does NOT write to ~/.hermes/** (filesystem path)", () => {
    const src = readSource();
    // The forbidden token is the filesystem path `~/.hermes/**`
    // (or `~/.hermes/...`). `window.hermesAPI` (a renderer
    // property name) is intentionally NOT forbidden — the
    // bridge is exposed via that property.
    expect(src).not.toMatch(/\.hermes\//);
    expect(src).not.toMatch(/\.hermes\*\*/);
  });
});
