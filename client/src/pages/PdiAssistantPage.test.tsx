import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import PdiAssistantPage from "./PdiAssistantPage";

describe("PdiAssistantPage", () => {
  it("conduz o usuário pelas duas etapas e gera uma direção estruturada", () => {
    render(<PdiAssistantPage />);

    fireEvent.click(screen.getByRole("button", { name: "Comunicação" }));
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    fireEvent.change(screen.getByLabelText("Situação real de trabalho"), {
      target: { value: "Em uma reunião, minhas ideias não ficaram claras." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Gerar minha direção/ }));

    expect(screen.getByText("Meta reescrita")).toBeInTheDocument();
    expect(screen.getByText("Ação prática")).toBeInTheDocument();
    expect(screen.getByText("Evidência de evolução")).toBeInTheDocument();
    expect(screen.getByText("Trilha eduCa")).toBeInTheDocument();
    expect(screen.getByText(/não uma avaliação/)).toBeInTheDocument();
  });

  it("aceita uma competência fora da lista editável", () => {
    render(<PdiAssistantPage />);
    fireEvent.change(screen.getByPlaceholderText("Outra competência (opcional)"), { target: { value: "Pensamento estratégico" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByText("Conte uma situação real de trabalho")).toBeInTheDocument();
  });
});
