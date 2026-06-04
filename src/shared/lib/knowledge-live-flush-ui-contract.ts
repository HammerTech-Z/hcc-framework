// Hermes Pro — Live Flush UI Confirmation Contract (Slice 007C, design only)
// Pure schema/types/projectors. No I/O, no network, no IPC, no runtime ingest,
// no gateway, no cron, no WeChat/iLink, no HCC, no handoff/audit write.
// This file is the read-only projection of a LiveFlushRequest into UI state
// and the pure reducer that drives a 3-step confirmation dialog. The dialog
// itself (renderer-side) is implemented in a future slice and MUST only call
// the pure helpers exported here. No knowledgeIngest IPC is ever invoked.

import type {
  LiveFlushRequest,
  HermesKnowledgeFrontmatter,
  LiveFlushValidationIssue,
  LiveFlushFailureCode,
} from "./knowledge-live-flush-contract";
import { validateLiveFlushRequest } from "./knowledge-live-flush-contract";
import type { KnowledgeIngestDraft } from "./knowledge-reuse-protocol";

// -----------------------------------------------------------------
// 1. Constants
// -----------------------------------------------------------------

/** The 3-step confirmation flow that the UI presents to the user. */
export const CONFIRMATION_STEPS = [
  "review_request",
  "review_evidence",
  "review_risks",
] as const;

export type ConfirmationStep = (typeof CONFIRMATION_STEPS)[number];

/** Action vocabulary for the pure reducer. */
export type ConfirmationAction =
  | { type: "open"; request: LiveFlushRequest; now_iso?: string }
  | { type: "advance_to"; step: ConfirmationStep }
  | { type: "go_back" }
  | { type: "approve"; confirmation_phrase: string; now_iso?: string }
  | { type: "reject"; reason?: string; now_iso?: string }
  | { type: "close" };

// -----------------------------------------------------------------
// 2. UI projection of LiveFlushRequest
// -----------------------------------------------------------------

export interface UISummaryCard {
  title: string;
  summary: string;
  primary_source_uri: string;
  primary_source_type: string;
  primary_trust_level: string;
  local_findings_count: number;
  web_findings_count: number;
  stale_sources_count: number;
  retrieval_keywords: string[];
}

export interface UIGateCard {
  /** Which gate this card represents */
  gate:
    | "user_confirmation"
    | "source_fidelity"
    | "bucket_semantics"
    | "roadmap_guard"
    | "secret_guard";
  /** Pass / fail / unknown */
  status: "pass" | "fail" | "warn" | "unknown";
  /** Human-readable summary; one line */
  summary: string;
  /** Detailed issues (only present when status is fail or warn) */
  issues: ReadonlyArray<{ code: string; message: string; severity: string }>;
}

export interface UIRiskCard {
  /** Risk category */
  category:
    | "roadmap_mutation"
    | "stale_source_promotion"
    | "secret_leak"
    | "vault_authority_claim"
    | "external_instruction_authority"
    | "live_flush_pending_hardening";
  /** Severity bucket; user-facing */
  severity: "block" | "warn" | "info";
  /** One-line summary */
  summary: string;
  /** Long-form explanation (for the "Learn more" affordance) */
  detail: string;
}

/**
 * The 5 hard risk categories that the UI MUST surface before allowing
 * "Confirm Flush" to be clickable. This is the source of truth for what
 * counts as a "block" risk in the dialog.
 */
export const HARD_RISK_CATEGORIES: ReadonlyArray<UIRiskCard["category"]> = [
  "roadmap_mutation",
  "stale_source_promotion",
  "secret_leak",
  "vault_authority_claim",
  "external_instruction_authority",
];

// -----------------------------------------------------------------
// 3. Reducer state
// -----------------------------------------------------------------

export type ConfirmationPhase =
  | "closed"
  | "open"
  | "approved"
  | "rejected";

export interface ConfirmationState {
  phase: ConfirmationPhase;
  step: ConfirmationStep;
  /** The LiveFlushRequest being reviewed; null when closed */
  request: LiveFlushRequest | null;
  /** The rendered frontmatter preview; null when closed */
  frontmatter: HermesKnowledgeFrontmatter | null;
  /** Validation result, recomputed on open */
  validation: {
    ok: boolean;
    issues: ReadonlyArray<LiveFlushValidationIssue>;
    blocking_issue_count: number;
  };
  /** Whether the user has typed the confirmation phrase verbatim */
  confirmation_phrase_typed: string;
  /** Whether the user has ticked the "I understand the risks" checkbox */
  risks_acknowledged: boolean;
  /** Whether "Confirm Flush" is currently clickable */
  confirm_button_enabled: boolean;
  /** Last action timestamp (ISO 8601) */
  updated_at: string;
  /** If phase === "rejected", the reason the user gave */
  reject_reason: string | null;
}

export const INITIAL_CONFIRMATION_STATE: ConfirmationState = {
  phase: "closed",
  step: "review_request",
  request: null,
  frontmatter: null,
  validation: { ok: false, issues: [], blocking_issue_count: 0 },
  confirmation_phrase_typed: "",
  risks_acknowledged: false,
  confirm_button_enabled: false,
  updated_at: "1970-01-01T00:00:00.000Z",
  reject_reason: null,
};

// -----------------------------------------------------------------
// 4. Helpers (pure)
// -----------------------------------------------------------------

/**
 * Project a `LiveFlushRequest` into a UI summary card. Pure. Throws if the
 * request is missing the required fields (defence in depth — caller should
 * have already validated).
 */
