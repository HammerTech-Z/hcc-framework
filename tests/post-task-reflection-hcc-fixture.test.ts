// Post-task Learning Loop - Slice LOOP-002
// Fixture-from-HCC-dry-run tests. Verifies that minimal HCC dry-run
// payloads (PASS / FAIL / manual_review) project into LOOP-001.1
// PostTaskReflection drafts that:
//   - pass the runtime guard
//   - are quarantined when agent-submitted
//   - are accepted by the consumer guard only when human-reviewed AND
//     carry a HumanApprovalRef
//   - round-trip through JSON without losing invariant
//   - contain no forbidden runtime call forms
//
// Hard boundary: no runtime write, no live knowledge flush, no
// knowledgeIngest / knowledgeSearch, no skill auto-install, no HCC
// Auto Executor, no IPC / gateway / subprocess.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  assertReflectionAllowedForNextTaskContext,
  assertReflectionAllowedForRankingInput,
  POST_TASK_REFLECTION_SCHEMA_VERSION,
  type PostTaskReflection,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  projectHccDryRunToReflection,
  type HccDryRunReflectionInput,
} from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");

const PROJECTION_SRC = readFileSync(
  join(ROOT, "src/shared/lib/post-task-reflection-hcc-fixture.ts"),
  "utf-8",
);

const FORBIDDEN_RUNTIME_PATTERNS = [
  "knowledgeIngest(",
  "window.hermesAPI",
  "ipcRenderer",
  "ipcMain",
  "fetch(",
  "writeFile",
  "appendFile",
  "setModelConfig(",
  "setEnv(",
  "startGateway(",
  "runPlaybook(",
  "triggerCronJob(",
  "~/.hermes",
  "handoff/packs",
  ".hermes/audit",
];

function loadFixture(name: string): HccDryRunReflectionInput {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as HccDryRunReflectionInput;
}

