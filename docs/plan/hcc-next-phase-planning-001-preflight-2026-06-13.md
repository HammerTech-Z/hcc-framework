# HCC Next Phase Planning — Preflight — 2026-06-13

> HCC Phase B full-chain 已 push 并 closure。本文档规划下一阶段路线。
> 不改代码。不启动 runtime。不提交执行变更。

## 1. 当前基线

| 维度 | 状态 |
|------|------|
| HEAD | `293c5c3` |
| origin/hermes-pro-main | `293c5c3` |
| HEAD ≡ origin | ✅ |
| HCC Phase B B-1~B-6 | ✅ 8/8 complete |
| HCC-STABLE | ✅ Accepted (6/6 conditions) |
| Vault stray feature batch | ✅ All ingested |
| B-5 KnowledgeControl | ✅ Complete |
| B-6 Mano-P ADR + agent-spaces | ✅ Complete |
| Lock-verify | PASS=46 |
| Typecheck | PASS (node + web) |
| Full vitest | 154/154 files, 4166/4166 PASS |
| Dirty workspace | 仅 `.claude/settings.json` (harness config; documented by `local-harness-dirty-policy-001-preflight-2026-06-12.md`) |

## 2. 下一阶段候选路线

### A. HCC Auto Executor 授权前置审计

| 维度 | 详情 |
|------|------|
| 目标 | 在用户考虑 Auto Executor 常驻授权前，进行前置的工程审计 + 用户-控制权限建模 |
| 范围 | `src/main/safety/hcc-task-handoff-policy.ts` 复用为基准；附加用户人工 kill switch 设计；拒绝 actor=ai / verified=true 路径 |
| 风险 | 高——若不严控，可能导致 AI 自我执行。**严禁不经过用户独立 GO 而自动开启。** |
| 前置条件 | 用户显式询问"如何评估 Auto Executor 授权" + 用户独立独立授权 preflight commit 批 |
| 预计产出 | `hcc-auto-executor-authorization-preflight-001.md` 文档，仅 preflight，零代码变更 |
| 工期 | 1-2 hours |
| 推荐 | ✅ **第一步**——先做前置审计是负责任的做法 |

### B. apply path / Live Flush 真执行 preflight

| 维度 | 详情 |
|------|------|
| 目标 | B-4C 已建 approval gate（pending_user_approval only）。下一步设计端到端"用户逐次审批 → 真 flush → 文档化" pipeline。 |
| 范围 | apply path slice 独立 preflight；不实现 apply；仅 design user approval flow。 |
| 风险 | 中——若 pipeline 错设计，user 误点 confirm 会触发真写入 vault。**严禁不经过 B-4C runtime guard 白名单验证。** |
| 前置条件 | 路线 A 完成 + 用户对 auto-executor 授权态度明朗 + B-4C closeout §10 重申 |
| 预计产出 | `hcc-apply-path-execution-preflight-001.md` |
| 工期 | 2-4 hours |
| 推荐 | 第二步——前置审计完成 + 用户对 auto-executor 态度明朗后 |

### C. P3 real execution bridge preflight

| 维度 | 详情 |
|------|------|
| 目标 | P3 dry-run baseline 已完整。设计从 dry-run 转向真执行的 bridge。 |
| 范围 | bridge preflight 仅 design audit log + 真执行权限 + 撤销机制；不实现真执行；不改 dry-run baseline。 |
| 风险 | 高——P3 real execution 是 Hermes Pro 长期停滞中的核心议题；任何一步错会让 P3 dry-run baseline 失效。 |
| 前置条件 | 路线 A + B 完成 + 用户对所有红线明确不放松 |
| 预计产出 | `hcc-p3-real-execution-bridge-preflight-001.md` |
| 工期 | 4-8 hours |
| 推荐 | 第三步——只有在所有前置审计 + 用户对 auto-approve 零放松后才能进 |

### D. UI next slice / product polish