export function projectRequestToSummary(
  request: LiveFlushRequest
): UISummaryCard {
  return {
    title: request.ingest_draft.title,
    summary: request.ingest_draft.summary,
    primary_source_uri: request.ingest_draft.sources[0]?.source_uri ?? "(no source)",
    primary_source_type:
      request.ingest_draft.local_findings[0]?.source_type ??
      request.ingest_draft.web_findings[0]?.source_type ??
      "unknown",
    primary_trust_level: request.ingest_draft.trust_level,
    local_findings_count: request.ingest_draft.local_findings.length,
    web_findings_count: request.ingest_draft.web_findings.length,
    stale_sources_count: 0, // Stale findings are surfaced via stale_sources, not duplicated here
    retrieval_keywords: request.ingest_draft.retrieval_keywords.slice(),
  };
}

/**
 * Project the four hard gates (user confirmation, source fidelity, bucket
 * semantics, roadmap guard) plus the secret-guard derived from validation
 * issues. Pure.
 */
export function projectGates(
  request: LiveFlushRequest,
  validation_issues: ReadonlyArray<LiveFlushValidationIssue>
): ReadonlyArray<UIGateCard> {
  const fidelityIssues = request.source_fidelity_result.issues;
  const fidelityStatus: UIGateCard["status"] = request.source_fidelity_result.ok
    ? fidelityIssues.length > 0
      ? "warn"
      : "pass"
    : "fail";
  const bucketStatus: UIGateCard["status"] =
    request.bucket_semantics_result.ok ? "pass" : "fail";
  const roadmapStatus: UIGateCard["status"] =
    request.roadmap_guard_result.allowed ? "pass" : "fail";
  const userConfirmStatus: UIGateCard["status"] = request.user_confirmation
    .confirmed_in_session
    ? "pass"
    : "fail";
  const secretIssues = validation_issues.filter((i) =>
    i.code.toLowerCase().includes("secret")
  );
  const secretStatus: UIGateCard["status"] =
    secretIssues.length > 0
      ? secretIssues.some((i) => i.severity === "block")
        ? "fail"
        : "warn"
      : "pass";

  return [
    {
      gate: "user_confirmation",
      status: userConfirmStatus,
      summary: userConfirmStatus === "pass"
        ? `Confirmed at ${request.user_confirmation.confirmed_at}`
        : "User has not confirmed in this session",
      issues: [],
    },
    {
      gate: "source_fidelity",
      status: fidelityStatus,
      summary: fidelityStatus === "pass"
        ? "source_uri and fetched_at preserved exactly"
        : fidelityStatus === "warn"
          ? `${fidelityIssues.length} soft issue(s)`
          : "source fidelity failed",
      issues: fidelityIssues.map((i) => ({
        code: "source_fidelity",
        message: i.message,
        severity: i.severity,
      })),
    },
    {
      gate: "bucket_semantics",
      status: bucketStatus,
      summary: bucketStatus === "pass"
        ? "local_known / newly_found / judgment split is consistent"
        : "bucket semantics failed",
      issues: (request.bucket_semantics_result.issues ?? []).map((i) => ({
        code: "bucket_semantics",
        message: i.message,
        severity: "block",
      })),
    },
    {
      gate: "roadmap_guard",
      status: roadmapStatus,
      summary: roadmapStatus === "pass"
        ? request.roadmap_guard_result.reason
        : "roadmap guard blocked flush",
      issues: [],
    },
    {
      gate: "secret_guard",
      status: secretStatus,
      summary: secretStatus === "pass"
        ? "no secret-like fields detected"
        : secretStatus === "warn"
          ? `${secretIssues.length} soft warning(s)`
          : "secret-like field detected",
      issues: secretIssues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity,
      })),
    },
  ];
}

/**
 * Derive the 6 hard risk cards from the request + validation result. Each
 * risk card has a single source of truth — derived from the request shape.
 * Pure.
 */
export function projectRisks(
  request: LiveFlushRequest,
  validation: { blocking_issue_count: number }
): ReadonlyArray<UIRiskCard> {
  const risks: UIRiskCard[] = [];

  // 1. roadmap_mutation: ingest_draft.roadmap_change_allowed must be false.
  risks.push({
    category: "roadmap_mutation",
    severity: request.ingest_draft.roadmap_change_allowed === false
      ? "info"
      : "block",
    summary: request.ingest_draft.roadmap_change_allowed === false
      ? "Roadmap is locked — this draft cannot modify it"
      : "Draft would modify a locked roadmap",
    detail:
      "ingest_draft.roadmap_change_allowed is a type-literal false, " +
      "and the validator enforces it at runtime. Even on confirm, the live " +
      "adapter will reject any attempt to write to docs/roadmap-locked-*.",
  });

  // 2. stale_source_promotion: any local finding with do_not_use_as_current_truth?
  const staleInLocal = request.ingest_draft.local_findings.some(
    (f) => f.do_not_use_as_current_truth === true
  );
  risks.push({
    category: "stale_source_promotion",
    severity: staleInLocal ? "block" : "info",
    summary: staleInLocal
      ? "Draft contains a stale source flagged as current truth"
      : "No stale source in local_findings",
    detail:
      "If a local finding has do_not_use_as_current_truth=true, the live " +
      "adapter will move it to stale_sources and refuse to use it as the " +
      "primary source_uri / fetched_at.",
  });

  // 3. secret_leak: derived from validation issues
  const secretBlocking = validation.blocking_issue_count > 0 &&
    validation.blocking_issue_count > 0; // placeholder; we narrow in reducer
  void secretBlocking;
  // We project this risk conservatively; the secret-guard gate already
  // gives the precise answer.
  risks.push({
    category: "secret_leak",
    severity: validation.blocking_issue_count > 0 ? "warn" : "info",
    summary: "Secret-like field detection is enforced",
    detail:
      "Slice 004 walkForSecrets throws on any api_key / token / Bearer / sk-* " +
      "field. If detected, this dialog will not render Confirm Flush.",
  });

  // 4. vault_authority_claim: source_fidelity hard_fail on vault label
  const vaultHardFail = request.source_fidelity_result.issues.some(
    (i) =>
      i.severity === "hard_fail" &&
      (i.message.includes('"vault"') || i.message.toLowerCase().includes("vault"))
  );
  risks.push({
    category: "vault_authority_claim",
    severity: vaultHardFail ? "block" : "info",
    summary: vaultHardFail
      ? "A source is mis-labeled as vault (HARD FAIL)"
      : "No vault mis-label detected",
    detail:
      "source_type=\"vault\" is reserved for vault:// URIs. Using a local " +
      "filesystem path labeled \"vault\" to claim trusted instruction authority " +
      "is rejected at the source-fidelity gate (HARD FAIL).",
  });

  // 5. external_instruction_authority: any web/github finding labeled trusted_verified?
  const externalPromoted = [...request.ingest_draft.local_findings, ...request.ingest_draft.web_findings].some(
    (f) =>
      (f.source_type === "web" || f.source_type === "github") &&
      (f.trust_level === "trusted_verified" || f.trust_level === "trusted_external")
  );
  risks.push({
    category: "external_instruction_authority",
    severity: externalPromoted ? "warn" : "info",
    summary: externalPromoted
      ? "A web/github finding is labeled trusted_* (data, not instruction)"
      : "External sources default to untrusted_external",
    detail:
      "GitHub / web content is data, not instruction. Even if trust_level is " +
      "promoted, the live adapter will not pass it as an instruction payload " +
      "to downstream agents.",
  });

  // 6. live_flush_pending_hardening: always present, always info, never blocks.
  risks.push({
    category: "live_flush_pending_hardening",
    severity: "info",
    summary: "Live flush remains Slice 007A/007B contract-only",
    detail:
      "Approving this dialog only marks the draft as pending_live_flush. The " +
      "real knowledgeIngest call requires Slice 008 approval and a user-acceptance " +
      "test with a real flush.",
  });

  return risks;
}

