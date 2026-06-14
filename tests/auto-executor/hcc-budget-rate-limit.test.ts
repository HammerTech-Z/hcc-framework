import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checkBudget,
  getHccBudgetPosture,
  HCC_BUDGET_RATE_LIMIT_SCHEMA_VERSION,
  HCC_BUDGET_HARD_LIMITS,
  HCC_BUDGET_SOFT_STOP_RATIO,
  type HCCBudgetObserved,
} from "../../src/shared/lib/hcc-budget-rate-limit";

const REPO_ROOT = resolve(__dirname, "../..");

const ZERO: HCCBudgetObserved = {
  task_count: 0,
  wall_clock_ms: 0,
  subprocess_count: 0,
  token_used: 0,
  output_bytes: 0,
  failure_count: 0,
};

describe("HCC budget / rate limit: normal usage within budget", () => {
  it("zero usage is within_budget", () => {
    const r = checkBudget({ observed: ZERO });
    expect(r.verdict).toBe("within_budget");
    expect(r.exceeded_fields).toEqual([]);
    expect(r.warn_fields).toEqual([]);
    expect(r.implies_real_execution).toBe(false);
    expect(r.implies_unattended).toBe(false);
  });

  it("mid-range usage is within_budget", () => {
    const r = checkBudget({
      observed: {
        task_count: 2,
        wall_clock_ms: 600_000,
        subprocess_count: 0,
        token_used: 100_000,
        output_bytes: 1_000_000,
        failure_count: 0,
      },
    });
    expect(r.verdict).toBe("within_budget");
  });

  it("exactly at hard limit triggers soft stop (>= 80% of cap)", () => {
    const r = checkBudget({
      observed: {
        ...ZERO,
        task_count: HCC_BUDGET_HARD_LIMITS.max_task_count,
        wall_clock_ms: HCC_BUDGET_HARD_LIMITS.max_wall_clock_ms,
        token_used: HCC_BUDGET_HARD_LIMITS.max_token_budget,
        output_bytes: HCC_BUDGET_HARD_LIMITS.max_output_bytes,
      },
    });
    // At 100% of cap, all 4 non-zero fields are at >= 80% → soft stop.
    expect(r.verdict).toBe("soft_stop_required");
    expect(r.exceeded_fields).toEqual([]);
  });
});

