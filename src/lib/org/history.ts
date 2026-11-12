import type { ChangeLogEntry } from "./types";

export type HistoryFilters = {
  text: string;
  result: "todos" | "aplicado" | "denegado";
  entity: string;
  from: string;
  to: string;
};
export const EMPTY_FILTERS: HistoryFilters = {
  text: "",
  result: "todos",
  entity: "todas",
  from: "",
  to: "",
};

const norm = (s: string) => s.toLowerCase();

/** Filtra el historial en el cliente (los datos ya llegaron filtrados por RLS). Fechas en formato AAAA-MM-DD, hora local. */
export function filterChangeLog(
  entries: readonly ChangeLogEntry[],
  f: HistoryFilters,
): ChangeLogEntry[] {
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : null;
  const q = norm(f.text.trim());
  return entries.filter((e) => {
    if (f.result !== "todos" && e.result !== f.result) return false;
    if (f.entity !== "todas" && e.entity !== f.entity) return false;
    const at = new Date(e.created_at);
    if (from && at < from) return false;
    if (to && at > to) return false;
    if (!q) return true;
    return norm(
      `${e.action} ${e.entity} ${e.actor_email ?? ""} ${e.reason ?? ""} ${JSON.stringify(e.after_data ?? "")}`,
    ).includes(q);
  });
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // evita inyección de fórmulas al abrir en hojas de cálculo
  return `"${safe.replace(/"/g, '""')}"`;
};
export function changeLogToCsv(entries: readonly ChangeLogEntry[]): string {
  const head = ["fecha", "actor", "accion", "entidad", "referencia", "resultado", "motivo"];
  const rows = entries.map((e) =>
    [e.created_at, e.actor_email, e.action, e.entity, e.entity_id, e.result, e.reason]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}
