// TODO: verify translations
export default {
  title: "Monitor P4",
  subtitle: "Gateway · Tendências · Volante · Conhecimento · Eventos",
  loading: "Carregando monitor...",
  summary: {
    activeDays: "Dias ativos (14d)",
    sessions: "Sessões (14d)",
    messages: "Mensagens (14d)",
    gateway: "Gateway 8643",
    activeAgents: "Agentes ativos",
  },
  status: {
    online: "Online",
    offline: "Offline",
    down: "DOWN",
    active: "Ativo",
    failed: "Falhou",
    completed: "Concluído",
    running: "Executando",
    idle: "Ocioso",
  },
  time: {
    seconds: "{{count}}s",
    minutes: "{{count}}m",
    hours: "{{count}}h",
    days: "{{count}}d",
    updated: "Atualizado há {{time}}",
    today: "Hoje",
    yesterday: "Ontem",
  },
  charts: {
    sessionTrends: "📈 Tendências de sessões (14 dias)",
  },
  system: {
    title: "⚡ Status do sistema",
    gateway: "Gateway: {{state}}",
    pid: "(PID {{pid}})",
    health: "Saúde 8643",
  },
  flywheel: {
    title: "🔄 Volante do conhecimento",
    empty: "Sem histórico de cron",
  },
  knowledge: {
    title: "📥 Conhecimento recente",
    empty: "Sem conteúdo no vault",
  },
  events: {
    title: "📊 Eventos",
    empty: "Nenhum evento ainda",
  },
  execution: {
    title: "▶ Execução atual",
    noActive: "Nenhum playbook ativo",
    running: "Executando",
    completed: "Concluído",
    failed: "Falhou",
    elapsed: "Decorrido: {{time}}",
    step: "Passo {{current}} de {{total}}",
  },
} as const;
