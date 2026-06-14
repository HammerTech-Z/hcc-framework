import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { invokeTerminalAgentControlledRealDispatch } from "../../src/shared/lib/hcc-terminal-agent-invoker";
import { handleAppIpcInvocation } from "../../src/shared/lib/hcc-app-user-explicit-ipc";
import { HCC_DISPATCH_SHELL_ALLOWLIST } from "../../src/shared/lib/hcc-controlled-dispatch-adapter";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import { planAuditActualWrite } from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";
const HASH = "sha256:abc123";

function makeAuthorization(taskId: string) {
  return evaluateRealExecutionAuthorization(
    {
      task_id: taskId,
      source_plan_ref: `plan:2026-06:task-${taskId.toLowerCase()}`,
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: `auth-${taskId.toLowerCase()}`,
      authorization_scope: "controlled_real_execution_candidate",
      issued_at: ISSUED,
      expires_at: EXPIRES,
      one_shot: true,
      dry_run_verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
      dry_run_artifact_hash: HASH,
      reason: "explicit user authorization",
    },
    NOW,
  );
}

function makeRunner(
  authorization: ReturnType<typeof makeAuthorization>,
  taskId: string,
  plannedActionId: string,
  plannedActionKind:
    | "shell_command"
    | "file_write"
    | "config_patch",
  whitelistActionId: string,
  targetPath: string,
) {
  return evaluateControlledRealRunnerCandidate({
    task_id: taskId,
    source_plan_ref: `plan:2026-06:task-${taskId.toLowerCase()}`,
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: plannedActionId,
    planned_action_kind: plannedActionKind,
    whitelist_action_id: whitelistActionId,
  });
}

function makeAudit(
  taskId: string,
  authorizationId: string,
  plannedActionId: string,
  plannedActionKind:
    | "shell_command"
    | "file_write"
    | "config_patch",
  whitelistActionId: string,
) {
  return {
    ...planAuditActualWrite({
      task_id: taskId,
      source_plan_ref: `plan:2026-06:task-${taskId.toLowerCase()}`,
      requested_by_user: "u-requester",
      authorization_id: authorizationId,
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      dry_run_artifact_hash: HASH,
      planned_action_id: plannedActionId,
      planned_action_kind: plannedActionKind,
      whitelist_action_id: whitelistActionId,
      target_path: "docs/audit/hcc/2026-06-14/audit.md",
      audit_payload: {
        would_execute: false as const,
        real_execution_ready: false as const,
        unattended_ready: false as const,
        any_command_executed: false as const,
        executed_commands: [] as const,
        go_no_go: "NO-GO" as const,
        body: "audit body",
      },
    }),
    verdict: "AUDIT-ACTUAL-WRITTEN" as const,
    written: true,
  };
}

