import { describe, expect, it } from "vitest";
import { assignmentStatus } from "@/lib/org/authz";
import { EMPTY_FILTERS, changeLogToCsv, filterChangeLog } from "@/lib/org/history";
import type { ChangeLogEntry } from "@/lib/org/types";

const entry = (over: Partial<ChangeLogEntry>): ChangeLogEntry => ({
  id: "1",
  created_at: "2026-10-20T15:00:00.000Z",
  actor_id: "a",
  actor_email: "ceo@x",
  action: "rol.asignar",
  entity: "usuario",
  entity_id: "u1",
  before_data: null,
  after_data: { role: "vendedor" },
  reason: "alta",
  result: "aplicado",
  ...over,
});
const log = [
  entry({ id: "1" }),
  entry({
    id: "2",
    action: "assign_role",
    entity: "intento",
    result: "denegado",
    actor_email: "plain@x",
    reason: "No autorizado",
    created_at: "2026-10-21T10:00:00.000Z",
  }),
  entry({
    id: "3",
    action: "departamento.crear",
    entity: "departamento",
    after_data: { name: "Laboratorio" },
    reason: null,
    created_at: "2026-10-22T09:00:00.000Z",
  }),
];

describe("filterChangeLog", () => {
  it("sin filtros devuelve todo", () =>
    expect(filterChangeLog(log, EMPTY_FILTERS)).toHaveLength(3));
  it("por resultado", () => {
    expect(filterChangeLog(log, { ...EMPTY_FILTERS, result: "denegado" }).map((e) => e.id)).toEqual(
      ["2"],
    );
    expect(filterChangeLog(log, { ...EMPTY_FILTERS, result: "aplicado" }).map((e) => e.id)).toEqual(
      ["1", "3"],
    );
  });
  it("por entidad", () =>
    expect(
      filterChangeLog(log, { ...EMPTY_FILTERS, entity: "departamento" }).map((e) => e.id),
    ).toEqual(["3"]));
  it("por texto en acción, actor, motivo y detalle", () => {
    expect(filterChangeLog(log, { ...EMPTY_FILTERS, text: "plain@x" }).map((e) => e.id)).toEqual([
      "2",
    ]);
    expect(
      filterChangeLog(log, { ...EMPTY_FILTERS, text: "laboratorio" }).map((e) => e.id),
    ).toEqual(["3"]);
    expect(
      filterChangeLog(log, { ...EMPTY_FILTERS, text: "no autorizado" }).map((e) => e.id),
    ).toEqual(["2"]);
  });
  it("por rango de fechas (inclusivo, hora local)", () => {
    const from = new Date("2026-10-21T10:00:00.000Z");
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const r = filterChangeLog(log, { ...EMPTY_FILTERS, from: ymd(from), to: ymd(from) });
    expect(r.map((e) => e.id)).toEqual(["2"]);
  });
  it("combina filtros (AND)", () => {
    expect(
      filterChangeLog(log, { ...EMPTY_FILTERS, result: "aplicado", text: "rol" }).map((e) => e.id),
    ).toEqual(["1"]);
  });
});

describe("changeLogToCsv", () => {
  it("incluye resultado y cabecera", () => {
    const csv = changeLogToCsv(log);
    expect(csv.split("\n")[0]).toBe("fecha,actor,accion,entidad,referencia,resultado,motivo");
    expect(csv).toContain("denegado");
  });
  it("neutraliza fórmulas de hoja de cálculo y escapa comillas", () => {
    const csv = changeLogToCsv([
      entry({ reason: '=HYPERLINK("http://x")', actor_email: "+cmd|calc" }),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"'+cmd|calc"`);
  });
});

describe("assignmentStatus", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const base = { revoked_at: null, valid_from: "2026-10-01T00:00:00.000Z", valid_until: null };
  it("vigente", () => expect(assignmentStatus(base, now)).toBe("vigente"));
  it("vigente hasta una fecha futura", () =>
    expect(assignmentStatus({ ...base, valid_until: "2026-11-01T00:00:00.000Z" }, now)).toBe(
      "vigente",
    ));
  it("vencida", () =>
    expect(assignmentStatus({ ...base, valid_until: "2026-10-10T00:00:00.000Z" }, now)).toBe(
      "vencida",
    ));
  it("el instante exacto de vencimiento ya no es vigente", () =>
    expect(assignmentStatus({ ...base, valid_until: now.toISOString() }, now)).toBe("vencida"));
  it("programada", () =>
    expect(assignmentStatus({ ...base, valid_from: "2026-12-01T00:00:00.000Z" }, now)).toBe(
      "programada",
    ));
  it("revocada prevalece sobre cualquier otro estado", () =>
    expect(
      assignmentStatus(
        {
          ...base,
          revoked_at: "2026-10-05T00:00:00.000Z",
          valid_until: "2027-01-01T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("revocada"));
});
