// Post-task Learning Loop - Slice LOOP-004
// Good Pattern -> Skill Candidate Draft Builder — design-only tests.
//
// The builder is pure. It never installs a skill, never mutates a
// skill registry, never writes to disk, never opens IPC.
//
// Hard boundary: no runtime write, no skill install, no skill registry
// mutation, no live knowledge flush, no knowledgeIngest /
// knowledgeSearch, no HCC Auto Executor, no IPC / gateway /
// subprocess, no hermes config / handoff / audit mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  type PostTaskReflection,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  SKILL_CANDIDATE_BUILDER_DESIGN,
  buildSkillCandidateFingerprint,
  collapseSkillCandidateDuplicates,
  isInstallEligibilityCandidate,
  projectDraftToRegistryRecord,
  projectGoodPatternToSkillCandidateDraft,
  projectSkillCandidateDraftsFromReflection,
  type SkillCandidateDesignDraft,
} from "../src/shared/lib/post-task-reflection-skill-candidate-design";

import { projectHccDryRunToReflection } from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(
    ROOT,
    "src/shared/lib/post-task-reflection-skill-candidate-design.ts",
  ),
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

function loadDryRun(name: string): PostTaskReflection {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  );
  return projectHccDryRunToReflection(json);
}

function loadFixture(name: string): SkillCandidateDesignDraft {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as SkillCandidateDesignDraft;
}

