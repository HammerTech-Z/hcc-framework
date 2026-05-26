export default {
  title: "MCP 服务器",
  description: "管理 Model Context Protocol 服务器，扩展 Hermes 能力。",
  empty: "尚未配置 MCP 服务器",
  cliNotFound: "未找到 Hermes CLI，请先安装。",

  type: {
    stdio: "标准输入输出",
    http: "HTTP",
  },

  status: {
    enabled: "已启用",
    disabled: "已禁用",
    testing: "测试中...",
    testSuccess: "连接成功",
    testFailed: "连接失败",
  },

  actions: {
    add: "添加服务器",
    remove: "删除",
    test: "测试连接",
    confirmRemove: "确定要删除 \"{{name}}\" 吗？",
  },

  form: {
    name: "服务器名称",
    namePlaceholder: "例如：my-mcp-server",
    type: "连接类型",
    command: "命令",
    commandPlaceholder: "例如：python3",
    args: "参数",
    argsPlaceholder: "例如：/path/to/server.py",
    url: "服务器 URL",
    urlPlaceholder: "例如：http://localhost:8080",
    cancel: "取消",
    save: "保存",
  },

  errors: {
    nameRequired: "请输入服务器名称",
    nameInvalid: "服务器名称包含非法字符",
    commandRequired: "stdio 类型需要指定命令",
    urlRequired: "HTTP 类型需要指定 URL",
    addFailed: "添加服务器失败：{{error}}",
    removeFailed: "删除服务器失败：{{error}}",
    toggleFailed: "切换状态失败：{{error}}",
    testFailed: "测试失败：{{error}}",
  },
} as const;
