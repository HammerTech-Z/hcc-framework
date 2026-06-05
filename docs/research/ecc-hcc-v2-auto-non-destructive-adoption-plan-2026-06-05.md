# ECC -> Hermes HCC v2 Auto 无损接入方案

> 日期：2026-06-05
> 状态：候选方案 / no runtime / no import
> 来源：只读评估 `https://github.com/affaan-m/ECC`
> 约束：不安装 ECC；不执行 ECC scripts/hooks；不复制外部 harness 配置；不修改 locked roadmap；不启用 HCC Auto Executor。

---

## 1. 结论

ECC 对 Hermes Pro 的代码能力和项目能力有参考价值，但只能先进入 HCC v2 Auto 的“方法论 / skill / checklist / prompt asset”层。

本方案不把 ECC 作为执行器、不把 ECC 作为 runtime 依赖、不接 MCP/hooks/agent subprocess。它只把 ECC 作为外部候选资产源，后续通过只读审计和 Hermes 本地重写进入 dry-run fixture。

---

## 2. 当前 Hermes 边界

本方案必须继承当前 Hermes Pro 状态：

- HCC Auto Executor 未批准、未启动、未接线。
- P3 real execution paused。
- L6 live knowledgeSearch / knowledgeIngest / live flush 未批准。
- Knowledge Reuse Chain 当前只到 L5 dry-run / prompt-builder。
- Round 2 C frozen。
- hard cutover unapproved。
- 不改 `docs/roadmap-locked-2026-05-28.md`。

因此 ECC 不能被用来“解冻”HCC Auto Executor。ECC 只能补强 HCC 的任务理解、代码审查、测试策略、项目收口和 agent 规则资产。

---

## 3. ECC 可借鉴能力

| 能力 | ECC 参考面 | Hermes 落点 | 价值 |
|------|------------|-------------|------|
| 代码审查 | code-review / security-review / coding rules | HCC reviewer prompt + checklist | 高 |
| 测试策略 | tdd-workflow / e2e-testing / verification-loop | HCC verifier section | 高 |
| 项目拆解 | feature-development / project-flow / architecture skills | HCC task package template | 高 |
| 多语言规则 | TypeScript / Python / Go / Java / Kotlin / Rust 等规则 | HCC domain profile supplements | 中高 |
| 文档检索 | documentation-lookup / research-first workflow | Knowledge reuse local/newly split | 中高 |
| MCP/工具模式 | mcp-server-patterns | 仅 design reference，不接 runtime | 中 |
| 长项目收口 | status / readiness / session patterns | Handoff Pack closeout checklist | 中高 |

---

## 4. 明确不接入范围

以下内容不得在本方案内接入：

- 不运行 `install.sh` / `install.ps1` / npm install / ECC CLI。
- 不复制 `.claude/`、`.codex/`、`.cursor/`、`.gemini/`、`.opencode/` 到 Hermes。
- 不接 `.mcp.json`。
- 不启用 hooks。
- 不启动 ECC dashboard / daemon / agent session。
- 不修改 Hermes default system prompt。
- 不修改 HCC Auto Executor 状态。
- 不写真实 `~/.hermes/handoff/packs` 或 `~/.hermes/audit`。
- 不将 ECC 文案原样作为 Hermes 当前 truth。

---

## 5. 无损接入链路

```text
ECC repo (external, untrusted)
  -> ECC-HCC-001 read-only audit
  -> ECC-HCC-002 asset classification fixture
  -> ECC-HCC-003 Hermes-local prompt/checklist rewrite
  -> ECC-HCC-004 dry-run task pack comparison
  -> ECC-HCC-005 closeout / GO-NO-GO
  -> later ADR only if user approves runtime-adjacent work
```

关键原则：

1. 外部内容先分类，不直接使用。
2. 可用思想必须重写成本地 Hermes 契约。
3. 所有输出先进入 fixtures / docs / tests。
4. 不触碰 runtime、不触碰 IPC、不触碰 executor。
5. 每一步都可以独立回滚，且不影响现有 HCC dry-run baseline。

