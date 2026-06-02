// P2.5 Scheduler / Resource Lease — pure main helper
// No IPC, no HCC, no CLI, no executor.
// Manages exclusive leases on resources (worktree, local_llm, gateway, browser).
// Each resourceId has at most one active lease at a time.
// Higher-priority leases cannot be preempted by lower-priority ones.

import type { AuditActor, AuditContext } from "@shared/lib/safety/types";
import { createAuditLogStore, DEFAULT_AUDIT_DIR } from "./audit-log";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type ResourceType = "worktree" | "local_llm" | "gateway" | "browser";

export type Priority = "interactive" | "cron" | "background";

export interface Lease {
  taskId: string;
  resourceType: ResourceType;
  resourceId: string;
  priority: Priority;
  /** Unix ms timestamp when this lease expires. */
  expiresAt: number;
  actor: AuditActor;
  evidenceRef: string;
  acquiredAt: string; // ISO 8601
}

export interface AcquireInput {
  taskId: string;
  resourceType: ResourceType;
  resourceId: string;
  priority: Priority;
  /** Lease TTL in ms. Default 5 minutes. */
  ttlMs?: number;
  actor: AuditActor;
  evidenceRef: string;
  auditDir?: string;
}

export interface ReleaseInput {
  taskId: string;
  resourceId: string;
  actor: AuditActor;
  evidenceRef: string;
  auditDir?: string;
}

export interface AcquireResult {
  decision: "allow" | "deny";
  reasons: string[];
  lease: Lease | null;
  chainClean: number;
}

export interface ReleaseResult {
  decision: "allow" | "deny";
  released: boolean;
  reasons: string[];
  chainClean: number;
}

// -----------------------------------------------------------------
// Priority ordering
// -----------------------------------------------------------------

const PRIORITY_RANK: Record<Priority, number> = {
  interactive: 3,
  cron: 2,
  background: 1,
};

// -----------------------------------------------------------------
// Resource Lease Manager
// -----------------------------------------------------------------

export interface ResourceLeaseManager {
  acquireLease(input: AcquireInput): AcquireResult;
  releaseLease(input: ReleaseInput): ReleaseResult;
  getActiveLeases(): Lease[];
}

interface InternalLease extends Lease {}

/**
 * Create a resource lease manager.
 * All leases are in-memory only (no persistence across restarts).
 */
