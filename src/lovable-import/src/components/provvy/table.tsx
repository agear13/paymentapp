import * as React from "react";
import { ChevronDown, ChevronUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<Row> {
  key: keyof Row & string;
  header: string;
  sortable?: boolean;
  render?: (row: Row) => React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}

export interface DataTableProps<Row extends { id: string | number }> {
  columns: Column<Row>[];
  rows: Row[];
  expandable?: (row: Row) => React.ReactNode;
  stickyHeader?: boolean;
  onRowClick?: (row: Row) => void;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<Row extends { id: string | number }>({
  columns,
  rows,
  expandable,
  stickyHeader = true,
  onRowClick,
  emptyState,
  className,
}: DataTableProps<Row>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = React.useState<Set<string | number>>(new Set());

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey];
      const vb = (b as Record<string, unknown>)[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-card", className)}>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className={cn("bg-secondary/50 text-ink-soft", stickyHeader && "sticky top-0 z-10")}>
            <tr>
              {expandable && <th className="w-8" />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "border-b border-border px-3 py-2 text-left text-[11.5px] font-medium uppercase tracking-wider",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center"
                  )}
                >
                  {c.sortable ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isExp = expanded.has(row.id);
              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "border-b border-border transition-colors last:border-b-0",
                      onRowClick && "cursor-pointer hover:bg-secondary/40"
                    )}
                  >
                    {expandable && (
                      <td className="px-2">
                        <button
                          aria-label={isExp ? "Collapse row" : "Expand row"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            });
                          }}
                          className="grid size-6 place-items-center rounded-md text-ink-soft hover:bg-secondary hover:text-foreground"
                        >
                          <ChevronRight className={cn("size-3.5 transition-transform", isExp && "rotate-90")} />
                        </button>
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3 py-2.5 align-middle",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center"
                        )}
                      >
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                  {expandable && isExp && (
                    <tr className="border-b border-border bg-secondary/20">
                      <td colSpan={columns.length + 1} className="px-6 py-3 text-[12.5px] text-ink-soft">
                        {expandable(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
