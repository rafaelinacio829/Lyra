import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mine, list, detail, escalations, integrations, create, send, addNote, transfer, updateTags, toggleReaction, acknowledgeEscalation, exportConversation } = vi.hoisted(() => ({ mine: vi.fn(), list: vi.fn(), detail: vi.fn(), escalations: vi.fn(), integrations: vi.fn(), create: vi.fn(), send: vi.fn(), addNote: vi.fn(), transfer: vi.fn(), updateTags: vi.fn(), toggleReaction: vi.fn(), acknowledgeEscalation: vi.fn(), exportConversation: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { tenant: { mine: { useQuery: mine } }, integrations: { list: { useQuery: integrations } }, conversations: { list: { useQuery: list }, detail: { useQuery: detail }, escalations: { useQuery: escalations }, create: { useMutation: create }, send: { useMutation: send }, addNote: { useMutation: addNote }, transfer: { useMutation: transfer }, updateTags: { useMutation: updateTags }, toggleReaction: { useMutation: toggleReaction }, acknowledgeEscalation: { useMutation: acknowledgeEscalation } }, reports: { exportConversation: { useQuery: exportConversation } } } }));
import ConversationsPage from "./ConversationsPage";

const mutation = { mutate: vi.fn(), isPending: false };
describe("ConversationsPage multicanal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mine.mockReturnValue({ isLoading: false, data: [{ id: 7 }] });
    integrations.mockReturnValue({ data: [{ id: 21, provider: "meta", name: "Vendas", status: "active" }, { id: 22, provider: "zapi", name: "Suporte", status: "active" }] });
    list.mockReturnValue({ isLoading: false, data: [{ id: 40, queue: "human", latestMessagePreview: "Olá", unreadCount: 0, updatedAt: new Date(), contactName: "Ana", whatsappConnectionName: "Vendas", whatsappProvider: "meta" }] });
    detail.mockReturnValue({ isLoading: false, data: { conversation: { id: 40, queue: "human", tags: [], contactName: "Ana", contactPhone: "5511999999999", integrationConfigId: 21, whatsappConnectionName: "Vendas", whatsappProvider: "meta" }, messages: [] }, refetch: vi.fn() });
    escalations.mockReturnValue({ data: [], refetch: vi.fn() }); exportConversation.mockReturnValue({ refetch: vi.fn() });
    [create, send, addNote, transfer, updateTags, toggleReaction, acknowledgeEscalation].forEach(hook => hook.mockReturnValue(mutation));
  });
  it("mostra a origem e inclui a conexão selecionada no envio externo", () => {
    render(<ConversationsPage />);
    expect(screen.getByText(/Origem: Meta · Vendas/)).toBeInTheDocument();
    const selectors = screen.getAllByLabelText("Conexão WhatsApp") as HTMLSelectElement[];
    expect(selectors.length).toBeGreaterThan(0);
    fireEvent.change(selectors.at(-1)!, { target: { value: "22" } });
    fireEvent.change(screen.getByPlaceholderText("Escreva uma mensagem"), { target: { value: "Resposta pelo suporte" } });
    fireEvent.submit(screen.getByPlaceholderText("Escreva uma mensagem").closest("form")!);
    expect(mutation.mutate).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 40, integrationId: 22, body: "Resposta pelo suporte" }));
  });
});
