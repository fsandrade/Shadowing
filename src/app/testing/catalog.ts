import type { Provider } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Catalog, Sentence } from '../core/catalog';
import { INITIAL_USER } from '../platform/auth';
import { SUPABASE } from '../platform/supabase-client';

function sentence(id: string, topicId: string, levelId: string, text: string): Sentence {
  return { id, topicId, levelId, text };
}

export const TEST_CATALOG: Catalog = {
  loadedAt: '2026-08-06T00:00:00Z',
  levels: [
    { id: 'A2', description: 'Elementary' },
    { id: 'B1', description: 'Intermediate' },
    { id: 'C2', description: 'Proficient' },
  ],
  topics: [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ],
  sentences: [
    sentence('s-a1', 'a', 'A2', 'a1'),
    sentence('s-a2', 'a', 'A2', 'a2'),
    sentence('s-a3', 'a', 'A2', 'a3'),
    sentence('s-b1', 'b', 'A2', 'b1'),
    sentence('s-c1', 'c', 'B1', 'c1'),
    sentence('s-c2', 'c', 'B1', 'c2'),
  ],
};

export const TEST_LEVEL = 'A2';

export const TEST_LINES = ['a1', 'a2', 'a3', 'b1'];

export const NO_SHUFFLE = (): number => 1;

export function storedProfile(
  overrides: Record<string, unknown> = {},
): { read: (key: string) => unknown; write: () => void } {
  const profile = { levelId: TEST_LEVEL };
  const settings = { ...overrides };
  return {
    read: (key: string) => {
      if (key === 'shadowing.profile') { return profile; }
      if (key === 'shadowing.settings') { return settings; }
      return null;
    },
    write: () => {},
  };
}

// PracticeStore reaches ProfileStore, which injects Supabase and the auth
// store. Signed out, both load() and the push back no-op, so a spec that only
// needs a level never has to await anything.
export function signedOutBackend(): Provider[] {
  return [
    { provide: INITIAL_USER, useValue: null },
    {
      provide: SUPABASE,
      useValue: {
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        }),
        auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      } as unknown as SupabaseClient,
    },
  ];
}
