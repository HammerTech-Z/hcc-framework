# Hermes Pro 执行计划（2026-06-10 · v3）

> 建议仓内路径：`docs/plan/02-execution-plan.md`（覆盖前一版需用户批）
> 事实来源：brief 2026-06-10 + supplement #2 + supplement #3（S1-S15 实测）+ HERMES-SOUL v5.5.1 候选
> 灵魂引用只标条款号，不复制正文（修改规则第 3 条）
> 执行模式：**Phase 0/A = 你出任务卡 → Codex 细化执行提示词 + 审计划 → Claude Code 执行 → Codex 复审 → 你批**（即 HCC v2 流程的人工彩排，每次执行同时产出 B1 闸门验证证据）；**Phase B = HCC-GO 后由 HCC 承载同一流程**
> 状态图例：⬜ 未动 / 🔶 进行中 / ✅ PASS / ⛔ 阻塞

---

## 附录零：Bug / AI 幻觉登记表（A-3 errata 的权威源）

> 来源：supplement #2/#3 交叉实测。每条修复归属指向本计划 P 项。状态由执行时更新。

| # | 位置 | 症状（一句话） | 灵魂依据 | 修复归属 | 状态 |
|---|------|---------------|---------|---------|------|
| H-1 | LOCK.md + brief §1.4/§4.4 + cerebrum | 物理锁是纸面锁：无 uchg / 无 watchdog / 无 violations.log，多份文档声称生效 | §12 / §8 / 修改规则第 5 条 | **P0-1** | ⬜ |
| H-2 | supplement-2 G2.4 方案 | patch prompt_builder.py 不成立——hermes-agent 是 NousResearch upstream clone，installer 覆盖本地改动 | §10 | **P0-2**（方案推翻为内容同步） | ⬜ |
| H-3 | prompt_builder.py:1328 | `load_soul_md()` 硬编码只读 SOUL.md，452 行灵魂 0 注入生产 agent（PID 2340 实证） | §1 | **P0-2** | ⬜ |
| H-4 | supplement-2 G1.4 估算 | "80 行 + 200 test" over-spec——实测后最小路径 ≈ 零代码 | §3 | P0-2 新方案吸收 | ✅ 已吸收 |
| H-5 | prompt_builder.py `_truncate_content` | 39KB 灵魂注入可能被截断，阈值未实测 | §12 | **P0-2 动作 3** | ⬜ |
| H-6 | tests/safety/external-input-scan-coverage.test.ts | 信任阶梯 5 级在测试矩阵 0 命中——§4"全系统统一刻度"未进断言 | §4 | **B-2**（scan gate 任务内补阶梯断言） | ⬜ |
| H-7 | ~/.hermes/HERMES-SOUL.md 修订记录 | 灵魂 v5.5.1 至今"候选·待逐条确认"——所有以灵魂为约束的计划建立在未批文本上 | 修改规则第 1 条 | **P0-2 动作 1**（用户批） | ⛔ 等用户 |
| H-8 | closeout 2026-06-07 审计常量 | "物理锁启用"假常量被收口文档引用固化 | §6 | **A-3**（errata 指针，不重写历史） | ⬜ |

> 历史轮 B-1~B-8（灵魂审查轮）处置：B-1→附录五#3 作废；B-2→S2 已答；B-3→S12 洗白撤销；B-4→B-1 任务定义吸收；B-5→A-3；B-6→A-5+B-5 收窄；B-7→A-2 边界写死；B-8→B-2/A-6 升级吸收。

---

## 0. 一页总览（关键路径）

```
Phase 0  信任修复（前提，全部阻塞后续）
  P0-1 物理锁真相修复          ← H-1，no_hermes_writes 闸的真实基座
  P0-2 灵魂批准 + 注入修复      ← H-3/H-7，集群 identity 归位
  P0-3 work 仓收口             ← 干净执行基线

Phase A  HCC 解锁链（Codex→Claude Code 人工执行）
  A-1 GOV-006：HCC 任务交接/进度/危险动作策略（纯 slice，零依赖，可立即发车）
  A-2 HumanApprovalRef 人闸门接线   → 关 user_authorization 闸
  A-3 closeout 勘误 + 文档对齐       → 关 no_hermes_writes 文档面
  A-4 dry-run 010 受控 worktree     → 消费 A-1 契约，关 hcc_auto_executor 闸前置
  A-5 GOV-007：B1 九闸评估 slice    → 出 GO/NOT-GO 裁决
  A-6 HCC 首个真实闭环任务（小、可回滚、你批）→ HCC-GO

Phase B  HCC 执行期（HCC-GO 后，HCC 承载调度/执行/双审，批准权在人）
  B-1 UI Slice 8（Knowledge Control 视觉收尾）
  B-2 能力/领域注册表空壳
  B-3 Reflection Evaluator 活化
  B-4 Live Reflection Writer → Live Flush（各单独批）
  B-5 真实输入路径 scan gate（vault/本地文件）
  B-6 Mano-P 放弃 ADR + agent-spaces license 审计

随时可做（不占关键路径）：UI Slice 0 批准（你一句话）
```

