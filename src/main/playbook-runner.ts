import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { cwd } from "process";

// --------------- Understand-Anything A-lite ---------------

export interface UnderstandingResult {
  summary: string;
  key_points: string[];
  entities: string[];
  risks: string[];
  todos: string[];
  suggested_playbook: string | null;
  suggested_playbook_reasoning?: string; // TODO: populate from LLM analysis
  metadata: {
    source: "inline" | "file";
    type: string;
    length: number;
    timestamp: string;
  };
  saved_to_vault?: boolean;
}

function getVaultDir(): string {
  return join(process.env.HOME || "~", ".hermes", "vault", "wiki", "understand");
}

function saveToVault(result: UnderstandingResult, originalInput?: string): boolean {
  try {
    const vaultDir = getVaultDir();
    if (!existsSync(vaultDir)) {
      mkdirSync(vaultDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const filename = `understanding-${timestamp}.md`;
    const filepath = join(vaultDir, filename);

    const content = `# Understanding Result

**Timestamp**: ${result.metadata.timestamp}
**Source**: ${result.metadata.source} (${result.metadata.type})
**Length**: ${result.metadata.length} characters

## Summary

${result.summary}

${result.key_points.length > 0 ? `## Key Points

${result.key_points.map(p => `- ${p}`).join("\n")}` : ""}

${result.entities.length > 0 ? `## Entities

${result.entities.map(e => `- ${e}`).join("\n")}` : ""}

${result.risks.length > 0 ? `## Risks

${result.risks.map(r => `- ⚠️ ${r}`).join("\n")}` : ""}

${result.todos.length > 0 ? `## Todos

${result.todos.map(t => `- ☐ ${t}`).join("\n")}` : ""}

${result.suggested_playbook ? `## Suggested Playbook

\`${result.suggested_playbook}\`` : ""}

${originalInput ? `---

## Original Content

\`\`\`${result.metadata.type}
${originalInput.slice(0, 1000)}${originalInput.length > 1000 ? "\n... (truncated)" : ""}
\`\`\`` : ""}
`;

    writeFileSync(filepath, content);
    return true;
  } catch (err) {
    console.error("Failed to save to vault:", err);
    return false;
  }
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit
const SUPPORTED_EXTENSIONS = [".md", ".txt", ".text"];

function extractHeadings(content: string): string[] {
  const headingRe = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match;
  while ((match = headingRe.exec(content)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

function extractListItems(content: string): string[] {
  const bulletRe = /^[-*]\s+(.+)$/gm;
  const numberedRe = /^\d+\.\s+(.+)$/gm;
  const items: string[] = [];
  let match;
  while ((match = bulletRe.exec(content)) !== null) {
    items.push(match[1].trim());
  }
  while ((match = numberedRe.exec(content)) !== null) {
    items.push(match[1].trim());
  }
  return items;
}

function extractEntities(content: string): string[] {
  const entities: string[] = [];
  // Extract markdown links [text](url)
  const linkRe = /\[([^\]]+)\]\([^)]+\)/g;
  let match;
  while ((match = linkRe.exec(content)) !== null) {
    entities.push(match[1]);
  }
  // Extract capitalized words (potential proper nouns)
  const capsRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  while ((match = capsRe.exec(content)) !== null) {
    if (!entities.includes(match[1]) && match[1].length > 2) {
      entities.push(match[1]);
    }
  }
  return entities.slice(0, 20);
}

function detectRisks(content: string): string[] {
  const risks: string[] = [];
  const riskPatterns = [
    { pattern: /security|security vulnerability|security issue/i, label: "Security concerns" },
    { pattern: /bug|buggy|broken|failing/i, label: "Potential bugs" },
    { pattern: /deprecated|obsolete|legacy/i, label: "Deprecated components" },
    { pattern: /TODO|FIXME|HACK|XXX/i, label: "Technical debt" },
    { pattern: /race condition|memory leak|deadlock/i, label: "Critical runtime issues" },
    { pattern: /incomplete|not implemented|WIP/i, label: "Incomplete implementation" },
    { pattern: /breaking change|breaking changes/i, label: "Breaking changes" },
  ];
  for (const { pattern, label } of riskPatterns) {
    if (pattern.test(content)) {
      risks.push(label);
    }
  }
  return risks;
}

function detectTodos(content: string): string[] {
  const todos: string[] = [];
  const todoPatterns = [
    /-?\s*\[?\s*(TODO|FIXME|HACK|NOTE|XXX)\s*[:\-]?\s*(.+)/gi,
    /-?\s*\[?\s*(todo|tbd|to.do|待做)\s*[:\-]?\s*(.+)/gi,
  ];
  for (const pattern of todoPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const task = match[2] || match[1];
      todos.push(task.trim());
    }
  }
  return [...new Set(todos)].slice(0, 10);
}

function suggestPlaybook(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.includes("code") || lower.includes("function") || lower.includes("class") ||
      lower.includes("typescript") || lower.includes("javascript") || lower.includes("react")) {
    return "code_dev";
  }
  if (lower.includes("manga") || lower.includes("animation") || lower.includes("video") ||
      lower.includes("asset") || lower.includes("sprite")) {
    return "manga_industrial";
  }
  return null;
}

function generateHeuristicSummary(content: string, headings: string[]): string {
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  const firstParagraph = lines.slice(0, 3).join(" ").substring(0, 300);
  if (headings.length > 0) {
    return `Document with ${headings.length} sections: ${headings.slice(0, 3).join(" | ")}${headings.length > 3 ? "..." : ""}`;
  }
  return firstParagraph || `Content: ${lines.length} lines`;
}

async function generateLlmSummary(content: string): Promise<string> {
  const truncated = content.slice(0, 2000);

  try {
    const result = execSync(
      `ollama run llama3.2 "Summarize in 2-3 sentences: ${truncated.slice(0, 500)}..." 2>&1 | head -5`,
      { encoding: "utf-8", timeout: 15_000, maxBuffer: 1024 }
    );
    const summary = result.trim();
    if (summary.length > 10) {
      return `[LLM] ${summary}`;
    }
  } catch {
    // Ollama not available or no chat model
  }
  return ""; // Signal to use heuristic
}

export async function understandAnything(
  input: string,
  filePath?: string,
): Promise<UnderstandingResult> {
  let content = input;
  let source: "inline" | "file" = "inline";
  let fileType = "inline";

  // If file path provided, read from file
  if (filePath) {
    try {
      const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
      }
      const stats = statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${stats.size} bytes. Max: ${MAX_FILE_SIZE} bytes`);
      }
      content = readFileSync(filePath, "utf-8");
      source = "file";
      fileType = ext === ".md" ? "markdown" : "plain_text";
    } catch (err) {
      if (err instanceof Error && err.message.includes("ENOENT")) {
        throw new Error(`File not found: ${filePath}`);
      }
      throw err;
    }
  }

  // Process content
  const headings = extractHeadings(content);
  const listItems = extractListItems(content);
  const entities = extractEntities(content);
  const risks = detectRisks(content);
  const todos = detectTodos(content);
  const suggestedPlaybook = suggestPlaybook(content);

  // Build summary - try LLM first, fall back to heuristic
  const llmSummary = await generateLlmSummary(content);
  const summary = llmSummary || generateHeuristicSummary(content, headings);

  // Extract key points from list items or first sentences
  const keyPoints: string[] = [];
  if (listItems.length > 0) {
    keyPoints.push(...listItems.slice(0, 5));
  } else {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    keyPoints.push(...sentences.slice(0, 5).map(s => s.trim()));
  }

  const result: UnderstandingResult = {
    summary,
    key_points: keyPoints,
    entities: entities,
    risks: risks,
    todos: todos,
    suggested_playbook: suggestedPlaybook,
    metadata: {
      source,
      type: fileType,
      length: content.length,
      timestamp: new Date().toISOString(),
    },
    saved_to_vault: saveToVault({
      summary,
      key_points: keyPoints,
      entities,
      risks,
      todos,
      suggested_playbook: suggestedPlaybook,
      metadata: {
        source,
        type: fileType,
        length: content.length,
        timestamp: new Date().toISOString(),
      },
    }, content),
  };
  return result;
}

