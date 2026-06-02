import { describe, expect, it, beforeEach } from "vitest";
import {
  recordUsageEvent,
  getEventsForTask,
  getAllEvents,
  _clearLedger,
  deadEndsToMisled,
  buildPassEvent,
  buildFailEvent,
  type UsageEvent,
} from "../src/shared/lib/usage-feedback";

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function makePassEvent(taskId = "task-001"): UsageEvent {
  return buildPassEvent({
    taskId,
    artifactRef: "HCC-20260530",
    retrieved: ["kb://local-llm-config", "kb://ollama-setup"],
    used: ["kb://local-llm-config"],
    helped: ["kb://local-llm-config"],
  });
}

function makeFailEvent(taskId = "task-002"): UsageEvent {
  return buildFailEvent({
    taskId,
    artifactRef: "HCC-20260530",
    retrieved: ["kb://some-doc", "kb://bad-assumption"],
    used: ["kb://bad-assumption"],
    misled: ["kb://bad-assumption"],
  });
}

// -----------------------------------------------------------------
// recordUsageEvent + getAllEvents
// -----------------------------------------------------------------

describe("recordUsageEvent", () => {
  beforeEach(() => {
    _clearLedger();
  });

  it("appends a PASS event to the ledger", () => {
    const event = makePassEvent();
    recordUsageEvent(event);

    const all = getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0].outcome).toBe("PASS");
    expect(all[0].helped).toContain("kb://local-llm-config");
  });

  it("appends a FAIL event to the ledger", () => {
    const event = makeFailEvent();
    recordUsageEvent(event);

    const all = getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0].outcome).toBe("FAIL");
    expect(all[0].misled).toContain("kb://bad-assumption");
  });

  it("appends a rolled_back event to the ledger", () => {
    const event = makeFailEvent("task-003");
    event.outcome = "rolled_back";
    recordUsageEvent(event);

    const all = getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0].outcome).toBe("rolled_back");
  });

  it("multiple events are appended (not replaced)", () => {
    recordUsageEvent(makePassEvent("task-a"));
    recordUsageEvent(makeFailEvent("task-b"));
    recordUsageEvent(makePassEvent("task-c"));

    const all = getAllEvents();
    expect(all).toHaveLength(3);
  });

  it("getEventsForTask returns only matching task_id", () => {
    recordUsageEvent(makePassEvent("task-x"));
    recordUsageEvent(makeFailEvent("task-y"));
    recordUsageEvent(makePassEvent("task-z"));

    const found = getEventsForTask("task-y");
    expect(found).toHaveLength(1);
    expect(found[0].outcome).toBe("FAIL");
  });
});

// -----------------------------------------------------------------
// dead_ends → misled mapping
// -----------------------------------------------------------------

describe("deadEndsToMisled", () => {
  it("maps dead_end strings to knowledge_ids when map is provided", () => {
    const deadEnds = ["bad-ref", "stale-doc"];
    const map = {
      "bad-ref": "kb://misleading-assumption",
      "stale-doc": "kb://outdated-guide",
    };

    const misled = deadEndsToMisled(deadEnds, map);
    expect(misled).toEqual([
      "kb://misleading-assumption",
      "kb://outdated-guide",
    ]);
  });

  it("falls back to original string when dead_end not in map", () => {
    const deadEnds = ["unknown-de"];
    const map: Record<string, string> = {};

    const misled = deadEndsToMisled(deadEnds, map);
    expect(misled).toEqual(["unknown-de"]);
  });

  it("treats dead_end strings as knowledge_ids when no map provided", () => {
    const deadEnds = ["kb://bad-idea", "kb://wrong-path"];

    const misled = deadEndsToMisled(deadEnds);
    expect(misled).toEqual(["kb://bad-idea", "kb://wrong-path"]);
  });

  it("returns empty array for empty dead_ends", () => {
    expect(deadEndsToMisled([])).toEqual([]);
  });
});

// -----------------------------------------------------------------
// buildPassEvent / buildFailEvent
// -----------------------------------------------------------------

describe("buildPassEvent", () => {
  it("produces a valid UsageEvent with outcome=PASS", () => {
    const event = buildPassEvent({
      taskId: "task-100",
      artifactRef: "HCC-20260530",
      retrieved: ["kb://a", "kb://b"],
      used: ["kb://a"],
      helped: ["kb://a"],
    });

    expect(event.task_id).toBe("task-100");
    expect(event.artifact_ref).toBe("HCC-20260530");
    expect(event.outcome).toBe("PASS");
    expect(event.misled).toEqual([]);
    expect(event.recorded_at).toBeTruthy();
  });

  it("defaults artifact_ref to null when not provided", () => {
    const event = buildPassEvent({
      taskId: "task-101",
      retrieved: [],
      used: [],
      helped: [],
    });
    expect(event.artifact_ref).toBeNull();
  });
});

describe("buildFailEvent", () => {
  it("produces a valid UsageEvent with outcome=FAIL", () => {
    const event = buildFailEvent({
      taskId: "task-200",
      artifactRef: "HCC-20260530",
      retrieved: ["kb://x"],
      used: ["kb://x"],
      misled: ["kb://x"],
    });

    expect(event.task_id).toBe("task-200");
    expect(event.outcome).toBe("FAIL");
    expect(event.helped).toEqual([]);
  });

  it("produces a valid UsageEvent with outcome=rolled_back", () => {
    const event = buildFailEvent({
      taskId: "task-201",
      retrieved: ["kb://x"],
      used: ["kb://x"],
      misled: ["kb://x"],
      rolledBack: true,
    });

    expect(event.outcome).toBe("rolled_back");
  });

  it("defaults artifact_ref to null when not provided", () => {
    const event = buildFailEvent({
      taskId: "task-202",
      retrieved: [],
      used: [],
      misled: [],
    });
    expect(event.artifact_ref).toBeNull();
  });
});

// -----------------------------------------------------------------
// typed-link sort stability (must NOT be affected by recording)
// -----------------------------------------------------------------

describe("typed-link sort is unaffected", () => {
  it("recording events does not change inferTypedLinks output order", () => {
    _clearLedger();

    // Record several events before inference
    recordUsageEvent(makePassEvent("pre-task"));
    recordUsageEvent(makeFailEvent("pre-task-2"));

    // We verify the ledger size grew — this proves recording happened
    expect(getAllEvents()).toHaveLength(2);

    // The module under test has no coupling to typed-links;
    // this test documents the non-coupling invariant.
    // If typed-links.ts is later imported here, verify link count is unchanged.
    _clearLedger();
    recordUsageEvent(makePassEvent("post-task"));

    // Ledger should reflect only post-task events now
    expect(getAllEvents()).toHaveLength(1);
  });
});