import { useMemo, useState } from "react";
import { ClipboardCopy, Eye } from "lucide-react";
import { toast } from "sonner";
import { Section, Empty } from "@/components/iris/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EMPTY_FILTERS,
  changeLogToCsv,
  filterChangeLog,
  type HistoryFilters,
} from "@/lib/org/history";
import { useChangeLog } from "@/lib/org/org.queries";
import type { ChangeLogEntry } from "@/lib/org/types";
import { FilterSelect, ReadOnlyNote, fmtDT } from "./shared";

const ENTITY_LABELS: Record<string, string> = {
  departamento: "Departamento",
  cargo: "Cargo",
  rol: "Rol",
  usuario: "Usuario",
  operacion: "Operación",
  configuracion: "Configuración",
  intento: "Intento bloqueado",
};

const PAGE = 500;
const ROWS_STEP = 200;
const MAX_LIMIT = 5000;

export function ChangeHistory() {
  const [limit, setLimit] = useState(PAGE);
  const [shown, setShown] = useState(ROWS_STEP);
  const { data = [], isLoading, error, isFetching } = useChangeLog(limit);
  const [f, setF] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<ChangeLogEntry | null>(null);

  const entities = useMemo(() => [...new Set(data.map((e) => e.entity))].sort(), [data]);
  const rows = useMemo(() => filterChangeLog(data, f), [data, f]);
  const denied = data.filter((e) => e.result === "denegado").length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(changeLogToCsv(rows));
      toast.success(`${rows.length} registros copiados (CSV)`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <Section
      title="Historial de cambios"
      right={
        rows.length > 0 && (
          <Button size="sm" variant="outline" onClick={copy}>
            <ClipboardCopy className="mr-1 h-4 w-4" />
            Copiar CSV
          </Button>
        )
      }
    >
      <ReadOnlyNote>
        Evidencia inmutable: nadie (ni el CEO ni la administración técnica) puede editarla o
        borrarla. Registra los cambios aplicados y los intentos de seguridad rechazados (permiso,
        escalada, separación de funciones). Solo la consulta el CEO o un rol de auditoría; la
        administración de organización no la ve, para preservar la separación de funciones.
      </ReadOnlyNote>

      <div className="my-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="hist-text" className="text-xs text-muted-foreground">
            Buscar
          </label>
          <Input
            id="hist-text"
            className="w-64"
            placeholder="Acción, usuario, motivo…"
            value={f.text}
            onChange={(e) => {
              setF({ ...f, text: e.target.value });
              setShown(ROWS_STEP);
            }}
          />
        </div>
        <FilterSelect
          label="Resultado"
          value={f.result}
          onChange={(v) => setF({ ...f, result: v as HistoryFilters["result"] })}
          options={[
            ["todos", "Todos"],
            ["aplicado", "Aplicado"],
            ["denegado", "Denegado"],
          ]}
        />
        <FilterSelect
          label="Entidad"
          value={f.entity}
          onChange={(v) => setF({ ...f, entity: v })}
          options={[
            ["todas", "Todas"],
            ...entities.map((e): [string, string] => [e, ENTITY_LABELS[e] ?? e]),
          ]}
        />
        <div className="space-y-1">
          <label htmlFor="hist-from" className="text-xs text-muted-foreground">
            Desde
          </label>
          <Input
            id="hist-from"
            type="date"
            className="w-40"
            value={f.from}
            onChange={(e) => setF({ ...f, from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="hist-to" className="text-xs text-muted-foreground">
            Hasta
          </label>
          <Input
            id="hist-to"
            type="date"
            className="w-40"
            value={f.to}
            onChange={(e) => setF({ ...f, to: e.target.value })}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setF(EMPTY_FILTERS)}>
          Limpiar
        </Button>
      </div>
      {data.length >= limit && (
        <div
          role="status"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs"
        >
          <span>
            Se muestran los últimos {limit} registros; puede haber más antiguos. Los filtros se
            aplican solo sobre los registros cargados.
          </span>
          {limit < MAX_LIMIT ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isFetching}
              onClick={() => setLimit((l) => Math.min(l + PAGE, MAX_LIMIT))}
            >
              Cargar {PAGE} más
            </Button>
          ) : (
            <span>
              Máximo alcanzado ({MAX_LIMIT}). Para períodos anteriores, consulta la bitácora
              directamente con el área de auditoría.
            </span>
          )}
        </div>
      )}
      <p className="mb-2 text-xs text-muted-foreground" role="status">
        {rows.length} de {data.length} registros · {denied} intento(s) denegado(s)
      </p>

      {isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          No se pudo cargar el historial.
        </div>
      ) : rows.length === 0 ? (
        <Empty>Sin registros visibles para tu perfil con esos filtros.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, shown).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fmtDT(r.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">{r.actor_email ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{r.action}</TableCell>
                    <TableCell className="text-xs">
                      {ENTITY_LABELS[r.entity] ?? r.entity}
                      {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.result === "denegado" ? "destructive" : "secondary"}>
                        {r.result === "denegado" ? "Denegado" : "Aplicado"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs">{r.reason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ver detalle"
                        onClick={() => setDetail(r)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > shown && (
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Mostrando {shown} de {rows.length} registros filtrados.
              </span>
              <Button size="sm" variant="outline" onClick={() => setShown((n) => n + ROWS_STEP)}>
                Mostrar {ROWS_STEP} más
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.action}</DialogTitle>
            <DialogDescription>
              {detail
                ? `${fmtDT(detail.created_at)} · ${detail.actor_email ?? "—"} · ${detail.result === "denegado" ? "Denegado" : "Aplicado"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detail?.reason && (
            <p className="rounded border bg-muted/40 p-2 text-sm">«{detail.reason}»</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Antes
              </div>
              <pre className="max-h-64 overflow-auto rounded border bg-muted/40 p-2 text-xs">
                {JSON.stringify(detail?.before_data ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Después
              </div>
              <pre className="max-h-64 overflow-auto rounded border bg-muted/40 p-2 text-xs">
                {JSON.stringify(detail?.after_data ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
