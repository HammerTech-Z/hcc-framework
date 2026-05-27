# Hermes Pro Fork Policy

## 定位
Hermes Pro 自 2026-05-27 起正式独立于 fathah/hermes-desktop 维护。

## upstream remote 用途
- 监控上游安全公告
- 必要时逐案评估安全补丁
- **不做**版本同步、不做日常 merge

## 安全补丁处理流程
1. 监控上游 commit 历史,识别 security: 前缀
2. 逐个评估是否影响 Hermes Pro
3. cherry-pick 或手动实现等效保护
4. 预期成功率低(2026-05-27 cherry-pick 实战:5/19 = 26%)

## 不再做的事
- merge upstream/main
- 跟随上游版本号
- 接受上游产品方向(kanban/model-discovery 等)