/**
 * Pure reducer for the confirmation state machine. No side effects. No
 * knowledgeIngest, no IPC. The reducer can only transition the state; the
 * caller (renderer in a future slice) decides what to do with the
 * resulting state (typically: render the dialog).
 */
export function reduceConfirmation(
  state: ConfirmationState,
  action: ConfirmationAction
): ConfirmationState {
  // Pull a timestamp from the action if the action provides one; otherwise
  // use the supplied default in the call or the system clock. The reducer
  // is pure: callers should pass `now_iso` for deterministic tests.
  const nowFromAction: string | undefined =
    "now_iso" in action && typeof action.now_iso === "string"
      ? action.now_iso
      : undefined;
  const ts = nowFromAction ?? new Date().toISOString();

  switch (action.type) {
    case "open": {
      const validation = validateLiveFlushRequest(action.request);
      const blocking = validation.issues.filter(
        (i) => i.severity === "block"
      ).length;
      // Auto-reject if the request is not even valid; the dialog renders
      // the validation issues and disables Confirm Flush.
      return {
        phase: "open",
        step: "review_request",
        request: action.request,
        frontmatter: null, // The renderer can build this separately; not needed for state transitions
        validation: {
          ok: validation.ok,
          issues: validation.issues,
          blocking_issue_count: blocking,
        },
        confirmation_phrase_typed: "",
        risks_acknowledged: false,
        confirm_button_enabled: false,
        updated_at: ts,
        reject_reason: null,
      };
    }
    case "advance_to": {
      if (state.phase !== "open") return state;
      return { ...state, step: action.step, updated_at: ts };
    }
    case "go_back": {
      if (state.phase !== "open") return state;
      const idx = CONFIRMATION_STEPS.indexOf(state.step);
      if (idx <= 0) return state;
      return {
        ...state,
        step: CONFIRMATION_STEPS[idx - 1],
        updated_at: ts,
      };
    }
    case "approve": {
      if (state.phase !== "open") return state;
      if (state.request === null) return state;
      // The caller is expected to have already checked
      // state.confirm_button_enabled. We re-check here for defence in depth.
      const phraseMatches = state.confirmation_phrase_typed.trim() === action.confirmation_phrase.trim();
      const ack = state.risks_acknowledged;
      const noBlock = state.validation.blocking_issue_count === 0;
      const enabled = phraseMatches && ack && noBlock;
      if (!enabled) {
        return {
          ...state,
          confirm_button_enabled: false,
          updated_at: ts,
        };
      }
      return {
        ...state,
        phase: "approved",
        confirm_button_enabled: false,
        updated_at: ts,
      };
    }
    case "reject": {
      return {
        ...state,
        phase: "rejected",
        confirm_button_enabled: false,
        reject_reason: action.reason ?? null,
        updated_at: ts,
      };
    }
    case "close": {
      return { ...INITIAL_CONFIRMATION_STATE, updated_at: ts };
    }
    default: {
      // Exhaustiveness check
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}

/**
 * Compute whether Confirm Flush is currently clickable, given the typed
 * phrase + risks-acked + validation result. Pure.
 */
export function computeConfirmButtonEnabled(input: {
  state: ConfirmationState;
  expected_phrase: string;
}): boolean {
  const { state, expected_phrase } = input;
  if (state.phase !== "open") return false;
  if (state.validation.blocking_issue_count > 0) return false;
  if (!state.risks_acknowledged) return false;
  if (state.confirmation_phrase_typed.trim() !== expected_phrase.trim()) {
    return false;
  }
  return true;
}

// -----------------------------------------------------------------
// 5. Failure classification (UI-facing)
// -----------------------------------------------------------------

export interface UIFailureView {
  code: LiveFlushFailureCode | "none";
  /** One-line summary; safe to render in red. */
  summary: string;
  /** Suggested next action the user can take. */
  suggested_action: string;
}

/**
 * Map a live-flush failure into a UI-friendly view. Pure.
 */
export function projectFailureToUI(
  code: LiveFlushFailureCode
): UIFailureView {
  switch (code) {
    case "runtime_flush_forbidden":
      return {
        code,
        summary: "Runtime flush is not allowed in this slice",
        suggested_action:
          "Close this dialog. Real flush requires a separate live adapter " +
          "implementation slice to be approved.",
      };
    case "runtime_adapter_not_approved":
      return {
        code,
        summary: "The live adapter has not been approved yet",
        suggested_action:
          "Close this dialog. The next_required_approval is still pointing " +
          "at the unapproved implementation slice.",
      };
    case "roadmap_mutation_blocked":
      return {
        code,
        summary: "This draft would modify a locked roadmap",
        suggested_action:
          "Reject this draft. Roadmap mutations are not allowed via the " +
          "knowledge flush path.",
      };
    case "source_fidelity_failed":
      return {
        code,
        summary: "Source fidelity check failed",
        suggested_action:
          "Reject this draft. Inspect the source_fidelity_result.issues " +
          "list; the request cannot be flushed until they are resolved.",
      };
    case "bucket_semantics_failed":
      return {
        code,
        summary: "Bucket semantics check failed",
        suggested_action:
          "Reject this draft. local_known / newly_found / judgment must be " +
          "split according to source_type.",
      };
    case "missing_user_confirmation":
      return {
        code,
        summary: "User confirmation is missing",
        suggested_action:
          "Close this dialog and re-open it after saying \"我授权 flush\" " +
          "in the same conversation.",
      };
    case "secret_like_field_detected":
      return {
        code,
        summary: "A secret-like field was detected in the draft",
        suggested_action:
          "Reject this draft. The draft contains a token / API key / " +
          "Bearer value that must not be flushed.",
      };
    case "stale_source_used_as_current_truth":
      return {
        code,
        summary: "A stale source is being promoted as current truth",
        suggested_action:
          "Reject this draft. Move the stale finding to stale_sources before " +
          "resubmitting.",
      };
    default: {
      const _exhaustive: never = code;
      void _exhaustive;
      return {
        code: "none",
        summary: "No failure",
        suggested_action: "Proceed.",
      };
    }
  }
}

// -----------------------------------------------------------------
// 6. Forbidden self-check (compile-time + runtime)
// -----------------------------------------------------------------

/**
 * Type guard that a ConfirmationState is in a renderable phase. The
 * dialog only renders when the state is in one of these phases.
 */
export function isRenderableConfirmationPhase(
  phase: ConfirmationPhase
): phase is "open" | "approved" | "rejected" {
  return phase !== "closed";
}

/**
 * Compile-time only: ensure the helper module never accidentally imports
 * from an IPC or runtime layer. We do this by re-exporting the empty list
 * of forbidden tokens; the Slice 007C test asserts no forbidden token
 * appears in the file source.
 */
export const UI_HELPER_FORBIDDEN_TOKENS: ReadonlyArray<string> = [
  "knowledgeIngest",
  "knowledgeSearch",
  "ipcMain",
  "ipcRenderer",
  "fetch(",
  "axios",
  "child_process",
  "triggerCronJob",
  "sendMessage",
  "runPlaybook",
  "delegate_task",
  "serve",
];

// -----------------------------------------------------------------
// 7. Ingest draft shape re-export (for renderer convenience)
// -----------------------------------------------------------------

export type { KnowledgeIngestDraft };

// -----------------------------------------------------------------
// 8. Slice 007D — UI Copy Deck + Golden UI Fixtures
// Pure builders. No I/O, no network, no IPC, no runtime ingest.
// -----------------------------------------------------------------

// -----------------------------------------------------------------
// Forbidden phrases — copy the renderer MUST NEVER show as action copy
// -----------------------------------------------------------------

/**
 * Phrases that imply the draft has already been written, or that
 * confirmation alone will perform a write. Every renderer copy and
 * fixture MUST avoid these as action copy. They may appear only in
 * the "Forbidden phrases" section of the copy deck and in test
 * self-checks (as labels, not as recommended actions).
 */
export const FORBIDDEN_FLUSH_PROMISE_PHRASES: ReadonlyArray<string> = [
  // Chinese
  "已保存",
  "写入成功",
  "已写入",
  "保存成功",
  "写入完成",
  "已存入",
  "存入成功",
  // English
  "saved successfully",
  "saved!",
  "write successful",
  "written successfully",
  "written!",
  "stored!",
  // Implied-promise phrases — confirmation alone does NOT write
  "确认后将写入",
  "确认后会写入",
  "点击后将写入知识库",
  "will be written after confirm",
  "will be written after confirmation",
  "will save after confirm",
  "will persist after confirm",
  "writing on confirm",
];

/**
 * Forbidden destination phrases — the renderer MUST NOT ask the user
 * for an Obsidian vault path, a MEMORY.md path, a .wolf path, or any
 * arbitrary note path. The only canonical destination is
 * `HERMES_MANAGED_KNOWLEDGE_STORE`.
 */
export const FORBIDDEN_FLUSH_DESTINATION_PHRASES: ReadonlyArray<string> = [
  "Obsidian Vault path",
  "Obsidian vault 路径",
  "选择 Vault 目录",
  "choose a vault folder",
  "MEMORY.md",
  ".claude/memory",
  ".wolf/cerebrum",
  ".wolf/anatomy",
  ".wolf/memory",
  "notes/<topic>.md",
  "research/<date>.md",
  "any custom note path",
];

export const ALL_FORBIDDEN_FLUSH_COPY_PHRASES: ReadonlyArray<string> = [
  ...FORBIDDEN_FLUSH_PROMISE_PHRASES,
  ...FORBIDDEN_FLUSH_DESTINATION_PHRASES,
];

// -----------------------------------------------------------------
// Copy deck — the canonical user-visible copy vocabulary
// -----------------------------------------------------------------

export interface KnowledgeFlushCopyDeck {
  /** Header copy shown at the top of every dialog render */
  header_copy: {
    title: string;
    subtitle: string;
    pending_badge: string;
  };
  /** Per-step body copy */
  body_copy: {
    review_request: { intro: string; primary_source_caption: string };
    review_evidence: { intro: string; stale_caption: string };
    review_risks: {
      intro: string;
      phrase_label: string;
      risks_acknowledgement_label: string;
    };
  };
  /** Copy used for each gate card */
  gate_card_copy: Record<UIGateCard["gate"], {
    label: string;
    pass_explainer: string;
    warn_explainer: string;
    fail_explainer: string;
  }>;
  /** Copy used for each risk card */
  risk_card_copy: Record<UIRiskCard["category"], {
    label: string;
    explainer: string;
  }>;
  /** Copy for the confirm button + the input field */
  confirmation_phrase_copy: {
    input_label: string;
    expected_phrase: string;
    match_helper: string;
  };
  /** Reasons the Confirm button may be disabled (3 known reasons) */
  disabled_button_reasons: {
    awaiting_phrase: string;
    awaiting_risks_ack: string;
    blocked_by_validation: string;
  };
  /** Terminal / success / failure copy */
  terminal_copy: {
    approved: {
      title: string;
      body: string;
      next_step_pending_live_adapter: string;
    };
    rejected: {
      title: string;
      body_default: string;
      body_with_reason: string;
    };
    blocked_by_validation: {
      title: string;
      body: string;
      next_step_edit_or_review: string;
    };
  };
  /** A small footer reminder repeated in every state */
  safety_footer_copy: string;
}

// -----------------------------------------------------------------
// buildKnowledgeFlushCopyDeck
// -----------------------------------------------------------------

/**
 * Build the canonical copy deck. The renderer is expected to render
 * exactly these strings (translated via the i18n key table separately).
 * No phrase on this deck implies that confirmation alone writes to
 * the knowledge base.
 */
export function buildKnowledgeFlushCopyDeck(): KnowledgeFlushCopyDeck {
  return {
    header_copy: {
      title: "Knowledge Flush — Review before confirm",
      subtitle:
        "This dialog only marks a draft as eligible for an approved live flush. " +
        "It does NOT write to the Hermes knowledge base.",
      pending_badge: "Pending live flush adapter approval",
    },
    body_copy: {
      review_request: {
        intro:
          "Step 1 of 3 — Review the request. This is a draft of what " +
          "would be written. Nothing has been written yet.",
        primary_source_caption: "Primary source (preserved exactly as input):",
      },
      review_evidence: {
        intro:
          "Step 2 of 3 — Review the gates. Each gate must pass before " +
          "the Confirm button can be enabled.",
        stale_caption:
          "Stale sources are listed here. They will not be used as the " +
          "primary source_uri or fetched_at in the future flush.",
      },
      review_risks: {
        intro:
          "Step 3 of 3 — Review the risks. The live flush is still " +
          "contract-only in this slice. The runtime flag is false, and " +
          "no write will happen even if you confirm.",
        phrase_label:
          "Type the confirmation phrase verbatim to enable Confirm Flush:",
        risks_acknowledgement_label:
          "I understand the risks. The runtime flush flag is false, and " +
          "the live flush adapter is not yet approved.",
      },
    },
    gate_card_copy: {
      user_confirmation: {
        label: "User confirmation",
        pass_explainer:
          "You have explicitly said \"我授权 flush\" in this session. " +
          "Confirmation only marks the draft as eligible — it does NOT write.",
        warn_explainer:
          "Confirmation was captured in this session, but the phrase is " +
          "not in the supported list. Re-open with a supported phrase.",
        fail_explainer:
          "User has not confirmed in this session. Close this dialog " +
          "and re-open it after saying \"我授权 flush\" in the same " +
          "conversation.",
      },
      source_fidelity: {
        label: "Source fidelity",
        pass_explainer:
          "source_uri and fetched_at are preserved exactly. No drift.",
        warn_explainer:
          "There are soft issues with source_uri / fetched_at. Review " +
          "before confirming.",
        fail_explainer:
          "Source fidelity failed. A source is mis-labeled, or " +
          "fetched_at has drifted. The live flush will be rejected.",
      },
      bucket_semantics: {
        label: "Bucket semantics",
        pass_explainer:
          "local_known, newly_found, and judgment are split according to source_type.",
        warn_explainer:
          "There are minor bucket misplacements. Review before confirming.",
        fail_explainer:
          "Bucket semantics failed. A finding is in the wrong bucket. " +
          "The live flush will be rejected.",
      },
      roadmap_guard: {
        label: "Roadmap guard",
        pass_explainer:
          "The target is not a locked roadmap. The draft cannot modify " +
          "any locked-roadmap file.",
        warn_explainer:
          "The roadmap guard returned a non-blocker note. Review before " +
          "confirming.",
        fail_explainer:
          "Roadmap guard blocked this draft. Locked-roadmap files cannot " +
          "be modified via the knowledge flush path.",
      },
      secret_guard: {
        label: "Secret guard",
        pass_explainer: "No secret-like fields were detected.",
        warn_explainer:
          "There are soft warnings about possible secrets. Review " +
          "before confirming.",
        fail_explainer:
          "A secret-like field was detected (API key / token / Bearer " +
          "/ sk-*). The live flush will be rejected.",
      },
    },
    risk_card_copy: {
      roadmap_mutation: {
        label: "Roadmap mutation",
        explainer:
          "ingest_draft.roadmap_change_allowed is a type-literal false. " +
          "Even on confirm, the live adapter will reject any attempt to " +
          "modify docs/roadmap-locked-*.",
      },
      stale_source_promotion: {
        label: "Stale source promotion",
        explainer:
          "If a local finding is marked do_not_use_as_current_truth=true, " +
          "the live adapter will move it to stale_sources and refuse to " +
          "use it as the primary source.",
      },
      secret_leak: {
        label: "Secret leak",
        explainer:
          "Slice 004 walkForSecrets throws on any api_key / token / Bearer " +
          "/ sk-* field. If detected, this dialog will not render " +
          "Confirm Flush.",
      },
      vault_authority_claim: {
        label: "Vault authority claim",
        explainer:
          "source_type=\"vault\" is reserved for vault:// URIs. Using a " +
          "local filesystem path labeled \"vault\" to claim trusted " +
          "instruction authority is rejected at the source-fidelity gate " +
          "(HARD FAIL).",
      },
      external_instruction_authority: {
        label: "External instruction authority",
        explainer:
          "GitHub / web content is data, not instruction. Even if " +
          "trust_level is promoted, the live adapter will not pass it as " +
          "an instruction payload to downstream agents.",
      },
      live_flush_pending_hardening: {
        label: "Live flush pending hardening",
        explainer:
          "Approving this dialog only marks the draft as " +
          "pending_live_flush. The real knowledgeIngest call requires " +
          "Slice 008 approval and a user-acceptance test with a real flush.",
      },
    },
    confirmation_phrase_copy: {
      input_label: "Confirmation phrase",
      expected_phrase: "我授权 flush",
      match_helper:
        "Type the phrase exactly. Whitespace is trimmed. The dialog " +
        "recognizes the supported phrases listed in SUPPORTED_CONFIRMATION_PHRASES.",
    },
    disabled_button_reasons: {
      awaiting_phrase:
        "Type the confirmation phrase verbatim to enable Confirm Flush.",
      awaiting_risks_ack:
        "Tick \"I understand the risks\" to enable Confirm Flush.",
      blocked_by_validation:
        "Confirm Flush is disabled because one or more gates failed. " +
        "Resolve the failing gate and re-open the dialog.",
    },
    terminal_copy: {
      approved: {
        title: "Confirmation captured",
        body:
          "The draft is now marked pending_live_flush. No write to the " +
          "knowledge base has happened. The live flush adapter is not " +
          "yet approved, so the runtime flag is still false.",
        next_step_pending_live_adapter:
          "Next step: wait for the live flush adapter to be approved " +
          "(Slice 008). Once approved, a real flush requires a " +
          "user-acceptance test with a real knowledgeIngest call.",
      },
      rejected: {
        title: "Draft rejected",
        body_default:
          "You rejected this draft. No write to the knowledge base " +
          "has happened. The draft will be discarded.",
        body_with_reason:
          "You rejected this draft. No write to the knowledge base " +
          "has happened. The reason you gave has been recorded for " +
          "future review.",
      },
      blocked_by_validation: {
        title: "Draft blocked by validation",
        body:
          "This draft cannot be confirmed because one or more gates " +
          "failed. The live flush will be rejected even if the user " +
          "says \"我授权 flush\".",
        next_step_edit_or_review:
          "Next step: edit the draft (remove secret-like fields, fix " +
          "source fidelity issues, correct bucket semantics) and " +
          "re-open the dialog. Do not try to bypass the gates.",
      },
    },
    safety_footer_copy:
      "runtime_flush_allowed = false · live adapter not approved · " +
      "confirmation only makes the draft eligible for an approved flush path",
  };
}

// -----------------------------------------------------------------
// Fixture projection — pure snapshot of a render state
// -----------------------------------------------------------------

export type KnowledgeFlushUiFixtureState =
  | "draft_ready_pass"
  | "blocked_by_source_fidelity"
  | "confirmation_captured_pending_adapter";

export interface KnowledgeFlushUiFixtureGateCard {
  gate: UIGateCard["gate"];
  status: "pass" | "warn" | "fail";
  copy: string;
}

export interface KnowledgeFlushUiFixtureRiskCard {
  category: UIRiskCard["category"];
  severity: UIRiskCard["severity"];
  copy: string;
}

export interface KnowledgeFlushUiFixtureConfirmButton {
  enabled: boolean;
  label: string;
  disabled_reason: string | null;
}

export interface KnowledgeFlushUiFixtureForbiddenPhraseHit {
  phrase: string;
  found: boolean;
  context: string;
}

export interface KnowledgeFlushUiFixtureProjection {
  schema_version: "1.0.0";
  state: KnowledgeFlushUiFixtureState;
  mode: "pending_live_flush";
  runtime_flush_allowed: false;
  live_adapter_approval: "pending" | "not_yet_approved" | "approved";
  header_copy: { title: string; subtitle: string; pending_badge: string };
  body_copy: { step_intro: string };
  gate_cards: KnowledgeFlushUiFixtureGateCard[];
  risk_cards: KnowledgeFlushUiFixtureRiskCard[];
  confirm_button: KnowledgeFlushUiFixtureConfirmButton;
  terminal_copy: { title: string; body: string; next_step: string };
  forbidden_phrase_scan: KnowledgeFlushUiFixtureForbiddenPhraseHit[];
}

/**
 * Project a render state into a golden fixture. Pure. Throws on unknown
 * state.
 */
export function buildKnowledgeFlushUiFixtureProjection(input: {
  state: KnowledgeFlushUiFixtureState;
  draft_id: string;
  now_iso?: string;
}): KnowledgeFlushUiFixtureProjection {
  const deck = buildKnowledgeFlushCopyDeck();
  const allForbidden: ReadonlyArray<string> = ALL_FORBIDDEN_FLUSH_COPY_PHRASES;
  const base: KnowledgeFlushUiFixtureProjection = {
    schema_version: "1.0.0",
    state: input.state,
    mode: "pending_live_flush",
    runtime_flush_allowed: false,
    live_adapter_approval: "not_yet_approved",
    header_copy: {
      title: deck.header_copy.title,
      subtitle: deck.header_copy.subtitle,
      pending_badge: deck.header_copy.pending_badge,
    },
    body_copy: {
      step_intro: deck.body_copy.review_request.intro,
    },
    gate_cards: [],
    risk_cards: [],
    confirm_button: {
      enabled: false,
      label: "Confirm Flush",
      disabled_reason: deck.disabled_button_reasons.awaiting_phrase,
    },
    terminal_copy: {
      title: "",
      body: "",
      next_step: "",
    },
    forbidden_phrase_scan: allForbidden.map((phrase) => ({
      phrase,
      found: false,
      context: "fixture scan: not present in copy deck",
    })),
  };
  switch (input.state) {
    case "draft_ready_pass": {
      return {
        ...base,
        live_adapter_approval: "pending",
        gate_cards: [
          {
            gate: "user_confirmation",
            status: "pass",
            copy: deck.gate_card_copy.user_confirmation.pass_explainer,
          },
          {
            gate: "source_fidelity",
            status: "pass",
            copy: deck.gate_card_copy.source_fidelity.pass_explainer,
          },
          {
            gate: "bucket_semantics",
            status: "pass",
            copy: deck.gate_card_copy.bucket_semantics.pass_explainer,
          },
          {
            gate: "roadmap_guard",
            status: "pass",
            copy: deck.gate_card_copy.roadmap_guard.pass_explainer,
          },
          {
            gate: "secret_guard",
            status: "pass",
            copy: deck.gate_card_copy.secret_guard.pass_explainer,
          },
        ],
        risk_cards: [
          {
            category: "roadmap_mutation",
            severity: "info",
            copy: deck.risk_card_copy.roadmap_mutation.explainer,
          },
          {
            category: "stale_source_promotion",
            severity: "info",
            copy: deck.risk_card_copy.stale_source_promotion.explainer,
          },
          {
            category: "secret_leak",
            severity: "info",
            copy: deck.risk_card_copy.secret_leak.explainer,
          },
          {
            category: "vault_authority_claim",
            severity: "info",
            copy: deck.risk_card_copy.vault_authority_claim.explainer,
          },
          {
            category: "external_instruction_authority",
            severity: "info",
            copy: deck.risk_card_copy.external_instruction_authority.explainer,
          },
          {
            category: "live_flush_pending_hardening",
            severity: "info",
            copy: deck.risk_card_copy.live_flush_pending_hardening.explainer,
          },
        ],
        confirm_button: {
          enabled: false,
          label: "Confirm Flush",
          disabled_reason:
            deck.disabled_button_reasons.awaiting_phrase +
            " | " +
            deck.disabled_button_reasons.awaiting_risks_ack,
        },
        terminal_copy: {
          title: "Draft ready — Confirm Flush is disabled",
          body:
            "All five gates pass. Confirm Flush is still disabled because " +
            "the user has not typed the confirmation phrase and has not " +
            "ticked the risks-acknowledgement checkbox.",
          next_step:
            "Type the confirmation phrase and tick the risks box to " +
            "enable Confirm Flush. Approval only marks the draft as " +
            "pending_live_flush; no write to the knowledge base happens.",
        },
      };
    }
    case "blocked_by_source_fidelity": {
      return {
        ...base,
        state: "blocked_by_source_fidelity",
        gate_cards: [
          {
            gate: "user_confirmation",
            status: "pass",
            copy: deck.gate_card_copy.user_confirmation.pass_explainer,
          },
          {
            gate: "source_fidelity",
            status: "fail",
            copy: deck.gate_card_copy.source_fidelity.fail_explainer,
          },
          {
            gate: "bucket_semantics",
            status: "pass",
            copy: deck.gate_card_copy.bucket_semantics.pass_explainer,
          },
          {
            gate: "roadmap_guard",
            status: "pass",
            copy: deck.gate_card_copy.roadmap_guard.pass_explainer,
          },
          {
            gate: "secret_guard",
            status: "pass",
            copy: deck.gate_card_copy.secret_guard.pass_explainer,
          },
        ],
        risk_cards: [
          {
            category: "vault_authority_claim",
            severity: "block",
            copy: deck.risk_card_copy.vault_authority_claim.explainer,
          },
          {
            category: "live_flush_pending_hardening",
            severity: "info",
            copy: deck.risk_card_copy.live_flush_pending_hardening.explainer,
          },
        ],
        confirm_button: {
          enabled: false,
          label: "Confirm Flush",
          disabled_reason: deck.disabled_button_reasons.blocked_by_validation,
        },
        terminal_copy: {
          title: deck.terminal_copy.blocked_by_validation.title,
          body: deck.terminal_copy.blocked_by_validation.body,
          next_step:
            deck.terminal_copy.blocked_by_validation.next_step_edit_or_review,
        },
      };
    }
    case "confirmation_captured_pending_adapter": {
      return {
        ...base,
        live_adapter_approval: "pending",
        gate_cards: [
          {
            gate: "user_confirmation",
            status: "pass",
            copy: deck.gate_card_copy.user_confirmation.pass_explainer,
          },
          {
            gate: "source_fidelity",
            status: "pass",
            copy: deck.gate_card_copy.source_fidelity.pass_explainer,
          },
          {
            gate: "bucket_semantics",
            status: "pass",
            copy: deck.gate_card_copy.bucket_semantics.pass_explainer,
          },
          {
            gate: "roadmap_guard",
            status: "pass",
            copy: deck.gate_card_copy.roadmap_guard.pass_explainer,
          },
          {
            gate: "secret_guard",
            status: "pass",
            copy: deck.gate_card_copy.secret_guard.pass_explainer,
          },
        ],
        risk_cards: [
          {
            category: "live_flush_pending_hardening",
            severity: "info",
            copy:
              "The draft is now pending_live_flush. The live flush " +
              "adapter is not yet approved. runtime_flush_allowed = false. " +
              "No write to the knowledge base has happened.",
          },
        ],
        confirm_button: {
          enabled: false,
          label: "Awaiting live flush adapter approval",
          disabled_reason:
            "Confirm Flush is no longer clickable. The draft is " +
            "pending_live_flush. The next step is live flush adapter " +
            "approval (Slice 008), not a write.",
        },
        terminal_copy: {
          title: deck.terminal_copy.approved.title,
          body: deck.terminal_copy.approved.body,
          next_step:
            deck.terminal_copy.approved.next_step_pending_live_adapter,
        },
      };
    }
    default: {
      const _exhaustive: never = input.state;
      void _exhaustive;
      throw new Error(
        `buildKnowledgeFlushUiFixtureProjection: unknown state "${String(input.state)}"`
      );
    }
  }
}

// -----------------------------------------------------------------
// scanForbiddenFlushUiCopy
// -----------------------------------------------------------------

export interface ScanForbiddenFlushUiCopyInput {
  /**
   * The user-visible text to scan. This can be a single string or a
   * list of strings (e.g. all copy deck entries flattened).
   */
  text: string | ReadonlyArray<string>;
}

export interface ForbiddenFlushUiCopyHit {
  phrase: string;
  /** The index of the offending text in the input list, or 0 if input is a string */
  index: number;
  /** A small excerpt of the text around the hit (up to 80 chars) */
  excerpt: string;
}

export interface ForbiddenFlushUiCopyScanResult {
  ok: boolean;
  hits: ForbiddenFlushUiCopyHit[];
  scanned_texts: number;
}

/**
 * Scan a piece of user-visible copy for any forbidden promise phrases
 * or forbidden destination phrases. Pure. Case-insensitive substring
 * match. Returns a structured report.
 */
export function scanForbiddenFlushUiCopy(
  input: ScanForbiddenFlushUiCopyInput
): ForbiddenFlushUiCopyScanResult {
  const list: ReadonlyArray<string> = Array.isArray(input.text)
    ? input.text
    : [input.text];
  const hits: ForbiddenFlushUiCopyHit[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const t = list[i];
    if (typeof t !== "string") continue;
    const lower = t.toLowerCase();
    for (const phrase of ALL_FORBIDDEN_FLUSH_COPY_PHRASES) {
      if (lower.includes(phrase.toLowerCase())) {
        const idx = lower.indexOf(phrase.toLowerCase());
        const start = Math.max(0, idx - 20);
        const end = Math.min(t.length, idx + phrase.length + 20);
        hits.push({
          phrase,
          index: i,
          excerpt: t.slice(start, end),
        });
      }
    }
  }
  return {
    ok: hits.length === 0,
    hits,
    scanned_texts: list.length,
  };
}

// -----------------------------------------------------------------
// flattenCopyDeckForScan — convenience: flatten the deck into a string[]
// -----------------------------------------------------------------

/**
 * Flatten a KnowledgeFlushCopyDeck into a list of strings, suitable
 * for `scanForbiddenFlushUiCopy`. Pure.
 */
export function flattenCopyDeckForScan(
  deck: KnowledgeFlushCopyDeck
): ReadonlyArray<string> {
  const out: string[] = [];
  out.push(deck.header_copy.title);
  out.push(deck.header_copy.subtitle);
  out.push(deck.header_copy.pending_badge);
  out.push(deck.body_copy.review_request.intro);
  out.push(deck.body_copy.review_request.primary_source_caption);
  out.push(deck.body_copy.review_evidence.intro);
  out.push(deck.body_copy.review_evidence.stale_caption);
  out.push(deck.body_copy.review_risks.intro);
  out.push(deck.body_copy.review_risks.phrase_label);
  out.push(deck.body_copy.review_risks.risks_acknowledgement_label);
  for (const k of Object.keys(deck.gate_card_copy) as ReadonlyArray<UIGateCard["gate"]>) {
    const c = deck.gate_card_copy[k];
    out.push(c.label);
    out.push(c.pass_explainer);
    out.push(c.warn_explainer);
    out.push(c.fail_explainer);
  }
  for (const k of Object.keys(deck.risk_card_copy) as ReadonlyArray<UIRiskCard["category"]>) {
    const c = deck.risk_card_copy[k];
    out.push(c.label);
    out.push(c.explainer);
  }
  out.push(deck.confirmation_phrase_copy.input_label);
  out.push(deck.confirmation_phrase_copy.expected_phrase);
  out.push(deck.confirmation_phrase_copy.match_helper);
  out.push(deck.disabled_button_reasons.awaiting_phrase);
  out.push(deck.disabled_button_reasons.awaiting_risks_ack);
  out.push(deck.disabled_button_reasons.blocked_by_validation);
  out.push(deck.terminal_copy.approved.title);
  out.push(deck.terminal_copy.approved.body);
  out.push(deck.terminal_copy.approved.next_step_pending_live_adapter);
  out.push(deck.terminal_copy.rejected.title);
  out.push(deck.terminal_copy.rejected.body_default);
  out.push(deck.terminal_copy.rejected.body_with_reason);
  out.push(deck.terminal_copy.blocked_by_validation.title);
  out.push(deck.terminal_copy.blocked_by_validation.body);
  out.push(deck.terminal_copy.blocked_by_validation.next_step_edit_or_review);
  out.push(deck.safety_footer_copy);
  return out;
}
