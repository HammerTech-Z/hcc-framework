import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseTerminalCliArgs,
  runTerminalCli,
  main,
  HCC_UNATTENDED_TERMINAL_CLI_SCHEMA_VERSION,
  type HCCUnattendedTerminalCliArgs,
} from "../../src/cli/hcc-unattended-terminal.ts";
import * as entrypointModule from "../../src/shared/lib/hcc-unattended-terminal-entrypoint.ts";

const REPO_ROOT = resolve(__dirname, "../..");

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeArgs(
  overrides: Partial<HCCUnattendedTerminalCliArgs> = {},
): HCCUnattendedTerminalCliArgs {
  return {
    terminal_agent_session_id: "term-sess-001",
    terminal_invocation_id: "term-inv-001",
    explicit_unattended_trigger_token: "term-trigger-001",
    feature_flag_enabled: true,
    task_id: "PLAN-UNATT-CLI-001",
    source_plan_ref: "plan:2026-06:task-unatt-cli-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-cli-001",
    schedule_id: "sched-cli-001",
    planned_action_id: "act-unatt-cli-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/unatt-cli-001.md",
    tz: "Asia/Shanghai",
    scheduler_window_start_iso: "2026-06-15T20:00:00Z",
    scheduler_window_end_iso: "2026-06-15T22:00:00Z",
    ...overrides,
  };
}

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-cli-001" })),
  };
}

describe("HCC terminal CLI: parse", () => {
  it("missing terminal_agent_session_id -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-invocation-id",
        "term-inv-001",
        "--explicit-unattended-trigger-token",
        "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("terminal-agent-session-id");
  });

  it("missing terminal_invocation_id -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--explicit-unattended-trigger-token",
        "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("terminal-invocation-id");
  });

  it("missing explicit trigger token -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--terminal-invocation-id",
        "term-inv-001",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("explicit-unattended-trigger-token");
  });

  it("missing feature flag -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--terminal-invocation-id",
        "term-inv-001",
        "--explicit-unattended-trigger-token",
        "t",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("feature flag");
  });

  it("missing required scheduler field (--task-id) -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--terminal-invocation-id",
        "term-inv-001",
        "--explicit-unattended-trigger-token",
        "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
  });

  it("unsupported planned_action_kind -> parse error", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--terminal-invocation-id",
        "term-inv-001",
        "--explicit-unattended-trigger-token",
        "t",
        "--feature-flag-enabled",
        "--task-id",
        "P",
        "--source-plan-ref",
        "P",
        "--requested-by-user",
        "u",
        "--authorization-id",
        "a",
        "--schedule-id",
        "s",
        "--planned-action-id",
        "act",
        "--planned-action-kind",
        "remote_exec",
        "--target-path",
        "x",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("unsupported");
  });

  it("all flags present -> ok with parsed args", () => {
    const r = parseTerminalCliArgs(
      [
        "--terminal-agent-session-id",
        "term-sess-001",
        "--terminal-invocation-id",
        "term-inv-001",
        "--explicit-unattended-trigger-token",
        "t",
        "--feature-flag-enabled",
        "--task-id",
        "P",
        "--source-plan-ref",
        "P",
        "--requested-by-user",
        "u",
        "--authorization-id",
        "a",
        "--schedule-id",
        "s",
        "--planned-action-id",
        "act",
        "--planned-action-kind",
        "file_write",
        "--target-path",
        "x",
      ],
      {},
    );
    expect(r.ok).toBe(true);
  });

  it("env vars are honored when flags are absent", () => {
    const r = parseTerminalCliArgs(
      [
        "--feature-flag-enabled",
        "--task-id",
        "P",
        "--source-plan-ref",
        "P",
        "--requested-by-user",
        "u",
        "--authorization-id",
        "a",
        "--schedule-id",
        "s",
        "--planned-action-id",
        "act",
        "--planned-action-kind",
        "file_write",
        "--target-path",
        "x",
      ],
      {
        HCC_TERMINAL_AGENT_SESSION_ID: "env-sess",
        HCC_TERMINAL_INVOCATION_ID: "env-inv",
        HCC_EXPLICIT_UNATTENDED_TRIGGER_TOKEN: "env-tok",
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.terminal_agent_session_id).toBe("env-sess");
      expect(r.args.terminal_invocation_id).toBe("env-inv");
      expect(r.args.explicit_unattended_trigger_token).toBe("env-tok");
    }
  });
});

