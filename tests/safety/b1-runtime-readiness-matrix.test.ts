import { describe, it, expect } from "vitest";
import {
  B1_RUNTIME_READINESS_MATRIX,
  B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR,
  B1_RUNTIME_READINESS_MATRIX_SCHEMA_VERSION,
  assertB1MatrixNoRuntimeSideEffects,
  decideB1Admission,
  listB1BlockingSurfaces,
  type B1RuntimeReadinessEntry,
  type B1SurfaceStatus,
} from "@shared/lib/safety/b1-runtime-readiness-matrix";

const SURFACE_IDS = [
  "backend_daemon",
  "channel_runtime",
  "cron_scheduling",
  "weixin_ingress",
  "gateway_ipc",
  "hcc_auto_executor_live_apply",
  "user_authorization",
  "no_hermes_config_writes",
  "no_runtime_mutation",
] as const;

const matrixEntry = (id: string): B1RuntimeReadinessEntry | undefined =>
  B1_RUNTIME_READINESS_MATRIX.find((entry) => entry.id === id);

describe("B1 runtime readiness matrix (HERMES-GOV-005)", () => {
  it("descriptor pins a stable schema version and matrix id", () => {
    expect(B1_RUNTIME_READINESS_MATRIX_SCHEMA_VERSION).toBe("1.0.0");
    expect(B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR.schema_version).toBe(
      "1.0.0",
    );
    expect(B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR.matrix_id).toBe(
      "HERMES-GOV-005::b1-runtime-readiness-matrix",
    );
    expect(B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR.evidence_ref).toContain(
      "HERMES-GOV-005",
    );
  });

  it("covers exactly the documented B1 surfaces", () => {
    const declaredIds = B1_RUNTIME_READINESS_MATRIX.map((e) => e.id).sort();
    expect(declaredIds).toEqual([...SURFACE_IDS].sort());
  });

  it("every entry has a description and a deterministic id", () => {
    for (const entry of B1_RUNTIME_READINESS_MATRIX) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.blocks_admission).toBe("boolean");
    }
  });

  it("ready / blocked / requires_separate_slice entries carry an evidence_ref", () => {
    for (const entry of B1_RUNTIME_READINESS_MATRIX) {
      if (entry.status === "not_applicable") continue;
      expect(
        typeof entry.evidence_ref === "string" && entry.evidence_ref.length > 0,
        `${entry.id} (status=${entry.status}) must have evidence_ref`,
      ).toBe(true);
    }
  });

  it("ready and not_applicable surfaces do not block admission", () => {
    for (const entry of B1_RUNTIME_READINESS_MATRIX) {
      if (entry.status === "ready" || entry.status === "not_applicable") {
        expect(
          entry.blocks_admission,
          `${entry.id} (status=${entry.status}) must not block admission`,
        ).toBe(false);
      }
    }
  });

  it("blocked / requires_user_authorization / requires_separate_slice surfaces do block admission", () => {
    const blockingStatuses: B1SurfaceStatus[] = [
      "blocked",
      "requires_user_authorization",
      "requires_separate_slice",
    ];
    for (const entry of B1_RUNTIME_READINESS_MATRIX) {
      if (blockingStatuses.includes(entry.status)) {
        expect(
          entry.blocks_admission,
          `${entry.id} (status=${entry.status}) must block admission`,
        ).toBe(true);
      }
    }
  });

  it("every non-ready / non-not_applicable entry points at a next slice", () => {
    for (const entry of B1_RUNTIME_READINESS_MATRIX) {
      if (entry.status === "ready" || entry.status === "not_applicable") continue;
      expect(
        typeof entry.next_slice === "string" && entry.next_slice.length > 0,
        `${entry.id} (status=${entry.status}) must declare next_slice`,
      ).toBe(true);
    }
  });

  it("B1 admission is NOT-GO by default", () => {
    const decision = decideB1Admission();
    expect(decision.go).toBe(false);
    expect(decision.not_go_reason).toMatch(/NOT-GO/);
    expect(decision.blocking_surfaces.length).toBeGreaterThan(0);
  });

  it("backend daemon / channel runtime / cron / weixin surfaces are blocked", () => {
    const runtimeSurfaceIds = [
      "backend_daemon",
      "channel_runtime",
      "cron_scheduling",
      "weixin_ingress",
    ] as const;
    for (const id of runtimeSurfaceIds) {
      const entry = matrixEntry(id);
      expect(entry, `${id} must be declared`).toBeDefined();
      expect(entry!.status, `${id} must be blocked`).toBe("blocked");
      expect(entry!.blocks_admission, `${id} must block admission`).toBe(true);
    }
  });

  it("HCC Auto Executor / live apply surface remains blocked", () => {
    const entry = matrixEntry("hcc_auto_executor_live_apply");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("blocked");
    expect(entry!.blocks_admission).toBe(true);
    expect(entry!.next_slice).toMatch(/HCC Auto Executor/);
  });

  it("user authorization surface requires_user_authorization and blocks admission", () => {
    const entry = matrixEntry("user_authorization");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("requires_user_authorization");
    expect(entry!.blocks_admission).toBe(true);
  });

  it("no ~/.hermes writes surface is ready and does not block admission", () => {
    const entry = matrixEntry("no_hermes_config_writes");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("ready");
    expect(entry!.blocks_admission).toBe(false);
  });

  it("no runtime mutation surface is ready and does not block admission", () => {
    const entry = matrixEntry("no_runtime_mutation");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("ready");
    expect(entry!.blocks_admission).toBe(false);
  });

  it("matrix does not authorize runtime mutation or ~/.hermes writes", () => {
    const report = assertB1MatrixNoRuntimeSideEffects();
    expect(report).toMatchObject({
      schema_version: "1.0.0",
      no_runtime_mutation: true,
      no_hermes_writes: true,
      no_daemon_or_cron_or_weixin_or_channel_or_live_apply_or_hcc: true,
    });
    // Belt-and-suspenders: literal booleans are true.
    expect(report.no_runtime_mutation).toBe(true);
    expect(report.no_hermes_writes).toBe(true);
    expect(
      report.no_daemon_or_cron_or_weixin_or_channel_or_live_apply_or_hcc,
    ).toBe(true);
  });

  it("B2 coverage is not enough to admit LOOP-010.A while B1 blockers remain", () => {
    // B2 readiness is out of scope for this matrix, but the
    // decideB1Admission result must NOT change just because a downstream
    // caller asserts B2 is covered. The matrix is a pure B1 view.
    const decision = decideB1Admission();
    expect(decision.go).toBe(false);
    expect(decision.blocking_surfaces).toContain("backend_daemon");
    expect(decision.blocking_surfaces).toContain("channel_runtime");
    expect(decision.blocking_surfaces).toContain("cron_scheduling");
    expect(decision.blocking_surfaces).toContain("weixin_ingress");
  });

  it("next smallest B1 slice is explicitly identified by the matrix", () => {
    const decision = decideB1Admission();
    expect(decision.next_slice).toBeTypeOf("string");
    expect(decision.next_slice!.length).toBeGreaterThan(0);
    expect(decision.next_slice!).toMatch(/HERMES-GOV-006/);
  });

  it("listB1BlockingSurfaces matches decideB1Admission().blocking_surfaces", () => {
    const blockers = listB1BlockingSurfaces();
    const ids = blockers.map((b) => b.id);
    expect(ids).toEqual(decideB1Admission().blocking_surfaces);
    // Every blocker is non-ready / non-not_applicable.
    for (const blocker of blockers) {
      expect(blocker.status).not.toBe("ready");
      expect(blocker.status).not.toBe("not_applicable");
      expect(blocker.blocks_admission).toBe(true);
    }
  });
});
