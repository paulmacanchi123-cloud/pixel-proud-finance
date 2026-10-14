import { describe, it, expect } from "vitest";
import { summarize } from "@/lib/finance-summary";

describe("finance summary (original formulas)", () => {
  it("empty data yields zeros and isEmpty", () => {
    const s = summarize(null);
    expect(s.patrimonio).toBe(0);
    expect(s.isEmpty).toBe(true);
  });

  it("transfers between own accounts do not change available money", () => {
    const s = summarize({
      accounts: [{ id: "a", type: "Efectivo", initialBalance: 100 }, { id: "b", type: "Ahorros", initialBalance: 0 }],
      movements: [{ type: "Transferencia", accountId: "a", toAccountId: "b", amount: 40 }],
    });
    expect(s.dineroDisponible).toBe(100);
  });

  it("patrimonio = disponible + inversiones + capital + por cobrar - deudas", () => {
    const s = summarize({
      accounts: [{ id: "a", type: "Efectivo", initialBalance: 1000 }],
      movements: [{ type: "Gasto", accountId: "a", amount: 200 }],
      investments: [{ status: "activa", valorActual: 300 }, { status: "cerrada", valorActual: 999 }],
      businesses: [{ capitalAportado: 500, capitalRetirado: 100 }],
      receivables: [{ montoOriginal: 60, payments: [] }],
      debts: [{ montoOriginal: 90, payments: [{ amount: 30 }] }],
    });
    expect(s.patrimonio).toBe(800 + 300 + 400 + 60 - 60);
  });
});