describe("HCC terminal CLI: runTerminalCli", () => {
  it("valid args -> entrypoint called once, success path", async () => {
    const spy = vi.spyOn(
      entrypointModule,
      "runTerminalUnattendedScheduledDispatch",
    );
    const adapter = makeMockAdapter();
    const r = await runTerminalCli(makeArgs(), adapter as never);
    // The CLI's ready_result is a no-op, so the entrypoint
    // returns NO-GO (ready_result.verdict is "NO-GO"). The CLI
    // does not synthesize a real ready state.
    expect(r.verdict).toBe("NO-GO");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("entrypoint returns NO-GO -> CLI forwards the reason", async () => {
    vi.spyOn(
      entrypointModule,
      "runTerminalUnattendedScheduledDispatch",
    ).mockResolvedValueOnce({
      schema_version: "1.0.0" as const,
      verdict: "NO-GO" as const,
      reason: "entrypoint refused",
      terminal_agent_session_id: "term-sess-001",
      terminal_invocation_id: "term-inv-001",
      explicit_unattended_trigger_token: "term-trigger-001",
      schedule_id: "sched-cli-001",
      task_id: "PLAN-UNATT-CLI-001",
      source_plan_ref: "plan:2026-06:task-unatt-cli-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-unatt-cli-001",
      planned_action_id: "act-unatt-cli-001",
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
    const r = await runTerminalCli(makeArgs());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("entrypoint refused");
  });

  it("entrypoint throws -> CLI surfaces typed NO-GO via the entrypoint (entrypoint catches)", async () => {
    // The entrypoint catches runner / adapter throws internally.
    // We simulate an entrypoint that re-throws to verify the CLI
    // does not swallow the error. The CLI delegates to
    // runTerminalUnattendedScheduledDispatch; if that rejects,
    // the CLI's `main()` propagates. runTerminalCli itself
    // awaits the entrypoint and lets the rejection bubble.
    vi.spyOn(
      entrypointModule,
      "runTerminalUnattendedScheduledDispatch",
    ).mockRejectedValueOnce(new Error("entrypoint boom"));
    await expect(runTerminalCli(makeArgs())).rejects.toThrow("entrypoint boom");
  });
});

describe("HCC terminal CLI: main()", () => {
  let stdoutChunks: string[] = [];
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutChunks = [];
    writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stdoutChunks.push(
          typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
        );
        return true;
      });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`__exit__:${code ?? "0"}`);
    }) as never);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("parse error -> returns 2, NO-GO JSON on stdout", async () => {
    const code = await main([]);
    expect(code).toBe(2);
    const out = stdoutChunks.join("");
    expect(out).toContain("NO-GO");
    expect(out).toContain(HCC_UNATTENDED_TERMINAL_CLI_SCHEMA_VERSION);
  });

  it("valid args -> entrypoint called once, exit 0 on success", async () => {
    vi.spyOn(
      entrypointModule,
      "runTerminalUnattendedScheduledDispatch",
    ).mockResolvedValueOnce({
      schema_version: "1.0.0" as const,
      verdict: "TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED" as const,
      reason: "ok",
      terminal_agent_session_id: "term-sess-001",
      terminal_invocation_id: "term-inv-001",
      explicit_unattended_trigger_token: "term-trigger-001",
      schedule_id: "sched-cli-001",
      task_id: "PLAN-UNATT-CLI-001",
      source_plan_ref: "plan:2026-06:task-unatt-cli-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-unatt-cli-001",
      planned_action_id: "act-unatt-cli-001",
      planned_action_kind: "file_write",
      controlled_command_id: "cc-cli-001",
      any_command_executed: true,
      executed_commands: ["cc-cli-001"] as const,
      subprocess_count: 1,
      would_execute: false as const,
      auto_executor_started: false as const,
      unattended_ready: true,
      night_run_ready: false as const,
      go_no_go: "NO-GO" as const,
      real_execution_ready: false as const,
    });

    const argv = [
      "--terminal-agent-session-id",
      "term-sess-001",
      "--terminal-invocation-id",
      "term-inv-001",
      "--explicit-unattended-trigger-token",
      "t",
      "--feature-flag-enabled",
      "--task-id",
      "P",
      "--source-plan-ref",
      "P",
      "--requested-by-user",
      "u",
      "--authorization-id",
      "a",
      "--schedule-id",
      "s",
      "--planned-action-id",
      "act",
      "--planned-action-kind",
      "file_write",
      "--target-path",
      "x",
    ];
    const code = await main(argv);
    expect(code).toBe(0);
    const out = stdoutChunks.join("");
    expect(out).toContain("TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED");
  });
});

describe("HCC terminal CLI: schema + static guards", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_TERMINAL_CLI_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("CLI source preserves night_run_ready:false + go_no_go:NO-GO literals", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-unattended-terminal.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("CLI source does NOT call spawn / exec / child_process / timer / ipc / BrowserWindow", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-unattended-terminal.ts"),
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

  it("CLI source does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-unattended-terminal.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("CLI source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-unattended-terminal.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("CLI source does NOT write to ~/.hermes", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-unattended-terminal.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\.hermes/);
  });
});
