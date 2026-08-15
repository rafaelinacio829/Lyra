import { describe, expect, it } from "vitest";
import { decodeOAuthState, encodeOAuthState, sanitizeOAuthReturnTo } from "./const";

describe("retorno OAuth", () => {
  it("preserva destinos internos permitidos no state da autenticação", () => {
    expect(decodeOAuthState(encodeOAuthState({ redirectUri: "https://lyra.test/api/oauth/callback", nonce: "nonce", returnTo: "/onboarding" })).returnTo).toBe("/onboarding");
    expect(sanitizeOAuthReturnTo("/app")).toBe("/app");
  });
  it("bloqueia destinos externos e mantém o onboarding como retorno seguro", () => {
    expect(sanitizeOAuthReturnTo("https://malicioso.test")).toBe("/onboarding");
    expect(sanitizeOAuthReturnTo("//malicioso.test")).toBe("/onboarding");
  });
});
