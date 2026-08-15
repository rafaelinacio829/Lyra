import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, Bot, Boxes, ChevronDown, CircleGauge, Loader2, MessageSquareText, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

function useSelectedTenant() {
  const tenants = trpc.tenant.mine.useQuery();
  const [tenantId, setTenantId] = useState<number | null>(null);
  useEffect(() => { if (!tenantId && tenants.data?.[0]) setTenantId(tenants.data[0].id); }, [tenantId, tenants.data]);
  return { tenants, tenantId, setTenantId };
}

function usagePercent(value: number, limit?: number) { return limit ? Math.min(100, Math.round((value / limit) * 100)) : 0; }

export default function WorkspaceHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { tenants, tenantId, setTenantId } = useSelectedTenant();
  const overview = trpc.tenant.overview.useQuery({ tenantId: tenantId ?? 0 }, { enabled: !!tenantId });
  const activeTenant = useMemo(() => tenants.data?.find(tenant => tenant.id === tenantId), [tenantId, tenants.data]);

  if (tenants.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;
  if (!tenants.data?.length) return <EmptyWorkspace onCreate={() => setLocation("/onboarding")} />;
  if (!overview.data || !activeTenant) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;

  const { subscription, usage, activeMembers, queueCounts, alerts } = overview.data;
  const plan = subscription;
  const metrics = [
    { label: "Conversas no período", value: usage.conversations, limit: plan?.includedConversations, icon: MessageSquareText, tone: "bg-[#e8f4f5] text-[#477d84]" },
    { label: "Mensagens no período", value: usage.messages, limit: plan?.includedMessages, icon: CircleGauge, tone: "bg-[#f2eefc] text-[#7661b5]" },
    { label: "Membros ativos", value: activeMembers, limit: plan?.includedMembers, icon: UsersRound, tone: "bg-[#f3f5df] text-[#738242]" },
    { label: "Agentes ativos", value: usage.activeAgents, limit: plan?.includedAgents, icon: Bot, tone: "bg-[#fceddf] text-[#a57144]" },
  ];

  return <div className="mx-auto max-w-7xl space-y-7 p-2 sm:p-5"><section className="flex flex-col justify-between gap-4 rounded-[1.75rem] bg-[#18333f] p-6 text-white shadow-[0_18px_45px_rgba(24,51,63,0.14)] sm:flex-row sm:items-end sm:p-8"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#c4ed83]">Centro de operação</p><h1 className="mt-3 font-display text-4xl tracking-[-.035em]">Olá, {user?.name?.split(" ")[0] || "gestor"}.</h1><p className="mt-2 text-sm text-[#bdcbd0]">Acompanhe a operação da sua empresa e mantenha o atendimento em movimento.</p></div><div className="relative"><select value={tenantId ?? ""} onChange={event => setTenantId(Number(event.target.value))} className="h-10 appearance-none rounded-xl border border-white/15 bg-white/10 px-4 pr-10 text-sm font-semibold text-white outline-none"><option className="text-slate-900" value="">Selecione empresa</option>{tenants.data.map(tenant => <option className="text-slate-900" key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white" /></div></section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <Card key={metric.label} className="border-[#e0e8e3] shadow-none"><CardContent className="p-5"><div className="flex items-center justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl ${metric.tone}`}><metric.icon className="h-5 w-5" /></div><span className="text-xs font-semibold text-[#718189]">{metric.limit?.toLocaleString("pt-BR")} incluídos</span></div><p className="mt-5 font-display text-3xl text-[#223b47]">{metric.value.toLocaleString("pt-BR")}</p><p className="mt-1 text-sm text-[#6f7d84]">{metric.label}</p><Progress value={usagePercent(metric.value, metric.limit)} className="mt-4 h-1.5 bg-[#edf1ee]" /></CardContent></Card>)}</section>
    <section className="grid gap-5 lg:grid-cols-[1.45fr_.85fr]"><Card className="border-[#e0e8e3] shadow-none"><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6a947f]">Filas em tempo real</p><h2 className="mt-2 font-display text-3xl text-[#213b47]">A operação está sob controle.</h2></div><Badge className="rounded-full bg-[#e9f5e2] px-3 py-1 text-[#4f815b] hover:bg-[#e9f5e2]">Atualizado agora</Badge></div><div className="mt-7 grid gap-3 sm:grid-cols-3">{[[String(queueCounts.ai), "Agente IA", "Respostas automáticas e handoff"],[String(queueCounts.human), "Atendente", "Aguardando ou em atendimento"],[String(queueCounts.resolved), "Resolvidas", "Histórico concluído no tenant"]].map(([value,title,body]) => <div key={title} className="rounded-2xl bg-[#f7faf8] p-4"><span className="font-display text-3xl italic text-[#79a18c]">{value}</span><p className="mt-4 text-sm font-bold text-[#304854]">{title}</p><p className="mt-1 text-xs leading-5 text-[#77858a]">{body}</p></div>)}</div><Button onClick={() => setLocation("/app/conversations")} className="mt-6 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">Abrir conversas <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>
      <Card className="border-[#e0e8e3] shadow-none"><CardContent className="p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff1d7]"><AlertTriangle className="h-5 w-5 text-[#a97a3d]" /></div><div><p className="font-bold text-[#304854]">Cobertura do plano</p><p className="text-xs text-[#77858a]">{plan?.planName || "Plano em configuração"}</p></div></div><div className="mt-6 space-y-4"><UsageLine label="Armazenamento" value={`${Math.round(usage.storageBytes / 1024 / 1024)} MB`} limit={`${plan?.includedStorageMb || 0} MB`} percent={usagePercent(Math.round(usage.storageBytes / 1024 / 1024), plan?.includedStorageMb)} /><UsageLine label="Integrações" value={String(usage.activeIntegrations)} limit={String(plan?.includedIntegrations || 0)} percent={usagePercent(usage.activeIntegrations, plan?.includedIntegrations)} /><UsageLine label="Período do trial" value="Ativo" limit={plan?.currentPeriodEndsAt ? new Date(plan.currentPeriodEndsAt).toLocaleDateString("pt-BR") : "—"} percent={42} /></div><Button variant="outline" onClick={() => setLocation("/app/billing")} className="mt-6 w-full rounded-full border-[#d7e3dc]">Ver plano e cobrança</Button></CardContent></Card></section>
    <section className="rounded-3xl border border-[#e0e8e3] bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8e7a4d]">Atenção operacional</p><h2 className="mt-2 font-display text-2xl text-[#29434e]">Alertas que merecem contexto.</h2></div><AlertTriangle className="h-5 w-5 text-[#ad7b3b]" /></div>{alerts.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{alerts.map(alert => <div key={alert.id} className={`rounded-2xl border p-4 ${alert.tone === "critical" ? "border-[#f2d6cb] bg-[#fff5f1]" : alert.tone === "warning" ? "border-[#efe3bc] bg-[#fffaf0]" : "border-[#d7e7dc] bg-[#f3f8f4]"}`}><p className="text-sm font-bold text-[#3e545d]">{alert.title}</p><p className="mt-1 text-xs leading-5 text-[#718087]">{alert.detail}</p></div>)}</div> : <p className="mt-4 text-sm leading-6 text-[#74848a]">Nenhum alerta crítico neste momento. A operação está dentro dos parâmetros monitorados.</p>}</section>
    {queueCounts.ai + queueCounts.human + queueCounts.resolved === 0 && <section className="rounded-3xl border border-dashed border-[#d8e4dd] bg-white/45 px-6 py-8 text-center"><Boxes className="mx-auto h-6 w-6 text-[#6f9982]" /><h2 className="mt-3 font-display text-2xl text-[#2a4450]">Nenhuma conversa ainda</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#708086]">Quando você conectar o canal de WhatsApp e ativar a operação, as filas de IA e atendimento humano aparecerão aqui com dados reais do seu tenant.</p></section>}
  </div>;
}

function UsageLine({ label, value, limit, percent }: { label: string; value: string; limit: string; percent: number }) { return <div><div className="flex items-center justify-between text-xs"><span className="font-semibold text-[#4c6069]">{label}</span><span className="text-[#74858c]">{value} / {limit}</span></div><Progress value={percent} className="mt-2 h-1.5 bg-[#edf1ee]" /></div>; }
function EmptyWorkspace({ onCreate }: { onCreate: () => void }) { return <div className="grid min-h-[70vh] place-items-center"><div className="max-w-lg rounded-[2rem] border border-[#dde7e1] bg-white p-9 text-center shadow-sm"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f4e0]"><Boxes className="h-6 w-6 text-[#628d74]" /></div><h1 className="mt-5 font-display text-3xl text-[#243e49]">Crie seu primeiro ambiente.</h1><p className="mt-3 text-sm leading-6 text-[#708087]">Cada empresa possui dados, equipe, agentes, integrações e limites próprios.</p><Button onClick={onCreate} className="mt-6 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">Criar empresa <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>; }
