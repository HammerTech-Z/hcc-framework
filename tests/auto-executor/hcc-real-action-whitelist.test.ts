import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  decideRealAction,
  isForbiddenSurface,
  getHccRealActionWhitelistPosture,
  HCC_REAL_ACTION_WHITELIST_SCHEMA_VERSION,
  type HCCRealActionDescriptor,
} from "../../src/shared/lib/hcc-real-action-whitelist";

const REPO_ROOT = resolve(__dirname, "../..");

function mkDescriptor(
  id: string,
  surfaces: HCCRealActionDescriptor["surfaces"] = ["repo_local_read"],
  overrides: Partial<HCCRealActionDescriptor> = {},
): HCCRealActionDescriptor {
  return {
    id,
    description: `test: ${id}`,
    surfaces,
    implies_unattended: false,
    touches_hermes_config: false,
    requires_shell_spawn: false,
    auto_apply: false,
    ...overrides,
  };
}

describe("HCC real action whitelist: forbidden surfaces", () => {
  it("shell_spawn is forbidden", () => {
    expect(isForbiddenSurface("shell_spawn")).toBe(true);
  });

  it("git_push is forbidden", () => {
    expect(isForbiddenSurface("git_push")).toBe(true);
  });

  it("git_destructive is forbidden", () => {
    expect(isForbiddenSurface("git_destructive")).toBe(true);
  });

  it("hermes_config_write is forbidden", () => {
    expect(isForbiddenSurface("hermes_config_write")).toBe(true);
  });

  it("package_install is forbidden", () => {
    expect(isForbiddenSurface("package_install")).toBe(true);
  });

  it("ipc_register is forbidden", () => {
    expect(isForbiddenSurface("ipc_register")).toBe(true);
  });

  it("timer_register is forbidden", () => {
    expect(isForbiddenSurface("timer_register")).toBe(true);
  });

  it("browser_action is forbidden", () => {
    expect(isForbiddenSurface("browser_action")).toBe(true);
  });

  it("external_publish is forbidden", () => {
    expect(isForbiddenSurface("external_publish")).toBe(true);
  });

  it("credential_access is forbidden", () => {
    expect(isForbiddenSurface("credential_access")).toBe(true);
  });

  it("live_apply is forbidden", () => {
    expect(isForbiddenSurface("live_apply")).toBe(true);
  });

  it("repo_local_read is NOT forbidden", () => {
    expect(isForbiddenSurface("repo_local_read")).toBe(false);
  });

  it("repo_local_dry_run_mutate is NOT forbidden (but approval_required)", () => {
    expect(isForbiddenSurface("repo_local_dry_run_mutate")).toBe(false);
  });

  it("test_run_dry is NOT forbidden", () => {
    expect(isForbiddenSurface("test_run_dry")).toBe(false);
  });

  it("docs_propose_only is NOT forbidden", () => {
    expect(isForbiddenSurface("docs_propose_only")).toBe(false);
  });
});

describe("HCC real action whitelist: default deny", () => {
  it("default deny for unknown action id", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("unknown-action-id-999"),
    });
    expect(r.decision).toBe("deny");
    expect(r.matched_entry).toBeNull();
  });

  it("default deny when descriptor surfaces include a forbidden surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["shell_spawn"]),
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("shell_spawn");
  });
});

describe("HCC real action whitelist: allowed low-risk actions", () => {
  it("read_repo_status is allow", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status"),
    });
    expect(r.decision).toBe("allow");
    expect(r.matched_entry).not.toBeNull();
    expect(r.matched_entry!.risk_level).toBe("low");
  });

  it("git_diff_inspection is allow", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("git_diff_inspection"),
    });
    expect(r.decision).toBe("allow");
  });

  it("propose_test_run is allow", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("propose_test_run", ["test_run_dry"]),
    });
    expect(r.decision).toBe("allow");
    expect(r.matched_entry!.required_verifier).toBe("verifier-test-proposal");
  });

  it("propose_docs_update is allow (low risk; rollback strategy pinned)", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("propose_docs_update", ["docs_propose_only"]),
    });
    expect(r.decision).toBe("allow");
    expect(r.matched_entry!.rollback_strategy).toBe("git_revert_commit");
  });

  it("repo_local_dry_run_mutate is requires_user_approval (moderate risk)", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("repo_local_dry_run_mutate", [
        "repo_local_dry_run_mutate",
      ]),
    });
    expect(r.decision).toBe("requires_user_approval");
  });

  it("real_command_execution is deny (high risk)", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("real_command_execution", []),
    });
    expect(r.decision).toBe("deny");
  });
});

