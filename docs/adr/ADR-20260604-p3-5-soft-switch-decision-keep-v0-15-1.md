# ADR-20260604 — P3.5 Soft Switch Observation Decision: KEEP v0.15.1

| 字段 | 值 |
|------|----|
| Status | **Accepted** |
| Date | 2026-06-04 |
| Author | Hermes Pro (Claude Code) |
| Decision | **A. 保持**（P3.5 soft switch candidate v0.15.1 由观察期升格为「采用」）|
| Supersedes | (none) |
| Refines | `docs/p3-dry-run-baseline-2026-06-01.md` § 8.2 / § 8.4 observation baseline |

---

## 1. 背景

- 2026-06-02：P3.5 upgrade candidate v0.15.1 通过 Round 2 A/B-impl/B-smoke/B-fix + B-runtime-smoke + A-remain + hermes-candidate wrapper v1.2.0 + soft-to-live switch 排练（6/6 smoke 全过）。
- 2026-06-02：执行 soft-to-live switch rehearsal。`hermes` symlink 由 `hermes-agent/venv/bin/hermes`（live v0.14.0）重定向至 `hermes-agent-upgrade-candidate/.venv/bin/hermes`（v0.15.1）。Backup 保留在 `~/.hermes/backups/hermes-live-wrapper-pre-soft-switch-20260602/`。
- 2026-06-02 起：soft switch 进入 1-2 天观察期。Baseline 报告：`~/.hermes/pipeline-runs/HCC-20260602-HERMES-SOFT-SWITCH-OBSERVATION/01-baseline.md`。
- 2026-06-04：观察期超出 1-2 天窗口 1 天（仍无故障报告，rollout 仍指向 v0.15.1），由用户裁决进入本 ADR。

## 2. 候选与差异

| 维度 | Live v0.14.0 | Candidate v0.15.1 |
|------|-------------|-------------------|
| `pyproject.toml` version | 0.14.0 | 0.15.1 |
| Release date | — | 2026-05-29 |
| 距 v0.14.0 commits | — | 1,302 commits / 747 PRs / 1,746 files / +282,712 / -36,699 (v0.15.0) + 28 commits / 21 PRs (v0.15.1) |
| 核心变化 | — | run_agent.py 16k→3.8k 重构（行为不变）、冷启动 perf wave、session_search 4,500× 加速、Promptware/Brainworm 防御、Bitwarden Secrets Manager、ntfy 第 23 messaging、Skill bundles、Kanban 升级为多 agent 平台 |
| Hotfix（v0.15.1） | — | Dashboard 401 reload loop、Docker `--insecure` 显式 env、MCP bare command PATH、Skills.sh catalog 858→19,932、Kanban worker SIGTERM 修复、Gateway `.md` 投递恢复、probe stepdown 安全 |

完整 release notes：

- `~/.hermes/hermes-agent-upgrade-candidate/RELEASE_v0.15.0.md`
- `~/.hermes/hermes-agent-upgrade-candidate/RELEASE_v0.15.1.md`

## 3. 用户环境差量（与 hermes-pro 桌面 / BaiLongma / Knowledge 关系）

| Hermes Agent 特性 | 对 hermes-pro 当前路径影响 |
|------------------|--------------------------|
| run_agent.py 16k→3.8k 重构（行为不变） | 无（hermes-pro 桌面 / BaiLongma / Knowledge 均为只读 screen 与 IPC，不接 hermes agent 内部循环）|
| session_search 4,500× 加速 | 间接正面（hermes-pro 知识检索路径）|
| Promptware/Brainworm 防御 | 间接正面（recall memory 扫描 + delimiter marker）|
| Kanban 104 PRs | 无关（hermes-pro 未启用 kanban）|
| Bitwarden / ntfy / Krea / MCP catalog / xAI 整合 / TUI orchestrator | 无关（未配 / 未启用）|
| v0.15.1 hotfix | 无关（不涉及 hermes-pro 桌面）|

## 4. 决策

