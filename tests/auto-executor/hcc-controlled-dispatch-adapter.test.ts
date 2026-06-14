import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildControlledDispatchAdapter,
  controlledDispatch,
  HCC_CONTROLLED_DISPATCH_ADAPTER_SCHEMA_VERSION,
  HCC_DISPATCH_SHELL_ALLOWLIST,
  type HCCControlledDispatchExecutorDeps,
  type HCCControlledDispatchInput,
} from "../../src/shared/lib/hcc-controlled-dispatch-adapter";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = () => "2026-06-14T12:00:00.000Z";

function makeDeps(): HCCControlledDispatchExecutorDeps & {
  shell_executor: ReturnType<typeof vi.fn>;
  writer: ReturnType<typeof vi.fn>;
  patcher: ReturnType<typeof vi.fn>;
} {
  return {
    shell_executor: vi.fn((id: string) => ({ command_id: id })),
    writer: vi.fn(() => ({ controlled_command_id: "cc-write" })),
    patcher: vi.fn(() => ({ controlled_command_id: "cc-patch" })),
  };
}

function makeInput(
  overrides: Partial<HCCControlledDispatchInput> = {},
): HCCControlledDispatchInput {
  return {
    planned_action_id: "act-001",
    backend: "in_memory",
    payload: undefined,
    trigger_proof: {
      explicit_user_trigger_token: "user-token-001",
      source_service: "hcc-shared-invocation-service",
    },
    executors: makeDeps(),
    now: NOW,
    ...overrides,
  };
}

describe("HCC controlled dispatch adapter: in_memory backend", () => {
  it("valid -> ok with in-memory controlled_command_id", async () => {
    const r = await controlledDispatch(makeInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.backend).toBe("in_memory");
      expect(r.value.controlled_command_id).toBe("in-memory:act-001");
      expect(r.value.audit.executed).toBe(true);
      expect(r.value.audit.executor).toBe("in-memory");
    }
  });

  it("in_memory does NOT call any executor", async () => {
    const deps = makeDeps();
    await controlledDispatch(makeInput({ executors: deps }));
    expect(deps.shell_executor).not.toHaveBeenCalled();
    expect(deps.writer).not.toHaveBeenCalled();
    expect(deps.patcher).not.toHaveBeenCalled();
  });
});

