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

export async function installFakeSupabase(page: Page): Promise<void> {
  const { decks, sentences } = rows();

  await page.route('**/auth/v1/**', (route) => route.fulfill({
    status: 422,
    json: { code: 422, error_code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' },
  }));

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
