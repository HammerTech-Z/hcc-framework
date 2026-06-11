// A-2 HumanApprovalRef 人闸门接线 — 适配层（green）
//
// 不变量：
// 1. contract-layer HumanApprovalRef.verified 必须保持 false
// 2. 仅 actor === "human" 可通过
// 3. auditDir 必须显式传入，且不得包含 .hermes 路径段
// 4. 禁止使用默认 audit store（见 audit-log.ts 默认常量与函数）
// 5. 复用 buildHumanApprovalRefVerifier，不重写校验逻辑

import * as fs from "fs";

import { createAuditLogStore, type AuditLogStore } from "./audit-log";

import type {
  HumanApprovalRef,
  HumanApprovalRefVerifier,
  HumanApprovalVerificationResult,
} from "@shared/lib/post-task-reflection-contract";

import type {
  HumanApprovalAnchorRecord,
} from "@shared/lib/post-task-reflection-human-approval-anchor-design";

import {
  buildHumanApprovalRefVerifier,
} from "@shared/lib/post-task-reflection-human-approval-anchor-design";

export interface HumanApprovalGateOptions {
  /** 人类离线登记的 anchor 表，adapter 仅读取 */
  readonly anchors: readonly HumanApprovalAnchorRecord[];
  /**
   * audit log 根目录。必须显式传入且禁止包含 .hermes 路径段。
   * 生产环境由 caller 传 app.getPath("userData") + "/audit-human-approval"。
   * 测试传 tmpDir。
   */
  readonly auditDir: string;
  /** 测试注入用：可替换 AuditLogStore */
  readonly auditStore?: AuditLogStore;
}

export interface HumanApprovalGateConfirmInput {
  readonly human_approval_ref: HumanApprovalRef;
  readonly gate: Parameters<HumanApprovalRefVerifier>[0]["gate"];
  readonly reflection_task_id: string;
  readonly artifact_ref: string;
  readonly created_at: string;
  /** 触发来源：必须 === "human"，其它值 throw */
  readonly actor: "human";
}

/**
 * 调用契约层 verifier 并把结果写入 caller 提供的 audit 目录。
 * 关键不变量：verified=true 仅来自人类 anchor 命中。
 */
export function confirmHumanApproval(
  input: HumanApprovalGateConfirmInput,
  options: HumanApprovalGateOptions,
): HumanApprovalVerificationResult {
  // 不变量 1: actor 必须 === "human"
  if (input.actor !== "human") {
    throw new Error(
      "human_approval_gate: only actor='human' is permitted; AI/programmatic paths must throw",
    );
  }

  // 不变量 2: 契约层 verified 必须 === false
  if (input.human_approval_ref.verified !== false) {
    throw new Error(
      "human_approval_gate: contract-layer human_approval_ref.verified must remain false",
    );
  }

  // 不变量 3: auditDir 必须显式且禁止命中受限路径段
  validateAuditDir(options.auditDir);

  // 复用契约层 verifier
  const verifier = buildHumanApprovalRefVerifier(options.anchors);

  const result = verifier({
    human_approval_ref: input.human_approval_ref,
    gate: input.gate,
    reflection_task_id: input.reflection_task_id,
    artifact_ref: input.artifact_ref,
    created_at: input.created_at,
  });

  // 写入 audit log（用 caller 注入的 store / 显式 auditDir 创建的 store）
  const store =
    options.auditStore ?? createAuditLogStore({ auditDir: options.auditDir });
  fs.mkdirSync(options.auditDir, { recursive: true });

  store.append({
    task_id: input.reflection_task_id,
    actor: "user", // AuditActor union: codex/claude/hermes/user/system — "user" 是人
    event: "user_override", // AuditEvent union: user_override 表示人显式覆盖判定
    decision: result.verified ? "allow" : "deny",
    context: {
      trust_level: "trusted_user",
      requested_capability: "credential_access", // 人批 = 高权限能力授权
      allowed_capability_set: result.verified
        ? ["credential_access", "write_project"]
        : [],
      matched_rule: result.verified
        ? "human_approval_gate:actor=human+anchor_matched"
        : `human_approval_gate:${result.reason ?? "rejected"}`,
      allowlist_hit: result.verified ? input.human_approval_ref.ref : null,
      path_check: "not_applicable",
      risk_level: "high", // 人批事件均视为高风险，留证
      // 扩展字段：retry_context / existing_lease 不填
      // 扩展字段：human_approval_gate 专用（resources_lease 字段复用存元数据）
      resource_type: "gateway",
      resource_id: `human-approval:${input.human_approval_ref.ref}`,
    },
    evidence_ref: input.artifact_ref,
  });

  return result;
}

/**
 * 拒绝 auditDir 为空 / 含 .hermes 路径段。
 * 路径段匹配：`.hermes` 作为完整路径段出现（含 `/` 或路径末尾）。
 */
function validateAuditDir(auditDir: string): void {
  if (!auditDir || auditDir.trim() === "") {
    throw new Error(
      "human_approval_gate: auditDir must be explicit (non-empty); default home audit dir is forbidden",
    );
  }
  // 路径段匹配: `/foo/.hermes/bar` 或 `/foo/.hermes` 或 `.hermes/`
  // 拆段后看是否含 `.hermes`
  const segments = auditDir.split(/[\\/]+/);
  if (segments.includes(".hermes")) {
    throw new Error(
      `human_approval_gate: auditDir must not contain a restricted path segment (got: ${auditDir}); use app.getPath('userData') or tmpDir`,
    );
  }
}