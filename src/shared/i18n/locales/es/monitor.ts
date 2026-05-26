// TODO: verify translations
export default {
  title: "Monitor P4",
  subtitle: "Gateway · Tendencias · Volante · Conocimiento · Eventos",
  loading: "Cargando monitor...",
  summary: {
    activeDays: "Días activos (14d)",
    sessions: "Sesiones (14d)",
    messages: "Mensajes (14d)",
    gateway: "Gateway 8643",
    activeAgents: "Agentes activos",
  },
  status: {
    online: "En línea",
    offline: "Fuera de línea",
    down: "CAÍDO",
    active: "Activo",
    failed: "Falló",
    completed: "Completado",
    running: "Ejecutando",
    idle: "Inactivo",
  },
  time: {
    seconds: "{{count}}s",
    minutes: "{{count}}m",
    hours: "{{count}}h",
    days: "{{count}}d",
    updated: "Actualizado hace {{time}}",
    today: "Hoy",
    yesterday: "Ayer",
  },
  charts: {
    sessionTrends: "📈 Tendencias de sesiones (14 días)",
  },
  system: {
    title: "⚡ Estado del sistema",
    gateway: "Gateway: {{state}}",
    pid: "(PID {{pid}})",
    health: "Salud 8643",
  },
  flywheel: {
    title: "🔄 Volante de conocimiento",
    empty: "Sin historial de cron",
  },
  knowledge: {
    title: "📥 Conocimiento reciente",
    empty: "Sin contenido en vault",
  },
  events: {
    title: "📊 Eventos",
    empty: "Sin eventos aún",
  },
  execution: {
    title: "▶ Ejecución actual",
    noActive: "Sin playbook activo",
    running: "Ejecutando",
    completed: "Completado",
    failed: "Falló",
    elapsed: "Transcurrido: {{time}}",
    step: "Paso {{current}} de {{total}}",
  },
} as const;
