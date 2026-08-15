import { describe, expect, it } from "vitest";
import { extractAiText } from "./aiProvider";

describe("adaptador de provedores de IA", () => {
  it("extrai texto de respostas estruturadas sem acoplar a orquestração ao provedor", () => {
    expect(extractAiText({ metadata: { answer: "Resposta configurada" } })).toBe("Resposta configurada");
    expect(extractAiText({ data: [] })).toBeNull();
  });
});
