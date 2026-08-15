export type OperationalAlertInput = { unassignedConversations: number; slaRiskConversations: number; trialEndsAt?: Date | null; now?: Date };
export type PreparedOperationalAlert = { kind: "unassigned" | "sla" | "trial"; subject: string; body: string };
export type WeeklySummaryInput = { tenantName: string; receivedMessages: number; resolvedConversations: number; awaitingHuman: number; firstResponseMinutes: number | null };

export function prepareOperationalAlerts(input: OperationalAlertInput): PreparedOperationalAlert[] {
  const now = input.now ?? new Date(); const alerts: PreparedOperationalAlert[] = [];
  if (input.unassignedConversations > 0) alerts.push({ kind: "unassigned", subject: "Lyra: conversas sem atendente", body: `${input.unassignedConversations} conversa(s) humana(s) aguardam responsável.` });
  if (input.slaRiskConversations > 0) alerts.push({ kind: "sla", subject: "Lyra: risco de SLA", body: `${input.slaRiskConversations} conversa(s) humana(s) estão sem primeira resposta há mais de 20 minutos.` });
  if (input.trialEndsAt && input.trialEndsAt.getTime() > now.getTime() && input.trialEndsAt.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000) alerts.push({ kind: "trial", subject: "Lyra: fim do período de teste", body: `O trial termina em ${input.trialEndsAt.toLocaleDateString("pt-BR")}.` });
  return alerts;
}

export function prepareWeeklySummary(input: WeeklySummaryInput): { subject: string; body: string } {
  const response = input.firstResponseMinutes === null ? "não disponível" : `${Math.round(input.firstResponseMinutes)} min`;
  return { subject: `Lyra: resumo semanal de ${input.tenantName}`, body: `Resumo operacional de ${input.tenantName}: ${input.receivedMessages} mensagem(ns) recebida(s), ${input.resolvedConversations} conversa(s) resolvida(s), ${input.awaitingHuman} conversa(s) aguardando atendimento humano e primeira resposta média de ${response}.` };
}

export async function deliverOperationalEmail(input: { to: string; alert: PreparedOperationalAlert | { subject: string; body: string } }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return { delivered: false as const, reason: "email_provider_not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: input.to, subject: input.alert.subject, text: input.alert.body }) });
  if (!response.ok) return { delivered: false as const, reason: "provider_rejected_request" as const };
  return { delivered: true as const };
}