describe("HCC controlled dispatch adapter: file_write backend", () => {
  it("valid repo-local file path -> ok via injected writer", async () => {
    const deps = makeDeps();
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "docs/notes/test-001.md",
          content: "hello",
        },
        executors: deps,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.backend).toBe("file_write");
      expect(r.value.controlled_command_id).toBe("cc-write");
      expect(r.value.audit.executor).toBe("writer");
      expect(r.value.audit.target_identity).toBe("docs/notes/test-001.md");
    }
    expect(deps.writer).toHaveBeenCalledWith(
      "docs/notes/test-001.md",
      "hello",
    );
  });

  it("absolute external path -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "/etc/passwd",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("DENIED");
      expect(r.failure.reason).toMatch(/repo-local/);
    }
  });

  it("Windows-style absolute path -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("~/.hermes/** -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "~/.hermes/audit/x.md",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("DENIED");
      expect(r.failure.reason).toMatch(/repo-local/);
    }
  });

  it(".. traversal -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "docs/notes/../escape.md",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("target = src/main/index.ts -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "src/main/index.ts",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("DENIED");
      expect(r.failure.reason).toMatch(/locked/);
    }
  });

  it("target = package.json -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "package.json",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("target = package-lock.json -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "package-lock.json",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("target = docs/knowledge/** -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "docs/knowledge/foo.md",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toMatch(/locked/);
    }
  });

  it("disallowed extension -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "docs/notes/x.exe",
          content: "x",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toMatch(/\.md|\.json|\.ts/);
    }
  });

  it("writer throws -> EXECUTOR_REJECTED", async () => {
    const deps: HCCControlledDispatchExecutorDeps = {
      shell_executor: vi.fn(),
      writer: vi.fn(() => {
        throw new Error("disk full");
      }),
      patcher: vi.fn(),
    };
    const r = await controlledDispatch(
      makeInput({
        backend: "file_write",
        payload: {
          kind: "file",
          target_path: "docs/notes/x.md",
          content: "x",
        },
        executors: deps,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("EXECUTOR_REJECTED");
      expect(r.failure.reason).toMatch(/disk full/);
    }
  });
});

describe("HCC controlled dispatch adapter: config_patch backend", () => {
  it("valid patch -> ok via injected patcher", async () => {
    const deps = makeDeps();
    const r = await controlledDispatch(
      makeInput({
        backend: "config_patch",
        payload: {
          kind: "config",
          target_path: "src/shared/lib/notes/cfg.json",
          patch: [{ key: "feature.enabled", value: true }],
        },
        executors: deps,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.backend).toBe("config_patch");
      expect(r.value.controlled_command_id).toBe("cc-patch");
      expect(r.value.audit.executor).toBe("patcher");
    }
    expect(deps.patcher).toHaveBeenCalledWith(
      "src/shared/lib/notes/cfg.json",
      [{ key: "feature.enabled", value: true }],
    );
  });

  it("config_patch target = package.json -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "config_patch",
        payload: {
          kind: "config",
          target_path: "package.json",
          patch: [{ key: "x", value: 1 }],
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("config_patch target = src/main/index.ts -> DENIED (locked)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "config_patch",
        payload: {
          kind: "config",
          target_path: "src/main/index.ts",
          patch: [{ key: "x", value: 1 }],
        },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("empty patch -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "config_patch",
        payload: {
          kind: "config",
          target_path: "docs/notes/cfg.json",
          patch: [],
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toMatch(/patch/);
    }
  });

  it("patch entry with non-string key -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "config_patch",
        payload: {
          kind: "config",
          target_path: "docs/notes/cfg.json",
          patch: [{ key: 42, value: 1 } as never],
        },
      }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("HCC controlled dispatch adapter: shell_command backend", () => {
  it("allowlisted argv -> ok via injected shell_executor", async () => {
    const deps = makeDeps();
    const entry = HCC_DISPATCH_SHELL_ALLOWLIST[0];
    const r = await controlledDispatch(
      makeInput({
        backend: "shell_command",
        payload: { kind: "shell", argv: entry.argv },
        executors: deps,
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.backend).toBe("shell_command");
      expect(r.value.controlled_command_id).toContain("shell:git.status");
    }
    expect(deps.shell_executor).toHaveBeenCalledWith(
      entry.command_id,
      entry.argv,
    );
  });

  it("non-allowlisted argv -> DENIED (refuses arbitrary shell)", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "shell_command",
        payload: { kind: "shell", argv: ["rm", "-rf", "/"] },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("DENIED");
      expect(r.failure.reason).toMatch(/allowlist|arbitrary/);
    }
  });

  it("argv with non-string element -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "shell_command",
        payload: { kind: "shell", argv: [42 as never] },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("empty argv -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        backend: "shell_command",
        payload: { kind: "shell", argv: [] },
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("shell_executor throws -> EXECUTOR_REJECTED", async () => {
    const deps: HCCControlledDispatchExecutorDeps = {
      shell_executor: vi.fn(() => {
        throw new Error("exec denied");
      }),
      writer: vi.fn(),
      patcher: vi.fn(),
    };
    const entry = HCC_DISPATCH_SHELL_ALLOWLIST[0];
    const r = await controlledDispatch(
      makeInput({
        backend: "shell_command",
        payload: { kind: "shell", argv: entry.argv },
        executors: deps,
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("EXECUTOR_REJECTED");
    }
  });
});

describe("HCC controlled dispatch adapter: trigger / backend guards", () => {
  it("missing explicit_user_trigger_token -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        trigger_proof: {
          explicit_user_trigger_token: "",
          source_service: "hcc-shared-invocation-service",
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toMatch(/trigger/);
    }
  });

  it("unknown source_service -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({
        trigger_proof: {
          explicit_user_trigger_token: "x",
          source_service: "rogue-service" as never,
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.reason).toMatch(/source_service/);
    }
  });

  it("missing executors -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({ executors: undefined as never }),
    );
    expect(r.ok).toBe(false);
  });

  it("missing now() clock -> DENIED", async () => {
    const r = await controlledDispatch(
      makeInput({ now: undefined as never }),
    );
    expect(r.ok).toBe(false);
  });

  it("unknown backend -> BACKEND_UNAVAILABLE", async () => {
    const r = await controlledDispatch(
      makeInput({ backend: "rogue" as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.kind).toBe("BACKEND_UNAVAILABLE");
    }
  });
});

describe("HCC controlled dispatch adapter: buildControlledDispatchAdapter (final dispatch compat)", () => {
  it("builds adapter; supports shell_command / file_write / config_patch", () => {
    const adapter = buildControlledDispatchAdapter(() => ({
      planned_action_id: "act-001",
      backend: "file_write",
      payload: {
        kind: "file",
        target_path: "docs/notes/test.md",
        content: "x",
      },
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-shared-invocation-service",
      },
      executors: makeDeps(),
      now: NOW,
    }));
    expect(adapter.supportsKind("file_write")).toBe(true);
    expect(adapter.supportsKind("shell_command")).toBe(true);
    expect(adapter.supportsKind("config_patch")).toBe(true);
  });

  it("adapter dispatches via injected writer for file_write", async () => {
    const deps = makeDeps();
    const adapter = buildControlledDispatchAdapter(() => ({
      planned_action_id: "act-001",
      backend: "file_write",
      payload: {
        kind: "file",
        target_path: "docs/notes/test.md",
        content: "x",
      },
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-shared-invocation-service",
      },
      executors: deps,
      now: NOW,
    }));
    const r = await adapter.dispatch("act-001", "file_write", "docs/notes/test.md");
    expect(r.controlled_command_id).toBe("cc-write");
    expect(deps.writer).toHaveBeenCalled();
  });

  it("adapter denied -> dispatch throws", async () => {
    const adapter = buildControlledDispatchAdapter(() => ({
      planned_action_id: "act-001",
      backend: "file_write",
      payload: {
        kind: "file",
        target_path: "/etc/passwd",
        content: "x",
      },
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-shared-invocation-service",
      },
      executors: makeDeps(),
      now: NOW,
    }));
    await expect(
      adapter.dispatch("act-001", "file_write", "/etc/passwd"),
    ).rejects.toThrow(/denied|DENIED/);
  });
});

describe("HCC controlled dispatch adapter: no auto-start / no unattended", () => {
  it("lib does NOT auto-select a real backend (factory is the only way)", () => {
    // The default constructor does nothing; the only way to
    // get an adapter is to call buildControlledDispatchAdapter
    // with an explicit factory. If the lib had an implicit
    // default, that would be a test failure mode we want to
    // catch.
    const adapter = buildControlledDispatchAdapter(() => ({
      planned_action_id: "act-001",
      backend: "in_memory",
      payload: undefined,
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-user-explicit-local-invoker",
      },
      executors: makeDeps(),
      now: NOW,
    }));
    expect(adapter.supportsKind("file_write")).toBe(true);
    // No implicit dispatch happened; we constructed an
    // adapter and asked it whether it supports a kind.
    // The dispatcher would only run if a real final dispatch
    // called `adapter.dispatch(...)`.
  });
});

describe("HCC controlled dispatch adapter: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_CONTROLLED_DISPATCH_ADAPTER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT set unattended_ready / night_run_ready: true / go_no_go: \"GO\"", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/\bexec\s*\(/);
  });

  it("lib does NOT call ipcMain / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("lib does NOT write ~/.hermes/**", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/writeFile/);
  });
});
