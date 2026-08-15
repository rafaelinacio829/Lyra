import { describe, expect, it } from "vitest";

describe("código de ativação inicial", () => {
  it("está configurado e possui comprimento mínimo seguro", () => {
    expect(process.env.LOCAL_AUTH_BOOTSTRAP_CODE).toBeTypeOf("string");
    expect(process.env.LOCAL_AUTH_BOOTSTRAP_CODE?.trim().length).toBeGreaterThanOrEqual(16);
  });
});