**HCC-GO 定义（可测量）**：B1 九闸中 `blocked` 清零；`requires_user_authorization` 项全部由你显式批；dry-run 010 PASS；A-6 首个真实任务交付 + 复盘入 LOOP 候选。四条全绿 = Phase B 启动。

**HCC-STABLE 定义（"HCC 做好"的可测量翻译，2026-06-10 用户裁决）**："完美执行"不可测，按 §4/§12 翻译为：**连续 5 个真实任务**满足——① 零红线违规（受保护文件 diff 空 + `~/.hermes` mtime 审计干净）；② 每任务全链 artifact 齐（handoff plan + 四段进度记录 + 验证命令输出）；③ 至少 1 次回滚演练 PASS（故意中止一个任务，worktree 回滚后基线测试全绿）；④ 反思候选全部 quarantine 产出、零自确认。**达成 HCC-STABLE 前，Phase B 只跑知识库车道；达成后才开放其余任务域。**

---

## Phase 0：信任修复

### P0-1 物理锁真相修复（H-1）

- **目标**：LOCK.md 声称的机制与实际一致——要么真锁，要么如实降级。
- **灵魂依据**：§12（设计目标≠现状）、§8、修改规则第 5 条（发现违反→停→说出来）。
- **入口**：`~/hermes-pro/LOCK.md`；新建 `scripts/lock-enforce.sh` + `scripts/lock-verify.sh`。
- **动作**：
  1. ~~裁决~~ **已裁决 (a) 真锁**（2026-06-10 用户批）。范围做减法：**chflags + 验证脚本即关闸；launchd watchdog 降为 v2 可选**（uchg 本身已挡写入，监控是锦上添花）。
  2. lock-enforce.sh（上锁）+ lock-verify.sh（验锁：`ls -lO` 断言 uchg 在；watchdog/violations.log 断言移入 v2）。
  3. LOCK.md 重写为与脚本一致的事实描述，附验证命令；删除 watchdog/violations.log 的虚构描述（v2 实装后再写回）。
  4. 同步勘误 brief §1.4/§4.4 引用（A-3 一并做）。
- **不做**：不锁 `~/.hermes/`（agent 运行时需要写 memory 等）；不锁 work 仓。
- **PASS**：`bash scripts/lock-verify.sh` 输出全绿；`touch ~/hermes-pro/src/main/index.ts` 失败（Operation not permitted）。
- **commits/tests**：2 commits / 0 vitest（验证靠 shell 脚本）。
- **回滚锚**：`chflags nouchg` 一条命令解锁；launchd unload。
- **人审节点**：(a)/(b) 裁决 + commit 批准。
- **执行者**：Codex 出提示词 → Claude Code 执行（在 work 仓写脚本，sync 时由你手动解锁→覆盖→重锁）。

### P0-2 灵魂批准 + 注入修复（H-2/H-3/H-5/H-7）

