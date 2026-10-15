/**
 * Replacement for PHP's SELECT ... FOR UPDATE: the first statement of a D1
 * batch inserts a guard row whose CHECK fails when the state read before the
 * batch changed, which rolls back the whole batch.
 */
import type { Env } from '../types';

export function guardStatement(env: Env, scope: string, condition: string, binds: unknown[]): D1PreparedStatement {
  return env.DB.prepare(`INSERT INTO worker_write_guards(nonce,scope,ok)
    VALUES (?,?,CASE WHEN ${condition} THEN 1 ELSE 0 END)`)
    .bind(crypto.randomUUID(), scope, ...binds);
}

/** null when the guard (or a unique key) rejected the batch. */
export async function runGuarded(env: Env, statements: D1PreparedStatement[]): Promise<D1Result[] | null> {
  try {
    return await env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes('CHECK constraint failed') || String(error).includes('UNIQUE constraint failed')) {
      return null;
    }
    throw error;
  }
}
