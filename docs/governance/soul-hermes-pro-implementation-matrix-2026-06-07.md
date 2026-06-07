# 灵魂 ↔ Hermes Pro 落地对照表（2026-06-07）

> 用途：治理守门工具。每次修改 `~/.hermes/HERMES-SOUL.md`、学习闭环、安全写入路径、
> prompt 注入、HCC 编排、知识入库或 Next Task Context 前，先用本表确认：
> 灵魂条款当前到底是机械级、契约级、约定级，还是待建。
>
> 本文是派生文档，不是灵魂正文；它描述 Hermes Pro 当前落地状态，允许随代码和计划更新。
> 它本身不产生运行时拦截效果，只有被计划、代码 gate、评审流程引用时才真正生效。

## 强制等级

| 等级 | 含义 |
|---|---|
| 机械级 | 已有代码 gate 能在对应运行路径拒绝输入/输出。仅对接入该 gate 的路径生效。 |
| 契约级 | 类型、纯函数、测试或设计契约已存在，但未接入活线运行时，或真实性仍需下游验证。 |
| 约定级 | 靠 `DAILY-SOP`、handoff、Agent 自律和人工评审；没有代码能直接拦截。 |
| 待建 / 未验证 | 本地未找到实现，或仍停留在未来计划。 |

## 0. 根层：灵魂有没有被运行时加载

| 灵魂机制 | 本地现状 | 强制等级 | 证据 | 断层 | 下一步 |
|---|---|---|---|---|---|
| 会话第 0 步读取 `HERMES-SOUL.md` 正文 | Hermes agent 当前 `load_soul_md()` 读取的是 `~/.hermes/SOUL.md`；该文件只有 4 行指针，未直接注入 452 行 `HERMES-SOUL.md` 正文 | 约定级 / 指针级 | `~/.hermes/hermes-agent/agent/system_prompt.py`；`~/.hermes/hermes-agent/agent/prompt_builder.py`；`~/.hermes/SOUL.md` | 重 | 建最小 loader：优先加载 `HERMES-SOUL.md`，`SOUL.md` 仅作 fallback；启动时若只加载到指针则 warning |
| Hermes Pro UI/API 对灵魂文件读写 | `src/main/soul.ts` 的 `canonicalSoulPath()` 优先 `HERMES-SOUL.md`，可 read/write/reset；这是文件管理，不是条款校验器 | UI 文件管理级 | `src/main/soul.ts`；`src/preload/index.ts`；`src/main/index.ts` | 轻 | 保持；不要误声明为运行时 enforcement |
| Codex / Claude Code 自动接入灵魂 | 本地未找到统一 loader 把 `HERMES-SOUL.md` 正文机械注入所有 Agent | 未验证 | 本地检索未发现统一 loader | 中 | 通过 handoff preamble、wrapper 或同一 loader 接入 |

## 1. 安全与可信内核

| 灵魂机制 | 本地现状 | 强制等级 | 证据 | 断层 | 下一步 |
|---|---|---|---|---|---|
| 信任阶梯 5 级 | `TrustLevel` 枚举逐字包含 `unverified / ai_inferred / single_run / reproduced / human_confirmed` | 机械级（反思契约路径） | `src/shared/lib/post-task-reflection-contract.ts` | 无 | 扩到其他路径时复用同一枚举 |
| quarantine + ApprovalGate + SafetyFlags 默认关闭 | Post-task Reflection contract 已有纯契约和测试；写入、flush、install、ranking 等 runtime flag 保持 false | 机械级（契约路径） | `post-task-reflection-contract.ts`；`tests/post-task-reflection-contract.test.ts` | 无（该路径内） | 活线接入前继续保持 no runtime write |
| 未验证不入主线 / 不进下一任务上下文 | 契约提供 `assertReflectionAllowedForNextTaskContext()` 与 `assertReflectionAllowedForRankingInput()`，要求 human review + `human_approval_ref` + 非 quarantine | 契约级 / 局部机械 | `post-task-reflection-contract.ts` | 轻 | 未来消费者接线时必须调用 guard |
| 自证可信禁止 / `human_reviewed` 不得由 Agent 自盖 | 当前代码已阻止 `submitted_by=claude_code/codex` 携带 `human_reviewed=true`、`human_confirmed` 或 `human_approval_ref`；但 `HumanApprovalRef` 真实性在 contract 层仍是结构性字段，`verified` 被硬断言为 false，需要 consumer/anchor 层验证 | 契约级，非完整机械级 | `post-task-reflection-contract.ts`；LOOP-006A human approval anchor design | 中 | 活线消费前实现 human approval anchor verification；不得把结构字段当真实人审 |
| 知识即攻击载荷 / secret + instruction scan | 反思契约要求 `secret_scan` 和 `instruction_scan` scanned/passed，且对 draft body 做 secret-like / instruction-authority free-text guard；但外部输入全路径覆盖未证明 | 机械级（反思契约）/ 待建（外部输入路径） | `post-task-reflection-contract.ts` | 中 | 外部输入、知识入库、Next Task Context 接入同一扫描闸 |
| 学习写入权唯一：Hermes 写，Codex/Claude Code 只交候选 | LOOP 计划和契约表达了边界；活线反思写入器仍未批准，不存在真实自动写入主线 | 契约级 / 待建 | `docs/learning-loop/hermes-post-task-learning-loop-plan-2026-06-07.md` | 中 | 建 live writer 前先实现 submitter matrix、approval anchor、consumer guard |