- **目标**：已批版灵魂真实进入所有 agent 的 system prompt stable tier，**零 Python 补丁**。
- **灵魂依据**：§1（第 0 步读灵魂）、§3（人批准生效）、§10（先验证依赖——upstream 覆盖风险已实证）。
- **入口**：`~/.hermes/SOUL.md`（load_soul_md 唯一读取的文件）；`src/main/soul-sync.ts`（新建，可选校验层）。
- **动作**：
  1. ~~逐条批 452 行~~ **已裁决走子集路径**（2026-06-10 用户批方向）：批准稿已抽好——`SOUL-INJECT-v5.5.1-subset-draft.md`（§1/§3/§4/§6/§10/§11/§12 + 修改规则，约 11.5KB / 147 行）。**你审读签字该稿即完成本步**；其余条款（序/§2/§5/§7/§8/需求链/身份设定）留候选，后续批一条并一条。
  2. **注入 = 内容同步**：备份现 4 行 SOUL.md → 把已批子集稿写入 `~/.hermes/SOUL.md`。手动 cp 一次性动作，你批。HERMES-SOUL.md 保持权威源不动。
  3. **实测 `_truncate_content` 阈值**（H-5）：子集版约 11.5KB / 147 行，大概率低于阈值，但仍须实测一次留证（注入后 system prompt 实际长度 vs 文件长度比对）。
  4. main 侧 `soul-sync.ts`：启动时比对 SOUL.md 与"已批子集稿登记 hash"，不一致→UI warning（不自动写）。状态记 app userData，**零 `~/.hermes/` 写**。
  5. 验证：重启 agent 后实测 system prompt 含"第十二条"标题字样且尾部修改规则完整（未被截断的证据）。
- **不做**：不 patch `prompt_builder.py` / `system_prompt.py`（upstream 覆盖风险）；不开 fork（维护成本不值——内容同步已达目的）；不在灵魂未批前注入候选文本。
- **PASS**：`diff <(md5 -q ~/.hermes/SOUL.md) <(md5 -q ~/.hermes/HERMES-SOUL.md)` 一致（或精简版 hash 登记在案）；agent 重启后 system prompt 实测含 §12 标题字样；truncation 阈值实测记录在案。
- **commits/tests**：1-2 commits（soul-sync.ts + 测试）/ +8-10 tests。
- **回滚锚**：恢复 4 行 SOUL.md 备份（cp 前先备份）。
- **人审节点**：灵魂逐条批（最重）+ cp 执行批 + commit 批。
- **执行者**：批灵魂=你；truncation 实测 + soul-sync.ts = Codex→Claude Code。

### P0-3 work 仓收口（ticker 已洗白）

- **目标**：p4-knowledge-loop 恢复 clean，P4 工作保全。
- **灵魂依据**：§6（干净真相态）、§4（可复现基线）。
- **入口**：`~/hermes-pro-work`；`src/main/playbook.ts`（151 行，**commit 前必须读全文**——S4 只有推断）。
- **动作**：① Claude Code 读 playbook.ts 全文出一段判定报告；② 你批 → `git checkout -b p4-knowledge-loop-wip-20260610` → add 全部 11 文件 → commit（消息注明"未审 WIP 快照"）；③ p4 分支回 clean。
- **不做**：不 merge main；不 push（除非你批）；不回滚丢弃任何 untracked。
- **PASS**：`git -C ~/hermes-pro-work status` clean；wip 分支 `git show --stat` 含 11 文件。
- **commits/tests**：1 / 0。
- **回滚锚**：wip 分支即快照，删分支即回滚。
- **人审节点**：playbook.ts 判定报告确认 + commit 批。

---

## Phase A：HCC 解锁链

> 每项完成时在 B1 九闸表登记证据（见 §附录一闸门映射）。

### A-1 GOV-006：HCC 任务交接 / 进度 / 危险动作策略（纯 slice）

> 来源：`HERMES-GOV-006-HCC-task-handoff-progress-danger-policy-plan.md`（2026-06-10，Codex 编制，本计划采纳并加 3 处修正）。**命名裁决**：GOV-006 归本 slice；brief G1.4 预留给 B1 评估的编号改为 GOV-007（见 A-5）。

- **目标**：HCC 协作规则机器可读化——三道任务结构（completed_baseline / in_progress / next_step）+ 四段进度记录 + 危险动作策略矩阵。**纯数据+校验，零 runtime。**
- **灵魂依据**：§4（last_successful_command 可复现 = 信任阶梯的机械化）、§3（危险动作人批，AI 不自批）、§6（单一 in_progress 锁）。
- **入口**：新建 `src/shared/lib/safety/hcc-task-handoff-policy.ts` + `tests/safety/hcc-task-handoff-policy.test.ts`（仅此两文件）。
- **动作**：
  1. 按源文档 §5 实现三个契约：`HCCTaskHandoffPlan`（in_progress 严格单任务；completed_baseline 必须 evidence refs；next_step 必须含输入条件+成功判据）、`HCCProgressRecord`（恰好四段：changed_this_round / last_successful_command / current_blocker / next_plan，next_plan 非空）、危险动作矩阵（delete_file / install_dependency / bulk_code_change → 一律 `requires_user_approval`，无 AI 自批路径）。
  2. **修正 ①（双分类法）**：加 `HCCStep.actionType` → danger 矩阵的显式映射表 + 完备性断言测试——禁止两套平行分类漂移。
  3. **修正 ②（版本化）**：两契约带 `schema_version` 字段，复用 LOOP P1-8/9 惯例。
  4. **修正 ③（进度记录↔信任阶梯）**：`last_successful_command` 旁挂可选 `trust_level` 字段（5 级 union），为 H-6 的阶梯断言铺路。
  5. 测试覆盖源文档 §6 全部 10 条（含"无任何策略允许自动执行"+"slice 不授权 runtime/daemon/cron/weixin/channel/live apply/Auto Executor"）。
