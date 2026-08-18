import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetMutate } = vi.hoisted(() => ({ resetMutate: vi.fn() }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, user: null }) }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
  tenant: { mine: { useQuery: () => ({ data: undefined, isLoading: false }) } },
  auth: {
    login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    register: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    bootstrapAdmin: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    resetPasswordWithRecoveryCode: { useMutation: () => ({ mutate: resetMutate, isPending: false }) },
  },
} }));
vi.mock("wouter", () => ({ Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>, useLocation: () => ["/login", vi.fn()] }));
import CustomerLogin from "./CustomerLogin";

describe("CustomerLogin recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it("permite definir uma nova senha com código administrativo temporário", () => {
    render(<CustomerLogin />);
    fireEvent.click(screen.getByRole("button", { name: "Recuperar" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "cliente@acme.test" } });
    fireEvent.change(screen.getByLabelText("Código temporário de recuperação"), { target: { value: "ABCD-EF12-3456-7890-ABCD" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "Nova-senha-segura-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Redefinir minha senha" }));
    expect(resetMutate).toHaveBeenCalledWith({ email: "cliente@acme.test", recoveryCode: "ABCD-EF12-3456-7890-ABCD", newPassword: "Nova-senha-segura-2026" });
  });
});