---

## 6. 后续 Slice 设计

### ECC-HCC-001: Read-only Repository Audit

目标：做 ECC 只读库存和风险审计。

交付物：

- repo inventory：skills / hooks / rules / agents / commands / scripts / mcp-configs 分类。
- license and package review。
- risky surface list：hooks、scripts、MCP、installer、daemon、session store。
- useful surface list：code review、testing、project flow、documentation lookup、verification loop。
- HCC v2 mapping table。

验收：

- 0 file import。
- 0 script execution。
- 0 runtime modification。
- locked roadmap unchanged。

### ECC-HCC-002: Asset Classification Fixture

目标：把 ECC 候选能力映射成 Hermes 可读 fixture，不复制代码。

交付物：

- JSON fixture：candidate_assets / forbidden_assets / rewrite_required_assets。
- 每个 asset 标记 source_uri、license、risk、Hermes target surface。
- prompt injection / overclaim / runtime token scanner。

验收：

- fixture 只存摘要和分类，不存大段外部原文。
- 不导入 ECC 文件树。

### ECC-HCC-003: Hermes-local Prompt Checklist Rewrite

目标：把通过审计的思想重写为 Hermes 本地 HCC prompt/checklist。

候选输出：

- HCC code-review checklist。
- HCC project-closeout checklist。
- HCC verification-loop checklist。
- HCC documentation-lookup checklist。
- HCC domain-profile supplement design。

验收：

- 语言和约束符合 Hermes 当前 dry-run contract。
- 明确声明 HCC Auto Executor still paused。
- 不使用 ECC hooks/scripts/MCP。

### ECC-HCC-004: Dry-run Task Pack Comparison

目标：用 Hermes 已有 dry-run task pack，对比加入 ECC-style checklist 前后的质量。

比较维度：

- 任务拆解完整度。
- 测试计划质量。
- 风险识别质量。
- 验证命令合理性。
- closeout 信息完整度。

验收：

- dry-run only。
- 不跑真实 verificationCommands。
- 不启动 Agent subprocess。

### ECC-HCC-005: Closeout / GO-NO-GO

目标：决定 ECC 是否值得留在 HCC v2 后续候选池。

可能结论：

- GO: 保留为 HCC prompt/checklist asset source。
- PARTIAL: 只保留 code-review/testing/project-closeout 三类。
- NO-GO: 归档，仅保留评估记录。

---

## 7. 风险矩阵

| 风险 | 直接接入 | 本方案 |
|------|----------|--------|
| 供应链风险 | 高 | 低 |
| prompt 行为漂移 | 中高 | 中低 |
| hooks 越权 | 高 | 无 |
| MCP 工具面扩张 | 高 | 无 |
| HCC 状态误判 | 高 | 低 |
| license/code copy 风险 | 中 | 低 |
| 维护成本 | 高 | 中低 |

---

## 8. 推荐优先级

推荐把 ECC 放在 HCC 后续候选池，不插队当前 paused / observation 状态。

建议顺序：

1. 保持 HCC Auto Executor paused。
2. 完成当前模型策略 / UI / closeout 等已批准分支。
3. 用户批准后跑 `ECC-HCC-001` 只读审计。
4. 审计 PASS 后再考虑 `ECC-HCC-002` fixture。
5. 严禁直接进入 runtime。

---

## 9. 成功标准

ECC 对 Hermes 的“无损优化”成立，当且仅当：

- 代码任务产出的 review/test/checklist 更完整。
- 项目任务的拆解、风险、收口更清晰。
- 没有新增 runtime attack surface。
- 没有改变 HCC Auto Executor paused 状态。
- 没有把外部配置变成 Hermes 当前 truth。

---

## 10. 一句话

ECC 可以作为 HCC v2 Auto 的外部能力参考库，帮助 Hermes 提升代码审查、项目拆解、验证闭环和收口质量；但它必须通过只读审计、资产分类、本地重写、dry-run 对比后再进入后续环节，不能直接接入 runtime。