- **不做**：不写真实 progress.md 文件（落盘版另批，源文档 §5.2 已声明）；不接 IPC / preload / renderer；不改 `.gitignore` / `package.json` / lock 文件；不装依赖。
- **PASS**：`npx vitest run tests/safety/hcc-task-handoff-policy.test.ts` 全绿 + `npm run typecheck` + `git diff --check` + 受保护文件 diff 为空 + `~/.hermes` mtime 三件未变（源文档 §7 命令照跑）。
- **commits/tests**：1-2 / +10-12。
- **回滚锚**：纯新增两文件，删之即回。
- **人审节点**：commit 批（执行本身无前置裁决——**这是当前唯一不被你三个未决问题阻塞的任务**）。
- **执行者**：源文档 §10 已有 GO prompt，补三处修正后即可发车。

### A-2 HumanApprovalRef 人闸门接线

- **目标**：`verified` 从结构性 false 变为**只能被人**置真——关 `user_authorization` 闸的核心证据。
- **灵魂依据**：§3 自证可信禁止、§6 反思不自确认。
- **入口**：`src/main/`（verifier adapter，复用 `1a5987f` 的 `verifyHumanApprovalRef`）；`src/preload/index.ts`（+1 IPC）；renderer 确认 UX（可先用 Inspector 内最小确认按钮，不等 UI Redesign）。
- **动作**：① main 侧 adapter：接收 renderer 确认事件（带 actor=human + 时间戳 + content_hash）→ 调 verifyHumanApprovalRef → 注入契约消费端；② preload 桥 1 条 channel（confirm UX 类，对照 Slice 红线登记）；③ 旁路测试：任何程序化路径置 true 必须 throw；④ audit-log 记录每次人批事件。
- **不做**：不开任何 AI 可达的置 true 路径；不接 live writer；renderer 改动最小化（非视觉 slice）。
- **PASS**：契约消费端 verified=true 仅人确认 fixture 可达；自盖章测试全 throw；audit-log 含人批记录。
- **commits/tests**：2-3 / +12。
- **回滚锚**：verified 默认 false 即天然回滚态；revert commits 即回。
- **人审节点**：IPC 新增批 + commit 批。

### A-3 closeout 勘误 + 文档对齐（H-8 + B-5 旧账）

- **目标**：消灭已知文档漂移——"物理锁启用"假常量、§8.1 vs 已落 commits 张力、LOCK.md 引用链。
- **灵魂依据**：§6 冲突即停、§8。
- **入口**：`docs/closeout/hermes-pro-local-reality-closeout-2026-06-07.md`（追加勘误段，不改原文）、`NEXT_STEP.md`、新建 `docs/plan/_errata-2026-06-10.md`。
- **动作**：① errata 文件集中登记 H-1~H-8 + 修复状态；② closeout 文件末尾追加"勘误指针"一行（指向 errata）；③ NEXT_STEP 追加同款指针。**只追加指针，不重写历史文档**。
- **不做**：不动两份 IMMUTABLE 文档；不重写 closeout 正文。
- **PASS**：errata 文件存在且 H-1~H-8 各有状态行；`git diff` 显示历史文档仅 +1 行指针。
- **commits/tests**：1 / 0。

### A-4 dry-run 010 受控 worktree（brief 中"待批"项）

