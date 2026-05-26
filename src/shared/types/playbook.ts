/**
 * Shared types for the Playbook Runner feature.
 */
export interface PlaybookStep {
  id: string;
  label: string;
  hccStage: string;
  status: "pending" | "running" | "success" | "failed";
  error?: string;
  output?: string;
}

export interface PlaybookStepDefinition {
  id: string;
  label: string;
  hccStage: string;
  command?: string;
  cwd?: string;
  timeout?: number;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: PlaybookStepDefinition[];
}

export interface RunResult {
  runId: string;
  playbookId: string;
  steps: PlaybookStep[];
  finalStatus: "success" | "failed" | "cancelled";
  startedAt: string;
  endedAt: string;
  error?: string;
}

export type StepEventCallback = (step: PlaybookStep) => void;
