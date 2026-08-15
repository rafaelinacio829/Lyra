export type IntegrationHealthRow = {
  provider: "zapi" | "meta" | "dify" | "erp_custom";
  name: string;
  status: "draft" | "verified" | "active" | "error" | "disabled";
  lastVerifiedAt: Date | null;
  lastError: string | null;
};

export function summarizeIntegrationHealth(rows: IntegrationHealthRow[]) {
  const errors = rows.filter(row => row.status === "error");
  const ready = rows.filter(row => row.status === "verified" || row.status === "active");
  const channelsReady = ready.filter(row => row.provider === "zapi" || row.provider === "meta");
  const waitingSetup = rows.filter(row => row.status === "draft");
  const signals: Array<{ id: string; tone: "healthy" | "warning" | "critical"; title: string; detail: string }> = [];
  if (errors.length) signals.push({ id: "integration-errors", tone: "critical", title: "Integração requer atenção", detail: `${errors.length} conexão(ões) registraram falha e precisam ser revisadas.` });
  if (!channelsReady.length) signals.push({ id: "channel-missing", tone: "warning", title: "Canal ainda não verificado", detail: "Conecte e valide a API oficial da Meta ou Z-API para receber conversas." });
  if (waitingSetup.length) signals.push({ id: "integration-drafts", tone: "warning", title: "Configurações em rascunho", detail: `${waitingSetup.length} integração(ões) ainda aguardam validação.` });
  if (!signals.length) signals.push({ id: "integrations-healthy", tone: "healthy", title: "Conexões monitoradas", detail: `${ready.length} integração(ões) estão verificadas para a operação.` });
  return { status: errors.length ? "attention" as const : channelsReady.length ? "healthy" as const : "setup" as const, total: rows.length, ready: ready.length, errors: errors.length, channelsReady: channelsReady.length, signals };
}
