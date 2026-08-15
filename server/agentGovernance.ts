export type AgentAuditEvent = { action: string; createdAt: Date; actorName: string | null };

const labels: Record<string, string> = {
  "agent.created": "Rascunho criado",
  "agent.preset_installed": "Modelo de teste instalado",
  "agent.profile_updated": "Perfil e instruções atualizados",
  "agent.provider_configured": "Conexão do provedor atualizada",
  "agent.provider_tested": "Conexão validada",
  "agent.activation_updated": "Status operacional alterado",
  "agent.fallback_updated": "Fallback atualizado",
};

export function presentAgentAudit(event: AgentAuditEvent) {
  return { ...event, label: labels[event.action] ?? "Alteração de governança", actor: event.actorName || "Administrador do tenant" };
}