describe("HCC budget / rate limit: hard stop on cap exceeded", () => {
  it("task_count exceeded", () => {
    const r = checkBudget({
      observed: { ...ZERO, task_count: HCC_BUDGET_HARD_LIMITS.max_task_count + 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("task_count");
  });

  it("wall_clock_ms exceeded", () => {
    const r = checkBudget({
      observed: { ...ZERO, wall_clock_ms: HCC_BUDGET_HARD_LIMITS.max_wall_clock_ms + 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("wall_clock_ms");
  });

  it("subprocess_count exceeded (any > 0 is hard stop since cap is 0)", () => {
    const r = checkBudget({
      observed: { ...ZERO, subprocess_count: 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("subprocess_count");
  });

  it("token_used exceeded", () => {
    const r = checkBudget({
      observed: { ...ZERO, token_used: HCC_BUDGET_HARD_LIMITS.max_token_budget + 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("token_used");
  });

  it("output_bytes exceeded", () => {
    const r = checkBudget({
      observed: { ...ZERO, output_bytes: HCC_BUDGET_HARD_LIMITS.max_output_bytes + 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("output_bytes");
  });

  it("failure_count exceeded (max is 1)", () => {
    const r = checkBudget({
      observed: { ...ZERO, failure_count: HCC_BUDGET_HARD_LIMITS.max_failure_count + 1 },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields).toContain("failure_count");
  });

  it("multiple caps exceeded at once", () => {
    const r = checkBudget({
      observed: {
        ...ZERO,
        task_count: 999,
        token_used: 999_999_999,
      },
    });
    expect(r.verdict).toBe("hard_stop_required");
    expect(r.exceeded_fields.length).toBe(2);
  });
});

describe("HCC budget / rate limit: soft stop at >= 80% of cap", () => {
  it("task_count at exactly 80% triggers soft stop", () => {
    const at80 = Math.floor(HCC_BUDGET_HARD_LIMITS.max_task_count * HCC_BUDGET_SOFT_STOP_RATIO);
    const r = checkBudget({ observed: { ...ZERO, task_count: at80 } });
    expect(r.verdict).toBe("soft_stop_required");
    expect(r.warn_fields).toContain("task_count");
    expect(r.exceeded_fields).toEqual([]);
  });

  it("wall_clock_ms at 80% triggers soft stop", () => {
    const at80 = Math.floor(HCC_BUDGET_HARD_LIMITS.max_wall_clock_ms * HCC_BUDGET_SOFT_STOP_RATIO);
    const r = checkBudget({ observed: { ...ZERO, wall_clock_ms: at80 } });
    expect(r.verdict).toBe("soft_stop_required");
    expect(r.warn_fields).toContain("wall_clock_ms");
  });

  it("task_count at 79% does NOT trigger soft stop", () => {
    const at79 = Math.floor(HCC_BUDGET_HARD_LIMITS.max_task_count * 0.79);
    const r = checkBudget({ observed: { ...ZERO, task_count: at79 } });
    expect(r.verdict).toBe("within_budget");
  });
});

describe("HCC budget / rate limit: deny_unattended when caller claims unattended_ready", () => {
  it("denies when unattended_ready=true even with zero usage", () => {
    const r = checkBudget({ observed: ZERO, unattended_ready: true });
    expect(r.verdict).toBe("deny_unattended");
  });

  it("denies when unattended_ready=true with mid-range usage", () => {
    const r = checkBudget({
      observed: {
        task_count: 1,
        wall_clock_ms: 1000,
        subprocess_count: 0,
        token_used: 1000,
        output_bytes: 1000,
        failure_count: 0,
      },
      unattended_ready: true,
    });
    expect(r.verdict).toBe("deny_unattended");
  });
});

describe("HCC budget / rate limit: posture", () => {
  it("posture: real_execution_ready=false, unattended_ready=false, night_run_ready=false, go_no_go=NO-GO", () => {
    const p = getHccBudgetPosture();
    expect(p.real_execution_ready).toBe(false);
    expect(p.unattended_ready).toBe(false);
    expect(p.night_run_ready).toBe(false);
    expect(p.go_no_go).toBe("NO-GO");
    expect(p.implies_real_execution).toBe(false);
    expect(p.implies_unattended).toBe(false);
    expect(p.subprocess_count).toBe(0);
  });

  it("posture: hard_limits exposed", () => {
    const p = getHccBudgetPosture();
    expect(p.hard_limits.max_task_count).toBe(5);
    expect(p.hard_limits.max_subprocess_count).toBe(0);
    expect(p.hard_limits.max_failure_count).toBe(1);
  });
});

describe("HCC budget / rate limit: schema + invariants", () => {
  it("schema version is 1.0.0", () => {
    expect(HCC_BUDGET_RATE_LIMIT_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor invariants: night_run_ready=false / go_no_go=NO-GO preserved", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("budget contract does not imply real execution (implies_real_execution literal false in all results)", () => {
    const r1 = checkBudget({ observed: ZERO });
    const r2 = checkBudget({
      observed: { ...ZERO, task_count: 999 },
    });
    const r3 = checkBudget({ observed: ZERO, unattended_ready: true });
    expect(r1.implies_real_execution).toBe(false);
    expect(r2.implies_real_execution).toBe(false);
    expect(r3.implies_real_execution).toBe(false);
  });
});

describe("HCC budget / rate limit: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-budget-rate-limit.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-budget-rate-limit.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-budget-rate-limit.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT mention ~/.hermes outside doc comments", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-budget-rate-limit.ts"),
      "utf8",
    );
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const writeMatches = stripped.match(/~\/\.hermes/g) ?? [];
    expect(writeMatches.length).toBe(0);
  });
});