describe("HCC real action whitelist: dangerous surfaces refused", () => {
  it("denies hermes_config_write surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["hermes_config_write"]),
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("hermes_config_write");
  });

  it("denies ipc_register surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["ipc_register"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies timer_register surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["timer_register"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies package_install surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["package_install"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies git_push surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["git_push"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies git_destructive surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["git_destructive"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies credential_access surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["credential_access"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies external_publish surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["external_publish"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies browser_action surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["browser_action"]),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies live_apply surface", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["live_apply"]),
    });
    expect(r.decision).toBe("deny");
  });
});

describe("HCC real action whitelist: whitelist cannot imply unattended readiness", () => {
  it("denies when unattended_ready=true even with allow-eligible action", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status"),
      unattended_ready: true,
    });
    expect(r.decision).toBe("deny");
    expect(r.reason).toContain("unattended_ready");
  });

  it("denies when unattended_ready=true with propose_docs_update", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("propose_docs_update", ["docs_propose_only"]),
      unattended_ready: true,
    });
    expect(r.decision).toBe("deny");
  });

  it("denies when descriptor.implies_unattended=true", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["repo_local_read"], {
        implies_unattended: true,
      }),
    });
    expect(r.decision).toBe("deny");
  });
});

describe("HCC real action whitelist: dangerous descriptor fields refused", () => {
  it("denies when touches_hermes_config=true", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["repo_local_read"], {
        touches_hermes_config: true,
      }),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies when requires_shell_spawn=true", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["repo_local_read"], {
        requires_shell_spawn: true,
      }),
    });
    expect(r.decision).toBe("deny");
  });

  it("denies when auto_apply=true", () => {
    const r = decideRealAction({
      descriptor: mkDescriptor("read_repo_status", ["repo_local_read"], {
        auto_apply: true,
      }),
    });
    expect(r.decision).toBe("deny");
  });
});

describe("HCC real action whitelist: posture", () => {
  it("posture: default_deny=true, night_run_ready=false, go_no_go=NO-GO", () => {
    const p = getHccRealActionWhitelistPosture();
    expect(p.default_deny).toBe(true);
    expect(p.night_run_ready).toBe(false);
    expect(p.go_no_go).toBe("NO-GO");
    expect(p.may_imply_unattended).toBe(false);
    expect(p.may_touch_hermes_config).toBe(false);
    expect(p.may_shell_spawn).toBe(false);
  });

  it("posture: total_entries >= 1", () => {
    const p = getHccRealActionWhitelistPosture();
    expect(p.total_entries).toBeGreaterThanOrEqual(1);
  });

  it("posture: allow_entries + approval_entries + deny_entries = total_entries", () => {
    const p = getHccRealActionWhitelistPosture();
    expect(p.allow_entries + p.approval_entries + p.deny_entries).toBe(
      p.total_entries,
    );
  });
});

describe("HCC real action whitelist: schema + invariants", () => {
  it("schema version is 1.0.0", () => {
    expect(HCC_REAL_ACTION_WHITELIST_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor invariants: night_run_ready=false / go_no_go=NO-GO preserved", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC real action whitelist: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-real-action-whitelist.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-real-action-whitelist.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-real-action-whitelist.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT mention ~/.hermes outside the contract comment", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-real-action-whitelist.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    // `~/.hermes` only appears in doc comments listing forbidden
    // surfaces. The strict count of write operations is zero.
    const writeMatches = stripped.match(/~\/\.hermes/g) ?? [];
    expect(writeMatches.length).toBe(0);
  });
});