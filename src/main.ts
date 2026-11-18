import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadContent } from './app/data/corpus-source';
import { SENTENCE_IDS } from './app/data/progress-service';
import { CATALOG } from './app/state/catalog-token';
import { showStartupError } from './startup-error';

async function start(): Promise<void> {
  
  const seed = crypto.randomUUID();
  const content = loadContent(seed);

  await bootstrapApplication(App, {
    ...appConfig,
    providers: [
      ...appConfig.providers,
      { provide: CATALOG, useValue: content.catalog },
      { provide: SENTENCE_IDS, useValue: content.sentenceIds },
    ],
  });
}

start().catch((reason) => {
  console.error(reason);
  showStartupError(reason);
});
