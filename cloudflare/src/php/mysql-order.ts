// MySQL's utf8mb4_unicode_ci ignores many non-printing marks and folds case.
// SQLite NOCASE folds ASCII only, so apply the display ordering after D1 reads.
const collator = new Intl.Collator('ms', { sensitivity: 'base' });

export function mysqlTextOrder(left: unknown, right: unknown): number {
  if (left == null) return right == null ? 0 : -1;
  if (right == null) return 1;
  return collator.compare(String(left), String(right));
}
