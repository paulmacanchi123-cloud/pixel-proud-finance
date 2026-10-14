// @ts-nocheck
/* Módulo financiero original de MI POL Finance, conservado (fórmulas sin cambios). Ver legacy/finanzas.jsx */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import Papa from "papaparse";
import irisLogo from "@/assets/iris-logo.png.asset.json";
const LOGO_MIPOL = irisLogo.url;
import {
  LayoutGrid, ArrowLeftRight, Wallet, TrendingUp, TrendingDown,
  Briefcase, LineChart as LineChartIcon, HandCoins, ScrollText,
  Landmark, History, BarChart3, Upload, Download, Plus, Pencil,
  Trash2, Copy, X, Search, Check, AlertTriangle,
} from "lucide-react";

/* ---------------------------------- tokens --------------------------------- */
const T = {
  bg: "#F3F6FA",
  surface: "#FFFFFF",
  ink: "#0F1E3A",
  inkSoft: "#5A6B85",
  line: "#D6DEE9",
  lineSoft: "#E8EDF4",
  green: "#1F7A5A",
  greenBg: "#E3F2EC",
  red: "#B23A3A",
  redBg: "#F7E6E6",
  gold: "#8A9AB3",
  goldBg: "#EEF1F6",
  slate: "#2F5D8A",
  slateBg: "#E4EDF6",
  serif: '"Cormorant Garamond","Iowan Old Style",Georgia,serif',
  sans: '"Manrope",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

const ACCOUNT_TYPES = ["Efectivo", "Cuenta bancaria", "Cooperativa", "Cuenta digital", "Ahorros", "Inversión", "Otra"];
const INCOME_CATEGORIES = ["Ventas", "Negocios", "Inversiones", "Intereses", "Trabajo", "Dinero recibido", "Otros"];
const EXPENSE_CATEGORIES = ["Negocio", "Transporte", "Alimentación", "Compras", "Educación", "Tecnología", "Entretenimiento", "Inversión", "Otros"];
const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Otro"];
const PIE_COLORS = [T.green, T.red, T.gold, T.slate, "#7A6A8C", "#4E7A6B", "#B0562F", "#5E6B8C"];

/* ---------------------------------- seed ------------------------------------ */
const seed = () => {
  const accId1 = uid(), accId2 = uid(), accId3 = uid();
  const bizId1 = uid();
  const now = new Date();
  const d = (offsetDays) => {
    const x = new Date(now);
    x.setDate(x.getDate() - offsetDays);
    return x.toISOString().slice(0, 10);
  };
  const movementsList = [
    { id: uid(), date: d(30), type: "Ingreso", concept: "Venta de camiseta", category: "Negocios", subcategory: "Ropa", amount: 25, accountId: accId1, businessId: bizId1, person: "", paymentMethod: "Efectivo", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(28), type: "Gasto", concept: "Almuerzo", category: "Alimentación", subcategory: "", amount: 6.5, accountId: accId1, businessId: "", person: "", paymentMethod: "Efectivo", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(25), type: "Ingreso", concept: "Pago de cliente", category: "Ventas", subcategory: "", amount: 120, accountId: accId2, businessId: bizId1, person: "Cliente demo", paymentMethod: "Transferencia", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(20), type: "Gasto", concept: "Publicidad", category: "Negocio", subcategory: "Ads", amount: 40, accountId: accId2, businessId: bizId1, person: "", paymentMethod: "Tarjeta débito", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(15), type: "Transferencia", concept: "Ahorro mensual", category: "", subcategory: "", amount: 100, accountId: accId2, toAccountId: accId3, businessId: "", person: "", paymentMethod: "Transferencia", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(10), type: "Gasto", concept: "Curso en línea", category: "Educación", subcategory: "", amount: 35, accountId: accId3, businessId: "", person: "", paymentMethod: "Tarjeta crédito", notes: "", status: "Confirmado", demo: true },
    { id: uid(), date: d(4), type: "Ingreso", concept: "Intereses ahorro", category: "Intereses", subcategory: "", amount: 3.2, accountId: accId3, businessId: "", person: "", paymentMethod: "Transferencia", notes: "", status: "Confirmado", demo: true },
  ];

  // Snapshots de demostración: se calculan replicando la misma fórmula que
  // usa la app (efectivo real acumulado + capital/inversiones/por cobrar
  // menos deudas de la propia demo), no son cifras arbitrarias.
  const demoAccounts = [
    { id: accId1, type: "Efectivo", initialBalance: 150 },
    { id: accId2, type: "Cuenta bancaria", initialBalance: 800 },
    { id: accId3, type: "Ahorros", initialBalance: 500 },
  ];
  const offset = 340 /* valor inversión demo */ + 500 /* capital negocio demo */ + 60 /* por cobrar demo */ - 60 /* deuda pendiente demo */;
  let running = demoAccounts.reduce((s, a) => s + a.initialBalance, 0);
  const snapshots = [{ date: d(31), value: running + offset }];
  [...movementsList].sort((a, b) => a.date.localeCompare(b.date)).forEach((m) => {
    if (m.type === "Ingreso") running += m.amount;
    else if (m.type === "Gasto") running -= m.amount;
    // la transferencia demo es entre dos cuentas propias, no afecta el total
    snapshots.push({ date: m.date, value: running + offset, demo: true });
  });
  snapshots.forEach((s) => (s.demo = true));

  return {
    accounts: [
      { id: accId1, name: "Efectivo", type: "Efectivo", initialBalance: 150, bank: "", status: "activa", notes: "", demo: true },
      { id: accId2, name: "Cuenta principal", type: "Cuenta bancaria", initialBalance: 800, bank: "Banco Demo", status: "activa", notes: "", demo: true },
      { id: accId3, name: "Ahorros", type: "Ahorros", initialBalance: 500, bank: "Cooperativa Demo", status: "activa", notes: "", demo: true },
    ],
    businesses: [
      { id: bizId1, name: "Billion Company", description: "Negocio de demostración", capitalAportado: 500, capitalRetirado: 0, status: "activo", demo: true },
    ],
    investments: [
      { id: uid(), name: "Fondo demo", type: "Fondo indexado", startDate: d(120), capitalInvertido: 300, valorActual: 340, status: "activa", notes: "", demo: true },
    ],
    receivables: [
      { id: uid(), person: "Cliente demo", concept: "Saldo de venta", montoOriginal: 60, fecha: d(20), fechaLimite: d(-10), payments: [], status: "Pendiente", demo: true },
    ],
    debts: [
      { id: uid(), creditor: "Proveedor demo", concept: "Compra de insumos", montoOriginal: 90, fecha: d(15), fechaLimite: d(-5), payments: [{ id: uid(), date: d(5), amount: 30 }], status: "Parcial", demo: true },
    ],
    movements: movementsList,
    snapshots,
  };
};

const emptyData = () => ({ accounts: [], movements: [], businesses: [], investments: [], receivables: [], debts: [], snapshots: [] });
const LIST_KEYS = ["accounts", "movements", "businesses", "investments", "receivables", "debts", "snapshots"];
const normalizeData = (raw) => {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  LIST_KEYS.forEach((k) => { if (Array.isArray(raw[k])) base[k] = raw[k]; });
  return base;
};
// Valida la estructura de un respaldo JSON antes de modificar datos.
const validateBackup = (raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "El respaldo no es un objeto válido.";
  for (const k of LIST_KEYS) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) return `La sección "${k}" debe ser una lista.`;
    for (const it of raw[k] || []) if (!it || typeof it !== "object") return `Elemento inválido en "${k}".`;
  }
  if (!Array.isArray(raw.accounts) || !Array.isArray(raw.movements)) return "Faltan las secciones de cuentas o movimientos.";
  for (const m of raw.movements) {
    if (!isFinite(Number(m.amount)) || Number(m.amount) < 0) return "Hay movimientos con importes inválidos.";
    if (m.date && !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return "Hay movimientos con fechas inválidas.";
  }
  return null;
};
const movementKey = (m) => [m.date, m.type, (m.concept || "").trim().toLowerCase(), Number(m.amount).toFixed(2), m.accountId || "", m.toAccountId || ""].join("|");

/* ------------------------------- generic bits -------------------------------- */
function Panel({ children, style, className = "" }) {
  return (
    <div
      className={className}
      style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 4, ...style }}
    >
      {children}
    </div>
  );
}

function KPI({ label, value, tone = "ink", sub }) {
  const color = { ink: T.ink, green: T.green, red: T.red, gold: T.gold, slate: T.slate }[tone];
  return (
    <Panel style={{ padding: "18px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, letterSpacing: -0.3 }}>{value}</div>
      <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.inkSoft, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: color, marginTop: 3 }}>{sub}</div>}
    </Panel>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: T.sans, fontSize: 12.5, color: T.inkSoft }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  fontFamily: T.sans, fontSize: 13.5, color: T.ink, padding: "7px 9px",
  border: `1px solid ${T.line}`, borderRadius: 3, background: "#FEFDFB", outline: "none",
};

function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select({ children, ...props }) { return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>{children}</select>; }

