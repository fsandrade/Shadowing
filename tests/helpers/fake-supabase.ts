import { Page } from '@playwright/test';
import fs from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classify } = require('../../tools/classify-level') as { classify: (s: string) => string };
import path from 'node:path';

interface LevelRow { id: string; description: string; }
interface DeckRow { id: string; description: string; }
interface SentenceRow { id: string; deck_id: string; level_id: string; content: string; }

const LEVELS: LevelRow[] = [
  { id: 'A1', description: 'Beginner' },
  { id: 'A2', description: 'Elementary' },
  { id: 'B1', description: 'Intermediate' },
  { id: 'B2', description: 'Upper intermediate' },
  { id: 'C1', description: 'Advanced' },
  { id: 'C2', description: 'Proficient' },
];

function repoFile(...parts: string[]): string {
  return path.resolve(__dirname, '..', '..', ...parts);
}

function readCorpus(): { decks: Array<{ id: string; name: string; lines: string[] }> } {
  const src = fs.readFileSync(repoFile('src', 'app', 'data', 'corpus.ts'), 'utf8');
  const start = src.indexOf('{', src.indexOf('export const CORPUS'));
  return JSON.parse(src.slice(start, src.lastIndexOf('}') + 1));
}

function rows(): { decks: DeckRow[]; sentences: SentenceRow[] } {
  const corpus = readCorpus();

  const decks = corpus.decks.map((deck) => ({ id: deck.id, description: deck.name }));

  const sentences = [...corpus.decks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((deck) => deck.lines.map((content, i) => ({
      id: `${deck.id}-${i}`,
      deck_id: deck.id,
      level_id: classify(content),
      content,
    })));

  return { decks, sentences };
}

export function sentenceCountAt(levelId: string): number {
  return rows().sentences.filter((s) => s.level_id === levelId).length;
}

export function topicCountAt(levelId: string): number {
  return new Set(rows().sentences.filter((s) => s.level_id === levelId).map((s) => s.deck_id)).size;
}

const FAKE_USER_ID = '11111111-1111-4111-8111-111111111111';

/** Unsigned, but shaped like the real thing: supabase-js reads the payload. */
function fakeJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const payload = {
    sub: FAKE_USER_ID,
    role: 'authenticated',
    aud: 'authenticated',
    is_anonymous: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.fake-signature`;
}

export interface FakeSupabaseOptions {
  /**
   * Signs the learner in, so the progress reads happen at all. Without it the
   * anonymous sign-in is refused and every progress path short-circuits, which
   * is the right default for tests that are not about progress.
   */
  readonly signedIn?: boolean;
  /** Row served from user_practice_totals when signed in. */
  readonly totals?: Record<string, unknown>;
}

export async function installFakeSupabase(
  page: Page,
  opts: FakeSupabaseOptions = {},
): Promise<void> {
  const { decks, sentences } = rows();

  if (opts.signedIn) {
    const token = fakeJwt();
    await page.route('**/auth/v1/**', (route) => route.fulfill({
      json: {
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh',
        user: {
          id: FAKE_USER_ID,
          aud: 'authenticated',
          role: 'authenticated',
          is_anonymous: true,
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      },
    }));

    await page.route('**/rest/v1/user_practice_totals*', (route) => route.fulfill({
      json: opts.totals ?? {},
    }));
    await page.route('**/rest/v1/user_streaks*', (route) => route.fulfill({ json: {} }));
    // Writes are accepted and discarded: no test asserts on them yet.
    await page.route('**/rest/v1/practice_sessions*', (route) => route.fulfill({ status: 201, json: [] }));
    await page.route('**/rest/v1/sentence_attempts*', (route) => route.fulfill({ status: 201, json: [] }));
    await page.route('**/rest/v1/user_settings*', (route) => route.fulfill({ json: {} }));
  } else {
    await page.route('**/auth/v1/**', (route) => route.fulfill({
      status: 422,
      json: { code: 422, error_code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' },
    }));
  }

  await page.route('**/*hcaptcha.com/**', (route) => route.abort());

  await page.route('**/rest/v1/levels*', (route) => route.fulfill({ json: LEVELS }));
  await page.route('**/rest/v1/decks*', (route) => route.fulfill({ json: decks }));

  await page.route('**/rest/v1/sentences*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const offset = Number(params.get('offset') ?? 0);
    const limit = Number(params.get('limit') ?? sentences.length);
    return route.fulfill({ json: sentences.slice(offset, offset + limit) });
  });
}

export async function breakSupabase(page: Page): Promise<void> {
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 500,
    json: { message: 'backend is down' },
  }));
}
