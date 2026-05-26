/**
 * Shared types for the Understand-Anything feature.
 * This file is the single source of truth; consumers should import from here.
 */
export interface UnderstandingResult {
  summary: string;
  key_points: string[];
  entities: string[];
  risks: string[];
  todos: string[];
  suggested_playbook: string | null;
  suggested_playbook_reasoning?: string;
  confidence?: number;
  metadata: {
    source: "inline" | "file";
    type: string;
    length: number;
    timestamp: string;
  };
  saved_to_vault?: boolean;
}
