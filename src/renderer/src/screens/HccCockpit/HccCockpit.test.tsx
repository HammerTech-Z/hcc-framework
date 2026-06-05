import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { resolve } from "path";

import HccCockpit from "./HccCockpit";

const SAMPLE_RUN = {
  runId: "run-001",
  taskName: "fixture task",
  status: "idle",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  artifactCount: 0,
  artifacts: [],
  conclusion: "fixture conclusion",
  stage: "discovery",
};

const SAMPLE_PLAYBOOK = { id: "pb-1", name: "fixture playbook" };
const SAMPLE_CRON = {
  ts: Date.now(),
  job: "fixture-job",
  status: "ok",
};
const SAMPLE_EVENT = { ts: Date.now(), event: "noop", role: "system" };
const SAMPLE_GATEWAY = {
  active_agents: 0,
  pending: 0,
};
const SAMPLE_HEALTH = { status: 200, ok: true };

type Api = {
  listPipelineRuns: ReturnType<typeof vi.fn>;
  listPlaybooks: ReturnType<typeof vi.fn>;
  getCronJobHistory: ReturnType<typeof vi.fn>;
  getEvents: ReturnType<typeof vi.fn>;
  getGatewayState: ReturnType<typeof vi.fn>;
  checkGatewayHealth: ReturnType<typeof vi.fn>;
  listModels: ReturnType<typeof vi.fn>;
  getModelConfig: ReturnType<typeof vi.fn>;
  setModelConfig: ReturnType<typeof vi.fn>;
  getEnv: ReturnType<typeof vi.fn>;
  setEnv: ReturnType<typeof vi.fn>;
  saveModelConfig: ReturnType<typeof vi.fn>;
};

function installMockApi(): Api {
  const api: Api = {
    listPipelineRuns: vi.fn().mockResolvedValue([SAMPLE_RUN]),
    listPlaybooks: vi.fn().mockResolvedValue([SAMPLE_PLAYBOOK]),
    getCronJobHistory: vi.fn().mockResolvedValue([SAMPLE_CRON]),
    getEvents: vi.fn().mockResolvedValue([SAMPLE_EVENT]),
    getGatewayState: vi.fn().mockResolvedValue(SAMPLE_GATEWAY),
    checkGatewayHealth: vi.fn().mockResolvedValue(SAMPLE_HEALTH),
    listModels: vi.fn().mockResolvedValue([]),
    getModelConfig: vi.fn().mockResolvedValue({}),
    setModelConfig: vi.fn().mockResolvedValue({ ok: true }),
    getEnv: vi.fn().mockResolvedValue({}),
    setEnv: vi.fn().mockResolvedValue({ ok: true }),
    saveModelConfig: vi.fn().mockResolvedValue({ ok: true }),
  };
  (window as unknown as { hermesAPI: Api }).hermesAPI = api;
  return api;
}

describe("HccCockpit integration with ModelStrategyDryRunPanel", () => {
  let api: Api;

  beforeEach(() => {
    api = installMockApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the embedded model strategy dry-run panel", async () => {
    render(<HccCockpit />);

    const panel = await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-panel"),
    );
    expect(panel).toBeInTheDocument();
  });

  it("renders the six lanes under the panel", async () => {
    render(<HccCockpit />);

    const list = await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-list"),
    );
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    for (const laneId of [
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]) {
      expect(
        await waitFor(() =>
          screen.getByTestId(`model-strategy-row-${laneId}`),
        ),
      ).toBeInTheDocument();
    }
  });

  it("banner and footer keep the dry-run / static snapshot disclaimers", async () => {
    render(<HccCockpit />);

    const banner = await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-banner"),
    );
    expect(banner.textContent).toMatch(/dry-run only/);
    expect(banner.textContent).toMatch(/no live config writes/);

    const footer = await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-footer"),
    );
    expect(footer.textContent).toMatch(/static snapshot/);
    expect(footer.textContent).toMatch(
      /does not refresh with cockpit polling/,
    );
  });

  it("panel does not render any buttons", async () => {
    render(<HccCockpit />);

    const panel = await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-panel"),
    );
    const buttons = within(panel).queryAllByRole("button");
    expect(buttons).toHaveLength(0);
  });

  it("panel does not trigger any write or model-config IPC", async () => {
    render(<HccCockpit />);
    await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-panel"),
    );

    expect(api.listModels).not.toHaveBeenCalled();
    expect(api.getModelConfig).not.toHaveBeenCalled();
    expect(api.setModelConfig).not.toHaveBeenCalled();
    expect(api.getEnv).not.toHaveBeenCalled();
    expect(api.setEnv).not.toHaveBeenCalled();
    expect(api.saveModelConfig).not.toHaveBeenCalled();
  });

  it("HccCockpit's existing read IPC still runs against window.hermesAPI", async () => {
    render(<HccCockpit />);
    await waitFor(() =>
      screen.getByTestId("model-strategy-dry-run-panel"),
    );

    await waitFor(() => {
      expect(api.listPipelineRuns).toHaveBeenCalled();
    });
    expect(api.listPlaybooks).toHaveBeenCalled();
    expect(api.getCronJobHistory).toHaveBeenCalled();
    expect(api.getEvents).toHaveBeenCalled();
    expect(api.getGatewayState).toHaveBeenCalled();
    expect(api.checkGatewayHealth).toHaveBeenCalled();
  });
});

describe("HccCockpit source guardrails", () => {
  it("HccCockpit.tsx does not import tests/fixtures or write-side surfaces", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(resolve(__dirname, "./HccCockpit.tsx"), "utf-8");

    expect(src).not.toMatch(/from\s+["'][^"']*tests\/fixtures/);
    expect(src).not.toMatch(/from\s+["'][^"']*\/tests\//);

    for (const forbidden of [
      "setModelConfig",
      "setEnv",
      "saveModelConfig",
      "config.yaml",
      "knowledgeIngest",
      "handoff/packs",
      ".hermes/audit",
      "fetch(",
      "spawn(",
      "exec(",
      "http.request(",
      "https.request(",
      "net.connect(",
      "dns.lookup(",
      "https.Agent",
    ]) {
      expect(src).not.toContain(forbidden);
    }
  });
});
