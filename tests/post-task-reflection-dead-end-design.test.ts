// Post-task Learning Loop - Slice LOOP-004b
// Bad Pattern -> Dead-end / Anti-pattern Draft Builder — design-only
// tests.
//
// The builder is pure. It never mutates ranking, never deletes or
// demotes knowledge, never writes to disk, never opens IPC.
//
// Hard boundary: no runtime write, no live retrieval ranking mutation,
// no knowledge demotion / delete, no knowledgeIngest / knowledgeSearch,
// no skill install, no HCC Auto Executor, no IPC / gateway /
// subprocess, no hermes config / handoff / audit mutation, no
// docs/roadmap-locked-2026-05-28.md mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  type PostTaskReflection,
  type ReflectionBadPattern,
  type ReflectionDeadEnd,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  DEAD_END_BUILDER_DESIGN,
  buildDeadEndFingerprint,
  collapseDeadEndDuplicates,
  isRankingPenaltyEligibilityCandidate,
  projectBadPatternToDeadEndDraft,
  projectDeadEndDraftsFromReflection,
  projectDeadEndToDeadEndDraft,
  type DeadEndDesignDraft,
} from "../src/shared/lib/post-task-reflection-dead-end-design";

import { projectHccDryRunToReflection } from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(ROOT, "src/shared/lib/post-task-reflection-dead-end-design.ts"),
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

interface DraftBundle {
  drafts: DeadEndDesignDraft[];
  dry_run_only: boolean;
  ranking_penalty_allowed: boolean;
  knowledge_demotion_allowed: boolean;
  knowledge_delete_allowed: boolean;
  runtime_write_allowed: boolean;
}

function loadFixture(name: string): DraftBundle {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as DraftBundle;
}

function loadDryRun(name: string): PostTaskReflection {
  return projectHccDryRunToReflection(
    JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf-8")),
  );
}

