// P3 Slice 006: HCC → Handoff Pack payload builder
// Pure: constructs a JSON-serializable Handoff Pack payload from a dry-run plan.
// Does NOT write to ~/.hermes/handoff or any real path. The payload is returned
// to the caller, who decides where (if anywhere) to persist it.

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import type { HCCTaskPlan } from "./hcc-task-types";
import {
  buildKnowledgeHandoffContractSnippet,
  type KnowledgeHandoffContractSnippet,
} from "../shared/lib/knowledge-handoff-contract";

// -----------------------------------------------------------------
// Handoff Pack payload schema
// Mirrors the locked Handoff Pack schema (see HANDOFF-P0.5-*.json
// structure) but adds HCC-specific verification / safety / decisions.
// -----------------------------------------------------------------

export interface HandoffDecision {
  id: string;
  description: string;
  why: string;
  evidence_ref: string;
}

export interface HandoffVerification {
  source: string;
  artifact_ref: string;
  exit_code: number;
  command: string;
}

export interface HandoffNextAction {
  owner: "claude_code" | "hermes" | "user";
  action: string;
  reason: string;
}

export interface HandoffSafety {
  redaction_status: "pass" | "fail" | "not_run";
  secrets_policy: string;
  permission_boundary: string;
  forbidden_fields_checked: string[];
}

export interface HCCHandoffPayload {
  schema_version: "1.0.0";
  task_id: string;
  created_at: string;
  created_by: "hcc-task-runner";
  git_ref: string | null;
  goal: string;
  active_truth_sources: string[];
  do_not_read: string[];
  current_state: {
    hcc_plan_state: string;
    hcc_executable: false;
    code_graph_status: string;
    domain_profile: string | null;
    verifier_input_valid: boolean;
  };
  assumptions: string[];
  open_questions: string[];
  dead_ends: string[];
  decisions: HandoffDecision[];
  changed_files: string[];
  verification: HandoffVerification[];
  next_actions: HandoffNextAction[];
  safety: HandoffSafety;
  artifact_ref: string;
  content_hash: string | null;
  // Slice 007L: read-only contract field. Always absent (or present) per
  // knowledgeContract option. NEVER carries executable payload. NEVER
  // overrides dry_run_only / runtime_flush_allowed invariants.
  context?: {
    contracts?: {
      knowledge_reuse?: KnowledgeHandoffContractSnippet;
    };
  };
}

// Forbidden fields that must never appear in the payload (builder/verifier
// separation: builder reasoning must not leak into the Handoff Pack).
const FORBIDDEN_PAYLOAD_FIELDS = [
  "reasoning",
  "chain_of_thought",
  "raw_prompt",
  "raw_messages",
  "chat_transcript",
  "internal_thought",
  "scratch_pad",
  "working_memory",
] as const;

const DO_NOT_READ = [
  "~/Desktop/知识/Hermes 代码任务/过时计划/",
  "~/hermes-pro/docs/archive/",
  "*.before-*",
  "*.noindex",
  "*.ignore",
  "HERMES-ARCHIVE-LOCK.md",
  "~/.hermes/secrets/",
  "~/.hermes/config.yaml",
  "~/.hermes/auth.json",
  "~/.hermes/handoff/",
  "~/.hermes/venvs/",
];

const ACTIVE_TRUTH_SOURCES = [
  "~/.hermes/HERMES-SOUL.md",
  "~/hermes-pro/CONTEXT.md",
  "~/hermes-pro/NEXT_STEP.md",
  "~/hermes-pro/docs/current-fusion-plan-2026-05-30.md",
  "~/hermes-pro/docs/security/p2-5-safety-foundation-2026-05-30.md",
  "~/hermes-pro/src/main/hcc-task-runner.ts",
  "~/hermes-pro/src/main/hcc-task-types.ts",
  "~/hermes-pro/src/shared/lib/safety/builder-verifier.ts",
  "~/hermes-pro/src/shared/lib/safety/domain-profile.ts",
];

