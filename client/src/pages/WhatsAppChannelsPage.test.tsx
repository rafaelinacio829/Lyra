import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mine, whatsappChannels, setDefault } = vi.hoisted(() => ({ mine: vi.fn(), whatsappChannels: vi.fn(), setDefault: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { tenant: { mine: { useQuery: mine } }, integrations: { whatsappChannels: { useQuery: whatsappChannels }, setDefaultWhatsAppChannel: { useMutation: setDefault } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/app/whatsapp-channels", vi.fn()] }));
import WhatsAppChannelsPage from "./WhatsAppChannelsPage";

describe("WhatsAppChannelsPage", () => {
  beforeEach(() => { vi.clearAllMocks(); mine.mockReturnValue({ isLoading: false, data: [{ id: 7 }] }); whatsappChannels.mockReturnValue({ isLoading: false, data: { defaultIntegrationId: 21, channels: [{ id: 21, name: "Vendas", provider: "meta", status: "active", isDefault: true, totalConversations: 12, pendingConversations: 3, avgFirstResponseMinutes: 4.5, lastActivityAt: new Date("2026-08-16"), lastVerifiedAt: new Date("2026-08-15"), lastError: null }, { id: 22, name: "Suporte", provider: "zapi", status: "active", isDefault: false, totalConversations: 6, pendingConversations: 1, avgFirstResponseMinutes: null, lastActivityAt: null, lastVerifiedAt: null, lastError: null }] }, refetch: vi.fn() }); setDefault.mockReturnValue({ mutate: vi.fn(), isPending: false }); });
  it("exibe métricas por conexão e permite selecionar outro canal ativo como padrão", () => {
    render(<WhatsAppChannelsPage />);
    expect(screen.getByText("Canais WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Vendas")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /definir padrão/i }));
    expect(setDefault().mutate).toHaveBeenCalledWith({ tenantId: 7, integrationId: 22 });
  });
});