**A. 保持 v0.15.1**（采用 P3.5 soft switch candidate 为生产候选）。

理由：

1. **行为相容**：v0.15.0 重构保留 `AIAgent` forwarder，所有 test patch path 与外部 caller 兼容。
2. **观察期无故障**：1-2 天窗口（2026-06-02 起）+ 1 天超窗仍未触发 rollback 条件。
3. **6/6 read-only smoke 排练全过**：live vs candidate 比较 6 byte-identical + config 1 行差 + tools 1 行差。
4. **当前入口已稳定指向 v0.15.1**，重新切回 live v0.14.0 需要动用 rollback 备份；rollback 本身没被任何故障触发。
5. **P3 真实执行仍未启动**（HCC Auto Executor 未批准），hard cutover 的「30 天 dual-run」前置条件未满足；现软切 + 采用比 hard cutover 更稳。

不选择 B (rollback) 的原因：无故障证据，未观察到 `~/.hermes/handoff/packs` / `~/.hermes/audit` mtime 异常，未观察到长驻进程异常。

不选择 C (hard cutover) 的原因：hard cutover 仍冻结（未批准）。HCC Auto Executor 仍不可用，P3 real execution 仍 paused。hard cutover 要求「30 天 dual-run + Action Gate」，在当前状态下不满足。

## 5. 决策对状态语义的影响

- soft switch 由「1-2 天观察期 ACTIVE」升格为「采用」/「KEEP v0.15.1」。
- `hermes` 仍指向 candidate v0.15.1；rollback 备份仍保留在 `~/.hermes/backups/hermes-live-wrapper-pre-soft-switch-20260602/`，可随时回滚。
- 5 份 entry-point docs 中「soft switch ACTIVE / 1-2 天观察期」措辞改为「KEEP v0.15.1 / 采用 / 观察期已结束」。
- **不**取消任何 hard freeze：HCC Auto Executor / P3 real execution / Productionization / hard cutover / Round 2 C / L6 live knowledge flush 全部仍冻结。
- 任何后续「切回 v0.14.0 live」动作必须新建 ADR + 用户显式批。

## 6. Rollback 路径（保留，未触发）

```bash
ln -sf /Users/midoudou/.hermes/hermes-agent/venv/bin/hermes \
       /Users/midoudou/.local/bin/hermes
```

回滚后需重新跑 `npm run typecheck && npx vitest run` 验证（候选/直播 ABI 一致，但 pip 包可能漂移）。

## 7. 关联文档

- `docs/p3-dry-run-baseline-2026-06-01.md` § 8.2（soft switch 排练） / § 8.4（观察期建议） — 本 ADR 闭环对象
- `docs/adr/ADR-20260602-locked-roadmap-drift-reset.md` — 锁定路线图 drift reset 流程参考
- `~/.hermes/pipeline-runs/HCC-20260602-HERMES-SOFT-TO-LIVE-SWITCH-REHEARSAL/01-report.md` — 排练报告
- `~/.hermes/pipeline-runs/HCC-20260602-HERMES-SOFT-SWITCH-OBSERVATION/01-baseline.md` — 观察期 baseline

## 8. 变更清单

本 ADR 后续随附的 doc-sync commit 将修改：

- `CONTEXT.md`（顶 + 状态段）
- `NEXT_STEP.md`（3 处：头表 / 中段 / 尾表）
- `docs/current-fusion-plan-2026-05-30.md`（顶段 / § 2.1 表 / 不得重跑段）
- `docs/iteration-plan-v2-updated.md`（顶段 / 瓶颈表）
- `docs/p3-dry-run-baseline-2026-06-01.md`（顶段 / § 8.2 / § 8.4）

不修改：

- `docs/roadmap-locked-2026-05-28.md`（锁定路线图）
- `~/.local/bin/hermes` symlink
- 任何 hermes agent 文件 / venv
- 任何真实 `~/.hermes/handoff/packs` 或 `~/.hermes/audit` 写入
