import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { ensureUser } from './auth';

const USER = { id: 'user-1', is_anonymous: true } as unknown as User;

function fakeClient(opts: {
  session?: { user: User } | null;
  signIn?: { data: { user: User | null }; error: { message: string } | null };
} = {}) {
  const calls: unknown[] = [];
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: opts.session ?? null } }),
      signInAnonymously: (arg?: unknown) => {
        calls.push(arg);
        return Promise.resolve(opts.signIn ?? { data: { user: USER }, error: null });
      },
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('ensureUser', () => {
  it('reuses an existing session rather than creating another user', async () => {
    const { client, calls } = fakeClient({ session: { user: USER } });
    await expect(ensureUser(client)).resolves.toBe(USER);
    expect(calls).toHaveLength(0);
  });

  it('signs in anonymously when there is no session', async () => {
    const { client, calls } = fakeClient();
    await expect(ensureUser(client)).resolves.toBe(USER);
    expect(calls).toEqual([undefined]);
  });

  it('returns null rather than throwing when sign-in is refused', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({
      signIn: { data: { user: null }, error: { message: 'rate limited' } },
    });

    await expect(ensureUser(client)).resolves.toBeNull();
  });

  it('returns null rather than throwing when the network is down', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = {
      auth: { getSession: () => Promise.reject(new Error('offline')) },
    } as unknown as SupabaseClient;

    await expect(ensureUser(client)).resolves.toBeNull();
  });
});
