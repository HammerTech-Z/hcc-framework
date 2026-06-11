// A-6 HCC first real task — Capability / Domain Registry shell
//
// Pure data + query helpers. No I/O, no IPC, no runtime mutation, no
// daemon, no cron, no weixin, no channel runtime, no live apply, no
// HCC Auto Executor, no ~/.hermes writes.
//
// trust_level reuses HCCProgressTrustLevel from A-1 GOV-006.
// This module is a Phase B lane-1 primer — subsequent B-2 scan gate
// will consume these registries as capability evidence lookup tables.

import type { HCCProgressTrustLevel } from "../safety/hcc-task-handoff-policy";

// ── types ───────────────────────────────────────────────────────────────────

/**
 * Capability identifier — a stable string key for a capability entry.
 * Distinct from `safety/types.ts` `Capability` union to avoid shadowing.
 */
export type CapabilityId = string;

/** Allowed status values for a registry entry. */
export type CapabilityEntryStatus = "draft" | "active" | "deprecated";

/** A single capability entry in the registry. */
export interface CapabilityRegistryEntry {
  readonly id: CapabilityId;
  readonly title: string;
  readonly trust_level: HCCProgressTrustLevel;
  readonly evidence_ref: string;
  readonly status: CapabilityEntryStatus;
}

/** The capability registry — an append-only collection of entries. */
export interface CapabilityRegistry {
  readonly entries: readonly CapabilityRegistryEntry[];
}

/** A domain groups related capabilities under a named scope. */
export interface DomainRegistryEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly CapabilityRegistryEntry[];
}

/** The domain registry — a collection of domain entries. */
export interface DomainRegistry {
  readonly domains: readonly DomainRegistryEntry[];
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Create an empty capability registry. */
export function createEmptyCapabilityRegistry(): CapabilityRegistry {
  return { entries: [] };
}

/** List all capability entries in the registry (read-only). */
export function listCapabilities(
  registry: CapabilityRegistry,
): readonly CapabilityRegistryEntry[] {
  return registry.entries;
}

/** Get a capability entry by id. Returns null when not found. */
export function getCapabilityById(
  registry: CapabilityRegistry,
  id: CapabilityId,
): CapabilityRegistryEntry | null {
  return registry.entries.find((e) => e.id === id) ?? null;
}

/**
 * Filter capabilities by trust level.
 * Returns a new array — does not mutate the input registry.
 */
export function filterCapabilitiesByTrustLevel(
  registry: CapabilityRegistry,
  level: HCCProgressTrustLevel,
): readonly CapabilityRegistryEntry[] {
  return registry.entries.filter((e) => e.trust_level === level);
}

/** Create an empty domain registry. */
export function createEmptyDomainRegistry(): DomainRegistry {
  return { domains: [] };
}
