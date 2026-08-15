import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, CreditCard, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const planData = [
  { code: "starter", name: "Starter", monthly: "R$ 299", annual: "R$ 239", description: "Governança para começar.", featured: false, features: ["3 membros", "2 agentes", "1.500 conversas"] },
  { code: "growth", name: "Growth", monthly: "R$ 699", annual: "R$ 559", description: "Capacidade para escalar.", featured: true, features: ["10 membros", "6 agentes", "7.000 conversas"] },
  { code: "scale", name: "Scale", monthly: "R$ 1.499", annual: "R$ 1.199", description: "Operação crítica e madura.", featured: false, features: ["30 membros", "20 agentes", "30.000 conversas"] },
] as const;

export default function BillingPage() {
  const tenants = trpc.tenant.mine.useQuery();
  const [, setLocation] = useLocation();
  const [tenantId, setTenantId] = useState<number | null>(null);
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    if (!tenantId && tenants.data?.[0]) setTenantId(tenants.data[0].id);
  }, [tenantId, tenants.data]);

  const overview = trpc.billing.overview.useQuery({ tenantId: tenantId ?? 0 }, { enabled: !!tenantId });
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: result => {
      toast.success("Abrindo checkout seguro em uma nova aba.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    },
    onError: error => toast.error(error.message),
  });
  const portal = trpc.billing.createPortal.useMutation({
    onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(error.message),
  });

  if (tenants.isLoading) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;
  if (!tenants.data?.length) return <div className="grid min-h-[55vh] place-items-center p-5"><div className="max-w-md rounded-3xl border border-[#dce7df] bg-white p-8 text-center shadow-sm"><CreditCard className="mx-auto h-7 w-7 text-[#628d74]" /><h1 className="mt-4 font-display text-3xl text-[#29434e]">Crie seu ambiente antes de escolher um plano.</h1><p className="mt-3 text-sm leading-6 text-[#74848b]">A assinatura fica vinculada a uma empresa. Crie o primeiro tenant para iniciar o trial e configurar a cobrança.</p><Button onClick={() => setLocation("/onboarding")} className="mt-6 rounded-full bg-[#203b47] text-white hover:bg-[#2d4f5b]">Criar empresa</Button></div></div>;
  if (!tenantId || overview.isLoading) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#5d8b75]" /></div>;
  if (!overview.data) return null;

  const current = overview.data;
  const changePlan = trpc.billing.changePlan.useMutation({ onSuccess: () => { toast.success("Plano atualizado. A Stripe sincronizará o ciclo de cobrança."); overview.refetch(); }, onError: error => toast.error(error.message) });
  const invoices = trpc.billing.invoices.useQuery({ tenantId });
  const choosePlan = (planCode: "starter" | "growth" | "scale") => current.providerSubscriptionId ? changePlan.mutate({ tenantId, planCode, interval }) : checkout.mutate({ tenantId, planCode, interval });
  return <div className="mx-auto max-w-6xl space-y-6 p-2 sm:p-5">
    <section className="flex flex-col justify-between gap-4 rounded-[1.7rem] border border-[#dce7df] bg-[#1d3844] p-7 text-white sm:flex-row sm:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#b9d9c6]">Assinatura e cobrança</p><h1 className="mt-2 font-display text-4xl tracking-[-.035em]">Plano {current.planName}</h1><p className="mt-2 text-sm text-[#c2d0d4]">{current.status === "trialing" ? `Trial até ${current.trialEndsAt ? new Date(current.trialEndsAt).toLocaleDateString("pt-BR") : "data não definida"}` : `Assinatura ${current.status}`}</p></div>
      <div className="flex flex-wrap gap-2"><Badge className="bg-[#c7ef7e] text-[#264334] hover:bg-[#c7ef7e]">{current.status}</Badge><Button onClick={() => portal.mutate({ tenantId })} disabled={!current.providerCustomerId || portal.isPending} variant="outline" className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"><ExternalLink className="mr-2 h-4 w-4" />Portal de cobrança</Button></div>
    </section>
    <section className="rounded-3xl border border-[#dde8e1] bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div><h2 className="font-display text-2xl text-[#2d4752]">Escolha a periodicidade</h2><p className="mt-1 text-xs text-[#77868d]">No anual, o valor mensal é menor e a cobrança ocorre uma vez por ano.</p></div><div className="shrink-0 rounded-full bg-[#eef3ef] p-1"><button onClick={() => setInterval("monthly")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${interval === "monthly" ? "bg-white text-[#294550] shadow-sm" : "text-[#74838a]"}`}>Mensal</button><button onClick={() => setInterval("annual")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${interval === "annual" ? "bg-white text-[#294550] shadow-sm" : "text-[#74838a]"}`}>Anual</button></div></div></section>
    <section className="grid gap-4 lg:grid-cols-3">{planData.map(plan => <article key={plan.code} className={`rounded-3xl border p-6 ${plan.featured ? "border-[#bce978] bg-[#1d3844] text-white shadow-xl shadow-[#274856]/10" : "border-[#dce7df] bg-white"}`}><div className="flex items-center justify-between"><h2 className="font-display text-3xl">{plan.name}</h2>{plan.featured && <Sparkles className="h-5 w-5 text-[#c8ef80]" />}</div><p className={`mt-2 min-h-10 text-sm ${plan.featured ? "text-[#c5d1d5]" : "text-[#728188]"}`}>{plan.description}</p><p className="mt-5 font-display text-4xl">{interval === "annual" ? plan.annual : plan.monthly}<span className="ml-1 font-sans text-xs font-normal opacity-65">/mês</span></p><ul className="mt-6 space-y-2">{plan.features.map(feature => <li key={feature} className={`flex items-center gap-2 text-sm ${plan.featured ? "text-[#e1eaec]" : "text-[#566a73]"}`}><Check className={`h-4 w-4 ${plan.featured ? "text-[#c8ef80]" : "text-[#5d9073]"}`} />{feature}</li>)}</ul><Button onClick={() => choosePlan(plan.code)} disabled={checkout.isPending || changePlan.isPending} className={`mt-7 w-full rounded-full ${plan.featured ? "bg-[#c8ef80] text-[#274334] hover:bg-[#d8fa96]" : "bg-[#203b47] text-white hover:bg-[#2d4f5b]"}`}>{checkout.isPending || changePlan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}{current.providerSubscriptionId ? `Mudar para ${plan.name}` : `Escolher ${plan.name}`}</Button></article>)}</section>
    <section className="rounded-3xl border border-[#dce7df] bg-white p-6"><h2 className="font-display text-2xl text-[#2d4752]">Faturas recentes</h2><div className="mt-4 space-y-2">{invoices.data?.length ? invoices.data.map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f6f9f7] px-4 py-3 text-sm"><span className="font-semibold text-[#445a63]">{new Date(invoice.createdAt).toLocaleDateString("pt-BR")} · {(invoice.amountPaid / 100).toLocaleString("pt-BR", { style: "currency", currency: invoice.currency.toUpperCase() })}</span><a className="text-xs font-bold text-[#487963]" target="_blank" rel="noreferrer" href={invoice.invoicePdf || invoice.hostedInvoiceUrl || "#"}>Abrir fatura</a></div>) : <p className="text-sm text-[#78878d]">As faturas aparecerão aqui depois da primeira cobrança confirmada.</p>}</div></section>
    <section className="rounded-3xl border border-[#dce7df] bg-[#f2f8f3] p-5 text-sm leading-6 text-[#5f746f]">O checkout é processado pela Stripe. Dados de cartão, CVV e informações de pagamento não são armazenados no Lyra. Mudanças e faturas ficam disponíveis no portal de cobrança.</section>
  </div>;
}
