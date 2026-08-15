import { describe, expect, it } from "vitest";
import { buildActivationJourney } from "./activationJourney";

describe("jornada de ativação", () => {
  it("direciona um novo tenant para a conexão de canal primeiro", () => {
    const journey = buildActivationJourney({ channelsReady: 0, activeAgents: 0, activeMembers: 1, conversations: 0 });
    expect(journey.percent).toBe(0); expect(journey.nextStep?.id).toBe("channel"); expect(journey.isComplete).toBe(false);
  });

  it("conclui a jornada somente quando canal, agente, equipe e conversa estiverem ativos", () => {
    const journey = buildActivationJourney({ channelsReady: 1, activeAgents: 1, activeMembers: 2, conversations: 1 });
    expect(journey.isComplete).toBe(true); expect(journey.percent).toBe(100); expect(journey.nextStep).toBeNull();
  });
});
