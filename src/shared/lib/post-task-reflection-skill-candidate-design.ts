// Post-task Learning Loop - Slice LOOP-004
// Pure design descriptor for the Good Pattern -> Skill Candidate Draft
// builder. No installation, no registry mutation, no runtime write.
//
// LOOP-004 deliverables:
//   1. The design descriptor that the future builder MUST satisfy.
//   2. A pure event-shape projection that converts a single
//      good_pattern into a SkillCandidateDesignDraft.
//   3. A pure batch projection that converts every good_pattern on a
//      PostTaskReflection into drafts (with eligibility gating).
//   4. A pure fingerprint helper for stable dedupe.
//   5. A pure duplicate-collapse helper.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no skill install, no skill registry mutation, no HCC Auto Executor,
// no hermes config / handoff / audit mutation, no docs/roadmap-locked-2026-05-28.md
// mutation.

import type {
  HumanApprovalRef,
  PostTaskReflection,
  ReflectionGoodPattern,
  EvidenceRef,
} from "./post-task-reflection-contract";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const SKILL_CANDIDATE_BUILDER_DESIGN = {
  builder_status: "design_only" as const,
  install_allowed: false as const,
  registry_mutation_allowed: false as const,
  runtime_write_allowed: false as const,
  approval_required: true as const,
  evidence_required: true as const,
  source_task_required: true as const,
  non_goals_required: true as const,
  verification_notes_required: true as const,
  human_approval_ref_required_for_install: true as const,
  schema_version: "1.0.0" as const,
} as const;

// -----------------------------------------------------------------
// Skill candidate draft shape (design only)
// -----------------------------------------------------------------

/**
 * Skill approval state carried by the design draft. The contract layer
 * is allowed to lift the state from "pending" to "approval_ready" only
 * when the parent reflection carries a HumanApprovalRef. Even then the
 * draft MUST stay install_allowed=false and registry_mutation_allowed=
 * false — install / registry write is a separate downstream action.
 */
export type SkillDraftApprovalState = "pending" | "approval_ready";

export interface SkillCandidateDesignDraft {
  schema_version: "1.0.0";
  draft_id: string;
  fingerprint: string;
  name: string;
  scope: string;
  trigger: string;
  non_goals: string[];
  verification_notes: string;
  source_task: string;
  source_ref: string;
  evidence: EvidenceRef[];
  provenance: PostTaskReflection["provenance"];
  approval_status: SkillDraftApprovalState;
  install_allowed: false;
  registry_mutation_allowed: false;
  runtime_write_allowed: false;
  dry_run_only: true;
  derived_from_good_pattern: string;
  human_approval_ref: HumanApprovalRef | null;
}

// -----------------------------------------------------------------
// Fingerprint helper
// -----------------------------------------------------------------

/**
 * Stable fingerprint for a skill candidate draft. Used for dedupe in
 * collapseSkillCandidateDuplicates and for the future registry.
 */
export function buildSkillCandidateFingerprint(input: {
  source_task: string;
  good_pattern_fingerprint: string;
  name: string;
}): string {
  return `skill-draft:${input.source_task}|${input.good_pattern_fingerprint}|${input.name}`;
}

// -----------------------------------------------------------------
// Single-pattern projection (pure)
// -----------------------------------------------------------------

export function projectGoodPatternToSkillCandidateDraft(
  reflection: PostTaskReflection,
  goodPattern: ReflectionGoodPattern,
): SkillCandidateDesignDraft {
  const humanApproved =
    reflection.provenance.human_reviewed === true &&
    reflection.provenance.human_approval_ref !== null;
  const evidenceHash = goodPattern.evidence[0]?.content_hash;
  if (!evidenceHash) {
    throw new Error(
      "projectGoodPatternToSkillCandidateDraft: good_pattern.evidence[0].content_hash is required",
    );
  }
  const fingerprint = buildSkillCandidateFingerprint({
    source_task: reflection.task_id,
    good_pattern_fingerprint: goodPattern.fingerprint,
    name: deriveSkillName(goodPattern),
  });
  return {
    schema_version: "1.0.0",
    draft_id: `draft-${reflection.task_id}-${goodPattern.fingerprint}`,
    fingerprint,
    name: deriveSkillName(goodPattern),
    scope: goodPattern.reuse_scope,
    trigger: deriveSkillTrigger(goodPattern),
    non_goals: [...goodPattern.counterexamples],
    verification_notes: deriveVerificationNotes(goodPattern),
    source_task: reflection.task_id,
    source_ref: reflection.artifact_ref ?? reflection.task_id,
    evidence: [
      {
        kind: "artifact",
        ref: `${reflection.artifact_ref ?? reflection.task_id}/skill/${goodPattern.fingerprint}`,
        content_hash: evidenceHash,
        excerpt: "redacted dry-run excerpt",
      },
    ],
    provenance: { ...reflection.provenance },
    approval_status: humanApproved ? "approval_ready" : "pending",
    install_allowed: false,
    registry_mutation_allowed: false,
    runtime_write_allowed: false,
    dry_run_only: true,
    derived_from_good_pattern: goodPattern.fingerprint,
    human_approval_ref: humanApproved
      ? reflection.provenance.human_approval_ref
      : null,
  };
}

