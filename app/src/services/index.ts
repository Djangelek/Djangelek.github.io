import type { DataSource } from './dataSource';
import { LocalSource } from './localSource';
import { SupabaseSource } from './supabaseSource';

/**
 * Selecciona la implementación según VITE_DATA_SOURCE:
 *  - 'local' (default) → demo con localStorage, sin backend
 *  - 'supabase' → PostgreSQL real
 */
function createSource(): DataSource {
  const mode = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? 'local';
  if (mode === 'supabase') return new SupabaseSource();
  return new LocalSource();
}

export const ds: DataSource = createSource();
export type { DataSource };
export { joinFleet } from './dataSource';