- **目标**：HCC 在隔离 worktree 中跑完整 dry-run 链（计划→执行→验证→artifact），为 `hcc_auto_executor` 闸出最后一份 dry-run 证据。
- **灵魂依据**：§10 试点≠主线、§11.3。
- **入口**：`docs/p3-dry-run-baseline-2026-06-01.md` 010 段；HCC harness 既有 8 artifact；**A-1 的 handoff/progress 契约（010 即其首个消费者）**。
- **动作**：① 你批 010 启动；② 在 `~/hermes-pro-work` 的独立 worktree 跑（不碰 main 仓）；③ 本次 run 的任务结构用 `HCCTaskHandoffPlan` 表达、每轮产出 `HCCProgressRecord` fixture——验证契约在真实流程中可用；④ artifact 入 store + 报告；⑤ 失败按 §1 失败分类沉淀。
- **不做**：不启动 Auto Executor 常驻进程——010 是单次受控运行；不写 `~/.hermes/`。
- **PASS**：010 报告 + artifact hash 登记；tests/safety 基线不降。
- **commits/tests**：1-2 / +10-15（010 fixture）。
- **人审节点**：启动批 + 结果验收。

### A-5 GOV-007：B1 九闸评估 slice（原 brief 预留编号 GOV-006，因冲突改号）

- **目标**：把 `c9492be` 的 data-only 矩阵跑成一次正式 GO/NOT-GO 裁决——逐闸填证据。
- **灵魂依据**：§10、§4（每闸配可重跑验证命令）。
- **入口**：`src/shared/lib/safety/b1-runtime-readiness-matrix.ts`；新建 `docs/governance/b1-go-evaluation-2026-06.md`。
- **动作**：① 九闸逐项填实测证据（命令+输出）：backend_daemon / channel_runtime / cron_scheduling / weixin_ingress / gateway_ipc / hcc_auto_executor / user_authorization / no_hermes_writes / no_runtime_mutation；② `weixin_ingress` 预期 `not_applicable`（当前无该入口，B-6 旧 bug 的收窄结论）；③ `requires_user_authorization` 项列成你的批准清单；④ 产出 GO/NOT-GO + 残差。
- **不做**：不为关闸而降低闸门标准（§11.3）；evaluator 不自评 `reproduced`（§4——升级凭实测证据）。
- **PASS**：九闸全部有证据行 + 状态 ≠ blocked（或 blocked 项有明确归属 P 项）；你签 GO。
- **commits/tests**：1-2 / +5（评估 fixture）。

### A-6 HCC 首个真实闭环任务 → HCC-GO

- **目标**：用一个小、可回滚、低风险的真实任务（推荐：B-2 注册表空壳）走完 HCC v2 全链：Hermes 调度 → 你确认 → 双视角审计划 → Claude Code worktree 执行 → Codex 双审 → 交付 → 反思候选入 quarantine。
- **灵魂依据**：§10（试点通过才转正）、§11.2（learning loop 闭环）。
- **不做**：首任务不选任何动 IPC / 动 `~/.hermes/` / 动 renderer 视觉的任务。
- **PASS**：任务交付 + 全链 artifact 齐 + 反思候选产出（quarantine=true）+ 你验收。**此即 HCC-GO，Phase B 启动。**
- **回滚锚**：worktree 即沙箱，删之即回。
- **人审节点**：任务确认 + 交付验收 + （独立动作）Auto Executor 常驻授权——**注意：HCC-GO ≠ Auto Executor 常驻**。常驻自动执行仍是独立批（brief 红线），Phase B 可先以"每任务你点一次发车"模式跑。

---

## Phase B：HCC 执行期

> 全部任务由 HCC 链承载（调度/执行/双审自动，发车与验收在你）。每项沿用 Phase A 任务卡格式，HCC handoff pack 即任务卡载体。
> **车道裁决（2026-06-10 用户）**：HCC 底座 + 知识库是底座，做好前不碰其他。故 Phase B 分两车道：**车道一（知识库，HCC-GO 即开跑）**= B-1~B-4；**车道二（其余，HCC-STABLE 达成后开放）**= B-5/B-6。车道一的任务流本身就是 HCC-STABLE 的 5 任务计数来源——一边建知识库一边压测 HCC。

