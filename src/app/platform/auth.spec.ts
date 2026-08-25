import type { SupabaseClient, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Captcha, ensureUser } from './auth';

const captcha: { configured: boolean; token: string | null } = {
  configured: false,
  token: null,
};

const fakeCaptcha: Captcha = {
  configured: () => captcha.configured,
  solve: () => Promise.resolve(captcha.token),
};

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

beforeEach(() => {
  captcha.configured = false;
  captcha.token = null;
  vi.restoreAllMocks();
});

describe('ensureUser', () => {
  it('reuses an existing session rather than creating another user', async () => {
    const { client, calls } = fakeClient({ session: { user: USER } });
    await expect(ensureUser(client, fakeCaptcha)).resolves.toBe(USER);
    expect(calls).toHaveLength(0);
  });

  it('signs in anonymously when there is no session', async () => {
    const { client, calls } = fakeClient();
    await expect(ensureUser(client, fakeCaptcha)).resolves.toBe(USER);
    expect(calls).toEqual([undefined]);
  });

  it('sends the captcha token when a captcha is configured', async () => {
    captcha.configured = true;
    captcha.token = 'token-abc';
    const { client, calls } = fakeClient();

    await expect(ensureUser(client, fakeCaptcha)).resolves.toBe(USER);
    expect(calls).toEqual([{ options: { captchaToken: 'token-abc' } }]);
  });

  it('does not attempt sign-in when a required captcha could not be solved', async () => {
    captcha.configured = true;
    captcha.token = null;
    const { client, calls } = fakeClient();

    await expect(ensureUser(client, fakeCaptcha)).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns null rather than throwing when sign-in is refused', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = fakeClient({
      signIn: { data: { user: null }, error: { message: 'captcha protection: request disallowed' } },
    });

    await expect(ensureUser(client, fakeCaptcha)).resolves.toBeNull();
  });

  it('returns null rather than throwing when the network is down', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = {
      auth: { getSession: () => Promise.reject(new Error('offline')) },
    } as unknown as SupabaseClient;

    await expect(ensureUser(client, fakeCaptcha)).resolves.toBeNull();
  });
});
