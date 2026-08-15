export const capacityAddonCatalog = {
  members: { label: "Usuários adicionais", unitLabel: "usuário", capacity: 1, monthlyCents: 4900, description: "Inclua mais uma pessoa ativa na equipe." },
  agents: { label: "Agentes adicionais", unitLabel: "agente", capacity: 1, monthlyCents: 9900, description: "Ative mais um agente de IA no seu catálogo." },
  messages: { label: "Pacote de mensagens", unitLabel: "pacote de 10 mil", capacity: 10_000, monthlyCents: 9900, description: "Amplie o limite mensal de mensagens da operação." },
} as const;

export type CapacityAddonType = keyof typeof capacityAddonCatalog;

export function addonCapacity(type: CapacityAddonType, quantity: number) { return capacityAddonCatalog[type].capacity * quantity; }
export function addonAmount(type: CapacityAddonType, quantity: number) { return capacityAddonCatalog[type].monthlyCents * quantity; }