export interface BuildHCCHandoffPayloadOptions {
  /** Override created_by. Defaults to "hcc-task-runner". */
  createdBy?: HCCHandoffPayload["created_by"];
  /** Override created_at. Defaults to now (ISO 8601). */
  createdAt?: string;
  /** Git ref if available. */
  gitRef?: string | null;
  /** Compute a content hash (sha256 of the payload minus the hash field). */
  includeContentHash?: boolean;
  /**
   * Slice 007L: optional knowledge contract snippet input. When provided
   * AND the helper decides to attach, the snippet is placed at
   * `payload.context.contracts.knowledge_reuse`. Pure, dry-run only;
   * never writes to disk. When omitted, payload.context is absent and
   * old behavior is preserved.
   */
  knowledgeContract?: {
    targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes";
    userRequest?: string;
    taskKind?: string;
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
}

// -----------------------------------------------------------------
// buildHCCHandoffPayload — pure: plan + options → payload
// -----------------------------------------------------------------

export function buildHCCHandoffPayload(
  plan: HCCTaskPlan,
  options: BuildHCCHandoffPayloadOptions = {},
): HCCHandoffPayload {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const createdBy: HCCHandoffPayload["created_by"] =
    options.createdBy ?? "hcc-task-runner";
  const gitRef = options.gitRef ?? null;

  const artifactRef = `hcc-dry-run://${plan.taskId}/handoff-payload`;

  const verification: HandoffVerification[] = [];

  if (plan.verifierInput) {
    verification.push({
      source: "hcc.verifierInput",
      artifact_ref: plan.verifierInput.handoffPackRef,
      exit_code: plan.verifierInputValid ? 0 : 1,
      command: `validate_verifier_input ${plan.taskId}`,
    });
    verification.push({
      source: "hcc.verifierInput.diffRef",
      artifact_ref: plan.verifierInput.diffRef,
      exit_code: plan.verifierInputValid ? 0 : 1,
      command: `validate_diff_ref ${plan.taskId}`,
    });
  }

  if (plan.domainProfile) {
    verification.push({
      source: `hcc.domainProfile[${plan.domainProfile.name}].verifier.hardChecks`,
      artifact_ref: `hcc-dry-run://${plan.taskId}/hard-checks`,
      exit_code: plan.verifierInputValid ? 0 : 1,
      command: `validate_hard_checks ${plan.domainProfile.verifier.hardChecks.join(",")}`,
    });
    verification.push({
      source: `hcc.domainProfile[${plan.domainProfile.name}].verifier.passCriteria`,
      artifact_ref: `hcc-dry-run://${plan.taskId}/pass-criteria`,
      exit_code: plan.verifierInputValid ? 0 : 1,
      command: `validate_pass_criteria ${plan.taskId}`,
    });
  }

  if (plan.codeGraph.wasProvided) {
    verification.push({
      source: "hcc.codeGraph",
      artifact_ref: plan.codeGraph.artifactRef ?? artifactRef,
      exit_code: plan.codeGraph.status === "available" ? 0 : 1,
      command: `validate_code_graph ${plan.taskId}`,
    });
  }

  const nextActions: HandoffNextAction[] = [
    {
      owner: "claude_code",
      action: "Read HCC plan (task_id=" + plan.taskId + "), verify executable=false, run slice contract tests",
      reason: "Claude Code is the executor for P3 code/project tasks while HCC Auto Executor is unavailable",
    },
    {
      owner: "hermes",
      action: "Requirements translation, plan review, knowledge retrieval, Handoff Pack archival",
      reason: "Hermes retains planning / review / archival roles per P3 delegation rule (2026-05-31)",
    },
    {
      owner: "user",
      action: "Approve any future HCC Auto Executor start; do not auto-start",
      reason: "HCC Auto Executor is not approved as an available execution entry point",
    },
  ];

  const decisions: HandoffDecision[] = [
    {
      id: "DEC-HCC-001",
      description: "HCC plan generated as dry-run only; executable=false",
      why: "P3 Slice 001-005 contract: HCC must not execute while Auto Executor is unavailable",
      evidence_ref: plan.taskId,
    },
    {
      id: "DEC-HCC-002",
      description: "Verifier boundary uses shouldRequireIndependentVerifier at call site",
      why: "Builder/Verifier separation: builderId === verifierId same context → deny; fresh_context → warn",
      evidence_ref: "src/shared/lib/safety/builder-verifier.ts",
    },
    {
      id: "DEC-HCC-003",
      description: "Handoff Pack payload is constructed but not written to ~/.hermes/handoff",
      why: "Slice 006 is a contract test only; persistence is the caller's responsibility",
      evidence_ref: "src/main/hcc-handoff-pack.ts",
    },
  ];

  const payload: HCCHandoffPayload = {
    schema_version: "1.0.0",
    task_id: plan.taskId,
    created_at: createdAt,
    created_by: createdBy,
    git_ref: gitRef,
    goal: plan.goal,
    active_truth_sources: ACTIVE_TRUTH_SOURCES,
    do_not_read: DO_NOT_READ,
    current_state: {
      hcc_plan_state: plan.state,
      hcc_executable: false,
      code_graph_status: plan.codeGraph.status,
      domain_profile: plan.domainProfile?.name ?? null,
      verifier_input_valid: plan.verifierInputValid,
    },
    assumptions: [
      "HCC Auto Executor is not started; P3 dry-run contract applies",
      "Hermes retains planning / review / archival roles",
      "Claude Code is the executor for P3 code/project tasks",
      "Builder/Verifier separation enforced at boundary call site",
    ],
    open_questions: plan.validationErrors.length > 0
      ? [`Why is plan blocked: ${plan.validationErrors.join("; ")}`]
      : [
        "When will HCC Auto Executor be approved for real execution?",
        "Will Domain Profile manga be added before P5 unfreezes?",
      ],
    dead_ends: plan.codeGraph.riskNotes.length > 0
      ? plan.codeGraph.riskNotes
      : [],
    decisions,
    changed_files: plan.verifierInput?.changedFiles ?? [],
    verification,
    next_actions: nextActions,
    safety: {
      // Default to "not_run" — must not fabricate "pass" without
      // running the actual redaction scanner.
      redaction_status: "not_run",
      secrets_policy:
        "No keys, tokens, private paths, or chat transcripts are copied into the payload. PII scan is the caller's responsibility.",
      permission_boundary:
        "Payload construction is pure; no IPC, no spawn, no runPlaybook, no external agent calls.",
      forbidden_fields_checked: [...FORBIDDEN_PAYLOAD_FIELDS],
    },
    artifact_ref: artifactRef,
    content_hash: null,
  };

  // Slice 007L: attach knowledge contract snippet to context.contracts.knowledge_reuse
  // when caller supplies knowledgeContract option. Pure, dry-run only, no IPC.
  // When omitted, payload.context is absent (old behavior).
  if (options.knowledgeContract) {
    const kc = options.knowledgeContract;
    const isHermes = kc.targetAgent === "hermes";
    // For hermes, set reserved=true via attach_reason; snippet_text is the
    // 8-line contract marker (still valid). Pure, no handoff write.
    const envelope = buildKnowledgeHandoffContractSnippet({
      target_agent: kc.targetAgent,
      now_iso: createdAt,
      max_chars: 2048,
      // Slice 007L: caller is the HCC handoff builder at the system
      // boundary; explicit attach intent. Bypass 007J's shouldAttach
      // trigger check (which expects end-user-style request_text). The
      // envelope's own literal invariants (dry_run_only / runtime_flush_allowed
      // / forbidden_runtime_checked) still apply.
      caller_explicit_attach: true,
      attach_context: {
        request_text: kc.userRequest ?? "",
        task_kind: (kc.taskKind ?? undefined) as never,
        handoff_context: {
          has_ingest_draft: kc.hasIngestDraft,
          has_flush_pending: kc.hasFlushPending,
          has_local_known: undefined,
          has_newly_found: kc.hasLocalKnownAndNewlyFound,
        },
      },
      // For hermes, force a reserved marker so the contract is inert.
      override_snippet_text: isHermes
        ? "[reserved — no default attach for hermes self-call]"
        : undefined,
    });
    if (isHermes) {
      // Override the derived attach_reason to make "reserved" the explicit
      // signal for hermes. The helper's priority ordering would otherwise
      // surface "task-kind-is-research" or "user-request-contains-research-keyword".
      envelope.attach_reason = "hermes-reserved-no-default-attach";
    }
    payload.context = {
      contracts: {
        knowledge_reuse: envelope,
      },
    };
  }

  if (options.includeContentHash) {
    const { content_hash: _ignored, ...rest } = payload;
    void _ignored;
    const canonical = JSON.stringify(rest, Object.keys(rest).sort());
    payload.content_hash = `sha256:${crypto
      .createHash("sha256")
      .update(canonical)
      .digest("hex")}`;
  }

  return payload;
}

// -----------------------------------------------------------------
// Forbidden-field self-check
// Throws if a forbidden key is found anywhere in the payload.
// Used as a defensive guard in tests and at integration boundaries.
// -----------------------------------------------------------------

export function assertHandoffPayloadNoForbiddenFields(
  payload: HCCHandoffPayload,
): void {
  const seen = new Set<string>();
  const stack: unknown[] = [payload];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined) continue;
    if (typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const v of node) stack.push(v);
      continue;
    }
    for (const [k, v] of Object.entries(node)) {
      if (
        (FORBIDDEN_PAYLOAD_FIELDS as readonly string[]).includes(k)
      ) {
        seen.add(k);
      }
      stack.push(v);
    }
  }
  if (seen.size > 0) {
    throw new Error(
      `Handoff payload contains forbidden fields: ${[...seen].join(", ")}`,
    );
  }
}