describe("Post-task Learning Loop LOOP-002 HCC dry-run fixture", () => {
  it("projection source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(PROJECTION_SRC.includes(pattern)).toBe(false);
    }
  });

  it("declares schema_version 1.1.0 across all fixtures", () => {
    for (const fx of [
      "ll002-hcc-pass-dry-run.json",
      "ll002-hcc-fail-dry-run.json",
      "ll002-hcc-manual-review-dry-run.json",
    ]) {
      const input = loadFixture(fx);
      const reflection = projectHccDryRunToReflection(input);
      expect(reflection.schema_version).toBe(POST_TASK_REFLECTION_SCHEMA_VERSION);
      expect(reflection.schema_version).toBe("1.1.0");
    }
  });

  it("PASS fixture: runtime guard accepts; consumer guards reject (agent-submitted, quarantined)", () => {
    const input = loadFixture("ll002-hcc-pass-dry-run.json");
    const reflection = projectHccDryRunToReflection(input);

    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();
    expect(reflection.verification_result).toBe("pass");
    expect(reflection.good_patterns.length).toBeGreaterThan(0);
    expect(reflection.skill_candidates.length).toBeGreaterThan(0);
    expect(reflection.usage_feedback_signals.length).toBeGreaterThan(0);
    expect(reflection.usage_feedback_signals[0]!.kind).toBe("helped");

    // SafetyFlags locked.
    expect(reflection.safety.knowledge_flush_allowed).toBe(false);
    expect(reflection.safety.skill_install_allowed).toBe(false);
    expect(reflection.safety.config_write_allowed).toBe(false);
    expect(reflection.safety.hcc_execute_allowed).toBe(false);
    expect(reflection.safety.model_runtime_start_allowed).toBe(false);

    // ApprovalGate locked.
    expect(reflection.approval_gate.approved).toBe(false);
    expect(reflection.approval_gate.status).toBe("closed");

    // Skill candidates must NOT carry install_allowed=true.
    for (const skill of reflection.skill_candidates) {
      expect(skill.install_allowed).toBe(false);
    }
    // Knowledge drafts must NOT carry runtime_flush_allowed=true.
    for (const draft of reflection.knowledge_ingest_draft) {
      expect(draft.runtime_flush_allowed).toBe(false);
    }
    // Agent-submitted => quarantined.
    for (const draft of reflection.knowledge_ingest_draft) {
      expect(draft.quarantine).toBe(true);
    }
    // hermes_main submitter => not human-reviewed.
    expect(reflection.provenance.human_reviewed).toBe(false);
    expect(reflection.provenance.human_approval_ref).toBeNull();

    // Consumer guards reject the agent-submitted draft.
    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection),
    ).toThrow(/next-task context requires human-reviewed/);
    expect(() =>
      assertReflectionAllowedForRankingInput(reflection),
    ).toThrow(/ranking input requires human-reviewed/);
  });

  it("FAIL fixture: runtime guard accepts; bad_patterns + dead_ends + misled signal carried", () => {
    const input = loadFixture("ll002-hcc-fail-dry-run.json");
    const reflection = projectHccDryRunToReflection(input);

    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();
    expect(reflection.verification_result).toBe("fail");
    expect(reflection.bad_patterns.length).toBeGreaterThan(0);
    expect(reflection.dead_ends.length).toBeGreaterThan(0);
    expect(reflection.dead_ends[0]!.failure_class).toBe("environmental");
    expect(reflection.dead_ends[0]!.proposed_action).toBe("warn_only");
    expect(reflection.usage_feedback_signals.length).toBeGreaterThan(0);
    expect(reflection.usage_feedback_signals[0]!.kind).toBe("misled");

    // Agent-submitted FAIL draft must still be quarantined and not
    // human-reviewed.
    for (const draft of reflection.knowledge_ingest_draft) {
      expect(draft.quarantine).toBe(true);
      expect(draft.runtime_flush_allowed).toBe(false);
    }
    expect(reflection.provenance.human_reviewed).toBe(false);
    expect(() =>
      assertReflectionAllowedForRankingInput(reflection),
    ).toThrow(/ranking input requires human-reviewed/);
  });

  it("manual_review fixture: consumer guards accept; runtime_flush_allowed stays false", () => {
    const input = loadFixture("ll002-hcc-manual-review-dry-run.json");
    const reflection = projectHccDryRunToReflection(input);

    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();
    expect(reflection.verification_result).toBe("manual_review");
    expect(reflection.provenance.human_reviewed).toBe(true);
    expect(reflection.provenance.human_approval_ref).not.toBeNull();
    expect(reflection.provenance.human_approval_ref!.verified).toBe(false);
    expect(reflection.provenance.human_approval_ref!.approval_kind).toBe(
      "manual_review",
    );

    // quarantine=false on every knowledge draft because human-reviewed.
    for (const draft of reflection.knowledge_ingest_draft) {
      expect(draft.quarantine).toBe(false);
      // Even with human approval, runtime_flush_allowed MUST stay false.
      expect(draft.runtime_flush_allowed).toBe(false);
    }

    // Approval gate is still closed — the contract never auto-approves.
    expect(reflection.approval_gate.approved).toBe(false);

    // Consumer guards accept the human-reviewed, approval-ref-present
    // reflection.
    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection),
    ).not.toThrow();
    expect(() =>
      assertReflectionAllowedForRankingInput(reflection),
    ).not.toThrow();
  });

  it("JSON round-trip preserves the LOOP-001.1 invariant", () => {
    for (const fx of [
      "ll002-hcc-pass-dry-run.json",
      "ll002-hcc-fail-dry-run.json",
      "ll002-hcc-manual-review-dry-run.json",
    ]) {
      const input = loadFixture(fx);
      const reflection = projectHccDryRunToReflection(input);
      const json = JSON.stringify(reflection);
      const rehydrated = JSON.parse(json) as PostTaskReflection;
      expect(() => assertPostTaskReflectionNoRuntime(rehydrated)).not.toThrow();
      expect(rehydrated.schema_version).toBe(reflection.schema_version);
      expect(rehydrated.task_id).toBe(reflection.task_id);
      expect(rehydrated.verification_result).toBe(reflection.verification_result);
    }
  });

  it("fixture file itself declares runtime_flush_allowed=false and dry_run mode", () => {
    for (const fx of [
      "ll002-hcc-pass-dry-run.json",
      "ll002-hcc-fail-dry-run.json",
      "ll002-hcc-manual-review-dry-run.json",
    ]) {
      const input = loadFixture(fx);
      expect(input.runtime_flush_allowed).toBe(false);
      expect(input.mode).toBe("dry_run");
    }
  });

  it("rejects empty task_id and empty task_summary in the projection", () => {
    expect(() =>
      projectHccDryRunToReflection({
        ...(loadFixture("ll002-hcc-pass-dry-run.json") as HccDryRunReflectionInput),
        task_id: "",
      }),
    ).toThrow(/task_id is required/);
    expect(() =>
      projectHccDryRunToReflection({
        ...(loadFixture("ll002-hcc-pass-dry-run.json") as HccDryRunReflectionInput),
        task_summary: "",
      }),
    ).toThrow(/task_summary is required/);
  });

  it("PASS fixture includes helped usage signal and skill candidate but no human approval", () => {
    const input = loadFixture("ll002-hcc-pass-dry-run.json");
    const reflection = projectHccDryRunToReflection(input);
    // no human anchor in the input, so the reflection must NOT carry one.
    expect(input.human_approval_ref).toBeUndefined();
    expect(reflection.provenance.human_approval_ref).toBeNull();
    // helped signal comes through.
    expect(reflection.usage_feedback_signals.some((s) => s.kind === "helped")).toBe(
      true,
    );
  });

  it("manual_review fixture propagates human_approval_ref.verified=false end-to-end", () => {
    const input = loadFixture("ll002-hcc-manual-review-dry-run.json");
    const reflection = projectHccDryRunToReflection(input);
    expect(input.human_approval_ref).toBeDefined();
    // Contract layer never flips verified to true.
    expect(reflection.provenance.human_approval_ref!.verified).toBe(false);
    // The contract layer's runtime guard already enforces this; double-check.
    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();
  });
});
