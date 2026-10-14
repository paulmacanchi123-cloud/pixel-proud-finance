// Read-only summary mirroring the original MI POL Finance formulas (see legacy/finanzas.jsx).
type Any = Record<string, any>;
export type FinanceData = {
  accounts: Any[]; movements: Any[]; businesses: Any[]; investments: Any[];
  receivables: Any[]; debts: Any[]; snapshots: Any[];
};
const n = (v: unknown) => Number(v) || 0;

export function summarize(raw: Partial<FinanceData> | null | undefined) {
  const D: FinanceData = {
    accounts: raw?.accounts ?? [], movements: raw?.movements ?? [], businesses: raw?.businesses ?? [],
    investments: raw?.investments ?? [], receivables: raw?.receivables ?? [], debts: raw?.debts ?? [],
    snapshots: raw?.snapshots ?? [],
  };
  const accountBalance = (id: string) => {
    const acc = D.accounts.find((a) => a.id === id);
    if (!acc) return 0;
    let bal = n(acc.initialBalance);
    for (const m of D.movements) {
      const amt = n(m.amount);
      if (m.type === "Ingreso" && m.accountId === id) bal += amt;
      else if (m.type === "Gasto" && m.accountId === id) bal -= amt;
      else if (m.type === "Transferencia") {
        if (m.accountId === id) bal -= amt;
        if (m.toAccountId === id) bal += amt;
      }
    }
    return bal;
  };
  const saldo = (it: Any) => Math.max(n(it.montoOriginal) - (it.payments ?? []).reduce((s: number, p: Any) => s + n(p.amount), 0), 0);
  const dineroDisponible = D.accounts.filter((a) => a.type !== "Inversión").reduce((s, a) => s + accountBalance(a.id), 0);
  const inversionesCuentas = D.accounts.filter((a) => a.type === "Inversión").reduce((s, a) => s + accountBalance(a.id), 0);
  const inversionesActivas = D.investments.filter((i) => i.status === "activa").reduce((s, i) => s + n(i.valorActual), 0);
  const totalInversiones = inversionesCuentas + inversionesActivas;
  const capitalNegocios = D.businesses.reduce((s, b) => s + n(b.capitalAportado) - n(b.capitalRetirado), 0);
  const totalPorCobrar = D.receivables.reduce((s, r) => s + saldo(r), 0);
  const totalDeudas = D.debts.reduce((s, d) => s + saldo(d), 0);
  const totalIngresos = D.movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + n(m.amount), 0);
  const totalGastos = D.movements.filter((m) => m.type === "Gasto").reduce((s, m) => s + n(m.amount), 0);
  const patrimonio = dineroDisponible + totalInversiones + capitalNegocios + totalPorCobrar - totalDeudas;
  const recent = [...D.movements].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  const overdue = [...D.receivables, ...D.debts].filter((x) => x.fechaLimite && x.fechaLimite < new Date().toISOString().slice(0, 10) && saldo(x) > 0).length;
  const isEmpty = D.accounts.length + D.movements.length + D.businesses.length + D.investments.length + D.receivables.length + D.debts.length === 0;
  return {
    dineroDisponible, totalInversiones, capitalNegocios, totalPorCobrar, totalDeudas,
    totalIngresos, totalGastos, flujoNeto: totalIngresos - totalGastos, patrimonio,
    accounts: D.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, balance: accountBalance(a.id) })),
    businesses: D.businesses.length, snapshots: D.snapshots, recent, overdue, isEmpty,
  };
}