| 维度 | 详情 |
|------|------|
| 目标 | KnowledgeControl 视觉收尾完成 (B-5)。下一步 UI polish / 文档化。 |
| 范围 | renderer-only；零 IPC；零 new 风险 |
| 风险 | 低——纯视觉，bounded by read-only 边界 |
| 前置条件 | 无 |
| 预计产出 | `ui-slice-NN-preflight.md` |
| 工期 | 1-2 hours per slice |
| 推荐 | 可与路线 A 并行——UI 风险低，不依赖 HCC 决策 |

### E. vault/knowledge live ingestion governance

| 维度 | 详情 |
|------|------|
| 目标 | Hermes Pro 当前无 live ingestion。下一步 design vault/knowledge 实时摄取 governance。 |
| 范围 | governance preflight；不实现 live ingestion；不改 knowledgeIngest handler；改 docs 设计。 |
| 风险 | 中-高——live ingestion 涉及 vault 写入；必须先设计 audit log + 撤销 + 限额。 |
| 前置条件 | 路线 A 完成（Auto Executor 态度明朗）+ 用户对 knowledgeIngest 写入态度明朗 |
| 预计产出 | `vault-live-ingestion-governance-preflight-001.md` |
| 工期 | 4-6 hours |
| 推荐 | 视用户对 live ingestion 态度而定——若用户不希望 live ingestion，跳过此路线 |

## 3. 推荐顺序

```
1. 路线 A: HCC Auto Executor 授权前置审计     ← 首选
2. 路线 B: apply path / Live Flush 真执行 preflight
3. 路线 C: P3 real execution bridge preflight
4. 路线 D / E: 视用户对 (4) Auto Executor + (5) live ingestion 态度而定
```

**关键决策原则**：先做前置审计 (A)，再考虑真执行 (B, C)，最后才考虑真实自动执行。所有路线均为"设计 + preflight"，不实现代码。

## 4. 红线

| 禁项 | 状态 |
|------|------|
| 自动开启 Auto Executor | ❌ 永不自动；需用户独立 GO |
| 开放 apply path | ❌ B-4C runtime guard 白名单约束 |
| 写 `~/.hermes/**` | ❌ 不写 |
| 修改 `src/**` / `tests/**` | ❌ 本批仅 docs |
| `git push` | ❌ 不推送；用户单独 GO |

## 5. 验证

| Gate | Result |
|------|--------|
| `git status --short -uall` | `.claude/settings.json` modified + this preflight untracked |
| `npm run typecheck` (node + web) | PASS |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | PASS=46 |
| `commit` / `push` | ❌ 不执行 |

## 6. Bellard-perspective

**Minimal next step should be planning, not execution.** 路线 A 优先——因为它是"审计前审计"，是"决策前的设计"。零行为 0 → 零行为 1：B-4C runtime guard + HCC-STABLE 6 条件 + 5 batch 闭环已存在；下一步是 design gate，**不** implementation。Bellard 原则：先看 design doc 的行数 vs implementation commit 的行数；design 多于 implementation 才是正工程。`preflight → preflight → implementation` 三段闭环。

审计结论：**推荐路线 A 作为第一步。**

## 7. Karpathy-perspective

**Measurable gates before capability expansion.** Phase B 已达 8/8 + HCC-STABLE 6/6 + Vitest 4166/4166 + 5 batch 闭环。每个 gate 都 measurable。下一阶段不可绕过 measurable gates——不能"因为 Phase B 完成就开 Auto Executor"。Karpathy 原则：gate 是 ground truth；不投射未来 gates；先 design，再 measure，再 expand。

审计结论：**推荐顺序 (A → B → C) 保证每步都有 measurable 验证。** 不需要 pre-launch — launch 还需要独立用户 GO。

## 8. 后续建议

1. 用户审阅本文档 + 选择路线
2. 选 A：GO preflight 路线 A
3. 选 D：可与 A 并行（UI 风险低）
4. 选 E：仅当用户对 live ingestion 明确希望时
5. 选 C：仅当 A + B + 用户零放松红线时

## 9. 修订

- 2026-06-13 v1：HCC Next Phase Planning preflight。
