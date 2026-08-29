import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadContent } from './app/data/corpus-source';
import { SENTENCE_IDS } from './app/data/progress-service';
import { ensureUser, INITIAL_USER } from './app/platform/auth';
import { createSupabaseClient, SUPABASE } from './app/platform/supabase-client';
import { CATALOG } from './app/state/catalog-token';
import { showStartupError } from './startup-error';

async function start(): Promise<void> {
  const client = createSupabaseClient();
  // Fresh seed per app load: sentences are ordered by hash(id || seed), so
  // every session gets a different random order while paging stays consistent.
  const seed = crypto.randomUUID();

  const [content, user] = await Promise.all([
    loadContent(client, seed),
    ensureUser(client),
  ]);

  await bootstrapApplication(App, {
    ...appConfig,
    providers: [
      ...appConfig.providers,
      { provide: SUPABASE, useValue: client },
      { provide: CATALOG, useValue: content.catalog },
      { provide: SENTENCE_IDS, useValue: content.sentenceIds },
      { provide: INITIAL_USER, useValue: user },
    ],
  });
}

start().catch((reason) => {
  console.error(reason);
  showStartupError(reason);
});
