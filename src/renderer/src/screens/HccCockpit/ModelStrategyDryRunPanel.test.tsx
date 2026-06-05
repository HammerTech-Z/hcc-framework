import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { ModelStrategyDryRunPanel } from "./ModelStrategyDryRunPanel";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..", "..");
const panelSrc = readFileSync(
  join(
    ROOT,
    "src/renderer/src/screens/HccCockpit/ModelStrategyDryRunPanel.tsx",
  ),
  "utf-8",
);

describe("MODEL-STRATEGY-003A-1 ModelStrategyDryRunPanel", () => {
  beforeEach(() => {
    (window as unknown as { hermesAPI?: unknown }).hermesAPI = {
      listModels: vi.fn(),
      getModelConfig: vi.fn(),
      setModelConfig: vi.fn(),
      getEnv: vi.fn(),
      setEnv: vi.fn(),
      saveModelConfig: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the six lanes with disabled state", () => {
    render(<ModelStrategyDryRunPanel />);

    const list = screen.getByTestId("model-strategy-dry-run-list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);

    const laneIds = [
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ];
    for (const laneId of laneIds) {
      const row = screen.getByTestId(`model-strategy-row-${laneId}`);
      const enabledPill = screen.getByTestId(
        `model-strategy-enabled-${laneId}`,
      );
      expect(row).toBeInTheDocument();
      expect(enabledPill).toHaveTextContent("disabled");
      expect(enabledPill).toHaveAttribute("data-enabled", "false");
      expect(enabledPill).toHaveAttribute("data-disabled", "true");
    }
  });

  it("shows the dry-run banner and footer disclaimer", () => {
    render(<ModelStrategyDryRunPanel />);

    const banner = screen.getByTestId("model-strategy-dry-run-banner");
    expect(banner.textContent).toMatch(/dry-run only/);
    expect(banner.textContent).toMatch(/no live config writes/);
    expect(banner.textContent).toMatch(/no runtime routing/);

    const footer = screen.getByTestId("model-strategy-dry-run-footer");
    expect(footer.textContent).toMatch(/read-only/);
    expect(footer.textContent).toMatch(/6 lanes/);
  });

  it("does not render any actionable buttons", () => {
    render(<ModelStrategyDryRunPanel />);

    const panel = screen.getByTestId("model-strategy-dry-run-panel");
    const buttons = within(panel).queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("never calls window.hermesAPI during render", () => {
    render(<ModelStrategyDryRunPanel />);

    const api = (window as unknown as {
      hermesAPI: {
        listModels: ReturnType<typeof vi.fn>;
        getModelConfig: ReturnType<typeof vi.fn>;
        setModelConfig: ReturnType<typeof vi.fn>;
        getEnv: ReturnType<typeof vi.fn>;
        setEnv: ReturnType<typeof vi.fn>;
        saveModelConfig: ReturnType<typeof vi.fn>;
      };
    }).hermesAPI;
    expect(api.listModels).not.toHaveBeenCalled();
    expect(api.getModelConfig).not.toHaveBeenCalled();
    expect(api.setModelConfig).not.toHaveBeenCalled();
    expect(api.getEnv).not.toHaveBeenCalled();
    expect(api.setEnv).not.toHaveBeenCalled();
    expect(api.saveModelConfig).not.toHaveBeenCalled();
  });

  it("exposes catalog/smoke/verification/disabledReason per lane", () => {
    render(<ModelStrategyDryRunPanel />);

    for (const laneId of [
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]) {
      const reason = screen.getByTestId(`model-strategy-reason-${laneId}`);
      expect(reason.textContent).not.toEqual("");
      const state = screen.getByTestId(`model-strategy-state-${laneId}`);
      expect(state.textContent ?? "").toMatch(/unverified|blocked|verified/);
    }

    const dailyReason = screen.getByTestId("model-strategy-reason-daily");
    expect(dailyReason.textContent).toMatch(
      /provider_catalog_resolution_required/,
    );
    const localReason = screen.getByTestId(
      "model-strategy-reason-daily_fallback",
    );
    expect(localReason.textContent).toMatch(
      /local_fallback_structural_only/,
    );
    const complexReason = screen.getByTestId(
      "model-strategy-reason-complex_code",
    );
    expect(complexReason.textContent).toMatch(/user_intent_required/);
    const taskReason = screen.getByTestId(
      "model-strategy-reason-task_fallback",
    );
    expect(taskReason.textContent).toMatch(/rollback_guard_present/);
  });
});

describe("MODEL-STRATEGY-003A-1 source guardrails", () => {
  it("panel source does not import tests/fixtures", () => {
    expect(panelSrc).not.toMatch(/from\s+["'][^"']*tests\/fixtures/);
    expect(panelSrc).not.toMatch(/from\s+["'][^"']*\/tests\//);
  });

  it("panel source does not reference runtime/network/config surfaces", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "spawn(",
      "exec(",
      "config.yaml",
      "setModelConfig",
      "setEnv",
      "startGateway",
      "runPlaybook",
      "triggerCronJob",
      "knowledgeIngest",
      "handoff/packs",
      ".hermes/audit",
      "http.request(",
      "https.request(",
      "net.connect(",
      "dns.lookup(",
      "https.Agent",
    ]) {
      expect(panelSrc).not.toContain(forbidden);
    }
  });

  it("panel source does not import Models or Providers writeable screens", () => {
    expect(panelSrc).not.toMatch(/from\s+["'][^"']*Models["']/);
    expect(panelSrc).not.toMatch(/from\s+["'][^"']*Providers["']/);
  });
});
