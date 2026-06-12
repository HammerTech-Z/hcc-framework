# HCC-B6 Mano-P ADR + Agent-Spaces License Audit — Preflight — 2026-06-12

> Phase B 车道二 逐任务 preflight。B-6：Mano-P 放弃 ADR + agent-spaces license 审计。
> 不实施。不提交外部结论。不做法律意见。只提供工程审计计划。

## 1. B-6 目标

按 plan v3.2 Phase B 车道二任务表：

| 任务 | 内容 | 标志 |
|------|------|------|
| B-6 | Mano-P 正式放弃 ADR + agent-spaces license 审计（零代码） | `license 查明前零引入；ClawWork 挂 V5 解冻` |

两个子目标：
1. **Mano-P 放弃 ADR**：产出一份 Architecture Decision Record，记录放弃原因、决策日期、替代方向。不执行任何 Mano-P 代码修改。
2. **agent-spaces license 审计**：对 Hermes Pro 依赖中的 agent-spaces 相关许可进行工程层面扫描，不提供法律结论。

## 2. 输入资料清单

### 2.1 Mano-P 放弃 ADR 输入

| 来源 | 路径 | 内容 |
|------|------|------|
| 执行计划 | `docs/plan/02-execution-plan.md` § Phase B B-6 | 原始任务定义 |
| 路线图 | `docs/roadmap-locked-2026-05-28.md` | Mano-P 在待定项目清单中的历史上下文 |
| CONTEXT.md | 当前根目录 | Mano-P 待定状态声明 |
| HCC-GO 授权 | `docs/governance/hcc-go-authorization-2026-06-11.md` §2.2 | B-6 需 HCC-STABLE 后开放 |
| 现有 ADR | `docs/adr/` 目录 | 已有 ADR 格式模板 |

### 2.2 agent-spaces license 审计输入

| 来源 | 路径 | 内容 |
|------|------|------|
| package.json | `~/hermes-pro/package.json` | dependencies / devDependencies 列表 |
| package-lock.json | `~/hermes-pro/package-lock.json` | 完整依赖树 |
| agent-spaces 引用 | `[待搜索]` | Hermes 代码中对 agent-spaces 的 import/require 引用 |
| ClawWork | `docs/` 中 ClawWork 相关 | plan 标记：ClawWork 挂 V5 解冻（与 license 查明联动） |
| LICENSE 文件 | `~/hermes-pro/LICENSE` 或 `~/hermes-pro/LICENSE.md` | Hermes Pro 自身许可 |
| node_modules 中 agent-spaces | `~/hermes-pro/node_modules/@anthropic/agent-spaces/` 或类似路径 | 需先确定 agent-spaces 的 npm 包名 |
| agent-spaces 源码/文档 | 外部（GitHub / npm registry） | **不准联网获取；需用户明确批准联网** |
| 其余相关 docs | `docs/adr/`、`docs/v6-*`、`docs/v7-*` | 提及 agent-spaces 或 Mano-P 的文档 |

## 3. 待确认问题

| # | 问题 | 当前状态 | 需要什么 |
|---|------|---------|---------|
| 1 | Mano-P 放弃原因是否已有来源证据 | 已有 CONTEXT.md / NEXT_STEP.md 中的描述（"已放入待定项目"、"browser-use DEFER"），但未以 ADR 格式整理 | 用户提供正式放弃原因或确认现有描述作为来源 |
| 2 | agent-spaces 的 npm 包名 | 包名未确切——推测为 agent-spaces（存在于 Hermes Pro 文档中）。可能是 Anthropic SDK 的一部分或单独包 | 用户确认包名 + 包是否存在 node_modules 中 |
| 3 | agent-spaces license 是否需要在本地源码审计还是只需远端查阅 | 若包在 Hermes Pro node_modules 中：本地审计；若仅外部模式：需用户批准联网获取 | 确认后二选一 |
| 4 | "ClawWork 挂 V5 解冻" 的具体含义 | plan 文本但细节未展开 | 用户澄清 |
| 5 | B-6 零代码——但 ADR 本身算不算"代码" | plan 所有代码任务均已标记 `零代码` 或 `1 / 0` | B-6 ADR 为文档，不涉及 src/ 改动 |

