export default {
  title: "MCP Servers",
  description: "Manage Model Context Protocol servers for extending Hermes capabilities.",
  empty: "No MCP servers configured",
  cliNotFound: "Hermes CLI not found. Please install it first.",

  type: {
    stdio: "stdio",
    http: "HTTP",
  },

  status: {
    enabled: "Enabled",
    disabled: "Disabled",
    testing: "Testing...",
    testSuccess: "Connection successful",
    testFailed: "Connection failed",
  },

  actions: {
    add: "Add Server",
    remove: "Remove",
    test: "Test Connection",
    confirmRemove: 'Are you sure you want to remove "{{name}}"?',
  },

  form: {
    name: "Server Name",
    namePlaceholder: "e.g. my-mcp-server",
    type: "Connection Type",
    command: "Command",
    commandPlaceholder: "e.g. python3",
    args: "Arguments",
    argsPlaceholder: "e.g. /path/to/server.py",
    url: "Server URL",
    urlPlaceholder: "e.g. http://localhost:8080",
    cancel: "Cancel",
    save: "Save",
  },

  errors: {
    nameRequired: "Server name is required",
    nameInvalid: "Server name contains invalid characters",
    commandRequired: "Command is required for stdio type",
    urlRequired: "URL is required for HTTP type",
    addFailed: "Failed to add server: {{error}}",
    removeFailed: "Failed to remove server: {{error}}",
    toggleFailed: "Failed to toggle server: {{error}}",
    testFailed: "Test failed: {{error}}",
  },
} as const;
