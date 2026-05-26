// TODO: verify translations
export default {
  title: "Servidores MCP",
  description: "Gerencie servidores Model Context Protocol para estender as capacidades do Hermes.",
  empty: "Nenhum servidor MCP configurado",
  cliNotFound: "Hermes CLI não encontrado. Por favor, instale primeiro.",

  type: {
    stdio: "stdio",
    http: "HTTP",
  },

  status: {
    enabled: "Habilitado",
    disabled: "Desabilitado",
    testing: "Testando...",
    testSuccess: "Conexão bem-sucedida",
    testFailed: "Falha na conexão",
  },

  actions: {
    add: "Adicionar servidor",
    remove: "Remover",
    test: "Testar conexão",
    confirmRemove: "Tem certeza que deseja remover \"{{name}}\"?",
  },

  form: {
    name: "Nome do servidor",
    namePlaceholder: "ex: meu-servidor-mcp",
    type: "Tipo de conexão",
    command: "Comando",
    commandPlaceholder: "ex: python3",
    args: "Argumentos",
    argsPlaceholder: "ex: /caminho/para/server.py",
    url: "URL do servidor",
    urlPlaceholder: "ex: http://localhost:8080",
    cancel: "Cancelar",
    save: "Salvar",
  },

  errors: {
    nameRequired: "O nome do servidor é obrigatório",
    nameInvalid: "O nome do servidor contém caracteres inválidos",
    commandRequired: "O comando é obrigatório para tipo stdio",
    urlRequired: "A URL é obrigatória para tipo HTTP",
    addFailed: "Falha ao adicionar servidor: {{error}}",
    removeFailed: "Falha ao remover servidor: {{error}}",
    toggleFailed: "Falha ao alternar estado: {{error}}",
    testFailed: "Falha no teste: {{error}}",
  },
} as const;
