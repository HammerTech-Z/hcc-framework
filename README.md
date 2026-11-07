# HCC framework archive

此仓库保存 HCC 决策与契约框架的抽取历史。它是供阅读和复用的历史代码材料，不是可以直接启动的 Agent 应用，也不提供无人值守运行能力。

## 代码在哪里

默认 `main` 分支原先只有 LICENSE。实际抽取代码在 [hcc-extract 分支](https://github.com/HammerTech-Z/hcc-framework/tree/hcc-extract)，共 293 个文件（2026-11-07 检查）。

```bash
git clone --branch hcc-extract https://github.com/HammerTech-Z/hcc-framework.git
cd hcc-framework
npm install
npm test
npm run typecheck
```

## 当前可用程度

2026-11-07 在独立检出中实测：

- 类型检查报告 127 个错误，包含丢失的 safety 模块、路径别名及类型不兼容。
- 测试有 39 个文件通过、19 个文件失败；已收集的用例中 1017 个通过、31 个失败，另有测试因缺少模块或 fixture 无法收集。
- 部分测试仍引用未抽取的桌面应用 `src/main/index.ts` 和 fixture，因此当前快照不能兑现“安装后全部测试通过”。

这说明抽取不完整，不代表所有契约代码都无用。若要复用，应先补齐依赖和 fixture，完成独立测试；不能把单独的契约测试通过当成实际 Agent 执行能力。

LICENSE 及 hcc-extract 分支保留原样。本说明不改变既有权限或运行边界。
