import { useState } from "react";
import React from "react";
import { ArrowLeft, ArrowRight, Bot, Check, CircleHelp, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Replace these editable labels with the official competency names when they are confirmed.
export const PDI_COMPETENCIES = [
  "Colaboração",
  "Comunicação",
  "Inovação",
  "Foco no cliente",
  "Liderança",
];

type PdiResult = {
  goal: string;
  action: string;
  evidence: string;
  track: string;
};

function buildPdiResult(competency: string, situation: string): PdiResult {
  const context = situation.trim().replace(/\s+/g, " ");
  return {
    goal: `Em 30 dias, fortalecer ${competency.toLowerCase()} ao aplicar uma prática intencional na situação descrita: "${context}".`,
    action: `Escolha uma oportunidade real por semana para praticar ${competency.toLowerCase()}, combine um próximo passo observável e registre em até cinco linhas o que funcionou e o que ajustar.`,
    evidence: `Um registro semanal com a ação realizada, o resultado percebido e um breve feedback de uma pessoa envolvida, sem nomes, clientes ou dados identificáveis.`,
    track: `Trilha sugerida: ${competency} em ação — procure conteúdos da eduCa relacionados a ${competency.toLowerCase()} e pratique um conceito por semana.`,
  };
}

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Etapa ${activeStep} de 2`}>
      {[1, 2].map(step => (
        <div key={step} className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${step <= activeStep ? "bg-[#c7f36d] text-[#17332d]" : "bg-white/10 text-[#a9c0bd]"}`}>
            {step < activeStep ? <Check className="h-4 w-4" /> : step}
          </span>
          {step < 2 && <span className={`h-px w-8 ${activeStep > 1 ? "bg-[#c7f36d]" : "bg-white/15"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function PdiAssistantPage() {
  const [competency, setCompetency] = useState("");
  const [situation, setSituation] = useState("");
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<PdiResult | null>(null);

  const reset = () => {
    setCompetency("");
    setSituation("");
    setStep(1);
    setResult(null);
  };

  const continueToSituation = () => {
    if (competency) setStep(2);
  };

  const generatePdi = () => {
    if (competency && situation.trim()) setResult(buildPdiResult(competency, situation));
  };

  return (
    <div className="min-h-screen bg-[#f5f8f4] text-[#19343b]">
      <header className="bg-[#173640] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Voltar para a página inicial">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#c7f36d] text-lg font-black italic text-[#17332d]">F</span>
            <span><strong className="block font-display text-xl leading-none">Flow One</strong><small className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a9c6bb]">PDI assistente</small></span>
          </Link>
          <button onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-[#d4e4df] transition-colors hover:text-white" type="button">
            <RotateCcw className="h-4 w-4" /> Recomeçar
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[.7fr_1.3fr] lg:px-8 lg:py-12">
        <section className="flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d4e4d7] bg-white px-3 py-1.5 text-xs font-bold text-[#4e7b67]"><Sparkles className="h-3.5 w-3.5" /> Demo funcional</div>
            <h1 className="mt-5 max-w-lg font-display text-5xl leading-[.98] tracking-[-.045em] text-[#173640] sm:text-6xl">Transforme uma situação em um <span className="italic text-[#5b9473]">próximo passo.</span></h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#60747a]">Um guia rápido para organizar uma direção de desenvolvimento. Você decide o que faz sentido — o assistente não avalia você.</p>
          </div>
          <div className="mt-10 rounded-3xl border border-[#dbe8dc] bg-[#e7f2e7] p-5 text-sm leading-6 text-[#46645e]">
            <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4f8a70]" /><p><strong className="text-[#315a4c]">Privacidade primeiro.</strong> Use uma situação sem nomes, dados de clientes ou qualquer informação sensível.</p></div>
          </div>
        </section>

        <section>
          <Card className="overflow-hidden rounded-[2rem] border-[#dce8df] bg-white shadow-[0_24px_70px_rgba(36,74,61,0.1)]">
            <div className="bg-[#173640] px-6 py-5 text-white sm:px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dff6c0]"><Bot className="h-5 w-5 text-[#35634e]" /></div><div><p className="font-bold">Seu guia de PDI</p><p className="text-xs text-[#b4c9c7]">Leva cerca de 60 segundos</p></div></div>
                {!result && <StepIndicator activeStep={step} />}
              </div>
            </div>

            {!result ? (
              <CardContent className="p-6 sm:p-8">
                {step === 1 ? (
                  <>
                    <CardHeader className="p-0"><CardTitle className="text-2xl text-[#19343b]">Qual competência você quer desenvolver?</CardTitle><CardDescription className="mt-2 leading-6">Escolha uma opção ou escreva outra que seja relevante para você.</CardDescription></CardHeader>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {PDI_COMPETENCIES.map(option => <button key={option} type="button" onClick={() => setCompetency(option)} className={`rounded-2xl border p-4 text-left text-sm font-bold transition-all ${competency === option ? "border-[#79a86e] bg-[#edf8e4] text-[#315e4c] ring-2 ring-[#d6efc4]" : "border-[#dfe9e0] text-[#425b61] hover:border-[#aac9a8] hover:bg-[#f7fbf6]"}`}>{option}</button>)}
                    </div>
                    <label className="mt-3 block"><span className="sr-only">Outra competência</span><input value={PDI_COMPETENCIES.includes(competency) ? "" : competency} onChange={event => setCompetency(event.target.value)} placeholder="Outra competência (opcional)" className="h-12 w-full rounded-2xl border border-[#dfe9e0] px-4 text-sm outline-none transition focus:border-[#79a86e] focus:ring-2 focus:ring-[#d6efc4]" /></label>
                    <Button type="button" onClick={continueToSituation} disabled={!competency} className="mt-7 h-12 w-full rounded-full bg-[#173640] text-white hover:bg-[#28515d]">Continuar <ArrowRight className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setStep(1)} className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-[#5c8175] hover:text-[#315e4c]"><ArrowLeft className="h-4 w-4" /> Alterar competência</button>
                    <CardHeader className="p-0"><CardTitle className="text-2xl text-[#19343b]">Conte uma situação real de trabalho</CardTitle><CardDescription className="mt-2 leading-6">O que aconteceu, qual era seu papel e o que você gostaria de fazer diferente?</CardDescription></CardHeader>
                    <textarea aria-label="Situação real de trabalho" value={situation} onChange={event => setSituation(event.target.value)} placeholder="Ex.: Em uma reunião, percebi que minhas ideias não ficaram claras e a decisão foi adiada..." className="mt-6 min-h-36 w-full resize-none rounded-2xl border border-[#dfe9e0] p-4 text-sm leading-6 outline-none transition focus:border-[#79a86e] focus:ring-2 focus:ring-[#d6efc4]" />
                    <p className="mt-3 flex gap-2 text-xs leading-5 text-[#6d7f82]"><CircleHelp className="h-4 w-4 shrink-0 text-[#6b9d79]" /> Não inclua nomes, dados de clientes ou informações confidenciais.</p>
                    <Button type="button" onClick={generatePdi} disabled={!situation.trim()} className="mt-6 h-12 w-full rounded-full bg-[#173640] text-white hover:bg-[#28515d]">Gerar minha direção de PDI <Sparkles className="h-4 w-4" /></Button>
                  </>
                )}
              </CardContent>
            ) : (
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5c9675]">Sua direção de desenvolvimento</p><h2 className="mt-2 font-display text-3xl tracking-[-.03em] text-[#19343b]">{competency}</h2></div><span className="rounded-full bg-[#eaf7e2] px-3 py-1 text-xs font-bold text-[#4c805e]">30 dias</span></div>
                <div className="mt-7 grid gap-3">
                  {[["Meta reescrita", result.goal], ["Ação prática", result.action], ["Evidência de evolução", result.evidence], ["Trilha eduCa", result.track]].map(([title, body]) => <article key={title} className="rounded-2xl border border-[#e1ebe2] bg-[#fbfdfb] p-4"><h3 className="text-sm font-bold text-[#315e4c]">{title}</h3><p className="mt-1 text-sm leading-6 text-[#5d7075]">{body}</p></article>)}
                </div>
                <div className="mt-6 rounded-2xl bg-[#f1f6ed] p-4 text-xs leading-5 text-[#587069]"><strong className="text-[#315e4c]">Importante:</strong> esta é apenas uma sugestão de direção, não uma avaliação. A decisão final é sua e do seu gestor.</div>
                <Button type="button" variant="outline" onClick={reset} className="mt-6 w-full rounded-full border-[#cbdccf] text-[#315e4c] hover:bg-[#f3f9f1]">Criar outra direção</Button>
              </CardContent>
            )}
          </Card>
        </section>
      </main>
    </div>
  );
}
