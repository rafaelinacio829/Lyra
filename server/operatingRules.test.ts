import { describe, expect, it } from "vitest";
import { decideInboundRouting, defaultBusinessHours, describeOperatingRule, isWithinBusinessHours, normalizeBusinessHours } from "./operatingRules";

describe("regras operacionais", () => {
  it("mantém um horário comercial seguro quando a configuração é inválida", () => {
    expect(normalizeBusinessHours([{ day: 1, start: "9:00", end: "18:00" }])).toEqual(defaultBusinessHours);
  });
  it("resume regras habilitadas sem prometer automação externa", () => {
    expect(describeOperatingRule({ isEnabled: true, firstResponseSlaMinutes: 15, inboundRouting: "ai_first", handoffOutsideBusinessHours: true, autoEscalateUnassigned: true })).toContain("15 min");
  });
  it("avalia o horário comercial no fuso do tenant", () => {
    const hours = [{ day: 1, start: "09:00", end: "18:00" }];
    expect(isWithinBusinessHours(new Date("2026-08-17T12:00:00Z"), "America/Sao_Paulo", hours)).toBe(true);
    expect(isWithinBusinessHours(new Date("2026-08-17T22:00:00Z"), "America/Sao_Paulo", hours)).toBe(false);
  });
  it("roteia entrada diretamente para humano quando a política do tenant exigir", () => {
    expect(decideInboundRouting({ isEnabled: true, inboundRouting: "human_first", handoffOutsideBusinessHours: false, timezone: "America/Sao_Paulo", businessHours: defaultBusinessHours })).toBe("human");
  });
});
