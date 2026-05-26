# Confidence 设计规范

## 1. 基本定义

- **confidence** 表示“系统对 `suggested_playbook` 推荐的把握程度”
- 取值范围：`[0, 1]`，浮点数
- `0` = 完全不确定或无推荐
- `1` = 完全确定
- 存储位置：`UnderstandingResult.confidence`（可选字段，无推荐时省略）

## 2. Heuristic 模式计算规则

### 计算公式

```
confidence = matchedKeywords.length / rule.keywords.length
```

其中：
- `matchedKeywords` = 输入内容对当前规则所有关键词做 `lower.includes(kw)` 过滤后的命中集合
- `rule.keywords.length` = 该规则定义的关键词总数
- 第一命中的规则胜出（`PLAYBOOK_RULES` 顺序遍历，优先返回）
- 若无任何规则命中：`confidence = 0`

### 当前 PLAYBOOK_RULES 注册表

| 规则 ID | name | 关键词 | 关键词数量 |
|---------|------|-------|-----------|
| `code_dev` | `code_dev_keyword_match` | code, function, class, typescript, javascript, react | 6 |
| `manga_industrial` | `manga_keyword_match` | manga, animation, video, asset, sprite | 5 |

### 示例

| 输入 | 命中规则 | 命中关键词 | confidence |
|------|---------|-----------|-----------|
| `"I need to write a TypeScript function"` | code_dev | typescript, function | 2/6 ≈ 0.333 |
| `"react and typescript code"` | code_dev | react, typescript, code | 3/6 = 0.500 |
| `"code function class typescript javascript react"` | code_dev | 全部 6 个 | 6/6 = 1.000 |
| `"this manga animation needs new sprites"` | manga_industrial | manga, animation, sprite | 3/5 = 0.600 |
| `"the weather is nice today"` | —（无命中） | — | 0 |

## 3. LLM 模式计算规则

### Prompt 模板（向 Ollama 发送）

```
分析以下用户输入，推荐最合适的 playbook。
返回 JSON 格式：
{"suggested_playbook": "playbook_id 或 null","confidence": 0.0-1.0 之间的浮点数,"reasoning": "用一两句话说明推荐理由"}

用户输入：${truncated_input}
```

- 输入截断：前 1000 字符（`recommendPlaybookLlm` 内 `content.slice(0, 1000)`），其中 prompt 体再截断到 500 字符
- prompt 中未预定义 playbook 列表，LLM 自行推断可用的 playbook_id
- 模型：`llama3.2`，通过 `execSync` 调用，15 秒超时

### 结果提取逻辑

```
LLM raw output → 正则 /{[\s\S]*}/ 提取第一个 JSON 对象
  → JSON.parse()
  → confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0))
```

- 若 LLM 返回的 confidence 超出 [0,1] 范围，夹紧到边界
- 若 LLM 未返回 confidence 字段，默认 `0`
- 若 JSON 解析失败 → `confidence = 0, reasoning = "LLM 不可用或返回解析失败"`
- 若 `execSync` 抛出异常（Ollama 未安装/超时）→ 同上

### CLI 调用形式

```
ollama run llama3.2 ${JSON.stringify(ollamaPrompt)} 2>&1 | head -10
```

## 4. 两种模式的可比性问题

### 核心声明

**heuristic 0.8 ≠ LLM 0.8，两者语义不同，不可直接比较。**

| 维度 | Heuristic | LLM |
|------|-----------|-----|
| 定义 | 关键词覆盖率 = 命中数 / 总关键词数 | 模型自评信心 |
| 量纲 | 有界、可复现、无歧义 | 无标准化、依赖模型、不稳定 |
| 0.8 的含义 | "80% 的关键词触发了该规则" | "模型对自己推荐有 80% 把握" |
| 影响因素 | 输入长度、关键词分布、大小写 | 模型版本、prompt 措辞、温度参数 |

### 当前的 fallback 逻辑

```
if (heuristic 无推荐 || heuristic.confidence < 0.3):
    调用 LLM fallback
    if (LLM 有推荐 || LLM.confidence > heuristic.confidence):
        采纳 LLM 结果
```

- **0.3 阈值**：当前为硬编码，无数据支撑。来源猜测：允许 heuristic 至少命中 2/6 或 2/5 的关键词才被视为可靠，低于此值时值得用 LLM 再试一次。
- **LLM 覆盖判定**：即使 LLM confidence 较低（如 0.1），只要 LLM 有推荐（`playbook !== null`）就覆盖 heuristic。这意味着 LLM 的推荐优先级高于 heuristic，不论 confidence 高低。
- **⚠️ 问题**：由于两种模式 confidence 不可比，`llmSuggestion.confidence > suggestion.confidence` 这个比较在语义上无效。当前仅实现了机械的大小比较，未做跨模式校准。

### 双失败回退

当两种模式都返回 `null` 且 `confidence = 0` 时，最终置为：
```
{ playbook: null, confidence: 0, reasoning: "无匹配规则且 LLM 不可用" }
```

## 5. Auto-trigger 阈值（V2.4 预设计）

### 建议阈值

| 模式 | 建议 auto-trigger 阈值 | 说明 |
|------|----------------------|------|
| Heuristic | `≥ 0.7` | 命中至少 5/6（code_dev）或 4/5（manga_industrial）关键词 |
| LLM | `≥ 0.8` | LLM 自评信心较高时才自动触发 |

### 配置要求

- 阈值必须可配置，通过 Settings UI 或 `~/.hermes/config.yaml`
- 配置项示例：
  ```yaml
  playbook_auto_trigger:
    enabled: true
    heuristic_threshold: 0.7
    llm_threshold: 0.8
  ```

### 白名单机制

- 只有用户明确允许的 playbook 才能 auto-trigger
- 格式：`auto_trigger_whitelist: ["code_dev"]`
- 不在白名单内的 playbook 即使 confidence 达标也不自动执行

### 安全门

- **HCC 阶段 1–4 的 playbook 永远不 auto-trigger**
- 这些阶段涉及物理环境操作（设备连接、网络配置、系统级变更），必须用户手动确认
- 判断方式：playbook 的 `steps` 中任意 step 的 `hccStage` 匹配 `stage_[1-4]_*`

## 6. 未来校准方向（不做，只记录）

### confidence → 成功率回测
- 积累 `pipeline-runs/` 下 run-metadata.json 数据后，可以回测 confidence 与实际步骤执行成功率的相关性
- 检验假设：高 confidence 推荐是否确实产生更高的 `finalStatus === "success"` 比例

### Heuristic → LLM 可比化
- 可以对 heuristic 的离散 confidence 值做 Platt scaling（逻辑回归校准），使其概率值接近 LLM 的置信度输出
- 或反过来：将 LLM confidence 离散化到 heuristic 的粒度的等价区间

### 数据收集建议
- 每条 `understand-anything` 调用记录：输入 hash、heuristic_confidence、LLM_confidence、最终采纳模式、用户是否手动触发 playbook
- 用于后续训练校准模型或调整阈值

这些是 V3+ 的工作。

---

- 版本：v1.0
- 创建日期：2026-05-26
- 关联代码：`src/main/playbook-runner.ts`（`suggestPlaybookHeuristic`、`recommendPlaybookLlm`、`understandAnything` 中的阈值逻辑）
- 下游消费者：V2.4 auto-trigger、V3 知识可视化
