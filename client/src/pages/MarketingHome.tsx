import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Check, ChevronRight, FileLock2, Layers3, MessageSquareText, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { Link, useLocation } from "wouter";

const plans = [
  { name: "Starter", price: "R$ 299", detail: "Para começar com IA e uma operação enxuta.", limits: ["3 membros", "2 agentes", "1.500 conversas/mês"] },
  { name: "Growth", price: "R$ 699", detail: "Para equipes que precisam de escala e governança.", limits: ["10 membros", "6 agentes", "7.000 conversas/mês"], featured: true },
  { name: "Scale", price: "R$ 1.499", detail: "Para operações críticas com alto volume e prioridade.", limits: ["30 membros", "20 agentes", "30.000 conversas/mês"] },
];

export default function MarketingHome() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen overflow-hidden bg-[#f8f7f4] text-[#15202b]">
      <header className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Lyra Omnichannel">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#162b37] shadow-[0_10px_30px_rgba(22,43,55,0.18)]">
            <span className="font-display text-lg italic text-[#d1ff76]">L</span>
          </div>
          <div>
            <p className="font-display text-xl leading-none tracking-tight">lyra</p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.22em] text-[#5f7280]">omnichannel</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[#52626e] md:flex">
          <a href="#produto" className="transition-colors hover:text-[#142a36]">Produto</a>
          <a href="#agentes" className="transition-colors hover:text-[#142a36]">Agentes</a>
          <Link href="/pricing" className="transition-colors hover:text-[#142a36]">Planos</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="hidden text-[#384b57] sm:inline-flex" onClick={() => setLocation("/login")}>Entrar</Button>
          <Button onClick={() => setLocation("/onboarding")} className="rounded-full bg-[#162b37] px-5 text-white hover:bg-[#264351]">Começar agora <ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:pb-28 lg:pt-24">
          <div className="absolute -left-36 top-12 h-96 w-96 rounded-full bg-[#dffcb2]/55 blur-3xl" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#b9e7df]/40 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e2d6] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#52706b] shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#4b8371]" /> Operação inteligente, relacionamento humano
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[0.98] tracking-[-0.045em] text-[#152b38] sm:text-6xl lg:text-7xl">
              Atendimento que <span className="italic text-[#477865]">acompanha</span> o ritmo do seu negócio.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#5a6973]">
              Centralize WhatsApp, agentes de IA, ERP e equipes em uma operação segura, mensurável e pronta para escalar com cada cliente.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => setLocation("/onboarding")} className="h-12 rounded-full bg-[#b8ef65] px-6 font-semibold text-[#172c26] shadow-[0_12px_28px_rgba(111,164,52,0.26)] hover:bg-[#c6f781]">Criar minha operação <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <a href="#produto" className="inline-flex h-12 items-center justify-center rounded-full border border-[#cfd9d4] bg-white/60 px-6 text-sm font-semibold text-[#334855] transition-colors hover:bg-white">Conhecer a plataforma <ChevronRight className="ml-1 h-4 w-4" /></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#60727a]">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#4a8a6f]" /> Trial de 14 dias</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#4a8a6f]" /> Sem cartão no início</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#4a8a6f]" /> Dados isolados por empresa</span>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-xl rounded-[2rem] border border-white/80 bg-[#162b37] p-3 shadow-[0_30px_80px_rgba(30,48,58,0.24)]">
              <div className="rounded-[1.55rem] bg-[#f7faf8] p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#dff6bd]" />
                    <div><p className="text-sm font-bold text-[#1b303b]">Visão da operação</p><p className="text-xs text-[#7a8a91]">Hoje, 09:42</p></div>
                  </div>
                  <span className="rounded-full bg-[#e6f7e9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#3b7d5d]">em dia</span>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[['126', 'Atendimentos'], ['93%', 'SLA no prazo'], ['12m', '1ª resposta']].map(([value, label]) => <div key={label} className="rounded-2xl border border-[#e3ebe6] bg-white p-3"><p className="font-display text-2xl text-[#1e3643]">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#7b8b8e]">{label}</p></div>)}
                </div>
                <div className="mt-4 rounded-2xl border border-[#e2ebe7] bg-white p-4">
                  <div className="flex items-center justify-between"><p className="text-xs font-bold text-[#304652]">Filas em tempo real</p><span className="text-[11px] font-semibold text-[#5f977b]">Atualizado agora</span></div>
                  <div className="mt-4 space-y-3">
                    {[['Agente IA', '38', 'bg-[#dff5fc]', 'text-[#397285]'], ['Aguardando humano', '7', 'bg-[#fff0cf]', 'text-[#916f31]'], ['Resolvidos hoje', '81', 'bg-[#e6f5df]', 'text-[#4d7d49]']].map(([label, value, color, tone]) => <div key={label} className="flex items-center gap-3"><span className={`h-8 w-8 rounded-xl ${color}`} /><span className="flex-1 text-sm font-medium text-[#3d515a]">{label}</span><span className={`rounded-lg px-2 py-1 text-xs font-bold ${color} ${tone}`}>{value}</span></div>)}
                  </div>
                </div>
                <div className="mt-4 rounded-2xl bg-[#233d49] p-4 text-white"><div className="flex items-start gap-3"><Bot className="mt-0.5 h-5 w-5 text-[#d3ff7d]" /><div><p className="text-sm font-semibold">Agente financeiro ativo</p><p className="mt-1 text-xs leading-5 text-[#c5d2d7]">Configurado no Lyra, conectado ao provedor de IA do seu tenant e pronto para transferir casos sensíveis para a equipe.</p></div></div></div>
              </div>
            </div>
          </div>
        </section>

        <section id="produto" className="border-y border-[#e3e9e4] bg-white/55 py-20">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5d907b]">Uma operação conectada</p><h2 className="mt-3 font-display text-4xl tracking-[-0.035em] text-[#18313e] sm:text-5xl">Cada conversa tem contexto, prioridade e um próximo passo claro.</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[{icon: MessageSquareText, title:'Inbox unificado', body:'Filas de IA, atendimento humano e resolução em uma mesma visão operacional.'},{icon: Bot,title:'Agentes configuráveis',body:'Perfis por empresa, regras de transferência e conexão isolada com o Dify.'},{icon: UsersRound,title:'Equipes com contexto',body:'Papéis, presença, capacidade e transferência com rastreabilidade.'},{icon: FileLock2,title:'Dados protegidos',body:'Documentos privados, acesso por tenant e URLs assinadas de curta duração.'}].map(item => <article key={item.title} className="rounded-3xl border border-[#e3eae5] bg-[#fdfefd] p-6 transition-transform duration-200 hover:-translate-y-1"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e7f5e0]"><item.icon className="h-5 w-5 text-[#497b65]" /></div><h3 className="mt-5 text-lg font-bold text-[#233d49]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#68777d]">{item.body}</p></article>)}
            </div>
          </div>
        </section>

        <section id="agentes" className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5d907b]">Agentes dentro do seu SaaS</p><h2 className="mt-3 font-display text-4xl tracking-[-0.035em] text-[#18313e]">Configure a inteligência sem criar atrito na operação.</h2><p className="mt-5 leading-7 text-[#62717a]">Cada empresa pode manter seus próprios agentes, aplicações conectadas, regras de handoff e políticas de atendimento. O Dify é uma integração do produto, não a experiência que o seu cliente precisa aprender.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[['01','Perfil e finalidade','Defina propósito, público, canal e modo de resposta do agente.'],['02','Conexão isolada','Associe a aplicação Dify do tenant com segredo mantido no servidor.'],['03','Regras de handoff','Direcione para pessoas quando houver palavra-chave, risco ou exceção.'],['04','Governança','Ative, pause, teste e acompanhe cada agente com histórico e auditoria.']].map(([index,title,body]) => <div key={index} className="rounded-3xl border border-[#dce7df] bg-[#eaf2ed] p-6"><span className="font-display text-3xl italic text-[#6f9f89]">{index}</span><h3 className="mt-8 text-base font-bold text-[#253e48]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#617278]">{body}</p></div>)}
          </div>
        </section>

        <section id="planos" className="bg-[#162b37] py-20 text-white">
          <div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c4f078]">Planos que acompanham a operação</p><h2 className="mt-3 font-display text-4xl tracking-[-0.035em] sm:text-5xl">Cresça com limites transparentes e governança real.</h2><p className="mt-4 text-[#b3c2c7]">Cada plano aplica limites técnicos dentro da plataforma, não apenas uma promessa comercial.</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">{plans.map(plan => <article key={plan.name} className={`relative rounded-3xl border p-6 ${plan.featured ? 'border-[#c4f078] bg-[#23414d] shadow-[0_20px_60px_rgba(0,0,0,0.2)]' : 'border-white/12 bg-white/5'}`}>{plan.featured && <span className="absolute right-5 top-5 rounded-full bg-[#c4f078] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1e3630]">Mais escolhido</span>}<h3 className="font-display text-3xl">{plan.name}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-[#bac8cc]">{plan.detail}</p><p className="mt-6 font-display text-4xl">{plan.price}<span className="ml-1 font-sans text-sm text-[#a9bbc0]">/mês</span></p><Button onClick={() => setLocation("/login")} className={`mt-6 w-full rounded-full ${plan.featured ? 'bg-[#c4f078] text-[#1e3630] hover:bg-[#d3fa90]' : 'bg-white text-[#1d3743] hover:bg-[#eaf0ed]'}`}>Começar trial</Button><ul className="mt-6 space-y-3 border-t border-white/10 pt-5">{plan.limits.map(limit => <li key={limit} className="flex items-center gap-2 text-sm text-[#d3dfe1]"><Check className="h-4 w-4 text-[#c4f078]" />{limit}</li>)}</ul></article>)}</div><Link href="/pricing" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#c4f078] hover:text-[#dafba3]">Comparar todos os limites <ChevronRight className="h-4 w-4" /></Link></div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#5d907b]">Dúvidas frequentes</p><h2 className="mt-3 font-display text-4xl tracking-[-.035em] text-[#1e3a43]">Clareza antes de cada próximo passo.</h2></div><div className="divide-y divide-[#dce7df] rounded-3xl border border-[#dce7df] bg-white/70 px-6"><details className="group py-5" open><summary className="cursor-pointer list-none pr-7 text-sm font-bold text-[#2a454f]">O cliente precisa operar o Dify diretamente?<span className="float-right text-lg text-[#6b9b81] group-open:rotate-45">+</span></summary><p className="mt-3 pr-7 text-sm leading-6 text-[#66777e]">Não. O cliente configura perfis, regras, ativação e transferência dentro do Lyra. O Dify permanece como provedor de IA conectado por tenant.</p></details><details className="group py-5"><summary className="cursor-pointer list-none pr-7 text-sm font-bold text-[#2a454f]">Como os dados de cada empresa são separados?<span className="float-right text-lg text-[#6b9b81] group-open:rotate-45">+</span></summary><p className="mt-3 pr-7 text-sm leading-6 text-[#66777e]">Cada empresa possui um tenant próprio. O acesso, as conversas, os agentes, as integrações e os arquivos são associados a esse tenant e filtrados no servidor.</p></details><details className="group py-5"><summary className="cursor-pointer list-none pr-7 text-sm font-bold text-[#2a454f]">Os limites do plano são somente comerciais?<span className="float-right text-lg text-[#6b9b81] group-open:rotate-45">+</span></summary><p className="mt-3 pr-7 text-sm leading-6 text-[#66777e]">Não. Membros, agentes, mensagens, conversas, integrações e armazenamento terão limites aplicados dentro da plataforma para preservar previsibilidade.</p></details><details className="group py-5"><summary className="cursor-pointer list-none pr-7 text-sm font-bold text-[#2a454f]">Como funciona o início do trial?<span className="float-right text-lg text-[#6b9b81] group-open:rotate-45">+</span></summary><p className="mt-3 pr-7 text-sm leading-6 text-[#66777e]">O administrador cria o primeiro ambiente, recebe um trial de 14 dias e pode estruturar equipe, agentes e integrações antes de contratar um plano.</p></details></div></div></section>
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="rounded-[2rem] bg-[#e0f2e6] px-7 py-12 text-center sm:px-12"><ShieldCheck className="mx-auto h-8 w-8 text-[#3f8064]"/><h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl tracking-[-0.035em] text-[#1e3a43]">Sua operação merece uma estrutura que cresça com confiança.</h2><p className="mx-auto mt-4 max-w-xl text-[#58706f]">Crie seu ambiente, conecte seus canais e comece a estruturar uma experiência de atendimento melhor para clientes e equipe.</p><Button onClick={() => setLocation("/login")} size="lg" className="mt-7 rounded-full bg-[#18323f] px-7 text-white hover:bg-[#294956]">Criar meu ambiente <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>
      </main>
      <footer className="border-t border-[#e2e8e3] py-8 text-center text-xs text-[#718087]">Lyra Omnichannel · Atendimento inteligente com governança.</footer>
    </div>
  );
}
