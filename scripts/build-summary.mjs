#!/usr/bin/env node
/**
 * Build a reproducible Claude-Web summary for Hermes Pro.
 *
 * Keep review numbers tied to git/vitest/diff instead of hand-written markdown.
 * This script intentionally avoids tsx/TypeScript runtime dependencies.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  if (!key.startsWith("--")) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith("--")) {
    args.set(key.slice(2), next);
    i += 1;
  } else {
    args.set(key.slice(2), "true");
  }
}

const repo = path.resolve(args.get("repo") ?? process.cwd());
const base = args.get("base") ?? "2f79c75";
const end = args.get("end") ?? "HEAD";
const out = path.resolve(
  args.get("out") ??
    "/Users/midoudou/Desktop/Hermes-Pro-Claude-Web-Summary-2026-06-04.md",
);
const commitCount = Number(args.get("commits") ?? "20");
const noTests = args.has("no-tests");

const buckets = [
  ["docs", (p) => p.startsWith("docs/")],
  ["fixtures", (p) => p.startsWith("tests/fixtures/")],
  ["tests", (p) => p.startsWith("tests/")],
  ["shared/lib", (p) => p.startsWith("src/shared/lib/")],
  ["main", (p) => p.startsWith("src/main/")],
  ["renderer", (p) => p.startsWith("src/renderer/")],
];

const forbiddenPositiveClaims = [
  /HCC Auto Executor[^\n]{0,30}(已可用|已启用|已启动|running|enabled|active)/i,
  /hard cutover[^\n]{0,30}(已完成|已批准|done|complete|enabled|approved)/i,
  /Productionization[^\n]{0,30}(已批准|已上线|approved|enabled|live)/i,
  /Round 2 C[^\n]{0,30}(已解冻|unfrozen|enabled|approved)/i,
  /L6 live (knowledge )?flush[^\n]{0,30}(已启用|enabled|active|live)/i,
  /live knowledge(Ingest|Search)[^\n]{0,30}(已启用|enabled|active|live)/i,
];

const negations = [
  "不代表",
  "未批准",
  "未启动",
  "未接线",
  "未启用",
  "不可用",
  "NOT APPROVED",
  "frozen",
  "冻结",
  "paused",
  "dry-run",
  "no_l6",
  "false",
  "误称",
  "是否有",
  "imply",
];

function sh(command, allowFail = false) {
  try {
    return execSync(command, {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (allowFail) return String(error.stdout ?? "");
    throw new Error(`Command failed: ${command}\n${error.stderr ?? error.message}`);
  }
}

function collectGit() {
  const branch = sh("git branch --show-current").trim();
  // P2-1: preserve git's two-column leading-space semantics in --short output.
  const statusShort = sh("git status --short", true);
  const statusSb = sh("git status -sb", true).trim();
  const head = sh("git rev-parse HEAD").trim();
  const upstream = sh(
    "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
    true,
  ).trim();
  const upstreamHead = upstream ? sh("git rev-parse @{u}", true).trim() : "";
  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const [behindRaw, aheadRaw] = sh(
      "git rev-list --left-right --count @{u}...HEAD",
      true,
    )
      .split(/\s+/)
      .map((x) => Number(x || "0"));
    behind = behindRaw;
    ahead = aheadRaw;
  }
  const commits = sh(`git log -${commitCount} --pretty=%h%x00%s`)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split("\0");
      return { hash, subject };
    });
  return {
    branch,
    statusShort,
    statusSb,
    head,
    upstream,
    upstreamHead,
    ahead,
    behind,
    commits,
  };
}

function collectDiff() {
  const rows = sh(`git diff --numstat ${base}^..${end}`, true)
    .split("\n")
    .filter(Boolean);
  const result = {
    files: 0,
    insertions: 0,
    deletions: 0,
    byBucket: new Map(),
    other: [],
  };
  for (const [label] of buckets) {
    result.byBucket.set(label, { files: 0, insertions: 0 });
  }
  result.byBucket.set("other", { files: 0, insertions: 0 });
  for (const row of rows) {
    const [addRaw, delRaw, ...rest] = row.split("\t");
    const file = rest.join("\t");
    const add = addRaw === "-" ? 0 : Number(addRaw);
    const del = delRaw === "-" ? 0 : Number(delRaw);
    const bucket = buckets.find(([, match]) => match(file))?.[0] ?? "other";
    const slot = result.byBucket.get(bucket);
    slot.files += 1;
    slot.insertions += add;
    result.files += 1;
    result.insertions += add;
    result.deletions += del;
    if (bucket === "other") result.other.push(file);
  }
  return result;
}

function collectVitest() {
  if (noTests) {
    return { stale: true, files: -1, tests: -1, passed: -1, failed: -1 };
  }
  const output = path.join(os.tmpdir(), `hermes-pro-vitest-${Date.now()}.json`);
  sh(
    `npx vitest run --reporter=json --outputFile=${JSON.stringify(output)}`,
    true,
  );
  if (!fs.existsSync(output)) {
    throw new Error("vitest json reporter did not produce output");
  }
  const json = JSON.parse(fs.readFileSync(output, "utf8"));
  fs.rmSync(output, { force: true });
  return {
    stale: false,
    files: Array.isArray(json.testResults)
      ? json.testResults.length
      : json.numTotalTestSuites,
    tests: json.numTotalTests,
    passed: json.numPassedTests,
    failed: json.numFailedTests,
  };
}

function knowledgeDocs() {
  const dir = path.join(repo, "docs/knowledge");
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => `docs/knowledge/${name}`);
}

function render(git, diff, tests) {
  const bucketRows = [...diff.byBucket.entries()]
    .filter(([, data]) => data.files > 0)
    .map(([label, data]) => `| ${label} | ${data.files} | +${data.insertions} |`)
    .join("\n");
  const testLine = tests.stale
    ? "Skipped with --no-tests; do not treat as current test truth."
    : `${tests.files} files / ${tests.tests} tests PASS (passed=${tests.passed}, failed=${tests.failed})`;
  const cleanNote = git.statusShort
    ? "Current worktree has pending edits. Treat generated git state as snapshot, not a clean-commit claim."
    : "Current worktree clean at generation time.";
  const docList = knowledgeDocs().map((file) => `- \`${file}\``).join("\n");
  const commits = git.commits.map((c) => `${c.hash} ${c.subject}`).join("\n");

  // P2-1: status-short output verbatim, with leading-space semantics preserved
  // by emitting the raw `git status --short` lines in a fenced code block.
  const statusShortBlock = git.statusShort || "(clean)";

  return `# Hermes Pro — Claude Web Review Summary

> Generated: ${new Date().toISOString()}
> Repo: \`${repo}\`
> Generator: \`scripts/build-summary.mjs\`
> This file is generated from git/vitest/diff data. Do not hand-edit numeric truth fields.

## 0. Claude Web 审核提示词 (Scope: KRC + doc/tooling closeout)

本 summary 主要用于 Knowledge Reuse Chain + doc/tooling closeout 审核。

In-scope:

- Knowledge Reuse Chain Slice 004-006.9 / 007A-007N / 008A-008M closeout.
- 6 commits 2f79c75 / 2a8dc08 / cdeea86 / 7c3e89b / d997914 / d5a6469 与 diff buckets。
- 5 entry-point docs (CONTEXT.md / NEXT_STEP.md / docs/current-fusion-plan-2026-05-30.md / docs/iteration-plan-v2-updated.md / docs/p3-dry-run-baseline-2026-06-01.md) 同步。
- scripts/build-summary.mjs 生成器与 package.json tooling 增量。
- 测试基线 (vitest) 与 typecheck。
- 硬冻结 (HCC Auto Executor / P3 real execution / Productionization / hard cutover / Round 2 C / L6 live knowledge flush / locked roadmap)。

Out-of-scope (covered by separate doc, not this summary):

- UI redesign 实现状态、BaiLongma cockpit 组件/IPC 契约允许范围、Knowledge 页当前状态 — 见 \`docs/design/UI-GROUND-TRUTH-2026-06-04.md\`。
- Hermes soft switch candidate v0.15.1 观察期运行时行为。
- P7 WeChat/iLink low-priority 4 jobs \`deliver=local\` 投递运行时。
- V1-V7 完成度矩阵。

请审核本 summary：是否所有数值均可在 §1/§2/§3 的 git/diff/vitest 输出回溯；是否 5 entry-point docs 的历史快照标注与 §3 diff bucket 一致；是否 6 commits 顺序与 diff range 2f79c75^..HEAD 完全匹配；是否有任何字段误称 HCC Auto Executor / hard cutover / Productionization / L6 live knowledge flush / live knowledgeIngest / live knowledgeSearch / default prompt injection / Agent subprocess execution 已启用。请先列 P0/P1/P2 风险，再给结论和下一步建议。

## 1. Git Snapshot

### 1.1 branch / HEAD / upstream

\`\`\`text
branch: ${git.branch}
HEAD:   ${git.head}
upstream: ${git.upstream || "(none)"}
upstream HEAD: ${git.upstreamHead || "(none)"}
ahead:  ${git.ahead}
behind: ${git.behind}
status header: ${git.statusSb.split("\n")[0] ?? ""}
\`\`\`

Note: ahead=0 + behind=0 + clean \`status -sb\` header = "已 push、worktree clean at HEAD"。本文件生成时若 §1.2 仍有 pending edits，表示当前是 commit-pending 状态，不是真正 clean commit。

### 1.2 worktree status (raw \`git status --short\`)

\`\`\`text
${statusShortBlock}
\`\`\`

${cleanNote}

Note (P2-1): 本节直接转储 \`git status --short\` 的两列输出，前导空格保留。两列含义为 XY status code + 工作区路径，trim 前导空格会丢失 staged-vs-unstaged 信息。

## 2. Current Test Baseline

${testLine}

Historical test counts in project docs are slice-local evidence only. The current baseline in this generated summary is the line above.

## 3. Knowledge Reuse Chain Diff Truth (auto, from \`git diff --numstat ${base}^..${end}\`)

Range: \`${base}^..${end}\`

Total: **${diff.files} files / +${diff.insertions} / -${diff.deletions}**

| Bucket | Files | Insertions |
|---|---:|---:|
${bucketRows}

${diff.other.length ? `Unclassified files:\n${diff.other.map((file) => `- ${file}`).join("\n")}` : "Unclassified files: none"}

Note (P2-2): 6 commits 的 subject 中手写的"35 files / 19 files + 3 subdirs / 8 files / 36 files"等数字是当时 commit message 描述，**不作为 truth**。Truth 以本节自动 diff bucket 为准。

## 4. Knowledge Reuse Chain Status

Completed scope:

- Slice 004-006.9: protocol / prompt contract / dry-run fixtures / integration.
- Slice 007A-007N: handoff contract + optional HCC handoff knowledge envelope.
- Slice 008A-008M: Surface B + task-dispatch prompt builder + closeout/observation.

Boundary (P1-1): this is L5 dry-run / prompt-builder / envelope contract only. It does not enable live knowledgeIngest, live knowledgeSearch, default prompt injection, Agent subprocess execution, or L6 live flush.

Commit chain (P2-2: subject numbers are descriptive, not truth):

\`\`\`text
2f79c75 docs(knowledge-reuse): add slice chain 004-006.9/007A-007N/008A-008M spec docs and closeout audit
2a8dc08 test(fixtures): add knowledge-reuse declarative fixtures for slice chain
cdeea86 feat(shared): add knowledge-reuse pure protocol / helper / snippet / envelope layer
7c3e89b test(knowledge-reuse): add unit + safety tests for slice chain 004-006.9/007A-007N/008A-008M
d997914 feat(main): add task-dispatch-prompt-builder (Slice 008J) as the L5 main-side entry point
d5a6469 feat(hcc-handoff): wire knowledge contract envelope into handoff payload builder (Slice 007L)
\`\`\`

## 5. Literal Safety Invariants

- \`runtime_flush_allowed=false\`
- \`runtime_dispatch_allowed=false\`
- \`real_handoff_write_allowed=false\`
- \`live_adapter_allowed=false\`
- \`no_l6=true\`
- Feature flag default is false.

## 6. Hard Frozen / Not Approved

- HCC Auto Executor: not approved, not started, not wired.
- P3 real execution: paused.
- hard cutover: not approved.
- P3.5 Round 2 C: frozen.
- BaiLongma/HCC Productionization: NOT APPROVED.
- L6 live knowledgeSearch / knowledgeIngest / live flush adapter: not approved.
- locked roadmap: do not edit without new ADR + user approval.
- UI redesign: design spec first, no implementation yet.

## 7. Key Source Index

- \`src/shared/lib/knowledge-reuse-protocol.ts\`
- \`src/shared/lib/knowledge-reuse-integration.ts\`
- \`src/shared/lib/knowledge-agent-contract-snippet.ts\`
- \`src/shared/lib/knowledge-handoff-contract.ts\`
- \`src/shared/lib/knowledge-runtime-injection-surface-b.ts\`
- \`src/shared/lib/knowledge-live-flush-contract.ts\`
- \`src/shared/lib/knowledge-live-flush-ui-contract.ts\`
- \`src/main/task-dispatch-prompt-builder.ts\`
- \`src/main/hcc-handoff-pack.ts\`
- \`src/main/hcc-artifact-store.ts\`
- \`src/renderer/src/screens/BaiLongma/BaiLongma.tsx\`
- \`src/renderer/src/screens/Knowledge/Knowledge.tsx\`

## 8. Representative Test Index

- \`tests/knowledge-reuse-protocol.test.ts\`
- \`tests/knowledge-agent-prompt-contract.test.ts\`
- \`tests/task-dispatch-prompt-builder.test.ts\`
- \`tests/safety/task-dispatch-prompt-builder-chain.test.ts\`
- \`tests/bailongma-status-sync.test.ts\`
- \`tests/safety/hcc-artifact-store.test.ts\`

## 9. docs/knowledge Inventory

> Note (P2-3): docs list below is files in diff range 2f79c75^..HEAD, not full docs/ directory inventory.

${docList}

## 10. Recent Commits

\`\`\`text
${commits}
\`\`\`

## 11. Review Questions

1. Does any current doc imply HCC Auto Executor is usable?
2. Does any current doc imply hard cutover is complete?
3. Does any current doc imply Productionization is approved?
4. Does any current doc imply L6 live knowledge flush or live knowledgeIngest is enabled?
5. Does the Knowledge Reuse Chain remain dry-run / prompt-builder only?
6. Are historical test counts clearly labeled as historical slice-local evidence?
7. Is UI redesign still design-spec-only, with no implementation started?
8. Does \`docs/design/UI-GROUND-TRUTH-2026-06-04.md\` exist as the dedicated UI scope reference (per §0 out-of-scope)?
`;
}

function assertSummary(markdown, tests, diff) {
  const failures = [];
  if (!tests.stale && tests.failed !== 0) {
    failures.push(`vitest failed count is ${tests.failed}`);
  }
  if (diff.other.length) {
    failures.push(`unclassified files: ${diff.other.join(", ")}`);
  }
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const negated = negations.some((token) =>
      line.toLowerCase().includes(token.toLowerCase()),
    );
    if (negated) continue;
    for (const pattern of forbiddenPositiveClaims) {
      if (pattern.test(line)) {
        failures.push(`forbidden positive claim at line ${i + 1}: ${line.trim()}`);
      }
    }
  }
  if (failures.length) {
    throw new Error(`Summary self-check failed:\n${failures.join("\n")}`);
  }
}

const git = collectGit();
const diff = collectDiff();
const tests = collectVitest();
const markdown = render(git, diff, tests);
assertSummary(markdown, tests, diff);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, markdown, "utf8");
console.log(out);