| # | 任务 | 车道 | 前置 | 单独批 | 预计 commits/tests | 一句话边界 |
|---|------|------|------|--------|--------------------|-----------|
| B-1 | 能力/领域注册表空壳（若未被 A-6 消耗） | 一·知识库 | 无 | 否 | 1 / +8 | 登记表+信任阶梯级+证据指针；无活线自动登记 |
| B-2 | 真实输入路径 scan gate（vault 导入 / 本地文件——仅已存在入口）+ H-6 阶梯断言补齐 | 一·知识库 | 无 | 否 | 2 / +15 | 微信/飞书/外链 gate 不建（入口不存在） |
| B-3 | Reflection Evaluator 活化（LOOP-008 → runtime read-only） | 一·知识库 | A-2 | **是** | 2 / +15 | 零写；forbidden-runtime scan 0 hits |
| B-4 | Live Reflection Writer（Hermes main 唯一）→ Live Flush | 一·知识库 | B-3 | **是，各一次** | 3-4 / +20 | writer 唯一性测试；flush 走 copy-deck 红线文案；Live Ranking 永远最后 |
| B-5 | UI Slice 8：KnowledgeControl 视觉收尾（inspector wiring + token 化——**不是新建屏**） | 二·HCC-STABLE 后 | UI Slice 0 批 | 否（spec 已批范围内） | 3 / +25 | renderer-only；零新 IPC；不调 knowledgeIngest |
| B-6 | Mano-P 正式放弃 ADR + agent-spaces license 审计（零代码） | 二·HCC-STABLE 后 | 无 | ADR 即批 | 1 / 0 | license 查明前零引入；ClawWork 挂 V5 解冻 |

**Phase B 排序逻辑**：车道一内 B-1/B-2 可并行喂 HCC（互不依赖的小任务，正好起量计数）；B-3→B-4 串行且每步你单独批——这条串行链就是"知识库做好"的主干：Evaluator 活化 → Writer 唯一 → Flush 上线 = 知识闭环从 dry-run 变真。车道二不占当前注意力。

> **Phase B 执行状态注记（2026-06-12 HCC-STATUS-SYNC-001）**：
> - B-1：✅ 已被 A-6 消耗（`capability-registry.ts`）。
> - B-2：✅ 已完成（`docs/closeout/b2-scan-gate-closeout-2026-06-11.md`）。
> - B-3：✅ 已完成（`docs/closeout/b3-evaluator-closeout-2026-06-11.md`）。
> - B-4：✅ 全部完成（2026-06-12）。拆为 B-4A（contract `6a33f6c`）、B-4B（writer impl `62b9bef`）、B-4C（approval gate preflight `b0e12a5` + impl `a15971f`）。B-4C apply path 仍未实现（future slice，separate approval）；Live Flush 未真实执行、未启用。
> - B-5/B-6：✅ 全部完成（2026-06-12）。B-5 KnowledgeControl cards `a5ab9f9` + B-6 Mano-P ADR + agent-spaces license audit `637775c`。Phase B 全链 B-1~B-6 8/8 complete。HCC-STABLE accepted（`b2db6a2`）。apply path / Auto Executor / Live Ranking mutation / Live Flush auto-apply 均未开放。每个后续任务仍需用户单独 GO。
> 本注记仅追加执行状态，不修改计划正文。

---

## 附录一：B1 九闸 ↔ P 项映射

| 闸 | 关闸证据来自 | 预期终态 |
|----|-------------|---------|
| no_hermes_writes | P0-1 真锁 + lock-verify.sh | ready |
| user_authorization | A-2 接线 + audit-log 人批记录 + **A-1 危险动作矩阵（无 AI 自批路径测试）** | ready（每任务仍需你批） |
| hcc_auto_executor | **A-1 handoff/progress/danger 契约** + A-4 dry-run 010 + A-6 首任务 | requires_user_authorization（常驻另批） |
| backend_daemon / channel_runtime / gateway_ipc | A-5 实测证据（gateway 已在跑，PID 2340） | ready / requires_separate_slice |
| cron_scheduling | A-5 实测（P7 4 个 cron 已 PASS） | ready |
| weixin_ingress | A-5 标 not_applicable（入口不存在） | not_applicable |
| no_runtime_mutation | P0-2 soul-sync 零写设计 + A-5 mtime 审计 + **A-1 测试第 10 条（slice 不授权 runtime）** | ready |

## 附录二：Codex 任务卡模板（Phase 0/A 用）

