export type ActivationStep = { id: string; title: string; detail: string; completed: boolean; href: string };

export function buildActivationJourney(input: { channelsReady: number; activeAgents: number; activeMembers: number; conversations: number }) {
  const steps: ActivationStep[] = [
    { id: "channel", title: "Conecte um canal", detail: "Verifique Meta ou Z-API para começar a receber conversas.", completed: input.channelsReady > 0, href: "/app/integrations" },
    { id: "agent", title: "Ative um agente", detail: "Instale um agente de teste ou configure sua IA para o primeiro atendimento.", completed: input.activeAgents > 0, href: "/app/agents" },
    { id: "team", title: "Monte a equipe", detail: "Adicione ao menos uma pessoa para receber transferências humanas.", completed: input.activeMembers > 1, href: "/app/team" },
    { id: "conversation", title: "Faça a primeira conversa", detail: "Envie uma mensagem pelo canal conectado e acompanhe a fila em tempo real.", completed: input.conversations > 0, href: "/app/conversations" },
  ];
  const completed = steps.filter(step => step.completed).length;
  return { completed, total: steps.length, percent: Math.round((completed / steps.length) * 100), isComplete: completed === steps.length, nextStep: steps.find(step => !step.completed) ?? null, steps };
}