function makeRollback(
  taskId: string,
  authorizationId: string,
  plannedActionId: string,
  plannedActionKind:
    | "shell_command"
    | "file_write"
    | "config_patch",
  targetPath: string,
) {
  return planRollbackActualRecovery({
    task_id: taskId,
    source_plan_ref: `plan:2026-06:task-${taskId.toLowerCase()}`,
    requested_by_user: "u-requester",
    authorization_id: authorizationId,
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: plannedActionId,
    planned_action_kind: plannedActionKind,
    target_path: targetPath,
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-canary-001" })),
  };
}

function makeFileWriteSharedFixture(
  taskId: string,
  override: {
    sharedAdapter?: ReturnType<typeof makeMockAdapter>;
    explicitUserTriggerToken?: string;
    dispatchAdapter?: unknown;
  } = {},
) {
  const authorization = makeAuthorization(taskId);
  const taskLower = taskId.toLowerCase();
  const plannedActionId = `act-${taskLower}-001`;
  const whitelistActionId = `wl-${taskLower}-001`;
  return {
    task_id: taskId,
    source_plan_ref: `plan:2026-06:task-${taskLower}`,
    requested_by_user: "u-requester",
    authorization_id: `auth-${taskLower}`,
    dry_run_artifact_hash: HASH,
    planned_action_id: plannedActionId,
    planned_action_kind: "file_write" as const,
    whitelist_action_id: whitelistActionId,
    target_path: `src/shared/lib/notes/${taskLower}.md`,
    explicit_user_trigger_token:
      override.explicitUserTriggerToken ?? `user-token-${taskLower}-001`,
    dispatch_adapter: override.dispatchAdapter ?? override.sharedAdapter ?? makeMockAdapter(),
    authorization_result: authorization,
    runner_result: makeRunner(
      authorization,
      taskId,
      plannedActionId,
      "file_write",
      whitelistActionId,
      `src/shared/lib/notes/${taskLower}.md`,
    ),
    audit_result: makeAudit(
      taskId,
      `auth-${taskLower}`,
      plannedActionId,
      "file_write",
      whitelistActionId,
    ),
    rollback_plan: makeRollback(
      taskId,
      `auth-${taskLower}`,
      plannedActionId,
      "file_write",
      `src/shared/lib/notes/${taskLower}.md`,
    ),
  };
}

function makeShellSharedFixture(taskId: string, dispatchAdapter: unknown) {
  const authorization = makeAuthorization(taskId);
  const taskLower = taskId.toLowerCase();
  const plannedActionId = `act-${taskLower}-001`;
  const whitelistActionId = `wl-${taskLower}-001`;
  return {
    task_id: taskId,
    source_plan_ref: `plan:2026-06:task-${taskLower}`,
    requested_by_user: "u-requester",
    authorization_id: `auth-${taskLower}`,
    dry_run_artifact_hash: HASH,
    planned_action_id: plannedActionId,
    planned_action_kind: "shell_command" as const,
    whitelist_action_id: whitelistActionId,
    target_path: "src/shared/lib/notes/argv.md",
    explicit_user_trigger_token: `user-token-${taskLower}-001`,
    dispatch_adapter,
    authorization_result: authorization,
    runner_result: makeRunner(
      authorization,
      taskId,
      plannedActionId,
      "shell_command",
      whitelistActionId,
      "src/shared/lib/notes/argv.md",
    ),
    audit_result: makeAudit(
      taskId,
      `auth-${taskLower}`,
      plannedActionId,
      "shell_command",
      whitelistActionId,
    ),
    rollback_plan: makeRollback(
      taskId,
      `auth-${taskLower}`,
      plannedActionId,
      "shell_command",
      "src/shared/lib/notes/argv.md",
    ),
  };
}

describe("HCC e2e canary: terminal valid canary", () => {
  it("in_memory-style happy path -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-TERM-OK-001", {
      sharedAdapter,
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-canary-001",
      terminal_invocation_id: "terminal-invocation-canary-001",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter,
    });
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(r.terminal_agent_session_id).toBe("terminal-session-canary-001");
    expect(r.terminal_invocation_id).toBe("terminal-invocation-canary-001");
    expect(r.controlled_command_id).toBe("cc-canary-001");
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });

  it("audit summary + controlled_command_id present on success", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-TERM-AUDIT-001", {
      sharedAdapter,
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-canary-002",
      terminal_invocation_id: "terminal-invocation-canary-002",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter,
    });
    expect(r.controlled_command_id).toBeTruthy();
    expect(r.executed_commands).toEqual(["cc-canary-001"]);
  });
});

describe("HCC e2e canary: app valid canary", () => {
  it("file_write happy path -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-APP-OK-001", {
      sharedAdapter,
    });
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-canary-001",
      app_invocation_id: "app-invocation-canary-001",
      user_confirmation: {
        kind: "renderer_button_click",
        nonce: "nonce-canary-001",
        display_text: "Confirm dispatch?",
        confirmed_at: "2026-06-14T11:55:00.000Z",
      },
      shared_fixture: sharedFixture,
    });
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(r.app_session_id).toBe("app-session-canary-001");
    expect(r.app_invocation_id).toBe("app-invocation-canary-001");
    expect(r.controlled_command_id).toBe("cc-canary-001");
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });
});

