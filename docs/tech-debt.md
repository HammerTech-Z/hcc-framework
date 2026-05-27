## TD-SEC-001: API key renderer 暴露
- **来源**: 上游 2429cd5 的安全改进目标
- **问题**: Hermes Pro 当前将 apiKey 传递到 renderer 用于 SSH tunnel 配置
- **目标**: 实现等效安全改进，将 apiKey 保留在 main process，
  但不破坏 SSH tunnel 功能
- **方案**: 在 main process 做 key resolve，renderer 只拿 hasApiKey flag，
  SSH tunnel 建立时通过 IPC 调用 main process 传 key，不经 renderer
- **优先级**: P1(Sprint 1 Day 3 或 Sprint 2)
- **状态**: 待实施
