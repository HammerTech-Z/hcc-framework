export type KnowledgeLifecycle =
  | "inbox"
  | "candidate"
  | "verified"
  | "linked"
  | "stale"
  | "archived";

export type KnowledgeTrust =
  | "unverified"
  | "candidate"
  | "verified"
  | "authoritative";

export type KnowledgeSourceType =
  | "github"
  | "web"
  | "local_note"
  | "agent_report"
  | "conversation";

export interface KnowledgeControlItem {
  id: string;
  path: string;
  title: string;
  kind: string;
  sourceType: KnowledgeSourceType;
  trustLevel: KnowledgeTrust;
  redactionStatus: "clean" | "partial" | "redacted";
  capturedAt: string;
  verifiedAt: string | null;
  mtime: number;
  size: number;
  stale: boolean;
  lifecycle: KnowledgeLifecycle;
  provenanceCount: number;
  linkedNotes: string[];
  linkedTasks: string[];
  allowPromptUse: "yes" | "prefer_local" | "ask_first" | "no";
  localPreferred: boolean;
  preview: string;
  frontmatter: Record<string, unknown> | null;
}

export interface KnowledgeControlInput {
  path: string;
  name: string;
  dir: string;
  size: number;
  mtime: number;
  content?: string;
  frontmatter?: Record<string, unknown> | null;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeTrust(value: unknown): KnowledgeTrust {
  const text = asString(value)?.toLowerCase();
  if (text === "candidate" || text === "verified" || text === "authoritative") return text;
  return "unverified";
}

function normalizeSource(value: unknown, path: string): KnowledgeSourceType {
  const text = asString(value)?.toLowerCase();
  if (text === "github" || text === "web" || text === "local_note" || text === "agent_report" || text === "conversation") {
    return text;
  }
  if (/github|repo|pull|issue/i.test(path)) return "github";
  if (/http|web|research/i.test(path)) return "web";
  if (/agent|report|pipeline|hcc/i.test(path)) return "agent_report";
  if (/chat|conversation|session/i.test(path)) return "conversation";
  return "local_note";
}

function normalizeRedaction(value: unknown): "clean" | "partial" | "redacted" {
  const text = asString(value)?.toLowerCase();
  if (text === "partial" || text === "redacted") return text;
  return "clean";
}

function normalizePromptUse(value: unknown, trust: KnowledgeTrust): "yes" | "prefer_local" | "ask_first" | "no" {
  const text = asString(value)?.toLowerCase();
  if (text === "yes" || text === "prefer_local" || text === "ask_first" || text === "no") return text;
  if (trust === "verified" || trust === "authoritative") return "prefer_local";
  if (trust === "candidate") return "ask_first";
  return "no";
}

function deriveKind(dir: string, path: string, name: string, frontmatter: Record<string, unknown> | null): string {
  const explicit = asString(frontmatter?.kind) || asString(frontmatter?.type);
  if (explicit) return explicit;
  if (path.includes("/tools/horizon-") || name.startsWith("horizon-")) return "horizon_summary";
  if (path.includes("/failure-lessons/") || name.endsWith(".fl.json")) return "failure_lesson";
  if (path.includes("/wiki/understand/") || path.includes("understand-")) return "understand_result";
  return dir || "vault_file";
}

function deriveTitle(path: string, name: string, frontmatter: Record<string, unknown> | null): string {
  return (
    asString(frontmatter?.title) ||
    asString(frontmatter?.name) ||
    name.replace(/\.(md|json|txt)$/i, "").replace(/[-_]/g, " ") ||
    path
  );
}

function countProvenance(frontmatter: Record<string, unknown> | null, content?: string): number {
  const sources = [
    frontmatter?.source,
    frontmatter?.source_url,
    frontmatter?.url,
    frontmatter?.repo,
    ...asStringArray(frontmatter?.sources),
    ...asStringArray(frontmatter?.provenance),
  ].filter(Boolean);
  const inlineLinks = content?.match(/https?:\/\/[^\s)]+/g) ?? [];
  return new Set([...sources.map(String), ...inlineLinks]).size;
}