## 2. 学习闭环与能力晶化

| 灵魂机制 | 本地现状 | 强制等级 | 证据 | 断层 | 下一步 |
|---|---|---|---|---|---|
| Post-task Learning Loop | LOOP-001.1 到 LOOP-009 已有多段 pure / dry-run / design-only 成果；LOOP-001.1 contract + LOOP-002 fixture + LOOP-003 usage feedback adapter design + LOOP-004 skill candidate design + LOOP-004b dead-end design + LOOP-005 local LLM wiki connector design + LOOP-006 knowledge ingest bridge design + LOOP-006A human approval anchor + consumer guard routing design + LOOP-007 retrieval feedback simulation dry-run + LOOP-008 reflection evaluator pure projection + LOOP-009 knowledge quarantine / promotion adapter design-only；全部保持 no runtime write、no live flush、no live ranking mutation、no HCC Auto Executor、no anchor verification | 契约级 / design-only / dry-run 级 | `docs/learning-loop/hermes-post-task-learning-loop-plan-2026-06-07.md`；`docs/iteration-plan-v2-updated.md` | 轻 | LOOP-009 apply path 仍冻结；任何 live 接线（含 live apply / live flush / anchor verification）需单独 ADR + 用户确认 |
| 晶化为能力 + 能力注册表 | LOOP-004 有 skill candidate draft builder；但本地未找到正式《能力注册表》作为活线注册表 | 设计级 / 待建 | `src/shared/lib/post-task-reflection-skill-candidate-design.ts`；本地注册表检索 | 中 | 建空壳 registry，再设计从 candidate 到 registry 的人工批准流程 |
| 领域注册表 | 灵魂有领域开放梯队概念；本地未找到正式《领域注册表》文件 | 待建 | 本地注册表检索 | 中 | 建空壳 registry，明确 planned/live 状态 |
| 外部输入入库（微信/飞书/定时/文件/链接） | Hermes Pro 有多入口和知识路径；但未证明所有外部输入路径都复用了 LOOP-001.1 的 scan + approval + quarantine 不变量 | 部分实现 / 待验证 | `docs/current-fusion-plan-2026-05-30.md`；知识链路 docs | 中 | 做 ingress-to-knowledge 安全矩阵，逐路径标 gate |

## 3. 编排与失效约束

| 灵魂机制 | 本地现状 | 强制等级 | 证据 | 断层 | 下一步 |
|---|---|---|---|---|---|
| HCC 集群编排 | HCC dry-run、handoff、artifact store 等已有；Auto Executor 仍未批准、未启动、未接线 | dry-run / 约定级 | `docs/current-fusion-plan-2026-05-30.md`；`docs/iteration-plan-v2-updated.md` | 中 | 继续禁止声明 P3 真实执行或 HCC Auto Executor 已启用 |
| 反幻觉 / 反偷懒“出现即停” | 目前没有全局机制能停掉所有 Agent；局部有 contract/test/guard，整体仍靠计划边界 + 人审 | 约定级 + 局部机械 | 本地代码和计划未发现全局 stopper | 中 | 将条款拆成机器可判定 gate：loader、scan、approval、promotion、write ownership |
| 快不等于跳过验证 | 多处计划已有 no-live / no-runtime / user approval 边界；仍不是全局自动 enforcement | 约定级 / 局部机械 | 当前融合计划、LOOP 计划、安全基座 | 轻 | 关键路径接 Action Gate 或 equivalent guard |

## 4. 对 Hermes Pro 的真实效果

| 效果 | 是否真实有帮助 | 边界 |
|---|---|---|
| 防 overclaim | 有。能防止把灵魂目标、design-only、dry-run 误写成 live runtime。 | 需要计划和评审流程引用；文档本身不会拦代码。 |
| 排优先级 | 有。能把 loader、approval anchor、scan 覆盖、registry 空壳排到前面。 | 不能替代 ADR 或用户授权。 |
| 回归检查 | 有。每次改灵魂、学习闭环、安全路径前查表，可发现计划漂移。 | 需要持续更新，否则会变成新的过期事实源。 |
| 运行时强制 | 当前没有。只有接入代码 gate / loader / Action Gate 后才有机械效果。 | 不能声明“已全局强制”。 |

## 使用规则

1. 修改 `HERMES-SOUL.md` 前，先检查本表是否会产生新的 overclaim。
2. 修改 Post-task Learning Loop、知识入库、Next Task Context、ranking、skill install、HCC Auto Executor 前，先更新本表对应行。
3. 如果某条机制只有设计或 dry-run，计划里必须写 `design-only` / `dry-run` / `no runtime` / `no live flush`，不能写成已启用。
4. 若本表与代码冲突，以代码和测试为准；随后修表。

## 当前优先级

| 优先级 | 事项 | 原因 |
|---|---|---|
| P0 | 建最小灵魂 loader / 启动自检 warning | 现在运行时只读 4 行 `SOUL.md` 指针，不等于加载灵魂正文。 |
| P0 | human approval anchor verification 接入消费者 | `HumanApprovalRef` 在 contract 层故意不是真实性验证。 |
| P0 | 外部输入路径 scan 覆盖矩阵 | 反思路径已有 scan gate；外部输入全覆盖未证明。 |
| P1 | 能力注册表 / 领域注册表空壳 | 防止灵魂引用的 registry 被误读成现状。 |
| P1 | 本表纳入当前融合计划与兼容索引 | 让它从“下载里的表”变成项目治理入口。 |