// --------------- llm-checker integration ---------------

export interface LlmModel {
  name: string;
  size: string;
  score: number;
  useCase: string;
  command: string;
  status: "installed" | "recommended";
}

export interface LlmCheckerResult {
  status: "pass" | "warning" | "fail";
  reason: string;
  models?: LlmModel[];
  details?: string;
}

function runCommand(cmd: string, timeout = 30_000): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      timeout,
      maxBuffer: 1024 * 1024,
    }).substring(0, 4000);
  } catch (err: unknown) {
    return err instanceof Error ? err.message.substring(0, 500) : String(err);
  }
}

function parseInstalledModels(output: string): LlmModel[] {
  const models: LlmModel[] = [];
  // Parse table rows like: "🥇  │ nomic-embed-text:latest │ 0.3GB  │ 90/100  │ embeddings │ ollama run..."
  const rows = output.split("\n").filter((l) => l.includes("│") && l.match(/[A-Za-z0-9]/));
  for (const row of rows) {
    const cols = row.split("│").map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 5) {
      const nameMatch = cols[1].match(/([a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)?)/);
      const sizeMatch = cols[2].match(/([0-9.]+[A-Z]{2})/);
      const scoreMatch = cols[3].match(/(\d+)/);
      if (nameMatch) {
        models.push({
          name: nameMatch[1],
          size: sizeMatch ? sizeMatch[1] : "unknown",
          score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
          useCase: cols[4] || "general",
          command: cols[5] || "",
          status: "installed",
        });
      }
    }
  }
  return models;
}

