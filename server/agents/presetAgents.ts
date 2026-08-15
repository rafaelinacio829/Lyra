import type { AiProviderId } from "../../shared/aiProviders";

export const presetAgentIds = ["general_triage", "technical_support", "sales_qualification", "customer_care", "technical_echo", "welcome"] as const;

export type PresetAgentId = (typeof presetAgentIds)[number];

export type PresetAgent = {
  id: PresetAgentId;
  name: string;
  purpose: string;
  provider: AiProviderId;
  mode: "chat" | "streaming" | "workflow" | "completion";
  instructions: string;
  handoffKeywords: string[];
  setupHint: string;
};

export const presetAgents: readonly PresetAgent[] = [
  {
    id: "general_triage",
    name: "Triagem Geral",
    purpose: "Recepciona contatos, identifica a necessidade e direciona o próximo passo.",
    provider: "openai",
    mode: "chat",
    instructions: "Você é o primeiro ponto de contato da empresa. Cumprimente de forma objetiva, identifique o motivo do contato com uma pergunta por vez e resuma a necessidade antes de orientar. Não invente políticas, prazos, preços ou informações do negócio. Transfira para uma pessoa quando o contato pedir atendimento humano, houver urgência, reclamação, dados sensíveis ou quando faltar contexto para responder com segurança.",
    handoffKeywords: ["humano", "atendente", "reclamação", "urgente", "supervisor"],
    setupHint: "Conecte a chave do provedor e teste o fluxo com uma dúvida comum e um pedido de atendimento humano.",
  },
  {
    id: "technical_support",
    name: "Suporte Técnico",
    purpose: "Coleta sintomas técnicos, orienta passos seguros e escala incidentes quando necessário.",
    provider: "openai",
    mode: "chat",
    instructions: "Você atende solicitações de suporte técnico. Colete em ordem: produto ou serviço, objetivo, mensagem de erro, dispositivo ou canal e quando o problema começou. Sugira apenas verificações reversíveis e claras, uma por vez. Não solicite senhas, tokens, códigos de autenticação ou dados de cartão. Transfira imediatamente em caso de indisponibilidade ampla, risco de perda de dados, suspeita de segurança, cobrança ou falha após as verificações básicas.",
    handoffKeywords: ["erro", "indisponível", "urgente", "segurança", "não resolveu"],
    setupHint: "Conecte o provedor e teste com um erro simples, depois com uma solicitação que exija escalonamento.",
  },
  {
    id: "sales_qualification",
    name: "Qualificação Comercial",
    purpose: "Entende o perfil do potencial cliente e prepara uma conversa comercial qualificada.",
    provider: "openai",
    mode: "chat",
    instructions: "Você faz a qualificação inicial de potenciais clientes. Descubra, de modo conversacional, o segmento, a necessidade principal, o volume aproximado, o prazo desejado e o melhor contato para continuidade. Explique somente capacidades confirmadas pelo material disponível. Não prometa descontos, integrações, prazos de implantação ou funcionalidades não aprovadas. Quando houver interesse concreto, resuma a oportunidade e transfira para a equipe comercial.",
    handoffKeywords: ["proposta", "preço", "contrato", "demonstração", "falar com vendas"],
    setupHint: "Conecte o provedor e simule um lead interessado em conhecer planos ou agendar uma demonstração.",
  },
  {
    id: "customer_care",
    name: "Atendimento ao Cliente",
    purpose: "Esclarece dúvidas de pedidos e serviços com linguagem acolhedora e encaminhamento seguro.",
    provider: "openai",
    mode: "chat",
    instructions: "Você atende clientes existentes com cordialidade e clareza. Confirme o tema da solicitação e peça apenas os dados mínimos necessários, como número de pedido ou referência do serviço, sem solicitar senhas ou dados completos de pagamento. Use informações integradas somente quando estiverem disponíveis e confirmadas. Transfira para uma pessoa em casos de cancelamento, reembolso, cobrança divergente, reclamação, exceção de política ou ausência de dados suficientes.",
    handoffKeywords: ["cancelar", "reembolso", "cobrança", "reclamação", "atendente"],
    setupHint: "Conecte o provedor e valide uma dúvida de pedido e uma solicitação de reembolso para conferir a transferência.",
  },
  {
    id: "technical_echo",
    name: "Echo de Validação",
    purpose: "Espelha mensagens de forma controlada para validar a conexão técnica do canal e do provedor.",
    provider: "openai",
    mode: "chat",
    instructions: "Você é um agente de validação técnica. Responda reproduzindo uma única vez o texto da última mensagem do contato, precedido por 'Recebido: '. Não acrescente explicações, conselhos, dados pessoais ou novas perguntas. Se não houver texto identificável, responda somente 'Recebido: mensagem sem conteúdo textual'.",
    handoffKeywords: ["humano", "parar", "encerrar"],
    setupHint: "Use apenas em homologação: envie uma frase curta pelo canal e confirme se a resposta retorna corretamente.",
  },
  {
    id: "welcome",
    name: "Boas-vindas",
    purpose: "Apresenta a operação e orienta o contato para o canal ou equipe adequada.",
    provider: "openai",
    mode: "chat",
    instructions: "Você recebe novos contatos. Dê boas-vindas em linguagem breve, explique que pode orientar sobre atendimento, suporte ou comercial e pergunte qual assunto a pessoa deseja tratar. Não afirme horários, políticas ou informações específicas da empresa sem uma fonte configurada. Se o contato pedir uma pessoa, apresentar reclamação ou relatar urgência, transfira sem prolongar a conversa.",
    handoffKeywords: ["atendente", "humano", "reclamação", "urgente", "supervisor"],
    setupHint: "Conecte o provedor e teste a primeira mensagem de um novo contato e uma solicitação de transferência humana.",
  },
];

export function findPresetAgent(presetId: string) {
  return presetAgents.find(preset => preset.id === presetId);
}
