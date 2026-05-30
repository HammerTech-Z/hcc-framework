# V7 生态工具融合

> 版本：V7
> 继承自：原 V4 生态融合任务
> 状态：待启动
> 锁定：本文档是锁定路线图的一部分，变更需 ADR + 用户确认

---

## 核心目标

**让 Hermes Pro 具备外部工具操作、多 worker 调度和高级记忆算法能力。**

原 V4 计划（CLI-Anything / Ruflo / Mano-P / OpenHuman / Daily Digest）因各种原因未能在 2026-05-27 完成现状调查后实施。全部迁移到 V7，等前置条件满足后再推进。

---

## 任务列表

### V7-1: CLI-Anything

|| 项目 | 内容 |
|------|------|
| **原计划目标** | 集成 CLI-Anything，实现 Safari MCP 操作 |
| **当前状态** | ✅ **MVP PASS** — safari-mcp 已接入 Hermes，smoke test 通过 |
| **阻塞原因** | ~~Python 3.14 TLS~~ ✅ 已解除（python3.14 OpenSSL 3.6.2）；Safari 需打开 + Safari 设置需勾"允许来自 Apple 事件中的 JavaScript" |
| **前置条件** | ~~暂缓，需等 Python TLS 问题解决~~ ✅ **MVP PASS 已达成** |
| **是否保留** | 保留 |
| **可达性判断** | ✅ MVP 已达成 — safari-mcp 已安装，配置到 Hermes，smoke test PASS |
| **验收标准** | 1. `safari-mcp` 已注册到 Hermes 2. Hermes Pro 可操作 Safari ✅ PASS |

---

### V7-2: Ruflo loop-workers

| 项目 | 内容 |
|------|------|
| **原计划目标** | 替代 Hermes cron，实现多 worker 调度 |
| **当前状态** | ❌ 未接入 |
| **阻塞原因** | Hermes jobs 问题在业务层（DeepSeek 401 + WeChat rate limit），不在调度层。Ruflo 无法解决业务层问题 |
| **前置条件** | 1. Hermes cron 问题解决后重新评估 2. 或 ruflo 生态有重大更新 |
| **是否保留** | 降级保留，不作为 V7 主线 |
| **可达性判断** | 暂缓，当前 Hermes cron 问题不在调度层，无需替代 |
| **验收标准** | 1. Ruflo 可管理 Hermes jobs 2. loop-workers 接入 Hermes cron |

---

### V7-3: Mano-P

| 项目 | 内容 |
|------|------|
| **原计划目标** | 本地模型训练/微调，支持 AI 操作 Mac |
| **当前状态** | ⏸️ **硬件不匹配，降级为候选** |
| **本机配置** | MacBook Air M5，16GB RAM |
| **Mano-P 前置要求** | Apple M4+，32GB RAM |
| **结论** | 芯片满足（M5 ≥ M4），内存不满足（16GB < 32GB）；不作为 V7 主线 |
| **保留条件** | 硬件升级到 32GB、Mano-P 计算棒可用、或云端服务可验证后再评估 |
| **是否保留** | 降级保留，不进入 V7 主线核心依赖 |
| **可达性判断** | 暂缓，等硬件升级或云端方案确认 |

---

### V7-4: OpenHuman Memory Tree

| 项目 | 内容 |
|------|------|
| **原计划目标** | 实现 Memory Tree 高级记忆算法 |
| **当前状态** | ❏ 未启动 |
| **阻塞原因** | 从未进入实施，无代码、无设计文档 |
| **前置条件** | 1. Memory Tree 设计定义 2. 与 GBrain 的关系明确 |
| **是否保留** | 保留，但需先完成设计定义 |
| **可达性判断** | 暂缓，需先完成设计定义 |
| **验收标准** | 1. Memory Tree 算法实现 2. 与 GBrain 集成完成 |

---

### V7-5: 每日知识摘要自动推送