function extractWikiLinks(content?: string): string[] {
  if (!content) return [];
  return [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]).slice(0, 8);
}

function extractTaskRefs(content?: string): string[] {
  if (!content) return [];
  return [...content.matchAll(/\b(?:HCC|P\d(?:\.\d)?|Slice)\S*/g)].map((match) => match[0]).slice(0, 8);
}

export function deriveStaleState(input: {
  capturedAt: string;
  verifiedAt: string | null;
  sourceType: KnowledgeSourceType;
  explicitStale?: unknown;
  now?: number;
}): boolean {
  if (input.explicitStale === true || input.explicitStale === "true") return true;
  const now = input.now ?? Date.now();
  const captured = new Date(input.capturedAt).getTime();
  const verified = input.verifiedAt ? new Date(input.verifiedAt).getTime() : Number.NaN;
  if (Number.isFinite(verified)) return now - verified > THIRTY_DAYS;
  if (input.sourceType === "web" && Number.isFinite(captured)) return now - captured > SEVEN_DAYS;
  return Number.isFinite(captured) ? now - captured > THIRTY_DAYS : true;
}

export function deriveLifecycle(input: {
  trustLevel: KnowledgeTrust;
  stale: boolean;
  archived?: unknown;
  linkedNotes?: readonly string[];
}): KnowledgeLifecycle {
  if (input.archived === true || input.archived === "true") return "archived";
  if (input.stale) return "stale";
  if ((input.linkedNotes?.length ?? 0) > 0 && (input.trustLevel === "verified" || input.trustLevel === "authoritative")) {
    return "linked";
  }
  if (input.trustLevel === "verified" || input.trustLevel === "authoritative") return "verified";
  if (input.trustLevel === "candidate") return "candidate";
  return "inbox";
}

export function buildKnowledgeControlItem(input: KnowledgeControlInput): KnowledgeControlItem {
  const frontmatter = input.frontmatter ?? null;
  const trustLevel = normalizeTrust(frontmatter?.trust_level ?? frontmatter?.trust);
  const sourceType = normalizeSource(frontmatter?.source_type, input.path);
  const capturedAt =
    asString(frontmatter?.captured_at) ||
    asString(frontmatter?.created_at) ||
    new Date(input.mtime * 1000).toISOString();
  const verifiedAt = asString(frontmatter?.verified_at);
  const linkedNotes = [
    ...asStringArray(frontmatter?.linked_notes),
    ...extractWikiLinks(input.content),
  ].slice(0, 10);
  const linkedTasks = [
    ...asStringArray(frontmatter?.linked_tasks),
    ...extractTaskRefs(input.content),
  ].slice(0, 10);
  const stale = deriveStaleState({
    capturedAt,
    verifiedAt,
    sourceType,
    explicitStale: frontmatter?.stale,
  });
  const lifecycle = deriveLifecycle({
    trustLevel,
    stale,
    archived: frontmatter?.archived,
    linkedNotes,
  });
  const allowPromptUse = normalizePromptUse(frontmatter?.allow_prompt_use, trustLevel);
  const contentPreview = input.content?.replace(/\s+/g, " ").trim().slice(0, 180);

  return {
    id: input.path,
    path: input.path,
    title: deriveTitle(input.path, input.name, frontmatter),
    kind: deriveKind(input.dir, input.path, input.name, frontmatter),
    sourceType,
    trustLevel,
    redactionStatus: normalizeRedaction(frontmatter?.redaction_status),
    capturedAt,
    verifiedAt,
    mtime: input.mtime,
    size: input.size,
    stale,
    lifecycle,
    provenanceCount: countProvenance(frontmatter, input.content),
    linkedNotes,
    linkedTasks,
    allowPromptUse,
    localPreferred: allowPromptUse === "prefer_local" || allowPromptUse === "yes",
    preview: contentPreview || input.path,
    frontmatter,
  };
}