function parseRecommendModels(output: string): LlmModel[] {
  const models: LlmModel[] = [];
  // Parse recommended models from output
  const nameMatch = output.match(/Model:\s*(.+)/i);
  const sizeMatch = output.match(/Size:\s*([0-9.]+[A-Z]+)/i);
  const scoreMatch = output.match(/Compatibility Score:\s*([0-9.]+)/i);
  const reasonMatch = output.match(/Reason:\s*(.+)/i);

  if (nameMatch) {
    models.push({
      name: nameMatch[1].trim(),
      size: sizeMatch ? sizeMatch[1] : "unknown",
      score: scoreMatch ? Math.round(parseFloat(scoreMatch[1])) : 0,
      useCase: reasonMatch ? reasonMatch[1].trim() : "general",
      command: `ollama run ${nameMatch[1].trim()}`,
      status: "recommended",
    });
  }
  return models;
}

export async function runLlmChecker(
  _task?: string,
  _context?: string,
): Promise<LlmCheckerResult> {
  try {
    // Step 1: Check installed models
    const installedOutput = runCommand("llm-checker installed 2>&1");
    const installedModels = parseInstalledModels(installedOutput);

    // Step 2: Get hardware recommendations (always run)
    const recommendOutput = runCommand("llm-checker recommend 2>&1");
    const recommendedModels = parseRecommendModels(recommendOutput);

    const allModels = [...installedModels, ...recommendedModels];

    if (allModels.length === 0) {
      return {
        status: "warning",
        reason: "No models found",
        details: "Run 'llm-checker check' to analyze hardware",
      };
    }

    return {
      status: "pass",
      reason: `Found ${installedModels.length} installed, ${recommendedModels.length} recommended`,
      models: allModels,
      details: installedModels.length > 0
        ? `Installed: ${installedModels.map((m) => m.name).join(", ")}`
        : `Recommended: ${recommendedModels.map((m) => m.name).join(", ")}`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "fail",
      reason: `llm-checker failed: ${message}`,
    };
  }
}

// --------------- types ---------------

export interface PlaybookStep {
  id: string;
  label: string;
  hccStage: string;
  status: "pending" | "running" | "success" | "failed";
  error?: string;
  output?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: PlaybookStepDefinition[];
}

export interface PlaybookStepDefinition {
  id: string;
  label: string;
  hccStage: string;
  command?: string;
  cwd?: string;
  timeout?: number;
}

export type StepEventCallback = (step: PlaybookStep) => void;

// --------------- built-in playbooks ---------------

const codeDevPlaybook: Playbook = {
  id: "code_dev",
  name: "Code Dev — HCC Code Pipeline",
  description:
    "编码闭环：Claude Code 执行 -> 测试审查 -> 交付。映射 HCC 阶段 5-7。",
  version: 1,
  steps: [
    {
      id: "setup",
      label: "阶段 5: 环境准备 & 物理锁检查",
      hccStage: "stage_5_codex_execute",
      command: "ls -1 src/main/*.ts | head -3",
      cwd: cwd(),
    },
    {
      id: "typecheck",
      label: "阶段 6: TypeScript 编译审查",
      hccStage: "stage_6_review_test",
      command: "npx tsc --noEmit",
      cwd: cwd(),
      timeout: 120_000,
    },
    {
      id: "test",
      label: "阶段 6: 测试执行",
      hccStage: "stage_6_review_test",
      command: "npx vitest run --reporter=verbose 2>&1 | tail -20",
      cwd: cwd(),
      timeout: 180_000,
    },
    {
      id: "build",
      label: "阶段 6: 构建验证",
      hccStage: "stage_6_review_test",
      command: "npx electron-vite build 2>&1",
      cwd: cwd(),
      timeout: 120_000,
    },
    {
      id: "deliver",
      label: "阶段 7: 交付报告",
      hccStage: "stage_7_delivery",
      command: "",
    },
  ],
};