describe("HCC e2e canary: shared denial cases (both paths)", () => {
  it("terminal missing trigger token -> NO-GO, adapter not called", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-DENY-TERM-001", {
      sharedAdapter,
      explicitUserTriggerToken: "",
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-canary-003",
      terminal_invocation_id: "terminal-invocation-canary-003",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/explicit_user_trigger_token/);
    expect(sharedAdapter.dispatch).not.toHaveBeenCalled();
  });

  it("app missing user_confirmation -> NO-GO, adapter not called", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-DENY-APP-001", {
      sharedAdapter,
    });
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-canary-002",
      app_invocation_id: "app-invocation-canary-002",
      user_confirmation: undefined as never,
      shared_fixture: sharedFixture,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/user_confirmation/);
    expect(sharedAdapter.dispatch).not.toHaveBeenCalled();
  });

  it("non-allowlisted shell denied in terminal path", async () => {
    // Adapter that throws the typed failure a real
    // controlledDispatch would throw for a non-allowlisted
    // argv. The terminal invoker must surface this as a
    // typed NO-GO.
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: argv is not in the shell allowlist");
      }),
    };
    const authorization = makeAuthorization("PLAN-SHELL-DENY-001");
    const sharedFixture = {
      ...makeFileWriteSharedFixture("PLAN-SHELL-DENY-001"),
      planned_action_kind: "shell_command" as const,
      target_path: "src/shared/lib/notes/argv.md",
      dispatch_adapter: sharedAdapter as never,
      authorization_result: authorization,
      runner_result: makeRunner(
        authorization,
        "PLAN-SHELL-DENY-001",
        "act-plan-shell-deny-001-001",
        "shell_command",
        "wl-plan-shell-deny-001-001",
        "src/shared/lib/notes/argv.md",
      ),
      audit_result: makeAudit(
        "PLAN-SHELL-DENY-001",
        `auth-${"PLAN-SHELL-DENY-001".toLowerCase()}`,
        "act-plan-shell-deny-001-001",
        "shell_command",
        "wl-plan-shell-deny-001-001",
      ),
      rollback_plan: makeRollback(
        "PLAN-SHELL-DENY-001",
        `auth-${"PLAN-SHELL-DENY-001".toLowerCase()}`,
        "act-plan-shell-deny-001-001",
        "shell_command",
        "src/shared/lib/notes/argv.md",
      ),
    };
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-shell-deny",
      terminal_invocation_id: "terminal-invocation-shell-deny",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter as never,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/shell allowlist/);
  });

  it("non-allowlisted shell denied in app path", async () => {
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: argv is not in the shell allowlist");
      }),
    };
    const authorization = makeAuthorization("PLAN-SHELL-DENY-002");
    const sharedFixture = {
      ...makeFileWriteSharedFixture("PLAN-SHELL-DENY-002"),
      planned_action_kind: "shell_command" as const,
      target_path: "src/shared/lib/notes/argv.md",
      dispatch_adapter: sharedAdapter as never,
      authorization_result: authorization,
      runner_result: makeRunner(
        authorization,
        "PLAN-SHELL-DENY-002",
        "act-plan-shell-deny-002-001",
        "shell_command",
        "wl-plan-shell-deny-002-001",
        "src/shared/lib/notes/argv.md",
      ),
      audit_result: makeAudit(
        "PLAN-SHELL-DENY-002",
        `auth-${"PLAN-SHELL-DENY-002".toLowerCase()}`,
        "act-plan-shell-deny-002-001",
        "shell_command",
        "wl-plan-shell-deny-002-001",
      ),
      rollback_plan: makeRollback(
        "PLAN-SHELL-DENY-002",
        `auth-${"PLAN-SHELL-DENY-002".toLowerCase()}`,
        "act-plan-shell-deny-002-001",
        "shell_command",
        "src/shared/lib/notes/argv.md",
      ),
    };
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-shell-deny",
      app_invocation_id: "app-invocation-shell-deny",
      user_confirmation: {
        kind: "menu_action",
        nonce: "nonce-shell-deny-002",
        display_text: "Run script?",
        confirmed_at: "2026-06-14T11:55:00.000Z",
      },
      shared_fixture: sharedFixture,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/shell allowlist/);
  });

  it("locked path denied in terminal path", async () => {
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: target_path is in a locked scope");
      }),
    };
    const sharedFixture = makeFileWriteSharedFixture("PLAN-LOCK-DENY-001", {
      dispatchAdapter: sharedAdapter as never,
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-lock-deny",
      terminal_invocation_id: "terminal-invocation-lock-deny",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter as never,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/locked/);
  });

  it("locked path denied in app path", async () => {
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: target_path is in a locked scope");
      }),
    };
    const sharedFixture = makeFileWriteSharedFixture("PLAN-LOCK-DENY-002", {
      dispatchAdapter: sharedAdapter as never,
    });
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-lock-deny",
      app_invocation_id: "app-invocation-lock-deny",
      user_confirmation: {
        kind: "keyboard_shortcut",
        nonce: "nonce-lock-deny-002",
        display_text: "Patch config?",
        confirmed_at: "2026-06-14T11:55:00.000Z",
      },
      shared_fixture: sharedFixture,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/locked/);
  });
});