## 4. Implementation 候选文件清单（另批）

| 文件 | 类型 | 描述 |
|------|------|------|
| `docs/adr/ADR-20260612-abandon-mano-p.md` | 新增 ADR | Mano-P 正式放弃决策记录 |
| `docs/closeout/hcc-b6-mano-p-agent-spaces-closeout-2026-06-12.md` | 新增 closeout | B-6 收口报告 |
| `docs/plan/hcc-b6-mano-p-agent-spaces-license-preflight-2026-06-12.md` | 本 preflight | 预检文档 |

**不修改**：`src/**`、`tests/**`、`CONTEXT.md`、`NEXT_STEP.md`、`package.json`、`package-lock.json`、`.claude/settings.json`、`~/.hermes/**`。

## 5. 审计方法（只读、工程记录、不给法律意见）

### 5.1 Mano-P ADR 审计方法

1. 读取 CONTEXT.md / NEXT_STEP.md / docs/roadmap-locked-2026-05-28.md 中 Mano-P 相关描述
2. 逐项提取放弃原因（V7 browser-use DEFER、硬件/云端验证不满足、用户未授权等）
3. 整理成 ADR 格式：
   - Status: Accepted
   - Context: 何时/为什么加入 Mano-P
   - Decision: 正式放弃
   - Consequences: 撤除 Mano-P 相关计划的资源分配、ClawWork 挂 V5 解冻
4. 不修改任何现有 Mano-P 相关代码或文档内容

### 5.2 agent-spaces license 审计方法

1. **本地优先**：在 node_modules / package-lock.json 中定位 agent-spaces 包
2. 提取包内 `LICENSE` / `LICENSE.md` / `package.json` 中 `license` 字段
3. 记录具体协议名称和 SPDX 标识符（如 MIT / Apache-2.0 / BSL / UNLICENSED）
4. 检查 Hermes Pro 自身 LICENSE 与 agent-spaces 许可是否冲突
5. 若本地无包，记录为 "pending — needs network access / user authorization"
6. **不做法律结论**：只记录许可名称、文本头、SPDX 标识符。不写 "可以商用"、"不可商用"、"法律建议"

## 6. 测试/验证计划

| 测试 | 期望 |
|------|------|
| Mano-P ADR: 文件存在 + status = Accepted + context/decision/consequences 完整 | 非空文档 |
| agent-spaces license: license 文件定位 + 包名确认 | 定位成功或 report pending |
| `npm run typecheck` | PASS（B-6 零代码，不受影响） |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |

**若需要外部资料**（npm registry / GitHub agent-spaces repo），必须**用户先明确批准联网**，本 preflight 不授权任何网络访问。

## 7. 红线

| 禁项 | 理由 |
|------|------|
| **写 `~/.hermes/**`** | P0-1 LOCK.md + lock-verify |
| **改 `src/**` / `tests/**`** | B-6 为零代码任务；不改任何代码 |
| **改 `package.json` / `package-lock.json`** | license 审计不修改依赖 |
| **给法律意见** | 工程审计，不给法律结论 |
| **开放 apply path** | B-4C runtime guard 白名单 |
| **启动 Auto Executor** | plan A-5 §1.6 + HCC-GO §2.2 |
| **开放 Live Ranking mutation** | LOOP-007 冻结 |
| **`git push`** | Phase A 全链未 push |
| **联网下载 agent-spaces 资料** | 需用户明确批准 |

## 8. HCC-STABLE 关系

- HCC-STABLE 已于 2026-06-12 用户签收（`b2db6a2`）。
- Phase B 车道二允许逐任务 preflight。
- **B-6 不是自动执行批准**。用户需独立 GO B-6 implementation。
- B-6 完成后 not automatic unlock of ClawWork 继续开发。

## 9. 修订

- 2026-06-12 v1：HCC-B6 Mano-P ADR + agent-spaces license audit preflight。