export function createResourceLeaseManager(): ResourceLeaseManager {
  /** resourceId → active (non-expired) lease */
  const leases = new Map<string, InternalLease>();

  function isExpired(lease: Lease): boolean {
    return Date.now() > lease.expiresAt;
  }

  function evictExpired(resourceId: string): void {
    const existing = leases.get(resourceId);
    if (existing && isExpired(existing)) {
      leases.delete(resourceId);
    }
  }

  function buildAuditContext(
    resourceType: ResourceType,
    resourceId: string,
    priority: Priority,
    _decision: "allow" | "deny",
    _reasons: string[],
    existingLease: Lease | null,
  ): AuditContext {
    // Cast to AuditContext — resource_lease events use extended context fields;
    // other fields are filled with safe defaults for hash chain completeness.
    return {
      trust_level: "trusted_user",
      requested_capability: "read_public",
      allowed_capability_set: [],
      matched_rule: "resource_lease",
      allowlist_hit: null,
      path_check: "not_applicable",
      risk_level: "low",
      resource_type: resourceType,
      resource_id: resourceId,
      priority,
      existing_lease: existingLease
        ? {
            task_id: existingLease.taskId,
            priority: existingLease.priority,
            expires_at: existingLease.expiresAt,
            is_expired: isExpired(existingLease),
          }
        : null,
    } as AuditContext;
  }

  return {
    acquireLease(input: AcquireInput): AcquireResult {
      const auditDir = input.auditDir ?? DEFAULT_AUDIT_DIR;
      const store = createAuditLogStore({ auditDir });
      const ttlMs = input.ttlMs ?? 5 * 60 * 1000; // default 5 min
      const reasons: string[] = [];

      // Evict any expired lease for this resourceId first
      evictExpired(input.resourceId);

      const existing = leases.get(input.resourceId);

      // Case 1: no active lease → allow
      if (!existing) {
        const now = Date.now();
        const acquiredAt = new Date().toISOString();
        const newLease: InternalLease = {
          taskId: input.taskId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          priority: input.priority,
          expiresAt: now + ttlMs,
          actor: input.actor,
          evidenceRef: input.evidenceRef,
          acquiredAt,
        };
        leases.set(input.resourceId, newLease);

        store.append({
          task_id: input.taskId,
          actor: input.actor,
          event: "resource_lease",
          decision: "allow",
          context: buildAuditContext(
            input.resourceType,
            input.resourceId,
            input.priority,
            "allow",
            reasons,
            null,
          ),
          evidence_ref: input.evidenceRef,
        });

        const chainClean = store.verify(input.taskId);
        return { decision: "allow", reasons, lease: newLease, chainClean };
      }

      // Case 2: existing lease found — check priority rules
      const existingRank = PRIORITY_RANK[existing.priority];
      const newRank = PRIORITY_RANK[input.priority];

      // Rule: cron/background cannot preempt an interactive lease
      if (existing.priority === "interactive" && input.priority !== "interactive") {
        const reason = `interactive lease held by task ${existing.taskId}: ${input.priority} request denied`;
        reasons.push(reason);

        store.append({
          task_id: input.taskId,
          actor: input.actor,
          event: "resource_lease",
          decision: "deny",
          context: buildAuditContext(
            input.resourceType,
            input.resourceId,
            input.priority,
            "deny",
            reasons,
            existing,
          ),
          evidence_ref: input.evidenceRef,
        });

        const chainClean = store.verify(input.taskId);
        return { decision: "deny", reasons, lease: null, chainClean };
      }

      // Rule: same or lower priority cannot replace existing lease
      if (newRank <= existingRank) {
        const reason = `lease already held by task ${existing.taskId} (priority ${existing.priority}): ${input.priority} request denied`;
        reasons.push(reason);

        store.append({
          task_id: input.taskId,
          actor: input.actor,
          event: "resource_lease",
          decision: "deny",
          context: buildAuditContext(
            input.resourceType,
            input.resourceId,
            input.priority,
            "deny",
            reasons,
            existing,
          ),
          evidence_ref: input.evidenceRef,
        });

        const chainClean = store.verify(input.taskId);
        return { decision: "deny", reasons, lease: null, chainClean };
      }

      // Case 3: higher-priority lease can take over (interactive takes over cron/background)
      const now = Date.now();
      const acquiredAt = new Date().toISOString();
      const newLease: InternalLease = {
        taskId: input.taskId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        priority: input.priority,
        expiresAt: now + ttlMs,
        actor: input.actor,
        evidenceRef: input.evidenceRef,
        acquiredAt,
      };
      leases.set(input.resourceId, newLease);

      const reason = `higher-priority lease (${input.priority}) preempts existing ${existing.priority} lease for task ${existing.taskId}`;
      reasons.push(reason);

      store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "resource_lease",
        decision: "allow",
        context: buildAuditContext(
          input.resourceType,
          input.resourceId,
          input.priority,
          "allow",
          reasons,
          existing,
        ),
        evidence_ref: input.evidenceRef,
      });

      const chainClean = store.verify(input.taskId);
      return { decision: "allow", reasons, lease: newLease, chainClean };
    },

    releaseLease(input: ReleaseInput): ReleaseResult {
      const auditDir = input.auditDir ?? DEFAULT_AUDIT_DIR;
      const store = createAuditLogStore({ auditDir });
      const reasons: string[] = [];

      const existing = leases.get(input.resourceId);

      if (!existing || (existing.taskId !== input.taskId)) {
        const reason = !existing
          ? `no active lease for resource ${input.resourceId}`
          : `lease for resource ${input.resourceId} held by task ${existing.taskId}, not ${input.taskId}`;
        reasons.push(reason);

        store.append({
          task_id: input.taskId,
          actor: input.actor,
          event: "resource_lease",
          decision: "deny",
          context: buildAuditContext(
            existing?.resourceType ?? ("gateway" as ResourceType),
            input.resourceId,
            existing?.priority ?? ("background" as Priority),
            "deny",
            reasons,
            existing ?? null,
          ),
          evidence_ref: input.evidenceRef,
        });

        const chainClean = store.verify(input.taskId);
        return { decision: "deny", released: false, reasons, chainClean };
      }

      // Release successful
      leases.delete(input.resourceId);

      store.append({
        task_id: input.taskId,
        actor: input.actor,
        event: "resource_lease",
        decision: "allow",
        context: buildAuditContext(
          existing.resourceType,
          input.resourceId,
          existing.priority,
          "allow",
          ["lease released"],
          existing,
        ),
        evidence_ref: input.evidenceRef,
      });

      const chainClean = store.verify(input.taskId);
      return { decision: "allow", released: true, reasons, chainClean };
    },

    getActiveLeases(): Lease[] {
      const result: Lease[] = [];
      for (const lease of Array.from(leases.values())) {
        if (!isExpired(lease)) {
          result.push(lease);
        }
      }
      // Also evict expired ones while we're at it
      for (const resourceId of Array.from(leases.keys())) {
        evictExpired(resourceId);
      }
      return result;
    },
  };
}