describe("Post-task Learning Loop LOOP-004b bad pattern -> dead-end design", () => {
  it("design descriptor forbids ranking penalty / demotion / delete / runtime write", () => {
    expect(DEAD_END_BUILDER_DESIGN.builder_status).toBe("design_only");
    expect(DEAD_END_BUILDER_DESIGN.ranking_penalty_allowed).toBe(false);
    expect(DEAD_END_BUILDER_DESIGN.knowledge_demotion_allowed).toBe(false);
    expect(DEAD_END_BUILDER_DESIGN.knowledge_delete_allowed).toBe(false);
    expect(DEAD_END_BUILDER_DESIGN.runtime_write_allowed).toBe(false);
    expect(DEAD_END_BUILDER_DESIGN.evidence_required).toBe(true);
    expect(DEAD_END_BUILDER_DESIGN.recurrence_required).toBe(true);
    expect(
      DEAD_END_BUILDER_DESIGN.human_approval_ref_required_for_penalty,
    ).toBe(true);
    expect(DEAD_END_BUILDER_DESIGN.schema_version).toBe("1.0.0");
    expect(
      DEAD_END_BUILDER_DESIGN.recurrence_threshold_for_penalty_candidate,
    ).toBe(3);
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("buildDeadEndFingerprint is stable and distinct on any input change", () => {
    const base = {
      source_task: "t-1",
      source_kind: "dead_end" as const,
      source_fingerprint: "d-1",
    };
    const fp1 = buildDeadEndFingerprint(base);
    const fp2 = buildDeadEndFingerprint(base);
    expect(fp1).toBe(fp2);
    expect(
      buildDeadEndFingerprint({ ...base, source_task: "t-2" }),
    ).not.toBe(fp1);
    expect(
      buildDeadEndFingerprint({
        ...base,
        source_kind: "bad_pattern",
      }),
    ).not.toBe(fp1);
    expect(
      buildDeadEndFingerprint({ ...base, source_fingerprint: "d-2" }),
    ).not.toBe(fp1);
  });

  it("collapseDeadEndDuplicates keeps first, drops rest", () => {
    const fp = buildDeadEndFingerprint({
      source_task: "t-1",
      source_kind: "dead_end",
      source_fingerprint: "d-1",
    });
    const base = loadFixture("ll004b-dead-end-fail-design.json").drafts[0]!;
    const a: DeadEndDesignDraft = { ...base, fingerprint: fp };
    const b: DeadEndDesignDraft = { ...a };
    const c: DeadEndDesignDraft = { ...a };
    const { kept, dropped } = collapseDeadEndDuplicates([a, b, c]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });

  it("FAIL reflection: bad_pattern + dead_end project to warn_only drafts", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const drafts = projectDeadEndDraftsFromReflection(reflection);
    expect(drafts.length).toBe(2);
    for (const d of drafts) {
      expect(d.dry_run_only).toBe(true);
      expect(d.ranking_penalty_allowed).toBe(false);
      expect(d.knowledge_demotion_allowed).toBe(false);
      expect(d.knowledge_delete_allowed).toBe(false);
      expect(d.runtime_write_allowed).toBe(false);
      expect(d.recurrence_count).toBe(1);
      expect(d.proposed_action).toBe("warn_only");
      expect(d.human_approval_ref).toBeNull();
      expect(d.evidence.length).toBeGreaterThan(0);
      expect(isRankingPenaltyEligibilityCandidate(d)).toBe(false);
    }
  });

  it("FAIL projected drafts match the fixture shape end-to-end", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    const projected = projectDeadEndDraftsFromReflection(reflection);
    const fx = loadFixture("ll004b-dead-end-fail-design.json").drafts;
    expect(projected.length).toBe(fx.length);
    for (let i = 0; i < projected.length; i++) {
      expect(projected[i]!.fingerprint).toBe(fx[i]!.fingerprint);
      expect(projected[i]!.source_kind).toBe(fx[i]!.source_kind);
      expect(projected[i]!.proposed_action).toBe(fx[i]!.proposed_action);
      expect(projected[i]!.recurrence_count).toBe(fx[i]!.recurrence_count);
      expect(projected[i]!.ranking_penalty_allowed).toBe(false);
      expect(projected[i]!.knowledge_demotion_allowed).toBe(false);
      expect(projected[i]!.knowledge_delete_allowed).toBe(false);
      expect(projected[i]!.runtime_write_allowed).toBe(false);
    }
  });

  it("manual_review reflection: drafts carry human_approval_ref.verified=false; still no penalty", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const drafts = projectDeadEndDraftsFromReflection(reflection);
    expect(drafts.length).toBe(2);
    for (const d of drafts) {
      expect(d.dry_run_only).toBe(true);
      expect(d.ranking_penalty_allowed).toBe(false);
      expect(d.knowledge_demotion_allowed).toBe(false);
      expect(d.knowledge_delete_allowed).toBe(false);
      expect(d.runtime_write_allowed).toBe(false);
      expect(d.human_approval_ref).not.toBeNull();
      expect(d.human_approval_ref!.verified).toBe(false);
      expect(d.proposed_action).toBe("warn_only");
      expect(isRankingPenaltyEligibilityCandidate(d)).toBe(false);
    }
  });

  it("manual_review fixture matches the projection end-to-end", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const projected = projectDeadEndDraftsFromReflection(reflection);
    const fx = loadFixture("ll004b-dead-end-manual-review-design.json").drafts;
    expect(projected.length).toBe(fx.length);
    for (let i = 0; i < projected.length; i++) {
      expect(projected[i]!.fingerprint).toBe(fx[i]!.fingerprint);
      expect(projected[i]!.source_kind).toBe(fx[i]!.source_kind);
      expect(projected[i]!.proposed_action).toBe(fx[i]!.proposed_action);
      expect(projected[i]!.human_approval_ref).not.toBeNull();
      expect(projected[i]!.human_approval_ref!.verified).toBe(false);
    }
  });

  it("PASS reflection (no bad_patterns / no dead_ends) projects to zero drafts", () => {
    const reflection = loadDryRun("ll002-hcc-pass-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    expect(projectDeadEndDraftsFromReflection(reflection)).toEqual([]);
  });

  it("recurrence_count=1 forbids ranking_penalty_candidate", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    const synthBad: ReflectionBadPattern = {
      ...reflection.bad_patterns[0]!,
      fingerprint: "bad-recurrence-1",
    };
    const synthRefl: PostTaskReflection = {
      ...reflection,
      bad_patterns: [synthBad],
    };
    const d = projectBadPatternToDeadEndDraft(synthRefl, synthBad);
    expect(d.recurrence_count).toBe(1);
    expect(d.proposed_action).not.toBe("ranking_penalty_candidate");
    expect(d.ranking_penalty_allowed).toBe(false);
  });

  it("recurrence_count>=threshold can mark ranking_penalty_candidate but ranking_penalty_allowed stays false", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    const base = reflection.bad_patterns[0]!;
    // 5 copies of the SAME fingerprint ⇒ recurrence_count=5.
    const repeatedArr: ReflectionBadPattern[] = [
      base,
      base,
      base,
      base,
      base,
    ];
    expect(repeatedArr.length).toBe(5);
    const synthRefl: PostTaskReflection = {
      ...reflection,
      bad_patterns: repeatedArr,
    };
    const d = projectBadPatternToDeadEndDraft(synthRefl, repeatedArr[0]!);
    expect(d.recurrence_count).toBe(5);
    expect(d.proposed_action).toBe("ranking_penalty_candidate");
    // Even when marked candidate, the safety flags stay false.
    expect(d.ranking_penalty_allowed).toBe(false);
    expect(d.knowledge_demotion_allowed).toBe(false);
    expect(d.knowledge_delete_allowed).toBe(false);
    expect(d.runtime_write_allowed).toBe(false);
    expect(d.dry_run_only).toBe(true);
    // The future penalty simulator is not approved in LOOP-004b.
    expect(isRankingPenaltyEligibilityCandidate(d)).toBe(false);
  });

  it("isRankingPenaltyEligibilityCandidate rejects tampered drafts", () => {
    const base = loadFixture("ll004b-dead-end-fail-design.json").drafts[0]!;
    expect(isRankingPenaltyEligibilityCandidate(base)).toBe(false);
    const t1: DeadEndDesignDraft = {
      ...base,
      ranking_penalty_allowed: true as unknown as false,
    };
    expect(isRankingPenaltyEligibilityCandidate(t1)).toBe(false);
    const t2: DeadEndDesignDraft = {
      ...base,
      knowledge_demotion_allowed: true as unknown as false,
    };
    expect(isRankingPenaltyEligibilityCandidate(t2)).toBe(false);
    const t3: DeadEndDesignDraft = {
      ...base,
      knowledge_delete_allowed: true as unknown as false,
    };
    expect(isRankingPenaltyEligibilityCandidate(t3)).toBe(false);
    const t4: DeadEndDesignDraft = {
      ...base,
      runtime_write_allowed: true as unknown as false,
    };
    expect(isRankingPenaltyEligibilityCandidate(t4)).toBe(false);
    const t5: DeadEndDesignDraft = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(isRankingPenaltyEligibilityCandidate(t5)).toBe(false);
  });

  it("FAIL fixture itself declares all safety flags false", () => {
    const fx = loadFixture("ll004b-dead-end-fail-design.json");
    expect(fx.dry_run_only).toBe(true);
    expect(fx.ranking_penalty_allowed).toBe(false);
    expect(fx.knowledge_demotion_allowed).toBe(false);
    expect(fx.knowledge_delete_allowed).toBe(false);
    expect(fx.runtime_write_allowed).toBe(false);
    for (const d of fx.drafts) {
      expect(d.ranking_penalty_allowed).toBe(false);
      expect(d.knowledge_demotion_allowed).toBe(false);
      expect(d.knowledge_delete_allowed).toBe(false);
      expect(d.runtime_write_allowed).toBe(false);
      expect(d.evidence.length).toBeGreaterThan(0);
    }
  });

  it("manual_review fixture itself declares all safety flags false", () => {
    const fx = loadFixture("ll004b-dead-end-manual-review-design.json");
    expect(fx.dry_run_only).toBe(true);
    expect(fx.ranking_penalty_allowed).toBe(false);
    expect(fx.knowledge_demotion_allowed).toBe(false);
    expect(fx.knowledge_delete_allowed).toBe(false);
    expect(fx.runtime_write_allowed).toBe(false);
    for (const d of fx.drafts) {
      expect(d.ranking_penalty_allowed).toBe(false);
      expect(d.knowledge_demotion_allowed).toBe(false);
      expect(d.knowledge_delete_allowed).toBe(false);
      expect(d.runtime_write_allowed).toBe(false);
      expect(d.human_approval_ref).not.toBeNull();
      expect(d.human_approval_ref!.verified).toBe(false);
      expect(d.evidence.length).toBeGreaterThan(0);
    }
  });

  it("JSON round-trip preserves the design-only invariant", () => {
    for (const name of [
      "ll004b-dead-end-fail-design.json",
      "ll004b-dead-end-manual-review-design.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(
        JSON.stringify(fx),
      ) as DraftBundle;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.ranking_penalty_allowed).toBe(false);
      expect(rehydrated.knowledge_demotion_allowed).toBe(false);
      expect(rehydrated.knowledge_delete_allowed).toBe(false);
      expect(rehydrated.runtime_write_allowed).toBe(false);
      for (const d of rehydrated.drafts) {
        expect(d.ranking_penalty_allowed).toBe(false);
        expect(d.knowledge_demotion_allowed).toBe(false);
        expect(d.knowledge_delete_allowed).toBe(false);
        expect(d.runtime_write_allowed).toBe(false);
        expect(d.fingerprint).toBeTruthy();
      }
    }
  });

  it("single-source projection accepts a ReflectionDeadEnd directly", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    const deadEnd: ReflectionDeadEnd = reflection.dead_ends[0]!;
    const d = projectDeadEndToDeadEndDraft(reflection, deadEnd);
    expect(d.source_kind).toBe("dead_end");
    expect(d.failure_class).toBe(deadEnd.failure_class);
    expect(d.recurrence_count).toBe(deadEnd.recurrence_count);
    expect(d.proposed_action).toBe("warn_only");
    expect(d.ranking_penalty_allowed).toBe(false);
  });
});
