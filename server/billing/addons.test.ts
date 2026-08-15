import { describe, expect, it } from "vitest";
import { addonAmount, addonCapacity, capacityAddonCatalog } from "./addons";

describe("catálogo de capacidade adicional", () => {
  it("calcula capacidade e preço mensal de pacotes recorrentes", () => {
    expect(addonCapacity("members", 3)).toBe(3); expect(addonCapacity("messages", 2)).toBe(20_000);
    expect(addonAmount("agents", 2)).toBe(capacityAddonCatalog.agents.monthlyCents * 2);
  });
});