```markdown
# 任务卡 [P0-x / A-x]：<名称>
## 来源：docs/plan/02-execution-plan.md §<节>
## 灵魂约束：§<条款号列表>（违反即停）
## 红线（本任务专属）：<从计划"不做"栏复制>
## 输入事实：<指向 supplement/brief 精确节>
## 期望产出：<文件清单 + PASS 命令>
## 执行步骤：<Codex 在此细化为 Claude Code 可执行的逐步提示词>
## 审计划：<Codex 给出双视角审查点>
## 验证：<可独立重跑命令 + 期望输出>
## 收口：Preflight Report（Findings/Files/Boundary/Tests/Commit recommendation）
## 禁止：commit/push 未批；~/.hermes/ 写；runtime 启动；缩范围不报
```

## 附录三：本计划的人审清单

| 必须你做 | 时点 |
|---------|------|
| **GOV-006 commit 批（A-1，唯一无前置裁决任务）** | **现在即可** |
| 物理锁 (a)真锁/(b)降级 裁决 | P0-1 启动前 |
| 灵魂 v5.5.1 逐条批（或先批核心子集） | P0-2 第 1 步 |
| SOUL.md cp 执行批 | P0-2 第 2 步 |
| work 仓 wip 分支 commit 批 | P0-3 |
| dry-run 010 启动批 | A-4 |
| B1 GO 签字 | A-5 |
| HCC 首任务确认 + 验收 | A-6 |
| UI Slice 0 批（随时，一句话） | 任意 |
| B-3 / B-4 各单独批 | Phase B |
| Auto Executor 常驻授权 | 独立，无期限 |

## 附录五：未决问题（继承 + 新增）

1. ~~hermes-agent 审批通道~~ → S2 已答：upstream clone，不直改，走内容同步。
2. ~~灵魂 v5.5.1 批准状态~~ → **已裁决走子集路径**；剩余动作 = 你签 `SOUL-INJECT-v5.5.1-subset-draft.md`（签字前仍是 P0-2 阻塞）。
3. `~/.hermes/runtime/` 红线 → 已绕开（soul-sync 状态写 userData），作废。
4. ~~物理锁 (a)/(b)~~ → **已裁决 (a) 真锁**（watchdog 降 v2）。
5. ~~S17 赚钱形态比例~~ → **已裁决**：HCC 底座 + 知识库优先，做好前不开其他任务域。机械化为 HCC-STABLE 定义 + Phase B 双车道。S16 时长未答，但已不阻塞任何项（Phase 0+A 人时 ≈4-6 小时摊两周）。

## 附录四：本版相对 v2 的变更（可追溯）

1. 新增 Phase 0（H-1 物理锁、H-7 灵魂未批两个根问题升为前提）。
2. Soul loader 方案从"patch prompt_builder.py"改为"SOUL.md 内容同步"（S2 upstream 事实驱动，成本从 80 行+200 test 降到 ≈0 代码）。
3. 新增 truncation 阈值实测（H-5）。
4. ticker.ts license 疑虑撤销（S12 实测自写）。
5. 整体重排为"HCC 解锁链"——每个 P0/A 项对准一个 B1 闸（响应用户"尽快搭建 HCC、用 HCC 执行剩余"的需求，同时不跳过任何闸门，§11.3）。
6. Phase B 全部任务定义为 HCC handoff pack 可承载的小任务卡。
7. **v3.1**：织入 GOV-006 计划（handoff/progress/danger policy）为新 A-1 + 3 处修正（actionType 映射、schema_version、trust_level 挂钩 H-6）；B1 评估改号 GOV-007；Phase A 重编号为 6 项；GOV-006 标记为唯一可立即发车任务。
8. **v3.2（2026-06-10 三裁决）**：P0-1 落定 (a) 真锁、watchdog 降 v2；P0-2 落定子集路径、批准稿 `SOUL-INJECT-v5.5.1-subset-draft.md` 产出、H-5 风险随子集体积消解大半；新增 **HCC-STABLE** 可测量定义（"完美执行"的 §4/§12 翻译：连续 5 任务零违规 + 全链 artifact + 1 次回滚演练 + 零自确认）；Phase B 重排双车道（知识库车道 B-1~B-4 先行，UI/外部项目车道 HCC-STABLE 后开放）；H-6 归属随重排改为 B-2。

---

> 验证本计划自身：`grep -c "^### P0-" → 3`；`grep -c "^### A-" → 6`；Phase B 表 6 行；每个 P0/A 项含 PASS+回滚锚+人审节点。
> 修订记录：v3.1 2026-06-10（织入 GOV-006）；v3 2026-06-10；v2 = 上轮对话 B 节；v1 = docs/current-fusion-plan-2026-05-30.md。
