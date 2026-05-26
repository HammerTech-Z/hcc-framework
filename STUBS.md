# hermes-pro 存根追踪

**状态**：技术债，等 P2 完成后的 GA 阶段实装

---

## 1. lib/sounds.ts

位置：`src/renderer/src/lib/sounds.ts`

当前导出（全部 no-op）：
```ts
export type SoundEvent = 'agent-spawned' | 'agent-complete' | ... | 'alert' | 'thinking'
export const getSoundVolume = (_event?: SoundEvent): number => 1.0
export const isSoundEnabled = (_event?: SoundEvent): boolean => true
export const playSound = (_event: SoundEvent): void => {}
export const playAgentSpawned = (): void => {}
export const playAgentComplete = (): void => {}
export const playAgentFailed = (): void => {}
export const playChatNotification = (): void => {}
export const playChatComplete = (): void => {}
export const playAlert = (): void => {}
export const playThinking = (): void => {}
export const setSoundVolume = (_event: SoundEvent, _volume: number): void => {}
```

**待实装**：
- [ ] 接入 Web Audio API
- [ ] 音量配置持久化
- [ ] per-event 音量支持

---

## 2. stores/agent-swarm-store.ts

位置：`src/renderer/src/stores/agent-swarm-store.ts`

当前导出（全部 no-op）：
```ts
export type SwarmSession = {
  id?: string; key?: string; friendlyId?: string;
  swarmStatus: 'idle' | 'running' | 'thinking' | 'complete' | 'failed'
}
export function useSwarmStore<T = SwarmStoreState>(selector?: ...): T
```

**待实装**：
- [ ] 全局 swarm 状态（sessions 数组）
- [ ] addSession / removeSession
- [ ] 与 gateway polling 集成

---

## 3. stores/chat-activity-store.ts

位置：`src/renderer/src/stores/chat-activity-store.ts`

当前导出（全部 no-op）：
```ts
export type AgentActivity = 'idle' | 'reading' | 'thinking' | 'responding' | 'tool-use' | 'orchestrating'
export function useChatActivityStore<T = ChatActivityStoreState>(selector?: ...): T
```

**待实装**：
- [ ] activity 状态变更通知 sound system
- [ ] gateway polling start/stop
- [ ] 运行时消耗指标（tokenCount / cost）聚合

---

## ActiveAgent 类型设计说明

```ts
// 必填：所有 ActiveAgent 实例构造时必有
id: string
name: string
tokenCount: number   // 初始 0
isLive: boolean       // 初始 false

// 可选（AgentTask 语义）：Agent 实例化后可能缺失
task?: string
model?: string
cost?: number
startedAtMs?: number
progress?: number
estimatedCost?: number
isMain?: boolean   // 初始 false（queued nodes 用）
```

**为什么这些字段是可选的**：
- `task`/`model`/`cost`：queued 或刚创建的 agent 尚未分配任务
- `isMain`：历史 agent 没有 main/branch 语义

**全部用 `??` 兜底**：`agent-view-panel.tsx` 里所有这些字段访问都有 `?? ''` 或 `?? 0` 保护，运行时不会 crash。