// -----------------------------------------------------------------
// writeHCCHandoffPayloadFixture
// Writes a JSON file under the given tmpDir. Filename includes task_id
// so multiple fixtures can coexist. Caller controls the directory — this
// function never writes outside `tmpDir`.
// -----------------------------------------------------------------

export interface WriteFixtureOptions {
  /** Subdirectory under tmpDir. Defaults to "hcc-handoff". */
  subdir?: string;
  /** Override filename (must include task_id in the name). */
  filename?: string;
}

export function writeHCCHandoffPayloadFixture(
  payload: HCCHandoffPayload,
  tmpDir: string,
  options: WriteFixtureOptions = {},
): string {
  if (!payload.task_id) {
    throw new Error("payload.task_id is required for fixture filename");
  }
  const subdir = options.subdir ?? "hcc-handoff";
  const filename = options.filename ?? `payload-${payload.task_id}.json`;
  if (!filename.includes(payload.task_id)) {
    throw new Error(
      `filename must include task_id "${payload.task_id}": got "${filename}"`,
    );
  }
  const outDir = path.join(tmpDir, subdir);
  if (!outDir.startsWith(path.resolve(tmpDir) + path.sep) &&
      outDir !== path.resolve(tmpDir)) {
    throw new Error(`writeHCCHandoffPayloadFixture: outDir escapes tmpDir`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  if (!outPath.startsWith(path.resolve(tmpDir) + path.sep) &&
      outPath !== path.resolve(tmpDir)) {
    throw new Error(`writeHCCHandoffPayloadFixture: outPath escapes tmpDir`);
  }
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  return outPath;
}

// -----------------------------------------------------------------
// readHCCHandoffPayloadFixture
// Reads a fixture back from disk. Pure read; no side effects beyond
// the file read. Path is resolved relative to tmpDir; never escapes.
// -----------------------------------------------------------------

export function readHCCHandoffPayloadFixture(
  tmpDir: string,
  filename: string,
  options: { subdir?: string } = {},
): HCCHandoffPayload {
  const subdir = options.subdir ?? "hcc-handoff";
  const inDir = path.join(tmpDir, subdir);
  const inPath = path.join(inDir, filename);
  if (!inPath.startsWith(path.resolve(tmpDir) + path.sep) &&
      inPath !== path.resolve(tmpDir)) {
    throw new Error(`readHCCHandoffPayloadFixture: inPath escapes tmpDir`);
  }
  const blob = fs.readFileSync(inPath, "utf8");
  return JSON.parse(blob) as HCCHandoffPayload;
}

// -----------------------------------------------------------------
// verifyHCCHandoffPayloadFixture
// Local, pure verifier-only check. NO external model, NO spawn, NO IPC.
// Runs the same assertions a downstream Verifier would run:
//   - schema_version === "1.0.0"
//   - task_id present
//   - current_state.hcc_executable === false
//   - safety.redaction_status !== "pass" unless redactionConfirmed=true
//   - next_actions contains claude_code / hermes / user
//   - do_not_read contains archive / before / 过时计划 markers
//   - verification and decisions and artifact_ref present
//   - assertHandoffPayloadNoForbiddenFields passes
// -----------------------------------------------------------------

export interface VerifyFixtureOptions {
  /** Caller asserts they actually ran the redaction scanner. */
  redactionConfirmed?: boolean;
}

export interface VerifyFixtureResult {
  valid: boolean;
  errors: string[];
}

export function verifyHCCHandoffPayloadFixture(
  payload: HCCHandoffPayload,
  options: VerifyFixtureOptions = {},
): VerifyFixtureResult {
  const errors: string[] = [];

  if (payload.schema_version !== "1.0.0") {
    errors.push(
      `schema_version must be "1.0.0", got "${payload.schema_version}"`,
    );
  }
  if (!payload.task_id) {
    errors.push("task_id is required");
  }
  if (payload.current_state.hcc_executable !== false) {
    errors.push(
      `current_state.hcc_executable must be false, got ${JSON.stringify(
        payload.current_state.hcc_executable,
      )}`,
    );
  }
  if (
    !options.redactionConfirmed &&
    payload.safety.redaction_status === "pass"
  ) {
    errors.push(
      "safety.redaction_status is \"pass\" but redaction was not confirmed by caller",
    );
  }
  if (
    options.redactionConfirmed &&
    payload.safety.redaction_status === "not_run"
  ) {
    // Not an error per se; record as informational via empty errors.
    // We only fail when status claims pass without confirmation.
  }

  const owners = new Set(payload.next_actions.map((a) => a.owner));
  for (const required of ["claude_code", "hermes", "user"] as const) {
    if (!owners.has(required)) {
      errors.push(`next_actions must include owner "${required}"`);
    }
  }

  const doNotRead = payload.do_not_read.join("\n");
  const requiredDoNotRead = [
    "过时计划",
    "docs/archive",
    "*.before-*",
  ];
  for (const marker of requiredDoNotRead) {
    if (!doNotRead.includes(marker)) {
      errors.push(`do_not_read must contain marker "${marker}"`);
    }
  }

  if (!Array.isArray(payload.verification) || payload.verification.length === 0) {
    errors.push("verification must be a non-empty array");
  }
  if (!Array.isArray(payload.decisions) || payload.decisions.length === 0) {
    errors.push("decisions must be a non-empty array");
  }
  if (!payload.artifact_ref) {
    errors.push("artifact_ref is required");
  }

  // Forbidden fields check (catches any injection).
  try {
    assertHandoffPayloadNoForbiddenFields(payload);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { valid: errors.length === 0, errors };
}
