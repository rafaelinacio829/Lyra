import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantMine, overview, invoices, addonCatalog, addons, createCheckout, createPortal, changePlan, createAddonCheckout } = vi.hoisted(() => ({ tenantMine: vi.fn(), overview: vi.fn(), invoices: vi.fn(), addonCatalog: vi.fn(), addons: vi.fn(), createCheckout: vi.fn(), createPortal: vi.fn(), changePlan: vi.fn(), createAddonCheckout: vi.fn() }));
vi.mock("@/lib/trpc", () => ({ trpc: { tenant: { mine: { useQuery: tenantMine } }, billing: { overview: { useQuery: overview }, invoices: { useQuery: invoices }, addonCatalog: { useQuery: addonCatalog }, addons: { useQuery: addons }, createCheckout: { useMutation: createCheckout }, createPortal: { useMutation: createPortal }, changePlan: { useMutation: changePlan }, createAddonCheckout: { useMutation: createAddonCheckout } } } }));
vi.mock("wouter", () => ({ useLocation: () => ["/app/billing", vi.fn()] }));

import BillingPage from "./BillingPage";

const billingOverview = { planName: "Starter", status: "trialing", billingMethod: "stripe", trialEndsAt: new Date("2026-08-29T00:00:00Z"), providerSubscriptionId: null, providerCustomerId: null };
const mutation = { mutate: vi.fn(), isPending: false };

describe("BillingPage runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks(); tenantMine.mockReturnValue({ isLoading: false, data: [{ id: 7 }] });
    overview.mockImplementation(({ tenantId }: { tenantId: number }) => tenantId === 7 ? { isLoading: false, data: billingOverview, isError: false, refetch: vi.fn() } : { isLoading: false, data: undefined, isError: false, refetch: vi.fn() });
    invoices.mockReturnValue({ data: [] }); addonCatalog.mockReturnValue({ data: [] }); addons.mockReturnValue({ data: [] }); createCheckout.mockReturnValue(mutation); createPortal.mockReturnValue(mutation); changePlan.mockReturnValue(mutation); createAddonCheckout.mockReturnValue(mutation);
  });
  it("mantém a renderização estável quando o tenant é definido após a primeira consulta", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<BillingPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Plano Starter" })).toBeInTheDocument());
    expect(screen.getByText("Faturas recentes")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("Rendered more hooks"));
    consoleError.mockRestore();
  });
});
