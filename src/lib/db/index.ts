import { LocalRepository } from '@/lib/db/local';
import { SupabaseRepository, supabaseConfigured } from '@/lib/db/supabase';
import type { WordRepository } from '@/lib/db/types';

export * from '@/lib/db/types';

let cached: WordRepository | null = null;

/**
 * Pick the storage backend.
 *
 * Supabase if it is configured, otherwise a local JSON file. The point of the
 * fallback is that a fresh clone runs immediately: no account, no SQL, no env
 * file. Set the two Supabase variables when you want the same data on your
 * phone, and everything above this line stays the same.
 */
export function getDb(): WordRepository {
  if (!cached) {
    cached = supabaseConfigured() ? new SupabaseRepository() : new LocalRepository();
  }
  return cached;
}

/** For the badge on the home page, so it is obvious where data is going. */
export function storageBackend(): 'local' | 'supabase' {
  return supabaseConfigured() ? 'supabase' : 'local';
}