describe("Post-task Learning Loop LOOP-004 good pattern -> skill candidate design", () => {
  it("design descriptor forbids install, registry mutation, and runtime write", () => {
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.builder_status).toBe("design_only");
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.install_allowed).toBe(false);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.registry_mutation_allowed).toBe(
      false,
    );
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.runtime_write_allowed).toBe(false);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.approval_required).toBe(true);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.evidence_required).toBe(true);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.source_task_required).toBe(true);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.non_goals_required).toBe(true);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.verification_notes_required).toBe(
      true,
    );
    expect(
      SKILL_CANDIDATE_BUILDER_DESIGN.human_approval_ref_required_for_install,
    ).toBe(true);
    expect(SKILL_CANDIDATE_BUILDER_DESIGN.schema_version).toBe("1.0.0");
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("buildSkillCandidateFingerprint is stable and distinct on any input change", () => {
    const base = {
      source_task: "t-1",
      good_pattern_fingerprint: "gp-1",
      name: "n-1",
    };
    const fp1 = buildSkillCandidateFingerprint(base);
    const fp2 = buildSkillCandidateFingerprint(base);
    expect(fp1).toBe(fp2);
    expect(
      buildSkillCandidateFingerprint({ ...base, source_task: "t-2" }),
    ).not.toBe(fp1);
    expect(
      buildSkillCandidateFingerprint({
        ...base,
        good_pattern_fingerprint: "gp-2",
      }),
    ).not.toBe(fp1);
    expect(buildSkillCandidateFingerprint({ ...base, name: "n-2" })).not.toBe(
      fp1,
    );
  });

  it("collapseSkillCandidateDuplicates keeps first, drops rest", () => {
    const fp = buildSkillCandidateFingerprint({
      source_task: "t-1",
      good_pattern_fingerprint: "gp-1",
      name: "n-1",
    });
    const a: SkillCandidateDesignDraft = {
      ...loadFixture("ll004-skill-candidate-pass-design.json"),
      fingerprint: fp,
    };
    const b: SkillCandidateDesignDraft = { ...a };
    const c: SkillCandidateDesignDraft = { ...a };
    const { kept, dropped } = collapseSkillCandidateDuplicates([a, b, c]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });

  it("PASS good_pattern projects to a pending draft (agent-submitted)", () => {
    const reflection = loadDryRun("ll002-hcc-pass-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const drafts = projectSkillCandidateDraftsFromReflection(reflection);
    expect(drafts.length).toBe(1);
    const d = drafts[0]!;
    expect(d.approval_status).toBe("pending");
    expect(d.install_allowed).toBe(false);
    expect(d.registry_mutation_allowed).toBe(false);
    expect(d.runtime_write_allowed).toBe(false);
    expect(d.dry_run_only).toBe(true);
    expect(d.human_approval_ref).toBeNull();
    expect(d.derived_from_good_pattern).toBe("good-verifier-first-refactor");
    expect(d.source_task).toBe(reflection.task_id);
    expect(d.evidence.length).toBeGreaterThan(0);
    expect(isInstallEligibilityCandidate(d)).toBe(false);
  });

  it("PASS projected draft matches the fixture shape end-to-end", () => {
    const reflection = loadDryRun("ll002-hcc-pass-dry-run.json");
    const projected = projectSkillCandidateDraftsFromReflection(reflection)[0]!;
    const fx = loadFixture("ll004-skill-candidate-pass-design.json");
    expect(projected.fingerprint).toBe(fx.fingerprint);
    expect(projected.name).toBe(fx.name);
    expect(projected.scope).toBe(fx.scope);
    expect(projected.trigger).toBe(fx.trigger);
    expect(projected.non_goals).toEqual(fx.non_goals);
    expect(projected.source_task).toBe(fx.source_task);
    expect(projected.approval_status).toBe(fx.approval_status);
    expect(projected.install_allowed).toBe(false);
    expect(projected.registry_mutation_allowed).toBe(false);
    expect(projected.runtime_write_allowed).toBe(false);
    expect(projected.derived_from_good_pattern).toBe(
      fx.derived_from_good_pattern,
    );
  });

  it("manual_review reflection with zero good_patterns produces zero drafts", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    expect(reflection.good_patterns.length).toBe(0);
    const drafts = projectSkillCandidateDraftsFromReflection(reflection);
    expect(drafts).toEqual([]);
  });

  it("manual_review empty-list fixture documents the no-draft outcome", () => {
    const json = JSON.parse(
      readFileSync(
        join(
          FIXTURE_DIR,
          "ll004-skill-candidate-manual-review-empty-design.json",
        ),
        "utf-8",
      ),
    ) as { drafts: unknown[]; dry_run_only: boolean };
    expect(json.drafts).toEqual([]);
    expect(json.dry_run_only).toBe(true);
  });

  it("FAIL reflection (no good_patterns) produces zero drafts", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    expect(reflection.good_patterns.length).toBe(0);
    expect(projectSkillCandidateDraftsFromReflection(reflection)).toEqual([]);
  });

  it("approval_ready draft: install_allowed stays false; human_approval_ref carries verified=false", () => {
    // Synthesize a human-reviewed reflection by wrapping the manual
    // review dry-run with an extra good_pattern carrying human
    // approval — without modifying any on-disk file.
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const synth: PostTaskReflection = {
      ...reflection,
      good_patterns: [
        {
          fingerprint: "good-boundary-contract",
          summary: "Define boundary contract before cross-service work.",
          human_readable_summary:
            "Cross-service changes require an explicit boundary contract first.",
          reuse_scope: "cross-service work",
          trigger_conditions: ["cross-service change"],
          counterexamples: ["single-service refactor"],
          risks: ["Can over-constrain small changes."],
          evidence: [
            {
              kind: "artifact",
              ref: "hcc://learning-loop/002/manual-review-001/good/good-boundary-contract",
              content_hash: "sha256-ll004-synth-good-001",
            },
          ],
          provenance: reflection.provenance,
        },
      ],
    };
    const drafts = projectSkillCandidateDraftsFromReflection(synth);
    expect(drafts.length).toBe(1);
    const d = drafts[0]!;
    expect(d.approval_status).toBe("approval_ready");
    expect(d.install_allowed).toBe(false);
    expect(d.registry_mutation_allowed).toBe(false);
    expect(d.runtime_write_allowed).toBe(false);
    expect(d.dry_run_only).toBe(true);
    expect(d.human_approval_ref).not.toBeNull();
    expect(d.human_approval_ref!.verified).toBe(false);
    // Install eligibility: install_allowed is still false ⇒ not yet
    // install-eligible. The helper short-circuits correctly.
    expect(isInstallEligibilityCandidate(d)).toBe(false);
  });

  it("isInstallEligibilityCandidate rejects tampered drafts", () => {
    const base = loadFixture("ll004-skill-candidate-pass-design.json");
    expect(isInstallEligibilityCandidate(base)).toBe(false);
    const t1: SkillCandidateDesignDraft = {
      ...base,
      install_allowed: false as const,
      approval_status: "approval_ready",
      human_approval_ref: {
        ref: "anchor://test/ll004-approval",
        content_hash: "sha256-anchor-ll004-001",
        approval_kind: "manual_review",
        verified: false,
      },
    };
    // Even with approval_ready + human_approval_ref, install_allowed
    // is literal false ⇒ not install-eligible.
    expect(isInstallEligibilityCandidate(t1)).toBe(false);
    const t2: SkillCandidateDesignDraft = {
      ...base,
      registry_mutation_allowed: true as unknown as false,
    };
    expect(isInstallEligibilityCandidate(t2)).toBe(false);
    const t3: SkillCandidateDesignDraft = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(isInstallEligibilityCandidate(t3)).toBe(false);
  });

  it("projectDraftToRegistryRecord preserves install_allowed=false and exposes human_approval_ref_present", () => {
    const fx = loadFixture("ll004-skill-candidate-pass-design.json");
    const reg = projectDraftToRegistryRecord(fx);
    expect(reg.install_allowed).toBe(false);
    expect(reg.registry_mutation_allowed).toBe(false);
    expect(reg.dry_run_only).toBe(true);
    expect(reg.human_approval_ref_present).toBe(false);
    expect(reg.fingerprint).toBe(fx.fingerprint);
  });

  it("JSON round-trip preserves install / registry / runtime locks", () => {
    const fx = loadFixture("ll004-skill-candidate-pass-design.json");
    const rehydrated = JSON.parse(
      JSON.stringify(fx),
    ) as SkillCandidateDesignDraft;
    expect(rehydrated.install_allowed).toBe(false);
    expect(rehydrated.registry_mutation_allowed).toBe(false);
    expect(rehydrated.runtime_write_allowed).toBe(false);
    expect(rehydrated.dry_run_only).toBe(true);
    expect(rehydrated.fingerprint).toBe(fx.fingerprint);
  });

  it("PASS fixture itself declares install_allowed=false and registry_mutation_allowed=false", () => {
    const fx = loadFixture("ll004-skill-candidate-pass-design.json");
    expect(fx.install_allowed).toBe(false);
    expect(fx.registry_mutation_allowed).toBe(false);
    expect(fx.runtime_write_allowed).toBe(false);
    expect(fx.dry_run_only).toBe(true);
  });
});