function Btn({ children, onClick, tone = "ink", ghost, type = "button", style, disabled }) {
  const color = { ink: T.ink, green: T.green, red: T.red, gold: T.gold }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: T.sans, fontSize: 13, fontWeight: 500, cursor: disabled ? "default" : "pointer",
        padding: "7px 13px", borderRadius: 3, border: `1px solid ${color}`,
        background: ghost ? "transparent" : color, color: ghost ? color : "#FBFAF6",
        opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(34,39,31,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, borderRadius: 5, width: wide ? 620 : 460, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", border: `1px solid ${T.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkSoft }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

function Confirm({ text, onConfirm, onCancel }) {
  return (
    <Modal title="Confirmar" onClose={onCancel}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
        <AlertTriangle size={18} color={T.red} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontFamily: T.sans, fontSize: 13.5, color: T.ink }}>{text}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn ghost onClick={onCancel}>Cancelar</Btn>
        <Btn tone="red" onClick={onConfirm}>Eliminar</Btn>
      </div>
    </Modal>
  );
}

/* --------------------------------- app ---------------------------------- */
export default function FinanzasApp({ initialData, onSave, readOnly = false, canExport = true }) {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("dashboard");
  const fileRef = useRef(null);
  const backupRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        // IRIS: datos reales desde la nube. Nunca se generan datos de demostración automáticamente.
        setData(normalizeData(initialData));
      } catch (e) {
        setData(emptyData());
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready || !data) return;
    if (readOnly || !onSave) return;
    const t = setTimeout(() => { onSave(data); }, 600);
    return () => clearTimeout(t);
  }, [data, ready]);

  // IMPORTANT: no hooks may be called after this point conditionally.
  // `D` is a always-defined fallback so every hook below runs on every
  // render (including the very first one, before storage has loaded),
  // which avoids "rendered more/fewer hooks than previous render" (React #310).
  const D = data || emptyData();

  /* ------------------------- derived / computed values ------------------------- */
  const accountBalance = (accId) => {
    const acc = D.accounts.find((a) => a.id === accId);
    if (!acc) return 0;
    let bal = Number(acc.initialBalance) || 0;
    D.movements.forEach((m) => {
      const amt = Number(m.amount) || 0;
      if (m.type === "Ingreso" && m.accountId === accId) bal += amt;
      else if (m.type === "Gasto" && m.accountId === accId) bal -= amt;
      else if (m.type === "Transferencia") {
        if (m.accountId === accId) bal -= amt;
        if (m.toAccountId === accId) bal += amt;
      }
    });
    return bal;
  };

  const dineroDisponible = useMemo(
    () => D.accounts.filter((a) => a.type !== "Inversión").reduce((s, a) => s + accountBalance(a.id), 0),
    [D]
  );
  const inversionesCuentas = useMemo(
    () => D.accounts.filter((a) => a.type === "Inversión").reduce((s, a) => s + accountBalance(a.id), 0),
    [D]
  );
  const inversionesActivas = useMemo(
    () => D.investments.filter((i) => i.status === "activa").reduce((s, i) => s + (Number(i.valorActual) || 0), 0),
    [D]
  );
  const totalInversiones = inversionesCuentas + inversionesActivas;

  const negocioStats = (bizId) => {
    const ingresos = D.movements.filter((m) => m.type === "Ingreso" && m.businessId === bizId).reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const gastos = D.movements.filter((m) => m.type === "Gasto" && m.businessId === bizId).reduce((s, m) => s + (Number(m.amount) || 0), 0);
    return { ingresos, gastos, utilidad: ingresos - gastos };
  };
  const capitalNegocios = useMemo(
    () => D.businesses.reduce((s, b) => s + (Number(b.capitalAportado) || 0) - (Number(b.capitalRetirado) || 0), 0),
    [D]
  );

  const saldoPendiente = (item) => {
    const pagado = (item.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.max((Number(item.montoOriginal) || 0) - pagado, 0);
  };
  const totalPorCobrar = useMemo(() => D.receivables.reduce((s, r) => s + saldoPendiente(r), 0), [D]);
  const totalDeudas = useMemo(() => D.debts.reduce((s, d) => s + saldoPendiente(d), 0), [D]);

  const totalIngresos = useMemo(() => D.movements.filter((m) => m.type === "Ingreso").reduce((s, m) => s + (Number(m.amount) || 0), 0), [D]);
  const totalGastos = useMemo(() => D.movements.filter((m) => m.type === "Gasto").reduce((s, m) => s + (Number(m.amount) || 0), 0), [D]);
  const flujoNeto = totalIngresos - totalGastos;
  const patrimonio = dineroDisponible + totalInversiones + capitalNegocios + totalPorCobrar - totalDeudas;

  // Registra un snapshot real del patrimonio del día de hoy cada vez que
  // cambia (no se inventa historial: solo se guarda el valor calculado en
  // el momento). Esto alimenta el gráfico "Evolución del patrimonio".
  useEffect(() => {
    if (!ready || !data) return;
    const today = todayISO();
    setData((d) => {
      const base = d || emptyData();
      const snaps = base.snapshots || [];
      const last = snaps[snaps.length - 1];
      if (last && last.date === today && last.value === patrimonio) return base;
      const trimmed = last && last.date === today ? snaps.slice(0, -1) : snaps;
      return { ...base, snapshots: [...trimmed, { date: today, value: patrimonio }] };
    });
  }, [ready, patrimonio]);

  /* ------------------------------ mutations ------------------------------ */
  const patch = (key, updater) => setData((d) => ({ ...(d || emptyData()), [key]: updater((d || emptyData())[key]) }));
  const addItem = (key, item) => patch(key, (list) => [...list, { id: uid(), ...item }]);
  const updateItem = (key, id, fields) => patch(key, (list) => list.map((it) => (it.id === id ? { ...it, ...fields } : it)));
  const removeItem = (key, id) => patch(key, (list) => list.filter((it) => it.id !== id));

  const clearDemo = () => {
    setData((d) => {
      const base = d || emptyData();
      return {
        accounts: base.accounts.filter((a) => !a.demo),
        movements: base.movements.filter((m) => !m.demo),
        businesses: base.businesses.filter((b) => !b.demo),
        investments: base.investments.filter((i) => !i.demo),
        receivables: base.receivables.filter((r) => !r.demo),
        debts: base.debts.filter((x) => !x.demo),
        snapshots: (base.snapshots || []).filter((s) => !s.demo),
      };
    });
  };
  const hasDemo = [...D.accounts, ...D.movements, ...D.businesses, ...D.investments, ...D.receivables, ...D.debts, ...(D.snapshots || [])].some((x) => x.demo);

  /* ------------------------------- CSV / backup ------------------------------- */
  const download = (filename, content, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMovementsCSV = () => {
    const rows = D.movements.map((m) => ({
      fecha: m.date, tipo: m.type, concepto: m.concept, categoria: m.category, subcategoria: m.subcategory,
      monto: m.amount, cuenta: D.accounts.find((a) => a.id === m.accountId)?.name || "",
      cuenta_destino: D.accounts.find((a) => a.id === m.toAccountId)?.name || "",
      negocio: D.businesses.find((b) => b.id === m.businessId)?.name || "",
      persona: m.person, metodo_pago: m.paymentMethod, notas: m.notes, estado: m.status,
    }));
    download("movimientos.csv", Papa.unparse(rows), "text/csv");
  };

  const exportSummary = () => {
    const lines = [
      "Resumen financiero", "",
      `Dinero disponible,${dineroDisponible.toFixed(2)}`,
      `Total ingresos,${totalIngresos.toFixed(2)}`,
      `Total gastos,${totalGastos.toFixed(2)}`,
      `Flujo neto,${flujoNeto.toFixed(2)}`,
      `Inversiones,${totalInversiones.toFixed(2)}`,
      `Capital en negocios,${capitalNegocios.toFixed(2)}`,
      `Por cobrar,${totalPorCobrar.toFixed(2)}`,
      `Deudas,${totalDeudas.toFixed(2)}`,
      `Patrimonio,${patrimonio.toFixed(2)}`,
    ];
    download("resumen_financiero.csv", lines.join("\n"), "text/csv");
  };

  const importMovementsCSV = (file) => {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const findAccId = (name) => D.accounts.find((a) => a.name === name)?.id || "";
        const findBizId = (name) => D.businesses.find((b) => b.name === name)?.id || "";
        const imported = res.data.map((r) => ({
          id: uid(), date: r.fecha || todayISO(), type: r.tipo || "Gasto",
          concept: r.concepto || "", category: r.categoria || "", subcategory: r.subcategoria || "",
          amount: Number(r.monto) || 0, accountId: findAccId(r.cuenta), toAccountId: findAccId(r.cuenta_destino),
          businessId: findBizId(r.negocio), person: r.persona || "", paymentMethod: r.metodo_pago || "",
          notes: r.notas || "", status: r.estado || "Confirmado",
        }));
        const valid = imported.filter((m) => m.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && ["Ingreso", "Gasto", "Transferencia"].includes(m.type));
        const existing = new Set(D.movements.map(movementKey));
        const fresh = [];
        valid.forEach((m) => { const k = movementKey(m); if (!existing.has(k)) { existing.add(k); fresh.push(m); } });
        const dup = valid.length - fresh.length, bad = imported.length - valid.length;
        patch("movements", (list) => [...list, ...fresh]);
        alert(`Importados: ${fresh.length}. Duplicados omitidos: ${dup}. Filas inválidas omitidas: ${bad}.`);
      },
    });
  };

  const exportBackup = () => download("respaldo_finanzas.json", JSON.stringify(D, null, 2), "application/json");
  const restoreBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const err = validateBackup(parsed);
        if (err) { alert("Respaldo rechazado: " + err); return; }
        if (!confirm("Esto reemplazará los datos actuales por los del respaldo. ¿Continuar?")) return;
        setData(normalizeData(parsed));
      } catch (e) { alert("Archivo de respaldo inválido."); }
    };
    reader.readAsText(file);
  };

  /* --------------------------------- nav --------------------------------- */
  const NAV_ALL = [
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "movimientos", label: "Movimientos", icon: ArrowLeftRight },
    { id: "cuentas", label: "Cuentas", icon: Wallet },
    { id: "ingresos", label: "Ingresos", icon: TrendingUp },
    { id: "gastos", label: "Gastos", icon: TrendingDown },
    { id: "negocios", label: "Negocios", icon: Briefcase },
    { id: "inversiones", label: "Inversiones", icon: LineChartIcon },
    { id: "porcobrar", label: "Por cobrar", icon: HandCoins },
    { id: "deudas", label: "Deudas", icon: ScrollText },
    { id: "patrimonio", label: "Patrimonio", icon: Landmark },
    { id: "historial", label: "Historial", icon: History },
    { id: "graficos", label: "Gráficos", icon: BarChart3 },
    { id: "datos", label: "Importar / exportar", icon: Upload },
  ];
  const NAV = canExport ? NAV_ALL : NAV_ALL.filter((n) => n.id !== "datos");

  // All hooks above this line run unconditionally on every render.
  // Only the JSX we return differs while the data is still loading —
  // this is a plain conditional render, not a conditional hook call.
  if (!ready || !data) {
    return (
      <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans, color: T.inkSoft }}>
        Cargando…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: 600, background: T.bg, fontFamily: T.sans, color: T.ink }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: ${T.line}; border-radius: 4px; } table { border-collapse: collapse; width: 100%; } th, td { text-align: left; padding: 8px 10px; font-size: 12.8px; } thead th { color: ${T.inkSoft}; font-weight: 500; border-bottom: 1px solid ${T.line}; } tbody tr { border-bottom: 1px solid ${T.lineSoft}; } tbody tr:hover { background: #FBFAF5; }`}</style>

      {/* sidebar */}
      <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${T.line}`, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ padding: "0 8px 18px" }}>
          <img
            src={LOGO_MIPOL}
            alt="IRIS"
            style={{ width: 96, height: 96, borderRadius: "50%", display: "block", margin: "0 auto" }}
          />
        </div>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 9px", borderRadius: 3, border: "none",
                background: active ? T.lineSoft : "transparent", color: active ? T.ink : T.inkSoft, cursor: "pointer",
                fontFamily: T.sans, fontSize: 13.3, textAlign: "left", fontWeight: active ? 600 : 400,
              }}>
              <Icon size={15} strokeWidth={1.8} /> {n.label}
            </button>
          );
        })}
      </div>

      {/* main */}
      <div style={{ flex: 1, padding: "26px 30px", overflow: "auto" }}>
        {readOnly && <div style={{ background: T.slateBg, color: T.slate, padding: "8px 12px", borderRadius: 4, fontSize: 12.5, marginBottom: 14 }}>Modo solo lectura: tus permisos no incluyen editar registros. Los cambios no se guardarán.</div>}
        {view === "dashboard" && <Dashboard {...{ dineroDisponible, totalIngresos, totalGastos, flujoNeto, patrimonio, capitalNegocios, totalInversiones, totalPorCobrar, totalDeudas }} />}
        {view === "movimientos" && <Movimientos data={data} accountBalance={accountBalance} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "cuentas" && <Cuentas data={data} accountBalance={accountBalance} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "ingresos" && <IngresosGastos data={data} type="Ingreso" categories={INCOME_CATEGORIES} />}
        {view === "gastos" && <IngresosGastos data={data} type="Gasto" categories={EXPENSE_CATEGORIES} />}
        {view === "negocios" && <Negocios data={data} negocioStats={negocioStats} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "inversiones" && <Inversiones data={data} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "porcobrar" && <CobrarDeber kind="cobrar" list={data.receivables} listKey="receivables" saldoPendiente={saldoPendiente} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "deudas" && <CobrarDeber kind="deudas" list={data.debts} listKey="debts" saldoPendiente={saldoPendiente} addItem={addItem} updateItem={updateItem} removeItem={removeItem} />}
        {view === "patrimonio" && <Patrimonio {...{ dineroDisponible, totalInversiones, capitalNegocios, totalPorCobrar, totalDeudas, patrimonio, data }} />}
        {view === "historial" && <Historial data={data} accountBalance={accountBalance} />}
        {view === "graficos" && <Graficos data={data} negocioStats={negocioStats} accountBalance={accountBalance} dineroDisponible={dineroDisponible} totalInversiones={totalInversiones} capitalNegocios={capitalNegocios} totalPorCobrar={totalPorCobrar} totalDeudas={totalDeudas} patrimonio={patrimonio} />}
        {view === "datos" && (
          <DatosView
            hasDemo={hasDemo} clearDemo={clearDemo}
            exportMovementsCSV={exportMovementsCSV} exportSummary={exportSummary}
            importMovementsCSV={importMovementsCSV} exportBackup={exportBackup} restoreBackup={restoreBackup}
            fileRef={fileRef} backupRef={backupRef}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Dashboard -------------------------------- */
function Dashboard(p) {
  return (
    <div>
      <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 4px" }}>Dashboard</h1>
      <p style={{ color: T.inkSoft, fontSize: 13, margin: "0 0 20px" }}>Estado general de tus finanzas personales y de negocio.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <KPI label="Dinero disponible" value={fmt(p.dineroDisponible)} tone="slate" />
        <KPI label="Total de ingresos" value={fmt(p.totalIngresos)} tone="green" />
        <KPI label="Total de gastos" value={fmt(p.totalGastos)} tone="red" />
        <KPI label="Flujo neto" value={fmt(p.flujoNeto)} tone={p.flujoNeto >= 0 ? "green" : "red"} />
        <KPI label="Patrimonio" value={fmt(p.patrimonio)} tone="gold" sub="Activos − pasivos" />
        <KPI label="Capital en negocios" value={fmt(p.capitalNegocios)} tone="ink" />
        <KPI label="Inversiones" value={fmt(p.totalInversiones)} tone="ink" />
        <KPI label="Por cobrar" value={fmt(p.totalPorCobrar)} tone="ink" />
      </div>
    </div>
  );
}

/* ------------------------------- Movimientos ------------------------------- */
function MovementForm({ data, initial, onSave, onClose }) {
  const [f, setF] = useState(initial || {
    date: todayISO(), type: "Gasto", concept: "", category: "", subcategory: "", amount: "",
    accountId: data.accounts[0]?.id || "", toAccountId: "", businessId: "", person: "",
    paymentMethod: "Efectivo", notes: "", status: "Confirmado",
  });
  const cats = f.type === "Ingreso" ? INCOME_CATEGORIES : f.type === "Gasto" ? EXPENSE_CATEGORIES : [];
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Field label="Fecha"><TextInput type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
      <Field label="Tipo">
        <Select value={f.type} onChange={(e) => set("type", e.target.value)}>
          <option>Ingreso</option><option>Gasto</option><option>Transferencia</option>
        </Select>
      </Field>
      <Field label="Concepto"><TextInput value={f.concept} onChange={(e) => set("concept", e.target.value)} /></Field>
      <Field label="Monto"><TextInput type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
      {f.type !== "Transferencia" && (
        <>
          <Field label="Categoría">
            <Select value={f.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">—</option>{cats.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Subcategoría"><TextInput value={f.subcategory} onChange={(e) => set("subcategory", e.target.value)} /></Field>
        </>
      )}
      <Field label={f.type === "Transferencia" ? "Cuenta origen" : "Cuenta"}>
        <Select value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
          <option value="">—</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      {f.type === "Transferencia" && (
        <Field label="Cuenta destino">
          <Select value={f.toAccountId} onChange={(e) => set("toAccountId", e.target.value)}>
            <option value="">—</option>{data.accounts.filter((a) => a.id !== f.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Negocio relacionado">
        <Select value={f.businessId} onChange={(e) => set("businessId", e.target.value)}>
          <option value="">—</option>{data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Persona relacionada"><TextInput value={f.person} onChange={(e) => set("person", e.target.value)} /></Field>
      <Field label="Método de pago">
        <Select value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </Field>
      <Field label="Estado">
        <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option>Confirmado</option><option>Pendiente</option>
        </Select>
      </Field>
      <div style={{ gridColumn: "1 / -1" }}>
        <Field label="Notas"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: 56 }} /></Field>
      </div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        <Btn tone="green" onClick={() => onSave(f)} disabled={!f.concept || !f.amount}><Check size={14} /> Guardar</Btn>
      </div>
    </div>
  );
}

function Movimientos({ data, addItem, updateItem, removeItem }) {
  const [modal, setModal] = useState(null); // {mode:'new'|'edit', item}
  const [confirmId, setConfirmId] = useState(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("fecha_desc");
  const [filterType, setFilterType] = useState("");

  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || "—";
  const bizName = (id) => data.businesses.find((b) => b.id === id)?.name || "";

  let rows = data.movements.filter((m) => {
    const s = q.toLowerCase();
    const matches = !s || [m.concept, m.category, accName(m.accountId), bizName(m.businessId), m.person].join(" ").toLowerCase().includes(s);
    return matches && (!filterType || m.type === filterType);
  });
  rows = rows.sort((a, b) => {
    if (sort === "fecha_desc") return b.date.localeCompare(a.date);
    if (sort === "fecha_asc") return a.date.localeCompare(b.date);
    if (sort === "monto_desc") return b.amount - a.amount;
    if (sort === "monto_asc") return a.amount - b.amount;
    if (sort === "tipo") return a.type.localeCompare(b.type);
    return 0;
  });

  const save = (f) => {
    const payload = { ...f, amount: Number(f.amount) };
    if (modal.mode === "edit") updateItem("movements", modal.item.id, payload);
    else addItem("movements", payload);
    setModal(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 4px" }}>Movimientos</h1>
          <p style={{ color: T.inkSoft, fontSize: 13, margin: 0 }}>{rows.length} registros</p>
        </div>
        <Btn tone="green" onClick={() => setModal({ mode: "new" })}><Plus size={14} /> Nuevo movimiento</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: T.inkSoft }} />
          <TextInput placeholder="Buscar concepto, categoría, cuenta, negocio, persona…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 28, width: 300 }} />
        </div>
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option><option>Ingreso</option><option>Gasto</option><option>Transferencia</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="fecha_desc">Fecha (recientes primero)</option>
          <option value="fecha_asc">Fecha (antiguas primero)</option>
          <option value="monto_desc">Mayor monto</option>
          <option value="monto_asc">Menor monto</option>
          <option value="tipo">Tipo</option>
        </Select>
      </div>

      <Panel>
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th>Negocio</th><th style={{ textAlign: "right" }}>Monto</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.date)}</td>
                <td style={{ color: m.type === "Ingreso" ? T.green : m.type === "Gasto" ? T.red : T.slate }}>{m.type}</td>
                <td>{m.concept}</td>
                <td>{m.category || "—"}</td>
                <td>{accName(m.accountId)}{m.toAccountId ? ` → ${accName(m.toAccountId)}` : ""}</td>
                <td>{bizName(m.businessId) || "—"}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(m.amount)}</td>
                <td>{m.status}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => setModal({ mode: "edit", item: m })} style={iconBtn}><Pencil size={13} /></button>
                  <button onClick={() => addItem("movements", { ...m, id: undefined, concept: m.concept + " (copia)" })} style={iconBtn}><Copy size={13} /></button>
                  <button onClick={() => setConfirmId(m.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: T.inkSoft, padding: 20 }}>Sin movimientos.</td></tr>}
          </tbody>
        </table>
      </Panel>

      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar movimiento" : "Nuevo movimiento"} onClose={() => setModal(null)} wide>
          <MovementForm data={data} initial={modal.item} onSave={save} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirmId && <Confirm text="¿Eliminar este movimiento? Los saldos se recalcularán automáticamente." onCancel={() => setConfirmId(null)} onConfirm={() => { removeItem("movements", confirmId); setConfirmId(null); }} />}
    </div>
  );
}
const iconBtn = { background: "none", border: "none", cursor: "pointer", padding: 4, color: T.inkSoft };

/* --------------------------------- Cuentas --------------------------------- */
function AccountForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", type: "Efectivo", initialBalance: "", bank: "", status: "activa", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Field label="Nombre"><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Tipo"><Select value={f.type} onChange={(e) => set("type", e.target.value)}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field label="Saldo inicial"><TextInput type="number" step="0.01" value={f.initialBalance} onChange={(e) => set("initialBalance", e.target.value)} /></Field>
      <Field label="Banco / institución"><TextInput value={f.bank} onChange={(e) => set("bank", e.target.value)} /></Field>
      <Field label="Estado"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="activa">Activa</option><option value="inactiva">Inactiva</option></Select></Field>
      <div style={{ gridColumn: "1 / -1" }}><Field label="Notas"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: 50 }} /></Field></div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        <Btn tone="green" onClick={() => onSave({ ...f, initialBalance: Number(f.initialBalance) || 0 })} disabled={!f.name}><Check size={14} /> Guardar</Btn>
      </div>
    </div>
  );
}

function Cuentas({ data, accountBalance, addItem, updateItem, removeItem }) {
  const [modal, setModal] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: 0 }}>Cuentas</h1>
        <Btn tone="green" onClick={() => setModal({ mode: "new" })}><Plus size={14} /> Nueva cuenta</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {data.accounts.map((a) => (
          <Panel key={a.id} style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontFamily: T.serif, fontSize: 16 }}>{a.name}</div>
              <div>
                <button onClick={() => setModal({ mode: "edit", item: a })} style={iconBtn}><Pencil size={13} /></button>
                <button onClick={() => setConfirmId(a.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>
              </div>
            </div>
            <div style={{ fontSize: 12, color: T.inkSoft, margin: "2px 0 10px" }}>{a.type}{a.bank ? ` · ${a.bank}` : ""} · {a.status}</div>
            <div style={{ fontFamily: T.serif, fontSize: 22 }}>{fmt(accountBalance(a.id))}</div>
          </Panel>
        ))}
        {data.accounts.length === 0 && <div style={{ color: T.inkSoft }}>No hay cuentas registradas.</div>}
      </div>
      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar cuenta" : "Nueva cuenta"} onClose={() => setModal(null)}>
          <AccountForm initial={modal.item} onClose={() => setModal(null)} onSave={(f) => { modal.mode === "edit" ? updateItem("accounts", modal.item.id, f) : addItem("accounts", f); setModal(null); }} />
        </Modal>
      )}
      {confirmId && <Confirm text="¿Eliminar esta cuenta? Los movimientos asociados no se eliminarán, pero quedarán sin cuenta válida." onCancel={() => setConfirmId(null)} onConfirm={() => { removeItem("accounts", confirmId); setConfirmId(null); }} />}
    </div>
  );
}

/* ---------------------------- Ingresos / Gastos ---------------------------- */
function IngresosGastos({ data, type, categories }) {
  const [cat, setCat] = useState(""); const [biz, setBiz] = useState(""); const [acc, setAcc] = useState("");
  const [person, setPerson] = useState(""); const [min, setMin] = useState(""); const [max, setMax] = useState("");
  const rows = data.movements.filter((m) => m.type === type)
    .filter((m) => !cat || m.category === cat)
    .filter((m) => !biz || m.businessId === biz)
    .filter((m) => !acc || m.accountId === acc)
    .filter((m) => !person || (m.person || "").toLowerCase().includes(person.toLowerCase()))
    .filter((m) => !min || m.amount >= Number(min))
    .filter((m) => !max || m.amount <= Number(max))
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, m) => s + m.amount, 0);
  const promedio = rows.length ? total / rows.length : 0;
  const mayor = rows.reduce((mx, m) => Math.max(mx, m.amount), 0);
  const tone = type === "Ingreso" ? "green" : "red";
  const accName = (id) => data.accounts.find((a) => a.id === id)?.name || "—";

  return (
    <div>
      <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 16px" }}>{type === "Ingreso" ? "Ingresos" : "Gastos"}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <KPI label={`Total de ${type === "Ingreso" ? "ingresos" : "gastos"}`} value={fmt(total)} tone={tone} />
        <KPI label="Número de registros" value={rows.length} tone="ink" />
        <KPI label="Promedio" value={fmt(promedio)} tone="ink" />
        <KPI label={`Mayor ${type === "Ingreso" ? "ingreso" : "gasto"}`} value={fmt(mayor)} tone="ink" />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Categoría (todas)</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={biz} onChange={(e) => setBiz(e.target.value)}><option value="">Negocio (todos)</option>{data.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        <Select value={acc} onChange={(e) => setAcc(e.target.value)}><option value="">Cuenta (todas)</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <TextInput placeholder="Persona" value={person} onChange={(e) => setPerson(e.target.value)} style={{ width: 120 }} />
        <TextInput placeholder="Monto mín." type="number" value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 100 }} />
        <TextInput placeholder="Monto máx." type="number" value={max} onChange={(e) => setMax(e.target.value)} style={{ width: 100 }} />
      </div>
      <Panel>
        <table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th>Persona</th><th style={{ textAlign: "right" }}>Monto</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}><td>{fmtDate(m.date)}</td><td>{m.concept}</td><td>{m.category || "—"}</td><td>{accName(m.accountId)}</td><td>{m.person || "—"}</td><td style={{ textAlign: "right" }}>{fmt(m.amount)}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: T.inkSoft, padding: 20 }}>Sin resultados.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

/* -------------------------------- Negocios -------------------------------- */
function BusinessForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", description: "", capitalAportado: "", capitalRetirado: "", status: "activo" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Field label="Nombre"><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Estado"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></Select></Field>
      <div style={{ gridColumn: "1 / -1" }}><Field label="Descripción"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, minHeight: 50 }} /></Field></div>
      <Field label="Capital aportado"><TextInput type="number" step="0.01" value={f.capitalAportado} onChange={(e) => set("capitalAportado", e.target.value)} /></Field>
      <Field label="Dinero retirado"><TextInput type="number" step="0.01" value={f.capitalRetirado} onChange={(e) => set("capitalRetirado", e.target.value)} /></Field>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        <Btn tone="green" onClick={() => onSave({ ...f, capitalAportado: Number(f.capitalAportado) || 0, capitalRetirado: Number(f.capitalRetirado) || 0 })} disabled={!f.name}><Check size={14} /> Guardar</Btn>
      </div>
    </div>
  );
}

function Negocios({ data, negocioStats, addItem, updateItem, removeItem }) {
  const [modal, setModal] = useState(null); const [confirmId, setConfirmId] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: 0 }}>Negocios</h1>
        <Btn tone="green" onClick={() => setModal({ mode: "new" })}><Plus size={14} /> Nuevo negocio</Btn>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {data.businesses.map((b) => {
          const s = negocioStats(b.id);
          const capitalActual = b.capitalAportado - b.capitalRetirado;
          return (
            <Panel key={b.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontFamily: T.serif, fontSize: 17 }}>{b.name}</div>
                <div>
                  <button onClick={() => setModal({ mode: "edit", item: b })} style={iconBtn}><Pencil size={13} /></button>
                  <button onClick={() => setConfirmId(b.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: T.inkSoft, margin: "2px 0 12px" }}>{b.description || "—"} · {b.status}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, fontSize: 12.5 }}>
                <div>Capital aportado <b style={{ float: "right" }}>{fmt(b.capitalAportado)}</b></div>
                <div>Dinero retirado <b style={{ float: "right" }}>{fmt(b.capitalRetirado)}</b></div>
                <div>Ingresos <b style={{ float: "right", color: T.green }}>{fmt(s.ingresos)}</b></div>
                <div>Gastos <b style={{ float: "right", color: T.red }}>{fmt(s.gastos)}</b></div>
                <div>Utilidad <b style={{ float: "right" }}>{fmt(s.utilidad)}</b></div>
                <div>Capital actual <b style={{ float: "right" }}>{fmt(capitalActual)}</b></div>
              </div>
            </Panel>
          );
        })}
        {data.businesses.length === 0 && <div style={{ color: T.inkSoft }}>No hay negocios registrados.</div>}
      </div>
      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar negocio" : "Nuevo negocio"} onClose={() => setModal(null)}>
          <BusinessForm initial={modal.item} onClose={() => setModal(null)} onSave={(f) => { modal.mode === "edit" ? updateItem("businesses", modal.item.id, f) : addItem("businesses", f); setModal(null); }} />
        </Modal>
      )}
      {confirmId && <Confirm text="¿Eliminar este negocio? Los movimientos ya no quedarán asociados a él." onCancel={() => setConfirmId(null)} onConfirm={() => { removeItem("businesses", confirmId); setConfirmId(null); }} />}
    </div>
  );
}

/* ------------------------------- Inversiones ------------------------------- */
function InvestmentForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: "", type: "", startDate: todayISO(), capitalInvertido: "", valorActual: "", status: "activa", notes: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Field label="Nombre"><TextInput value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="Tipo de inversión"><TextInput value={f.type} onChange={(e) => set("type", e.target.value)} /></Field>
      <Field label="Fecha inicial"><TextInput type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
      <Field label="Estado"><Select value={f.status} onChange={(e) => set("status", e.target.value)}><option value="activa">Activa</option><option value="finalizada">Finalizada</option></Select></Field>
      <Field label="Capital invertido"><TextInput type="number" step="0.01" value={f.capitalInvertido} onChange={(e) => set("capitalInvertido", e.target.value)} /></Field>
      <Field label="Valor actual"><TextInput type="number" step="0.01" value={f.valorActual} onChange={(e) => set("valorActual", e.target.value)} /></Field>
      <div style={{ gridColumn: "1 / -1" }}><Field label="Notas"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: 50 }} /></Field></div>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        <Btn tone="green" onClick={() => onSave({ ...f, capitalInvertido: Number(f.capitalInvertido) || 0, valorActual: Number(f.valorActual) || 0 })} disabled={!f.name}><Check size={14} /> Guardar</Btn>
      </div>
    </div>
  );
}

function Inversiones({ data, addItem, updateItem, removeItem }) {
  const [modal, setModal] = useState(null); const [confirmId, setConfirmId] = useState(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: 0 }}>Inversiones</h1>
        <Btn tone="green" onClick={() => setModal({ mode: "new" })}><Plus size={14} /> Nueva inversión</Btn>
      </div>
      <Panel>
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Inicio</th><th style={{ textAlign: "right" }}>Capital</th><th style={{ textAlign: "right" }}>Valor actual</th><th style={{ textAlign: "right" }}>Ganancia</th><th style={{ textAlign: "right" }}>Rendimiento</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {data.investments.map((i) => {
              const ganancia = i.valorActual - i.capitalInvertido;
              const rendimiento = i.capitalInvertido ? (ganancia / i.capitalInvertido) * 100 : 0;
              return (
                <tr key={i.id}>
                  <td>{i.name}</td><td>{i.type || "—"}</td><td>{fmtDate(i.startDate)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.capitalInvertido)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(i.valorActual)}</td>
                  <td style={{ textAlign: "right", color: ganancia >= 0 ? T.green : T.red }}>{fmt(ganancia)}</td>
                  <td style={{ textAlign: "right", color: ganancia >= 0 ? T.green : T.red }}>{pct(rendimiento)}</td>
                  <td>{i.status}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button onClick={() => setModal({ mode: "edit", item: i })} style={iconBtn}><Pencil size={13} /></button>
                    <button onClick={() => setConfirmId(i.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>
                  </td>
                </tr>
              );
            })}
            {data.investments.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: T.inkSoft, padding: 20 }}>Sin inversiones registradas.</td></tr>}
          </tbody>
        </table>
      </Panel>
      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar inversión" : "Nueva inversión"} onClose={() => setModal(null)}>
          <InvestmentForm initial={modal.item} onClose={() => setModal(null)} onSave={(f) => { modal.mode === "edit" ? updateItem("investments", modal.item.id, f) : addItem("investments", f); setModal(null); }} />
        </Modal>
      )}
      {confirmId && <Confirm text="¿Eliminar esta inversión?" onCancel={() => setConfirmId(null)} onConfirm={() => { removeItem("investments", confirmId); setConfirmId(null); }} />}
    </div>
  );
}

/* --------------------------- Por cobrar / Deudas --------------------------- */
function ReceivableDebtForm({ nameField, nameLabel, initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { [nameField]: "", concept: "", montoOriginal: "", fecha: todayISO(), fechaLimite: "", payments: [] });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <Field label={nameLabel}><TextInput value={f[nameField]} onChange={(e) => set(nameField, e.target.value)} /></Field>
      <Field label="Concepto"><TextInput value={f.concept} onChange={(e) => set("concept", e.target.value)} /></Field>
      <Field label="Monto original"><TextInput type="number" step="0.01" value={f.montoOriginal} onChange={(e) => set("montoOriginal", e.target.value)} /></Field>
      <Field label="Fecha"><TextInput type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
      <Field label="Fecha límite"><TextInput type="date" value={f.fechaLimite} onChange={(e) => set("fechaLimite", e.target.value)} /></Field>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn ghost onClick={onClose}>Cancelar</Btn>
        <Btn tone="green" onClick={() => onSave({ ...f, montoOriginal: Number(f.montoOriginal) || 0, payments: f.payments || [] })} disabled={!f[nameField] || !f.montoOriginal}><Check size={14} /> Guardar</Btn>
      </div>
    </div>
  );
}

function CobrarDeber({ kind, list, listKey, saldoPendiente, addItem, updateItem, removeItem }) {
  const isCobrar = kind === "cobrar";
  const nameField = isCobrar ? "person" : "creditor";
  const nameLabel = isCobrar ? "Persona" : "Acreedor";
  const [modal, setModal] = useState(null); const [confirmId, setConfirmId] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAmt, setPayAmt] = useState("");

  const statusOf = (item) => {
    const pend = saldoPendiente(item);
    if (pend <= 0) return "Pagado";
    if (item.payments && item.payments.length) return "Parcial";
    if (item.fechaLimite && item.fechaLimite < todayISO()) return "Vencido";
    return "Pendiente";
  };
  const statusColor = { Pagado: T.green, Parcial: T.gold, Vencido: T.red, Pendiente: T.inkSoft };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: 0 }}>{isCobrar ? "Cuentas por cobrar" : "Deudas"}</h1>
        <Btn tone="green" onClick={() => setModal({ mode: "new" })}><Plus size={14} /> {isCobrar ? "Nuevo registro" : "Nueva deuda"}</Btn>
      </div>
      <Panel>
        <table>
          <thead><tr><th>{nameLabel}</th><th>Concepto</th><th style={{ textAlign: "right" }}>Original</th><th style={{ textAlign: "right" }}>Pagado</th><th style={{ textAlign: "right" }}>Pendiente</th><th>Fecha límite</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {list.map((item) => {
              const pagado = (item.payments || []).reduce((s, p) => s + p.amount, 0);
              const pend = saldoPendiente(item);
              const st = statusOf(item);
              return (
                <tr key={item.id}>
                  <td>{item[nameField]}</td><td>{item.concept}</td>
                  <td style={{ textAlign: "right" }}>{fmt(item.montoOriginal)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(pagado)}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(pend)}</td>
                  <td>{fmtDate(item.fechaLimite)}</td>
                  <td style={{ color: statusColor[st] }}>{st}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {pend > 0 && <button onClick={() => { setPayModal(item); setPayAmt(""); }} style={iconBtn} title="Registrar pago"><HandCoins size={13} color={T.green} /></button>}
                    <button onClick={() => setModal({ mode: "edit", item })} style={iconBtn}><Pencil size={13} /></button>
                    <button onClick={() => setConfirmId(item.id)} style={iconBtn}><Trash2 size={13} color={T.red} /></button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: T.inkSoft, padding: 20 }}>Sin registros.</td></tr>}
          </tbody>
        </table>
      </Panel>
      {modal && (
        <Modal title={modal.mode === "edit" ? "Editar registro" : "Nuevo registro"} onClose={() => setModal(null)}>
          <ReceivableDebtForm nameField={nameField} nameLabel={nameLabel} initial={modal.item} onClose={() => setModal(null)} onSave={(f) => { modal.mode === "edit" ? updateItem(listKey, modal.item.id, f) : addItem(listKey, f); setModal(null); }} />
        </Modal>
      )}
      {payModal && (
        <Modal title="Registrar pago" onClose={() => setPayModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: T.inkSoft }}>Saldo pendiente actual: <b style={{ color: T.ink }}>{fmt(saldoPendiente(payModal))}</b></div>
            <Field label="Monto del pago"><TextInput type="number" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} /></Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn ghost onClick={() => setPayModal(null)}>Cancelar</Btn>
              <Btn tone="green" disabled={!payAmt} onClick={() => {
                updateItem(listKey, payModal.id, { payments: [...(payModal.payments || []), { id: uid(), date: todayISO(), amount: Number(payAmt) }] });
                setPayModal(null);
              }}><Check size={14} /> Registrar</Btn>
            </div>
          </div>
        </Modal>
      )}
      {confirmId && <Confirm text="¿Eliminar este registro?" onCancel={() => setConfirmId(null)} onConfirm={() => { removeItem(listKey, confirmId); setConfirmId(null); }} />}
    </div>
  );
}

/* -------------------------------- Patrimonio -------------------------------- */
function Patrimonio(p) {
  const efectivo = p.data.accounts.filter((a) => a.type === "Efectivo").reduce((s, a) => s + 0, 0);
  const rows = [
    ["Dinero disponible (efectivo + cuentas)", p.dineroDisponible],
    ["Inversiones", p.totalInversiones],
    ["Capital en negocios", p.capitalNegocios],
    ["Cuentas por cobrar", p.totalPorCobrar],
  ];
  return (
    <div>
      <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 16px" }}>Patrimonio</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Activos</div>
          {rows.map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 }}>
              <span style={{ color: T.inkSoft }}>{l}</span><span>{fmt(v)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontWeight: 600 }}>
            <span>Total activos</span><span>{fmt(p.dineroDisponible + p.totalInversiones + p.capitalNegocios + p.totalPorCobrar)}</span>
          </div>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Pasivos</div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13 }}>
            <span style={{ color: T.inkSoft }}>Deudas</span><span>{fmt(p.totalDeudas)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontWeight: 600 }}>
            <span>Total pasivos</span><span>{fmt(p.totalDeudas)}</span>
          </div>
        </Panel>
      </div>
      <Panel style={{ padding: 20, marginTop: 16, borderTop: `3px solid ${T.gold}` }}>
        <div style={{ fontSize: 13, color: T.inkSoft }}>Patrimonio neto (activos − pasivos)</div>
        <div style={{ fontFamily: T.serif, fontSize: 30 }}>{fmt(p.patrimonio)}</div>
      </Panel>
    </div>
  );
}

/* -------------------------------- Historial -------------------------------- */
function Historial({ data, accountBalance }) {
  const [range, setRange] = useState("mes");
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());

  const bounds = useMemo(() => {
    const now = new Date();
    const start = new Date(now); const end = new Date(now);
    if (range === "hoy") { /* today */ }
    else if (range === "semana") start.setDate(now.getDate() - 7);
    else if (range === "mes") start.setDate(1);
    else if (range === "mes_anterior") { start.setMonth(now.getMonth() - 1, 1); end.setDate(0); }
    else if (range === "ano") start.setMonth(0, 1);
    else if (range === "personalizado") return { from: customFrom, to: customTo };
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }, [range, customFrom, customTo]);

  const inRange = data.movements.filter((m) => m.date >= bounds.from && m.date <= bounds.to);
  const ingresos = inRange.filter((m) => m.type === "Ingreso").reduce((s, m) => s + m.amount, 0);
  const gastos = inRange.filter((m) => m.type === "Gasto").reduce((s, m) => s + m.amount, 0);

  const series = useMemo(() => {
    const movs = [...data.movements].filter((m) => m.date <= bounds.to).sort((a, b) => a.date.localeCompare(b.date));
    const totalInitial = data.accounts.filter((a) => a.type !== "Inversión").reduce((s, a) => s + (Number(a.initialBalance) || 0), 0);
    let running = totalInitial;
    const byDate = {};
    movs.forEach((m) => {
      const acc = data.accounts.find((a) => a.id === m.accountId);
      const toAcc = data.accounts.find((a) => a.id === m.toAccountId);
      if (m.type === "Ingreso" && acc && acc.type !== "Inversión") running += m.amount;
      else if (m.type === "Gasto" && acc && acc.type !== "Inversión") running -= m.amount;
      else if (m.type === "Transferencia") {
        if (acc && acc.type !== "Inversión") running -= m.amount;
        if (toAcc && toAcc.type !== "Inversión") running += m.amount;
      }
      byDate[m.date] = running;
    });
    return Object.entries(byDate).map(([date, value]) => ({ date, value }));
  }, [data, bounds.to]);

  return (
    <div>
      <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 16px" }}>Historial</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["mes_anterior", "Mes anterior"], ["ano", "Este año"], ["personalizado", "Personalizado"]].map(([id, l]) => (
          <button key={id} onClick={() => setRange(id)} style={{
            padding: "6px 12px", borderRadius: 3, border: `1px solid ${T.line}`, cursor: "pointer",
            background: range === id ? T.ink : "transparent", color: range === id ? "#fff" : T.ink, fontSize: 12.5, fontFamily: T.sans,
          }}>{l}</button>
        ))}
      </div>
      {range === "personalizado" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Field label="Desde"><TextInput type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
          <Field label="Hasta"><TextInput type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Ingresos del período" value={fmt(ingresos)} tone="green" />
        <KPI label="Gastos del período" value={fmt(gastos)} tone="red" />
        <KPI label="Flujo neto" value={fmt(ingresos - gastos)} tone={ingresos - gastos >= 0 ? "green" : "red"} />
        <KPI label="Movimientos en el período" value={inRange.length} tone="ink" />
      </div>
      <Panel style={{ padding: 16, height: 300 }}>
        <div style={{ fontFamily: T.serif, fontSize: 15, marginBottom: 10 }}>Evolución del dinero disponible</div>
        <ResponsiveContainer width="100%" height="88%">
          <LineChart data={series}>
            <CartesianGrid stroke={T.lineSoft} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={fmtDate} />
            <YAxis tick={{ fontSize: 10 }} width={70} tickFormatter={(v) => fmt(v)} />
            <Tooltip formatter={(v) => fmt(v)} labelFormatter={fmtDate} />
            <Line type="monotone" dataKey="value" stroke={T.slate} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

/* -------------------------------- Gráficos -------------------------------- */
/* Paleta oscura, aislada a esta sección — el resto de la app conserva su
   diseño original sin cambios. */
const DK = {
  bg: "#0D1117",
  panel: "#151B23",
  panel2: "#1B222C",
  border: "#262E38",
  grid: "#232B35",
  text: "#E9EDF2",
  textSoft: "#8B96A5",
  textFaint: "#5B6572",
  green: "#34D399",
  greenSoft: "rgba(52,211,153,0.14)",
  red: "#F0645C",
  redSoft: "rgba(240,100,92,0.14)",
  gold: "#E0B15C",
  blue: "#5B9BF0",
  purple: "#A78BFA",
};
const DK_COLORS = [DK.gold, DK.blue, DK.purple, DK.green, DK.red, "#4FC1D6", "#E08F4F"];

function DarkPanel({ children, style }) {
  return <div style={{ background: DK.panel, border: `1px solid ${DK.border}`, borderRadius: 10, ...style }}>{children}</div>;
}

function DarkChartBox({ title, right, height = 300, children, empty, emptyText }) {
  return (
    <DarkPanel style={{ padding: "16px 18px", height }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: T.sans, fontWeight: 600, fontSize: 13.5, color: DK.text }}>{title}</div>
        {right}
      </div>
      {empty ? (
        <div style={{ height: "85%", display: "flex", alignItems: "center", justifyContent: "center", color: DK.textFaint, fontSize: 12.5, textAlign: "center", padding: "0 20px" }}>
          {emptyText || "Todavía no hay suficiente historial para mostrar esta evolución."}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="88%">{children}</ResponsiveContainer>
      )}
    </DarkPanel>
  );
}

function PeriodPicker({ value, onChange }) {
  const OPTS = [["7d", "7D"], ["30d", "30D"], ["3m", "3M"], ["6m", "6M"], ["1a", "1A"], ["todo", "TODO"]];
  return (
    <div style={{ display: "inline-flex", gap: 4, background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 8, padding: 3 }}>
      {OPTS.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} style={{
          border: "none", cursor: "pointer", padding: "5px 11px", borderRadius: 6, fontFamily: T.sans, fontSize: 11.5, fontWeight: 600,
          background: value === id ? DK.gold : "transparent", color: value === id ? "#1A1204" : DK.textSoft,
        }}>{label}</button>
      ))}
    </div>
  );
}

const periodDays = { "7d": 7, "30d": 30, "3m": 91, "6m": 182, "1a": 365, todo: Infinity };
function filterByPeriod(points, period, dateKey = "date") {
  if (period === "todo") return points;
  const days = periodDays[period];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return points.filter((p) => p[dateKey] >= cutoffStr);
}

function PatrimonioTooltip({ active, payload, label, series }) {
  if (!active || !payload || !payload.length) return null;
  const idx = series.findIndex((p) => p.date === label);
  const prev = idx > 0 ? series[idx - 1] : null;
  const val = payload[0].value;
  const delta = prev ? val - prev.value : null;
  return (
    <div style={{ background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 8, padding: "9px 12px", fontFamily: T.sans, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ color: DK.textSoft, fontSize: 11, marginBottom: 3 }}>{fmtDate(label)}</div>
      <div style={{ color: DK.text, fontSize: 13.5, fontWeight: 700 }}>{fmt(val)}</div>
      {delta !== null && (
        <div style={{ color: delta >= 0 ? DK.green : DK.red, fontSize: 11.5, marginTop: 2 }}>
          {delta >= 0 ? "▲ +" : "▼ "}{fmt(Math.abs(delta))}
        </div>
      )}
    </div>
  );
}

function GenericDarkTooltip({ active, payload, label, valueFmt = fmt }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 8, padding: "9px 12px", fontFamily: T.sans, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ color: DK.textSoft, fontSize: 11, marginBottom: 4 }}>{label && label !== "inicio" ? fmtDate(label) || label : label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || DK.text, fontSize: 12.5, fontWeight: 600 }}>
          {p.name}: {valueFmt(p.value)}
        </div>
      ))}
    </div>
  );
}

function IndicatorCard({ label, value, tone, sub }) {
  const color = tone === "green" ? DK.green : tone === "red" ? DK.red : tone === "gold" ? DK.gold : DK.text;
  return (
    <DarkPanel style={{ padding: "14px 16px" }}>
      <div style={{ color: DK.textFaint, fontSize: 11, fontFamily: T.sans, marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontFamily: T.sans, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color, fontSize: 11.5, marginTop: 2, fontFamily: T.sans }}>{sub}</div>}
    </DarkPanel>
  );
}

function Graficos({ data, negocioStats, accountBalance, dineroDisponible, totalInversiones, capitalNegocios, totalPorCobrar, totalDeudas, patrimonio }) {
  const [period, setPeriod] = useState("30d");
  const [gran, setGran] = useState("mes"); // dia | semana | mes

  /* 1) Evolución del patrimonio — a partir de snapshots reales guardados
        localmente cada vez que el patrimonio cambia. No se inventa historial. */
  const snapshots = useMemo(() => (data.snapshots || []).slice().sort((a, b) => a.date.localeCompare(b.date)), [data.snapshots]);
  const patrimonioFiltered = useMemo(() => filterByPeriod(snapshots, period), [snapshots, period]);
  const hasPatrimonioHistory = patrimonioFiltered.length >= 2;
  const patrimonioChart = useMemo(() => patrimonioFiltered.map((p) => ({ date: p.date, value: p.value })), [patrimonioFiltered]);

  const indicators = useMemo(() => {
    if (!patrimonioFiltered.length) return null;
    const first = patrimonioFiltered[0].value;
    const variacion = patrimonio - first;
    const variacionPct = first !== 0 ? (variacion / Math.abs(first)) * 100 : 0;
    const values = patrimonioFiltered.map((p) => p.value).concat([patrimonio]);
    return { variacion, variacionPct, max: Math.max(...values), min: Math.min(...values) };
  }, [patrimonioFiltered, patrimonio]);

  /* 2) Evolución del dinero disponible — reconstruida a partir de los
        movimientos reales (efectivo + bancos + cooperativas + digitales). */
  const cashSeriesFull = useMemo(() => {
    const movs = [...data.movements].sort((a, b) => a.date.localeCompare(b.date));
    const totalInitial = data.accounts.filter((a) => a.type !== "Inversión").reduce((s, a) => s + (Number(a.initialBalance) || 0), 0);
    let running = totalInitial;
    const points = [];
    movs.forEach((m) => {
      const acc = data.accounts.find((a) => a.id === m.accountId);
      const toAcc = data.accounts.find((a) => a.id === m.toAccountId);
      if (m.type === "Ingreso" && acc && acc.type !== "Inversión") running += m.amount;
      else if (m.type === "Gasto" && acc && acc.type !== "Inversión") running -= m.amount;
      else if (m.type === "Transferencia") {
        if (acc && acc.type !== "Inversión") running -= m.amount;
        if (toAcc && toAcc.type !== "Inversión") running += m.amount;
      }
      points.push({ date: m.date, value: running });
    });
    points.push({ date: todayISO(), value: dineroDisponible });
    return points;
  }, [data, dineroDisponible]);
  const cashFiltered = useMemo(() => filterByPeriod(cashSeriesFull, period), [cashSeriesFull, period]);
  const hasCashHistory = cashFiltered.length >= 2;

  /* 3) Ingresos vs gastos, con granularidad día / semana / mes */
  const weekKey = (d) => {
    const dt = new Date(d + "T00:00:00");
    const day = (dt.getDay() + 6) % 7; // lunes=0
    dt.setDate(dt.getDate() - day);
    return dt.toISOString().slice(0, 10);
  };
  const igSeries = useMemo(() => {
    const movsInRange = filterByPeriod(data.movements, period);
    const keyFn = gran === "dia" ? (d) => d : gran === "semana" ? weekKey : (d) => d.slice(0, 7);
    const map = {};
    movsInRange.forEach((m) => {
      const k = keyFn(m.date);
      map[k] = map[k] || { key: k, ingresos: 0, gastos: 0 };
      if (m.type === "Ingreso") map[k].ingresos += m.amount;
      if (m.type === "Gasto") map[k].gastos += m.amount;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [data.movements, period, gran]);
  const hasIgHistory = igSeries.length >= 1 && igSeries.some((p) => p.ingresos > 0 || p.gastos > 0);

  /* 4) Composición del patrimonio: activos reales vs deudas */
  const efectivo = data.accounts.filter((a) => a.type === "Efectivo").reduce((s, a) => s + accountBalance(a.id), 0);
  const cuentas = data.accounts.filter((a) => a.type !== "Efectivo" && a.type !== "Inversión").reduce((s, a) => s + accountBalance(a.id), 0);
  const composicion = [
    { name: "Efectivo", value: efectivo },
    { name: "Cuentas", value: cuentas },
    { name: "Inversiones", value: totalInversiones },
    { name: "Capital en negocios", value: capitalNegocios },
    { name: "Por cobrar", value: totalPorCobrar },
    { name: "Deudas", value: -totalDeudas },
  ].filter((d) => d.value !== 0);

  /* Gráficos que ya existían — conservados, solo re-estilizados en oscuro */
  const byCat = (type) => {
    const map = {};
    data.movements.filter((m) => m.type === type).forEach((m) => {
      const k = m.category || "Sin categoría";
      map[k] = (map[k] || 0) + m.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  };
  const gastosCat = byCat("Gasto");
  const ingresosCat = byCat("Ingreso");
  const invPerf = data.investments.map((i) => ({ name: i.name, rendimiento: i.capitalInvertido ? ((i.valorActual - i.capitalInvertido) / i.capitalInvertido) * 100 : 0 }));
  const bizPerf = data.businesses.map((b) => ({ name: b.name, utilidad: negocioStats(b.id).utilidad }));

  const granLabel = { dia: "por día", semana: "por semana", mes: "por mes" }[gran];

  return (
    <div style={{ background: DK.bg, margin: "-26px -30px", padding: "26px 30px", minHeight: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: T.sans, fontWeight: 700, fontSize: 22, margin: "0 0 4px", color: DK.text }}>Gráficos</h1>
          <p style={{ color: DK.textSoft, fontSize: 12.5, margin: 0 }}>Evolución real de tus finanzas, calculada con tus propios datos.</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {/* Indicadores del patrimonio */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <IndicatorCard label="Patrimonio actual" value={fmt(patrimonio)} tone="gold" />
        <IndicatorCard
          label="Variación del período"
          value={indicators ? `${indicators.variacion >= 0 ? "+" : ""}${fmt(indicators.variacion)}` : "—"}
          tone={indicators ? (indicators.variacion >= 0 ? "green" : "red") : "ink"}
          sub={indicators ? `${indicators.variacionPct >= 0 ? "+" : ""}${pct(indicators.variacionPct)}` : "Sin historial suficiente"}
        />
        <IndicatorCard label="Máximo del período" value={indicators ? fmt(indicators.max) : "—"} tone="green" />
        <IndicatorCard label="Mínimo del período" value={indicators ? fmt(indicators.min) : "—"} tone="red" />
      </div>

      {/* Gráfico principal: evolución del patrimonio */}
      <DarkChartBox title="Evolución del patrimonio" height={340} empty={!hasPatrimonioHistory}
        emptyText="Aún no hay suficiente historial de patrimonio guardado. Se registra un punto real cada día que uses la aplicación — vuelve pronto para ver la evolución.">
        <AreaChart data={patrimonioChart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DK.gold} stopOpacity={0.32} />
              <stop offset="100%" stopColor={DK.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={DK.grid} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: DK.textFaint }} tickFormatter={fmtDate} axisLine={{ stroke: DK.border }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: DK.textFaint }} width={68} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
          <Tooltip content={(p) => <PatrimonioTooltip {...p} series={patrimonioChart} />} />
          <Area type="monotone" dataKey="value" stroke={DK.gold} strokeWidth={2.4} fill="url(#patGrad)" dot={{ r: 2.5, fill: DK.gold, strokeWidth: 0 }} activeDot={{ r: 5, fill: DK.gold, stroke: DK.bg, strokeWidth: 2 }} isAnimationActive animationDuration={500} />
        </AreaChart>
      </DarkChartBox>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, marginTop: 16 }}>
        <DarkChartBox title="Dinero disponible" empty={!hasCashHistory}>
          <AreaChart data={cashFiltered} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DK.blue} stopOpacity={0.28} />
                <stop offset="100%" stopColor={DK.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={DK.grid} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: DK.textFaint }} tickFormatter={fmtDate} axisLine={{ stroke: DK.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: DK.textFaint }} width={64} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
            <Area type="monotone" dataKey="value" name="Disponible" stroke={DK.blue} strokeWidth={2} fill="url(#cashGrad)" dot={false} activeDot={{ r: 4, fill: DK.blue, stroke: DK.bg, strokeWidth: 2 }} />
          </AreaChart>
        </DarkChartBox>

        <DarkChartBox
          title={`Ingresos vs gastos ${granLabel}`}
          right={
            <div style={{ display: "inline-flex", gap: 4, background: DK.panel2, border: `1px solid ${DK.border}`, borderRadius: 7, padding: 2 }}>
              {[["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]].map(([id, l]) => (
                <button key={id} onClick={() => setGran(id)} style={{ border: "none", cursor: "pointer", padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontFamily: T.sans, fontWeight: 600, background: gran === id ? DK.border : "transparent", color: gran === id ? DK.text : DK.textFaint }}>{l}</button>
              ))}
            </div>
          }
          empty={!hasIgHistory}
        >
          <LineChart data={igSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={DK.grid} vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 9, fill: DK.textFaint }} tickFormatter={(k) => (gran === "mes" ? k : fmtDate(k))} axisLine={{ stroke: DK.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: DK.textFaint }} width={64} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: DK.textSoft }} />
            <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke={DK.green} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="gastos" name="Gastos" stroke={DK.red} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
          </LineChart>
        </DarkChartBox>

        <DarkChartBox title="Composición del patrimonio" empty={composicion.length === 0}>
          <BarChart data={composicion} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={DK.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: DK.textFaint }} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: DK.textSoft }} width={110} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
            <ReferenceLine x={0} stroke={DK.border} />
            <Bar dataKey="value" radius={[3, 3, 3, 3]}>
              {composicion.map((c, i) => <Cell key={i} fill={c.value < 0 ? DK.red : DK_COLORS[i % DK_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </DarkChartBox>

        <DarkChartBox title="Gastos por categoría" empty={gastosCat.length === 0}>
          <PieChart>
            <Pie data={gastosCat} dataKey="value" nameKey="name" outerRadius={82} innerRadius={44} paddingAngle={2} label={(e) => e.name} labelLine={false}>
              {gastosCat.map((_, i) => <Cell key={i} fill={DK_COLORS[i % DK_COLORS.length]} stroke={DK.panel} />)}
            </Pie>
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
          </PieChart>
        </DarkChartBox>

        <DarkChartBox title="Ingresos por categoría" empty={ingresosCat.length === 0}>
          <PieChart>
            <Pie data={ingresosCat} dataKey="value" nameKey="name" outerRadius={82} innerRadius={44} paddingAngle={2} label={(e) => e.name} labelLine={false}>
              {ingresosCat.map((_, i) => <Cell key={i} fill={DK_COLORS[i % DK_COLORS.length]} stroke={DK.panel} />)}
            </Pie>
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
          </PieChart>
        </DarkChartBox>

        <DarkChartBox title="Rendimiento de inversiones (%)" empty={invPerf.length === 0}>
          <BarChart data={invPerf} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={DK.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: DK.textFaint }} axisLine={{ stroke: DK.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: DK.textFaint }} tickFormatter={pct} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <GenericDarkTooltip {...p} valueFmt={pct} />} />
            <Bar dataKey="rendimiento" radius={[3, 3, 0, 0]}>
              {invPerf.map((d, i) => <Cell key={i} fill={d.rendimiento >= 0 ? DK.green : DK.red} />)}
            </Bar>
          </BarChart>
        </DarkChartBox>

        <DarkChartBox title="Rendimiento de negocios (utilidad)" empty={bizPerf.length === 0}>
          <BarChart data={bizPerf} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={DK.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: DK.textFaint }} axisLine={{ stroke: DK.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: DK.textFaint }} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
            <Tooltip content={(p) => <GenericDarkTooltip {...p} />} />
            <Bar dataKey="utilidad" radius={[3, 3, 0, 0]}>
              {bizPerf.map((d, i) => <Cell key={i} fill={d.utilidad >= 0 ? DK.green : DK.red} />)}
            </Bar>
          </BarChart>
        </DarkChartBox>
      </div>
    </div>
  );
}

/* ------------------------------- Datos view -------------------------------- */
function DatosView({ hasDemo, clearDemo, exportMovementsCSV, exportSummary, importMovementsCSV, exportBackup, restoreBackup, fileRef, backupRef }) {
  return (
    <div>
      <h1 style={{ fontFamily: T.serif, fontSize: 24, margin: "0 0 16px" }}>Importar / exportar</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Movimientos</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={exportMovementsCSV}><Download size={14} /> Exportar CSV</Btn>
            <Btn ghost onClick={() => fileRef.current?.click()}><Upload size={14} /> Importar CSV</Btn>
            <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files[0] && importMovementsCSV(e.target.files[0])} />
          </div>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Resumen financiero</div>
          <Btn onClick={exportSummary}><Download size={14} /> Exportar resumen (CSV)</Btn>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Copia de seguridad completa</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={exportBackup}><Download size={14} /> Exportar respaldo (JSON)</Btn>
            <Btn ghost onClick={() => backupRef.current?.click()}><Upload size={14} /> Restaurar respaldo</Btn>
            <input ref={backupRef} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && restoreBackup(e.target.files[0])} />
          </div>
        </Panel>
        <Panel style={{ padding: 18 }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, marginBottom: 10 }}>Datos de demostración</div>
          <p style={{ fontSize: 12.5, color: T.inkSoft, margin: "0 0 10px" }}>Elimina cualquier dato de ejemplo heredado de la versión anterior.</p>
          <Btn tone="red" disabled={!hasDemo} onClick={clearDemo}><Trash2 size={14} /> Eliminar datos de demostración</Btn>
        </Panel>
      </div>
      <p style={{ fontSize: 12, color: T.inkSoft, marginTop: 16 }}>Los datos se guardan automáticamente en la nube de IRIS según tus permisos.</p>
    </div>
  );
}
