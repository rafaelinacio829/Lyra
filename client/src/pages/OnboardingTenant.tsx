import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Building2, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function OnboardingTenant() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const tenants = trpc.tenant.mine.useQuery(undefined, { enabled: isAuthenticated });
  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: () => {
      toast.success("Seu ambiente foi criado com trial de 14 dias.");
      setLocation("/app");
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email, email]);

  useEffect(() => {
    if (tenants.data?.length) setLocation("/app");
  }, [tenants.data, setLocation]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f8f7f4]"><Loader2 className="h-6 w-6 animate-spin text-[#5e8b76]" /></div>;
  if (!isAuthenticated) return <div className="grid min-h-screen place-items-center bg-[#f8f7f4] px-5"><div className="max-w-lg rounded-3xl border border-[#dce5df] bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-9 w-9 text-[#5b8f74]" /><p className="mt-5 text-xs font-bold uppercase tracking-[.17em] text-[#5d8f78]">Etapa de segurança</p><h1 className="mt-3 font-display text-3xl text-[#1e3742]">Antes de criar sua operação, confirme sua identidade.</h1><p className="mt-3 text-sm leading-6 text-[#697980]">O Lyra usa a autenticação segura da Manus para vincular o primeiro administrador à empresa e manter a operação auditável. Você continuará no Lyra após entrar; não é necessário contratar nem usar outro produto.</p><p className="mt-3 text-xs leading-5 text-[#849198]">Caso ainda não tenha um login, a tela seguinte pode pedir a criação gratuita de uma conta de acesso.</p><Button className="mt-6 rounded-full bg-[#1c3542] text-white" onClick={() => startLogin()}>Continuar para o login seguro <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createTenant.mutate({ name, primaryEmail: email });
  };

  return <div className="min-h-screen bg-[#f8f7f4] px-5 py-10 lg:py-16"><div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[#dae5df] bg-white shadow-[0_20px_70px_rgba(34,54,62,0.10)] lg:grid-cols-[.85fr_1.15fr]"><aside className="bg-[#19333f] p-8 text-white sm:p-12"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#c7f27b] font-display text-lg italic text-[#203d39]">L</div><span className="font-display text-xl">lyra</span></div><p className="mt-12 text-xs font-bold uppercase tracking-[.18em] text-[#b7eb74]">Seu novo ambiente</p><h1 className="mt-4 font-display text-4xl leading-tight">Uma operação pronta para ganhar escala.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-[#bbcad0]">Comece com um trial de 14 dias, equipe organizada, limites claros e estrutura pronta para conectar IA, WhatsApp e ERP.</p><div className="mt-12 space-y-4">{["Empresa isolada e auditável", "Plano Starter com limites aplicados", "Administração inicial vinculada à sua conta"].map(item => <div key={item} className="flex gap-3 text-sm text-[#dbe6e8]"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#b7eb74]" />{item}</div>)}</div></aside><section className="p-8 sm:p-12"><div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ebf6e1]"><Building2 className="h-5 w-5 text-[#538268]" /></div><h2 className="mt-5 font-display text-3xl tracking-tight text-[#1e3742]">Crie sua empresa</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#718089]">Estas informações definem o seu tenant inicial. Você poderá personalizar marca, equipe e integrações depois.</p><form className="mt-8 space-y-5" onSubmit={handleSubmit}><div className="space-y-2"><Label htmlFor="tenant-name">Nome da empresa</Label><Input id="tenant-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Aurora Consultoria" required className="h-11 rounded-xl border-[#d7e1db]" /></div><div className="space-y-2"><Label htmlFor="tenant-email">E-mail administrativo</Label><Input id="tenant-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@empresa.com" required className="h-11 rounded-xl border-[#d7e1db]" /></div><Button type="submit" disabled={createTenant.isPending} className="mt-3 h-12 w-full rounded-full bg-[#1c3542] text-white hover:bg-[#294956]">{createTenant.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando ambiente</> : <>Criar ambiente e iniciar trial <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></form></section></div></div>;
}
