// HccUnattendedArming — User-Visible Hermes Pro App Confirmation
// Entrypoint for HCC Unattended App IPC Arming.
//
// Pure React component. Two-click UX:
//   1. First click on the visible button opens a confirmation
//      dialog.
//   2. Confirm click generates a per-click
//      `explicit_unattended_trigger_token` and posts to
//      `window.hermesAPI.armHccUnattendedAppIpc(...)`. The
//      renderer MUST NOT call the arming bridge before the
//      user has explicitly clicked through the dialog.
//
// The component does NOT call the arming bridge on mount, on
// any effect, on a timer, or on polling. Cancel does not
// call the arming bridge. The button is visible but safe by
// default — opening the dialog is the only side effect of
// the first click.
//
// Per HCC governance (preflight
// `hcc-unattended-app-ipc-renderer-preflight-2026-06-15`):
//   - NO `setInterval` / `setTimeout` / cron / auto-arm.
//   - NO imports of `ipcRenderer` / `ipcMain` / `contextBridge`.
//   - NO direct import from `src/main` / `electron` / `preload`.
//   - NO write to `~/.hermes/**`.
//   - The component preserves `night_run_ready: false` and
//     `go_no_go: "NO-GO"` (displayed via the arming bridge's
//     deterministic response; the component itself does not
//     flip any verdict).
//   - The component does NOT call the final HCC dispatch
//     channel. The arming channel is the only IPC surface
//     reachable from the renderer here.

import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog/ConfirmDialog";

export type HccUnattendedArmingVerdict =
  | "INSTALLED"
  | "ALREADY-INSTALLED"
  | "NO-GO"
  | "ERROR"
  | "IDLE";

export interface HccUnattendedArmingResult {
  schema_version: "1.0.0";
  /** Matches the installer's verdict. "ALREADY-INSTALLED" is
   *  carried by `gesture_verdict`, NOT by `verdict`. */
  verdict: "INSTALLED" | "NO-GO";
  reason: string;
  channel: string;
  handler_count: number;
  installed_at: string;
  /** The wire helper's gesture-level verdict. "INSTALLED" on
   *  first success, "ALREADY-INSTALLED" on repeated gestures,
   *  "NO-GO" on invalid payload. */
  gesture_verdict: "INSTALLED" | "ALREADY-INSTALLED" | "NO-GO";
  gesture_handled_at: string;
  channel_armed: "hcc:unattended-app-ipc-install";
}

export interface HccUnattendedArmingProps {
  /**
   * Optional override of the arming bridge. Defaults to
   * `window.hermesAPI.armHccUnattendedAppIpc`. Tests inject
   * a mock.
   */
  arm?: (payload: {
    user_confirmation: true;
    explicit_unattended_trigger_token: string;
    feature_flag_enabled: true;
  }) => Promise<HccUnattendedArmingResult>;
}

const ACTION_NAME = "Arm HCC unattended app IPC dispatcher";
const DESCRIPTION =
  "This arms the HCC unattended app IPC dispatcher in the main process. " +
  "The final HCC dispatch channel is registered only after this " +
  "arming gesture succeeds. The action is reversible by reloading the app.";

function generateTriggerToken(): string {
  // Per-click one-shot token. Not a long-lived credential.
  // Uses crypto.getRandomValues when available (browser /
  // jsdom), falls back to Math.random + Date.now for older
  // environments.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function renderStatus(verdict: HccUnattendedArmingVerdict, reason: string): string {
  switch (verdict) {
    case "INSTALLED":
      return "已开启 · HCC unattended appIPC dispatcher armed";
    case "ALREADY-INSTALLED":
      return "已开启 · already armed (idempotent)";
    case "NO-GO":
      return `未开启 · ${reason || "arming refused"}`;
    case "ERROR":
      return `未开启 · ${reason || "arming failed"}`;
    case "IDLE":
    default:
      return "未操作";
  }
}

export function HccUnattendedArming({
  arm,
}: HccUnattendedArmingProps = {}): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [verdict, setVerdict] = useState<HccUnattendedArmingVerdict>("IDLE");
  const [reason, setReason] = useState<string>("");

  const armFn =
    arm ??
    (typeof window !== "undefined" && window.hermesAPI
      ? window.hermesAPI.armHccUnattendedAppIpc.bind(window.hermesAPI)
      : undefined);

  function handleArmClick(): void {
    // First click ONLY opens the dialog. The arming bridge is
    // never called here. No timer, no effect, no auto-call.
    setConfirmOpen(true);
  }

  function handleCancel(): void {
    setConfirmOpen(false);
    // Cancel does NOT call the arming bridge.
  }

  async function handleConfirm(): Promise<void> {
    setConfirmOpen(false);
    if (!armFn) {
      setVerdict("ERROR");
      setReason("hermesAPI.armHccUnattendedAppIpc is not available");
      return;
    }
    const explicit_unattended_trigger_token = generateTriggerToken();
    if (explicit_unattended_trigger_token.length === 0) {
      // Defensive: should be unreachable because the generator
      // always returns a 32-char hex string. Surface as ERROR
      // if it ever returns empty.
      setVerdict("ERROR");
      setReason("trigger token generator returned empty");
      return;
    }
    try {
      const r = await armFn({
        user_confirmation: true,
        explicit_unattended_trigger_token,
        feature_flag_enabled: true,
      });
      // UI status is driven from `gesture_verdict`, which is the
      // wire helper's gesture-level verdict. `r.verdict` is the
      // installer's verdict and is "INSTALLED" on both first
      // success and repeated gestures (the repeated case carries
      // "ALREADY-INSTALLED" in `gesture_verdict`).
      if (r.gesture_verdict === "INSTALLED") {
        setVerdict("INSTALLED");
        setReason(r.reason);
      } else if (r.gesture_verdict === "ALREADY-INSTALLED") {
        setVerdict("ALREADY-INSTALLED");
        setReason(r.reason);
      } else {
        setVerdict("NO-GO");
        setReason(r.reason);
      }
    } catch (err) {
      setVerdict("ERROR");
      setReason((err as Error).message ?? String(err));
    }
  }

  return (
    <div
      className="hcc-unattended-arming"
      data-testid="hcc-unattended-arming"
    >
      <div className="hcc-unattended-arming-row">
        <button
          type="button"
          className="hcc-unattended-arming-button"
          data-testid="hcc-unattended-arming-button"
          onClick={handleArmClick}
        >
          开启 HCC unattended appIPC
        </button>
        <span
          className="hcc-unattended-arming-status"
          data-testid="hcc-unattended-arming-status"
        >
          {renderStatus(verdict, reason)}
        </span>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          actionName={ACTION_NAME}
          description={DESCRIPTION}
          reversible={true}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
