import { InjectionToken } from '@angular/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE');

export function createSupabaseClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = environment;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set supabaseUrl and supabaseAnonKey in '
      + 'src/environments/environment.ts (Project Settings -> API).',
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
