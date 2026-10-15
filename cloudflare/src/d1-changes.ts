/**
 * Remote D1 reports total_changes() in meta.changes, which also counts the
 * rows written by the MySQL ON UPDATE triggers of migration 0009: one updated
 * row can report 2. Use only for a statement that can touch at most one row.
 */
export function wroteRow(result: { meta: { changes?: number } } | undefined): boolean {
  return Number(result?.meta.changes ?? 0) > 0;
}