describe("HCC e2e canary: adapter failure surfaces as typed NO-GO (both paths)", () => {
  it("terminal adapter throw -> typed NO-GO", async () => {
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: EXECUTOR_REJECTED: writer rejected: disk full");
      }),
    };
    const sharedFixture = makeFileWriteSharedFixture("PLAN-THROW-TERM-001", {
      dispatchAdapter: sharedAdapter as never,
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-throw",
      terminal_invocation_id: "terminal-invocation-throw",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter as never,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("disk full");
  });

  it("app adapter throw -> typed NO-GO", async () => {
    const sharedAdapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: EXECUTOR_REJECTED: writer rejected: disk full");
      }),
    };
    const sharedFixture = makeFileWriteSharedFixture("PLAN-THROW-APP-001", {
      dispatchAdapter: sharedAdapter as never,
    });
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-throw",
      app_invocation_id: "app-invocation-throw",
      user_confirmation: {
        kind: "renderer_button_click",
        nonce: "nonce-throw-001",
        display_text: "Confirm?",
        confirmed_at: "2026-06-14T11:55:00.000Z",
      },
      shared_fixture: sharedFixture,
    });
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("disk full");
  });
});

describe("HCC e2e canary: identity / boundary preservation", () => {
  it("terminal identity preserved on NO-GO (typed failure)", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-ID-TERM-001", {
      sharedAdapter,
      explicitUserTriggerToken: "",
    });
    const r = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-session-id",
      terminal_invocation_id: "terminal-invocation-id",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter,
    });
    expect(r.terminal_agent_session_id).toBe("terminal-session-id");
    expect(r.terminal_invocation_id).toBe("terminal-invocation-id");
  });

  it("app identity preserved on NO-GO (typed failure)", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-ID-APP-001", {
      sharedAdapter,
    });
    const r = await handleAppIpcInvocation({
      app_session_id: "app-session-id",
      app_invocation_id: "app-invocation-id",
      user_confirmation: undefined as never,
      shared_fixture: sharedFixture,
    });
    expect(r.app_session_id).toBe("app-session-id");
    expect(r.app_invocation_id).toBe("app-invocation-id");
  });

  it("all success paths preserve unattended_ready=false / night_run_ready=false / go_no_go=NO-GO / auto_executor_started=false", async () => {
    const sharedAdapter = makeMockAdapter();
    const sharedFixture = makeFileWriteSharedFixture("PLAN-BOUND-001", {
      sharedAdapter,
    });
    const t = await invokeTerminalAgentControlledRealDispatch({
      terminal_agent_session_id: "terminal-boundary",
      terminal_invocation_id: "terminal-invocation-boundary",
      shared_fixture: sharedFixture,
      dispatch_adapter: sharedAdapter,
    });
    const a = await handleAppIpcInvocation({
      app_session_id: "app-boundary",
      app_invocation_id: "app-invocation-boundary",
      user_confirmation: {
        kind: "renderer_button_click",
        nonce: "nonce-bound",
        display_text: "Confirm?",
        confirmed_at: "2026-06-14T11:55:00.000Z",
      },
      shared_fixture: sharedFixture,
    });
    for (const r of [t, a]) {
      expect(r.unattended_ready).toBe(false);
      expect(r.night_run_ready).toBe(false);
      expect(r.go_no_go).toBe("NO-GO");
      expect(r.auto_executor_started).toBe(false);
    }
  });
});

describe("HCC e2e canary: shell allowlist backends are reachable on both paths", () => {
  it("HCC_DISPATCH_SHELL_ALLOWLIST has 3 entries (smoke check)", () => {
    expect(HCC_DISPATCH_SHELL_ALLOWLIST.length).toBe(3);
    const ids = HCC_DISPATCH_SHELL_ALLOWLIST.map((e) => e.command_id);
    expect(ids).toContain("git.status");
    expect(ids).toContain("git.diff");
    expect(ids).toContain("git.show");
  });
});

describe("HCC e2e canary: static forbidden-surface guard", () => {
  it("canary test does NOT call forbidden surface (sweep)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "tests/hcc/hcc-e2e-canary.test.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });
});