// -----------------------------------------------------------------
// Batch projection (pure)
// -----------------------------------------------------------------

/**
 * Convert every good_pattern on a reflection into a draft. Empty list
 * ⇒ empty result. Eligibility is decided by the parent's human-review
 * state, not by anything mutable on disk.
 */
export function projectSkillCandidateDraftsFromReflection(
  reflection: PostTaskReflection,
): SkillCandidateDesignDraft[] {
  if (reflection.good_patterns.length === 0) return [];
  return reflection.good_patterns.map((p) =>
    projectGoodPatternToSkillCandidateDraft(reflection, p),
  );
}

// -----------------------------------------------------------------
// Duplicate collapse helper (pure)
// -----------------------------------------------------------------

export function collapseSkillCandidateDuplicates<
  T extends { fingerprint: string },
>(drafts: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const d of drafts) {
    if (seen.has(d.fingerprint)) {
      dropped.push(d);
    } else {
      seen.add(d.fingerprint);
      kept.push(d);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Eligibility rule check (pure)
// -----------------------------------------------------------------

/**
 * Returns true iff the draft is *eligible* to be promoted to install
 * by a future, separately-approved install path. Crucially, the
 * current LOOP-004 slice has NO install adapter approved, so the
 * helper MUST always return false. The check is left in place as a
 * pure routing rule the future install path can call — when a future
 * slice flips `install_adapter_approved=true`, this helper will
 * correctly gate by that flag plus install_allowed / registry_mutation
 * / runtime_write / dry_run_only / human_approval_ref / approval_status.
 */
export function isInstallEligibilityCandidate(
  d: SkillCandidateDesignDraft,
): boolean {
  if (d.install_allowed !== false) return false;
  if (d.registry_mutation_allowed !== false) return false;
  if (d.runtime_write_allowed !== false) return false;
  if (d.dry_run_only !== true) return false;
  if (d.human_approval_ref === null) return false;
  // No install adapter is approved in LOOP-004. Until a future slice
  // explicitly flips the install-adapter gate, the helper MUST return
  // false regardless of approval_status.
  if (!SKILL_CANDIDATE_BUILDER_DESIGN.install_allowed) return false;
  return d.approval_status === "approval_ready";
}

// -----------------------------------------------------------------
// Future-registry shape projection (no I/O — derives a registry-
// ready record that the future adapter may consume). The record is
// still install_allowed=false.
// -----------------------------------------------------------------

export interface SkillRegistryRecordDesign {
  schema_version: "1.0.0";
  fingerprint: string;
  name: string;
  scope: string;
  source_task: string;
  approval_status: SkillDraftApprovalState;
  install_allowed: false;
  registry_mutation_allowed: false;
  dry_run_only: true;
  human_approval_ref_present: boolean;
}

/**
 * Project a draft into a future-registry record. The record is
 * install_allowed=false even when approval_status="approval_ready";
 * the install flag is a future downstream decision.
 */
export function projectDraftToRegistryRecord(
  d: SkillCandidateDesignDraft,
): SkillRegistryRecordDesign {
  return {
    schema_version: "1.0.0",
    fingerprint: d.fingerprint,
    name: d.name,
    scope: d.scope,
    source_task: d.source_task,
    approval_status: d.approval_status,
    install_allowed: false,
    registry_mutation_allowed: false,
    dry_run_only: true,
    human_approval_ref_present: d.human_approval_ref !== null,
  };
}

// -----------------------------------------------------------------
// Internal name / trigger / notes derivation (pure)
// -----------------------------------------------------------------

function deriveSkillName(p: ReflectionGoodPattern): string {
  // Lowercase + collapse whitespace + kebab-case the fingerprint stem.
  const base = p.fingerprint
    .toLowerCase()
    .replace(/^good-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "unnamed-skill";
}

function deriveSkillTrigger(p: ReflectionGoodPattern): string {
  if (p.trigger_conditions.length === 0) {
    return `Apply good pattern: ${p.summary}`;
  }
  return `When ${p.trigger_conditions.join(" AND ")}`;
}

function deriveVerificationNotes(p: ReflectionGoodPattern): string {
  return `Re-run evidence for ${p.fingerprint}; check counterexamples: ${p.counterexamples.join("; ") || "(none)"}`;
}
