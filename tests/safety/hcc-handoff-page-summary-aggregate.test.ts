import { describe, expect, it } from "vitest";

import {
  buildHCCHandoffPageSummary,
  aggregateHCCHandoffPageSummaries,
} from "../../src/main/hcc-handoff-page-summary";

import type { HCCHandoffPageSummary } from "../../src/main/hcc-handoff-page-summary";
import type { HCCArtifactRecordSummary } from "../../src/main/hcc-artifact-store";

// -----------------------------------------------------------------
// P3 Code Task 006 — Handoff Page Summary Aggregator
// -----------------------------------------------------------------

describe("HCCHandoffPageSummary aggregator (P3 Code Task 006)", () => {
  // Helper: build a HCCHandoffPageSummary with sensible defaults
  // and per-test overrides. We mutate a JSON-clone of a real
  // buildHCCHandoffPageSummary output to keep the input shape
  // valid (so we only have to worry about the field we are
  // deliberately changing).
  const baseSummary = (): HCCHandoffPageSummary =>
    buildHCCHandoffPageSummary({
      schema_version: "1.0.0",
      task_id: "base-task",
      valid: true,
      errors: [],
      artifact_type: "hcc_dry_run_combined",
      redaction_status: "not_run",
      source_commit: {
        commit: null,
        branch: null,
        is_git_repo: false,
      },
      has_content_hash: false,
      plan_ref: "hcc-dry-run://base-task/plan",
      handoff_ref: "hcc-dry-run://base-task/handoff-payload",
      verifier_ref: "hcc-dry-run://base-task/verifier-input",
      do_not_read_count: 5,
      do_not_read_markers: {
        archive_lock: true,
        handoff_packs: true,
        audit: true,
        secrets: true,
        before: true,
      },
      forbidden_fields_checked_count: 8,
      notes_count: 0,
      next_action_owners: ["claude_code", "hermes", "user"],
    } as unknown as HCCArtifactRecordSummary);

  const override = (
    base: HCCHandoffPageSummary,
    patch: Partial<HCCHandoffPageSummary>,
  ): HCCHandoffPageSummary => ({ ...base, ...patch });

  // ---- 1. empty input ----

  it("empty input produces a zero-totalled, no-error aggregate", () => {
    const agg = aggregateHCCHandoffPageSummaries([]);
    expect(agg.total).toBe(0);
    expect(agg.ready).toBe(0);
    expect(agg.blocked).toBe(0);
    expect(agg.invalid).toBe(0);
    expect(agg.task_ids).toEqual([]);
    expect(agg.next_action_owner_counts).toEqual({
      claude_code: 0,
      hermes: 0,
      user: 0,
    });
    expect(agg.errors).toEqual([]);
  });

  it("empty input still respects the dry-run-only / executable_count=0 invariants", () => {
    const agg = aggregateHCCHandoffPageSummaries([]);
    expect(agg.dry_run_only).toBe(true);
    expect(agg.executable_count).toBe(0);
  });

  it("empty input's safety flags default to true (vacuously)", () => {
    const agg = aggregateHCCHandoffPageSummaries([]);
    expect(agg.safety.all_no_ipc).toBe(true);
    expect(agg.safety.all_no_spawn).toBe(true);
    expect(agg.safety.all_no_runPlaybook).toBe(true);
    expect(agg.safety.all_have_archive_guard).toBe(true);
    expect(agg.safety.all_have_handoff_packs_guard).toBe(true);
    expect(agg.safety.all_have_audit_guard).toBe(true);
  });

  // ---- 2. single ready ----

  it("single ready summary → total=1, ready=1, blocked=0, invalid=0", () => {
    const a = override(baseSummary(), { task_id: "t1", status: "ready" });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    expect(agg.total).toBe(1);
    expect(agg.ready).toBe(1);
    expect(agg.blocked).toBe(0);
    expect(agg.invalid).toBe(0);
    expect(agg.task_ids).toEqual(["t1"]);
  });

  // ---- 3. mixed status counts ----

  it("mixed ready/blocked/invalid counts correctly", () => {
    const a = override(baseSummary(), { task_id: "t1", status: "ready" });
    const b = override(baseSummary(), { task_id: "t2", status: "blocked" });
    const c = override(baseSummary(), { task_id: "t3", status: "invalid" });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    expect(agg.total).toBe(3);
    expect(agg.ready).toBe(1);
    expect(agg.blocked).toBe(1);
    expect(agg.invalid).toBe(1);
  });

  // ---- 4. task_ids preserve input order ----

  it("task_ids preserve input order even when ids are not sorted", () => {
    const a = override(baseSummary(), { task_id: "z" });
    const b = override(baseSummary(), { task_id: "a" });
    const c = override(baseSummary(), { task_id: "m" });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    expect(agg.task_ids).toEqual(["z", "a", "m"]);
  });

  // ---- 5. next_action_owner_counts ----

  it("next_action_owner_counts tally each owner's occurrences across all summaries", () => {
    const a = override(baseSummary(), {
      task_id: "t1",
      next_action_owners: ["claude_code", "hermes", "user"],
    });
    const b = override(baseSummary(), {
      task_id: "t2",
      next_action_owners: ["claude_code", "hermes"], // missing user
    });
    const c = override(baseSummary(), {
      task_id: "t3",
      next_action_owners: ["claude_code"], // missing hermes, user
    });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    expect(agg.next_action_owner_counts).toEqual({
      claude_code: 3,
      hermes: 2,
      user: 1,
    });
  });

  // ---- 6. safety all_* flags reduce with AND ----

  it("safety all_* flags are true when every summary has them true", () => {
    const a = baseSummary();
    const b = baseSummary();
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.safety.all_no_ipc).toBe(true);
    expect(agg.safety.all_no_spawn).toBe(true);
    expect(agg.safety.all_no_runPlaybook).toBe(true);
    expect(agg.safety.all_have_archive_guard).toBe(true);
    expect(agg.safety.all_have_handoff_packs_guard).toBe(true);
    expect(agg.safety.all_have_audit_guard).toBe(true);
  });

  it("safety all_* flags flip to false when one summary is missing a guard", () => {
    const a = baseSummary();
    const b = override(baseSummary(), {
      safety_flags: {
        no_ipc: true,
        no_spawn: true,
        no_runPlaybook: true,
        has_archive_guard: false, // <-- missing
        has_handoff_packs_guard: true,
        has_audit_guard: true,
      },
    });
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.safety.all_have_archive_guard).toBe(false);
    // Other guards remain true.
    expect(agg.safety.all_have_handoff_packs_guard).toBe(true);
    expect(agg.safety.all_have_audit_guard).toBe(true);
  });

  it("safety all_no_* flags flip to false when one summary has them false", () => {
    const a = baseSummary();
    const b = override(baseSummary(), {
      safety_flags: {
        no_ipc: false, // <-- violation
        no_spawn: true,
        no_runPlaybook: true,
        has_archive_guard: true,
        has_handoff_packs_guard: true,
        has_audit_guard: true,
      },
    });
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.safety.all_no_ipc).toBe(false);
  });

  // ---- 7. executable_count is always 0 ----

  it("executable_count is always 0 (literal type)", () => {
    const a = baseSummary();
    const b = baseSummary();
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.executable_count).toBe(0);
  });

  // ---- 8. dry_run_only is always true ----

  it("dry_run_only is always true (literal type)", () => {
    const a = baseSummary();
    const b = baseSummary();
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.dry_run_only).toBe(true);
  });

  // ---- 9. non-dryRun summary captured as error ----

  it("non-dryRun summary is captured in errors (no throw)", () => {
    const a = override(baseSummary(), { dryRun: false as unknown as true });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    expect(agg.errors.join("\n")).toMatch(/dryRun must be true/);
  });

  // ---- 10. executable=true captured as error ----

  it("executable=true is captured in errors (no throw)", () => {
    const a = override(baseSummary(), { executable: true as unknown as false });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    expect(agg.errors.join("\n")).toMatch(/executable must be false/);
  });

  // ---- 11. runtime_class != dry_run captured as error ----

  it("runtime_class that is not dry_run is captured in errors (no throw)", () => {
    const a = override(baseSummary(), {
      runtime_class: "live" as unknown as "dry_run",
    });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    expect(agg.errors.join("\n")).toMatch(/runtime_class must be "dry_run"/);
  });

  it("multiple violations are surfaced in a single aggregate", () => {
    const a = override(baseSummary(), {
      dryRun: false as unknown as true,
      executable: true as unknown as false,
      runtime_class: "live" as unknown as "dry_run",
    });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    expect(agg.errors.length).toBe(3);
    expect(agg.errors.join("\n")).toMatch(/dryRun/);
    expect(agg.errors.join("\n")).toMatch(/executable/);
    expect(agg.errors.join("\n")).toMatch(/runtime_class/);
  });

  it("violation in summary[2] references the right index", () => {
    const a = baseSummary();
    const b = baseSummary();
    const c = override(baseSummary(), {
      dryRun: false as unknown as true,
    });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    expect(agg.errors.join("\n")).toMatch(/summary\[2\]/);
  });

  // ---- 12. JSON round-trip ----

  it("aggregate is JSON-serializable and round-trips", () => {
    const a = override(baseSummary(), { task_id: "t1", status: "ready" });
    const b = override(baseSummary(), { task_id: "t2", status: "blocked" });
    const c = override(baseSummary(), { task_id: "t3", status: "invalid" });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    const blob = JSON.stringify(agg, null, 2);
    const parsed = JSON.parse(blob);
    expect(parsed.total).toBe(3);
    expect(parsed.ready).toBe(1);
    expect(parsed.blocked).toBe(1);
    expect(parsed.invalid).toBe(1);
    expect(parsed.dry_run_only).toBe(true);
    expect(parsed.executable_count).toBe(0);
    expect(parsed.task_ids).toEqual(["t1", "t2", "t3"]);
  });

  // ---- 13. no notes / do_not_read / raw record fields ----

  it("aggregate does not include notes 原文", () => {
    const a = override(baseSummary(), { task_id: "t1" });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    const blob = JSON.stringify(agg);
    // Aggregate has no `notes` key on any field
    const top = JSON.parse(blob) as Record<string, unknown>;
    expect("notes" in top).toBe(false);
    expect("counts" in top).toBe(false); // aggregate has no counts
  });

  it("aggregate does not include do_not_read 原文", () => {
    const a = override(baseSummary(), { task_id: "t1" });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    const top = agg as unknown as Record<string, unknown>;
    expect("do_not_read" in top).toBe(false);
    expect("do_not_read_count" in top).toBe(false);
  });

  it("aggregate does not include raw record fields like plan_ref / handoff_ref / verifier_ref", () => {
    const a = override(baseSummary(), { task_id: "t1" });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    const top = agg as unknown as Record<string, unknown>;
    expect("plan_ref" in top).toBe(false);
    expect("handoff_ref" in top).toBe(false);
    expect("verifier_ref" in top).toBe(false);
    expect("refs" in top).toBe(false);
  });

  it("aggregate does not leak source_commit commit / branch values", () => {
    const a = override(baseSummary(), {
      source_commit: {
        commit: "secret-commit-sha",
        branch: "secret-branch",
        is_git_repo: true,
      },
    });
    const agg = aggregateHCCHandoffPageSummaries([a]);
    const blob = JSON.stringify(agg);
    expect(blob).not.toContain("secret-commit-sha");
    expect(blob).not.toContain("secret-branch");
  });

  // ---- 14. schema_version ----

  it("aggregate schema_version is 1.0.0", () => {
    const agg = aggregateHCCHandoffPageSummaries([]);
    expect(agg.schema_version).toBe("1.0.0");
  });

  // ---- 15. status counts match the input list when one input has all three statuses ----

  it("a single ready+blocked+invalid set gives the canonical 1/1/1", () => {
    const a = override(baseSummary(), { task_id: "t1", status: "ready" });
    const b = override(baseSummary(), { task_id: "t2", status: "blocked" });
    const c = override(baseSummary(), { task_id: "t3", status: "invalid" });
    const agg = aggregateHCCHandoffPageSummaries([a, b, c]);
    expect(agg.ready).toBe(1);
    expect(agg.blocked).toBe(1);
    expect(agg.invalid).toBe(1);
  });

  // ---- 16. errors array is empty when no violations ----

  it("errors array is empty when no literal-type violations", () => {
    const a = baseSummary();
    const b = baseSummary();
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.errors).toEqual([]);
  });

  // ---- 17. is pure (same input → same output) ----

  it("aggregate is pure for the same input", () => {
    const a = override(baseSummary(), { task_id: "t1" });
    const b = override(baseSummary(), { task_id: "t2" });
    const x = aggregateHCCHandoffPageSummaries([a, b]);
    const y = aggregateHCCHandoffPageSummaries([a, b]);
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
  });

  // ---- 18. all guards true stays true across many summaries ----

  it("many summaries all with all guards true → all guards true", () => {
    const summaries = Array.from({ length: 10 }, (_, i) =>
      override(baseSummary(), { task_id: `t${i}` }),
    );
    const agg = aggregateHCCHandoffPageSummaries(summaries);
    expect(agg.total).toBe(10);
    expect(agg.safety.all_have_archive_guard).toBe(true);
    expect(agg.safety.all_have_handoff_packs_guard).toBe(true);
    expect(agg.safety.all_have_audit_guard).toBe(true);
  });

  // ---- 19. one summary missing every guard → all guards false ----

  it("one summary missing every guard flips all guards to false", () => {
    const a = baseSummary();
    const b = override(baseSummary(), {
      safety_flags: {
        no_ipc: true,
        no_spawn: true,
        no_runPlaybook: true,
        has_archive_guard: false,
        has_handoff_packs_guard: false,
        has_audit_guard: false,
      },
    });
    const agg = aggregateHCCHandoffPageSummaries([a, b]);
    expect(agg.safety.all_have_archive_guard).toBe(false);
    expect(agg.safety.all_have_handoff_packs_guard).toBe(false);
    expect(agg.safety.all_have_audit_guard).toBe(false);
  });
});
