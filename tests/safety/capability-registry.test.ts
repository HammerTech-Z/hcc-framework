// A-6 HCC first real task — Capability/Domain Registry shell (TDD red)
//
// Tests for:
// 1. Empty registry is empty
// 2. Query by id
// 3. Miss returns null (explicit)
// 4. trust_level only 5 levels (HCCProgressTrustLevel union)
// 5. evidence_ref is required on every entry
// 6. status only draft/active/deprecated
// 7. Helpers do not mutate input
// 8. DomainRegistry shell exists
// 9. Source code contains no fs/ipc/runtime/~/.hermes write paths

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  createEmptyCapabilityRegistry,
  createEmptyDomainRegistry,
  listCapabilities,
  getCapabilityById,
  filterCapabilitiesByTrustLevel,
  type CapabilityRegistry,
  type CapabilityRegistryEntry,
  type DomainRegistry,
  type DomainRegistryEntry,
  type CapabilityId,
  type CapabilityEntryStatus,
} from "../../src/shared/lib/registry/capability-registry";

// ── helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_ID: CapabilityId = "read_local" as CapabilityId;

const SAMPLE_ENTRY: CapabilityRegistryEntry = {
  id: SAMPLE_ID,
  title: "Read Local Files",
  trust_level: "single_run",
  evidence_ref: "tests/safety/capability-registry.test.ts",
  status: "active",
};

function makeEntry(overrides: Partial<CapabilityRegistryEntry> = {}): CapabilityRegistryEntry {
  return { ...SAMPLE_ENTRY, ...overrides };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe("A-6 CapabilityRegistry", () => {
  // 1. empty registry
  it("createEmptyCapabilityRegistry returns an empty registry", () => {
    const reg = createEmptyCapabilityRegistry();
    expect(reg.entries).toEqual([]);
    expect(listCapabilities(reg)).toEqual([]);
    expect(getCapabilityById(reg, SAMPLE_ID)).toBeNull();
  });

  // 2. query by id
  it("getCapabilityById returns the matching entry", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    const found = getCapabilityById(reg, SAMPLE_ID);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(SAMPLE_ID);
    expect(found!.title).toBe("Read Local Files");
  });

  // 3. miss returns null
  it("getCapabilityById returns null on miss", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    expect(getCapabilityById(reg, "nonexistent" as CapabilityId)).toBeNull();
  });

  // 4. trust_level only 5 levels
  it("trust_level only accepts HCCProgressTrustLevel values (5 levels)", () => {
    const levels: CapabilityRegistryEntry["trust_level"][] = [
      "unverified",
      "ai_inferred",
      "single_run",
      "reproduced",
      "human_confirmed",
    ];
    for (const level of levels) {
      const entry = makeEntry({ id: `test-${level}` as CapabilityId, trust_level: level });
      expect(entry.trust_level).toBe(level);
    }
    // 类型层面：不匹配的字符串在 TS 编译期即拒
  });

  // 5. evidence_ref is required
  it("evidence_ref is required on every entry (compile-time enforced)", () => {
    // validate that entries list is filterable by evidence_ref presence
    const reg: CapabilityRegistry = {
      entries: [
        SAMPLE_ENTRY,
        makeEntry({ id: "write_artifact" as CapabilityId, evidence_ref: "tests/safety/hcc-task-handoff-policy.test.ts" }),
      ],
    };
    const allHaveEvidenceRef = reg.entries.every((e) => typeof e.evidence_ref === "string" && e.evidence_ref.length > 0);
    expect(allHaveEvidenceRef).toBe(true);
  });

  // 6. status only draft/active/deprecated
  it("status only allows draft | active | deprecated", () => {
    const valid: CapabilityEntryStatus[] = ["draft", "active", "deprecated"];
    for (const s of valid) {
      const entry = makeEntry({ id: `test-status-${s}` as CapabilityId, status: s });
      expect(entry.status).toBe(s);
    }
  });

  // 7. helpers do not mutate input
  it("listCapabilities does not mutate input", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    const snapshot = JSON.stringify(reg);
    listCapabilities(reg);
    expect(JSON.stringify(reg)).toBe(snapshot);
  });

  it("getCapabilityById does not mutate input", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    const snapshot = JSON.stringify(reg);
    getCapabilityById(reg, SAMPLE_ID);
    expect(JSON.stringify(reg)).toBe(snapshot);
  });

  it("filterCapabilitiesByTrustLevel does not mutate input", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    const snapshot = JSON.stringify(reg);
    filterCapabilitiesByTrustLevel(reg, "single_run");
    expect(JSON.stringify(reg)).toBe(snapshot);
  });

  // filter helper
  it("filterCapabilitiesByTrustLevel returns matching entries", () => {
    const reg: CapabilityRegistry = {
      entries: [
        makeEntry({ id: "read_local" as CapabilityId, trust_level: "single_run" }),
        makeEntry({ id: "read_public" as CapabilityId, trust_level: "unverified" }),
        makeEntry({ id: "write_artifact" as CapabilityId, trust_level: "human_confirmed" }),
      ],
    };
    const filtered = filterCapabilitiesByTrustLevel(reg, "single_run");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("read_local");
  });

  it("filterCapabilitiesByTrustLevel returns empty for no match", () => {
    const reg: CapabilityRegistry = { entries: [SAMPLE_ENTRY] };
    expect(filterCapabilitiesByTrustLevel(reg, "human_confirmed")).toEqual([]);
  });
});

describe("A-6 DomainRegistry", () => {
  it("createEmptyDomainRegistry returns a shell with empty domains", () => {
    const reg = createEmptyDomainRegistry();
    expect(reg.domains).toEqual([]);
  });

  it("DomainRegistryEntry shape is usable", () => {
    const entry: DomainRegistryEntry = {
      id: "code" as const,
      title: "Code Domain",
      description: "Source code and project-level capabilities",
      capabilities: [SAMPLE_ENTRY],
    };
    expect(entry.capabilities).toHaveLength(1);
    expect(entry.capabilities[0]!.id).toBe(SAMPLE_ID);
  });
});

describe("A-6 static: no fs / ipc / runtime / ~/.hermes write paths", () => {
  const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const SRC = path.resolve(HERE_DIR, "../../src/shared/lib/registry/capability-registry.ts");

  it("source does not import fs, ipc, spawn, exec, BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/ipcRenderer/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("source does not contain spawn( or exec( or runPlaybook(", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\brunPlaybook\s*\(/);
  });

  it("source contains no .hermes string (write path)", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    // skip comment/doc lines
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });
});