const mangaIndustrialPlaybook: Playbook = {
  id: "manga_industrial",
  name: "AI Manga — Multi-Agent Pipeline",
  description:
    "AI漫剧多Agent协作生产流水线 — 8 节点标准工艺。映射 HCC 质量审查。",
  version: 2,
  steps: [
    {
      id: "asset_check",
      label: "资产清单检查",
      hccStage: "stage_5_codex_execute",
      command:
        "ls -1 src/renderer/src/assets/ 2>/dev/null | head -10 || echo 'no assets dir'",
    },
    {
      id: "typecheck",
      label: "TypeScript 编译审查",
      hccStage: "stage_6_review_test",
      command: "npx tsc --noEmit",
      cwd: cwd(),
      timeout: 120_000,
    },
    {
      id: "build_check",
      label: "构建验证",
      hccStage: "stage_6_review_test",
      command: "npx electron-vite build 2>&1",
      cwd: cwd(),
      timeout: 120_000,
    },
    {
      id: "deliver",
      label: "流水线交付",
      hccStage: "stage_7_delivery",
      command: "",
    },
  ],
};

const PLAYBOOKS: Record<string, Playbook> = {
  code_dev: codeDevPlaybook,
  manga_industrial: mangaIndustrialPlaybook,
};

export function getPlaybooks(): Playbook[] {
  return Object.values(PLAYBOOKS);
}

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS[id];
}

// --------------- runner ---------------

export interface RunResult {
  runId: string;
  playbookId: string;
  steps: PlaybookStep[];
  finalStatus: "success" | "failed" | "cancelled";
  startedAt: string;
  endedAt: string;
  error?: string;
}

function generateRunId(): string {
  const now = new Date();
  const ts = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/[T.]/g, "")
    .slice(0, 15);
  return `HCC-${ts}`;
}

function ensurePipelineDir(runId: string): string {
  const dir = join(
    process.env.HOME || "~",
    ".hermes",
    "pipeline-runs",
    runId,
  );
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function runPlaybook(
  playbookId: string,
  onStep: StepEventCallback,
  signal?: AbortSignal,
): Promise<RunResult> {
  const playbook = PLAYBOOKS[playbookId];
  if (!playbook) {
    throw new Error(`Unknown playbook: ${playbookId}`);
  }

  const runId = generateRunId();
  const pipelineDir = ensurePipelineDir(runId);
  const startedAt = new Date().toISOString();

  const steps: PlaybookStep[] = playbook.steps.map((def) => ({
    id: def.id,
    label: def.label,
    hccStage: def.hccStage,
    status: "pending" as const,
  }));

  let finalStatus: RunResult["finalStatus"] = "success";

  for (let i = 0; i < steps.length; i++) {
    if (signal?.aborted) {
      steps[i].status = "pending";
      finalStatus = "cancelled";
      break;
    }

    const def = playbook.steps[i];
    const step = steps[i];
    step.status = "running";
    onStep({ ...step });

    // Write HCC pipeline artifact
    const artifactPath = join(pipelineDir, `${step.id}.log`);

    if (def.command) {
      try {
        const output = execSync(def.command, {
          cwd: def.cwd || cwd(),
          timeout: def.timeout ?? 60_000,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
        });
        step.status = "success";
        step.output = output.trim().substring(0, 2000);
        writeFileSync(artifactPath, output);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message.substring(0, 500)
            : String(err).substring(0, 500);
        step.status = "failed";
        step.error = message;
        const stdOut =
          err &&
          typeof err === "object" &&
          "stdout" in err &&
          typeof (err as { stdout: unknown }).stdout === "string"
            ? (err as { stdout: string }).stdout
            : "";
        writeFileSync(artifactPath, stdOut || message);
        finalStatus = "failed";
        onStep({ ...step });
        break;
      }
    } else {
      step.status = "success";
      step.output = "Step completed (no command)";
    }

    onStep({ ...step });
  }

  const endedAt = new Date().toISOString();

  const finalReport = {
    run_id: runId,
    playbook_id: playbookId,
    final_status: finalStatus,
    started_at: startedAt,
    ended_at: endedAt,
    steps: steps.map((s) => ({
      id: s.id,
      hcc_stage: s.hccStage,
      status: s.status,
      error: s.error || null,
    })),
  };
  writeFileSync(
    join(pipelineDir, "run-metadata.json"),
    JSON.stringify(finalReport, null, 2),
  );

  return {
    runId,
    playbookId,
    steps,
    finalStatus,
    startedAt,
    endedAt,
  };
}
