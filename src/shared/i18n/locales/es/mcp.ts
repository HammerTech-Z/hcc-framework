// TODO: verify translations
export default {
  title: "Servidores MCP",
  description: "Administra servidores Model Context Protocol para extender las capacidades de Hermes.",
  empty: "No hay servidores MCP configurados",
  cliNotFound: "Hermes CLI no encontrado. Por favor, instálalo primero.",

  type: {
    stdio: "stdio",
    http: "HTTP",
  },

  status: {
    enabled: "Habilitado",
    disabled: "Deshabilitado",
    testing: "Probando...",
    testSuccess: "Conexión exitosa",
    testFailed: "Conexión fallida",
  },

  actions: {
    add: "Agregar servidor",
    remove: "Eliminar",
    test: "Probar conexión",
    confirmRemove: "¿Estás seguro de que deseas eliminar \"{{name}}\"?",
  },

  form: {
    name: "Nombre del servidor",
    namePlaceholder: "ej: mi-servidor-mcp",
    type: "Tipo de conexión",
    command: "Comando",
    commandPlaceholder: "ej: python3",
    args: "Argumentos",
    argsPlaceholder: "ej: /ruta/al/server.py",
    url: "URL del servidor",
    urlPlaceholder: "ej: http://localhost:8080",
    cancel: "Cancelar",
    save: "Guardar",
  },

  errors: {
    nameRequired: "El nombre del servidor es obligatorio",
    nameInvalid: "El nombre del servidor contiene caracteres no válidos",
    commandRequired: "El comando es obligatorio para tipo stdio",
    urlRequired: "La URL es obligatoria para tipo HTTP",
    addFailed: "Error al agregar servidor: {{error}}",
    removeFailed: "Error al eliminar servidor: {{error}}",
    toggleFailed: "Error al cambiar estado: {{error}}",
    testFailed: "Prueba fallida: {{error}}",
  },
} as const;