|| 项目 | 内容 |
|------|------|
| **原计划目标** | 每日自动生成知识摘要推送到 WeChat |
| **当前状态** | **🔗 已从 V7 主线解绑** → 归入独立 Delivery/Reliability 任务池 |
| **阻塞原因** | WeChat/iLink delivery 受 rate limit 阻塞（账号 o9cq80-y） |
| **ADR** | [docs/adr/ADR-20260530-v7-5-delivery-unbind.md](./adr/ADR-20260530-v7-5-delivery-unbind.md) |
| **新归属** | Delivery/Reliability 独立任务池，不再阻塞 V7 主线 |
| **是否保留** | 保留（每日摘要功能不取消，只改变归属） |
| **可达性判断** | 待 WeChat/iLink rate limit 诊断解决后恢复 |
| **验收标准** | 1. 每日摘要自动生成 2. 成功推送到用户（不依赖 V7 生态工具进展） |

---

## V7 任务优先级建议

| 优先级 | 任务 | 可达性 | 原因 |
|--------|------|--------|------|
| P1 | V7-1 CLI-Anything | ✅ MVP PASS | Safari MCP 已接入 Hermes，smoke test PASS |
| P2 | V7-2 Ruflo loop-workers | 暂缓 | 当前无需替代 |
| P3 | V7-3 Mano-P | **候选暂缓** | 硬件不匹配（16GB < 32GB），降级为候选 |
| P4 | V7-4 OpenHuman Memory Tree | 暂缓 | 需设计定义 |
| P5 | V7-5 每日知识摘要 | 暂缓 | iLink rate limit 阻塞 |

**注意**：V7 全部任务当前都是"暂缓"，没有"现在可做"的项。这符合实际情况，不是问题。

---

## 替代候选（小节）

GUI-VLA 方向（Mano-P 的替代方案）进入候选池，不直接进入 V7 主线。需单独试点验证后才能进入锁定路线图。

### UI-TARS Desktop

| 项目 | 内容 |
|------|------|
| **定位** | 优先候选，适合 App/操作层 + 云端/API VLM |
| **本地适配** | 本机 M5 16GB 可轻松承担 GUI 控制、截图、浏览器操作（使用云端 VLM API） |
| **不推荐** | 不建议本机硬跑 UI-TARS 7B 全量模型；16GB 只适合轻量/量化试验 |
| **状态** | 候选试点，不入主线 |
| **试点条件** | 1. 验证云端 VLM API 可用 2. 验证 GUI 控制能力 3. ADR + 用户确认后才能入主线 |

### OpenAdapt

| 项目 | 内容 |
|------|------|
| **定位** | 桌面自动化/RPA 候选 |
| **本地适配** | 通用桌面自动化工具 |
| **状态** | 候选试点 |
| **试点条件** | ADR + 用户确认后才能入主线 |

### browser-use

|| 项目 | 内容 |
|------|------|
| **定位** | 浏览器自动化候选，不覆盖完整桌面 GUI |
| **本地适配** | 适合 Web 自动化任务 |
| **状态** | **DEFER** — 评估完成，等待 Safari MCP 验证后再评估必要性 |
| **推荐理由** | browser-use-sdk 云端 API 是默认（需 API key）；Chrome + Playwright 额外依赖；Safari MCP 已满足浏览器控制需求 |
| **DEFER 条件** | Safari MCP 自然运行验证后 + 用户有明确非 Safari 需求 + 云端 API 成本可控 |
| **试点条件** | ADR + 用户确认后才能入主线 |

---

## 原V4调查结论保留

2026-05-27 现状调查结果保留，不删除：

| 项目 | 结论 |
|------|------|
| CLI-Anything | Safari harness 受 Python 3.14 TLS 问题阻塞。官方入口真实存在且高度活跃（HKUDS/CLI-Anything，40,643 stars） |
| Ruflo loop-workers | 本地零痕迹，Hermes jobs 问题在业务层，不需要替代 |
| Mano-P | 硬件不匹配：芯片满足（M5 ≥ M4），内存不满足（16GB < 32GB），降级为候选 |

---

## 锁定规则

V7 是锁定路线图的一部分。
- 任务只增不减，除非用户明确批准。
- 替代候选进入主线需经过 ADR + 用户确认。
- 当前没有"现在可做"的任务是正常状态，不代表放弃。
- 每年至少重新评估一次 V7 前置条件是否满足。