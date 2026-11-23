import { computed, inject, Injectable, signal } from '@angular/core';
import { type PracticeKind, type PracticeSource } from '../core/activity';
import { ProgressService } from '../data/progress-service';
import { ValidationService } from '../validation/validation-service';
import { BannerStore } from './banner-store';
import { MESSAGES } from './messages';
import { PracticeStore } from './practice-store';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';

export type Screen = 'chooser' | 'practice' | 'dictation' | 'summary';

export interface SessionResult {
  readonly kind: PracticeKind;
  readonly source: PracticeSource;
  readonly topicId: string | null;
  
  
  readonly practisedMs: number;
  readonly spoken: number;
  readonly stars: number | null;
  readonly name: string;
}

interface RunningSession {
  readonly kind: PracticeKind;
  readonly source: PracticeSource;
  readonly topicId: string | null;
  readonly minutes: number;
}




@Injectable({ providedIn: 'root' })
export class FlowStore {
  private readonly settings = inject(SettingsStore);
  private readonly practice = inject(PracticeStore);
  private readonly timer = inject(SessionTimerStore);
  private readonly validation = inject(ValidationService);
  private readonly banner = inject(BannerStore);
  private readonly progress = inject(ProgressService);

  private readonly running = signal<RunningSession | null>(null);
  private readonly finished = signal<SessionResult | null>(null);
  private readonly topic = signal<string | null>(null);

  readonly kind = computed(() => this.running()?.kind ?? null);
  readonly result = this.finished.asReadonly();

  readonly screen = computed<Screen>(() => {
    if (this.finished()) { return 'summary'; }
    if (!this.running()) { return 'chooser'; }
    return this.running()!.kind === 'dictation' ? 'dictation' : 'practice';
  });

  async start(
    kind: PracticeKind,
    source: PracticeSource,
    topicId: string | null,
    minutes: number,
  ): Promise<void> {
    this.finished.set(null);
    this.topic.set(topicId);

    
    
    
    
    
    this.validation.reset();

    
    
    if (source === 'custom') {
      this.practice.useCustomText();
    } else {
      this.practice.selectTopic(topicId);
      
      
      
      
      
    }

    this.settings.setDurationMin(minutes);

    if (kind === 'dictation') {
      
      this.settings.setTypingMode(true);
      this.banner.clear('stt-denied');
    } else {
      
      
      const enabled = await this.validation.useSpeaking();
      
      
      
      
      if (!enabled) {
        this.banner.show(MESSAGES.micDenied, 'stt-denied');
      } else {
        this.banner.clear('stt-denied');
      }
    }

    this.timer.reset(minutes);

    
    
    if (source === 'catalog') {
      this.progress.startSession(kind, topicId, minutes);
    }

    this.running.set({ kind, source, topicId, minutes });
  }

  finish(): void {
    const session = this.running();
    if (!session) { return; }

    const tally = this.timer.finish();
    this.progress.endSession(tally.usedMs);

    
    
    const names: Record<PracticeSource, string> = {
      catalog: '',
      custom: 'My text',
    };
    const name = session.source === 'catalog'
      ? session.kind === 'speaking' ? 'Speaking' : 'Dictation'
      : names[session.source];
    this.finished.set({
      kind: session.kind,
      source: session.source,
      topicId: this.topic(),
      practisedMs: tally.usedMs,
      spoken: tally.spoken,
      stars: tally.stars,
      name,
    });
    this.running.set(null);
  }

  backToChooser(): void {
    this.finished.set(null);
    this.running.set(null);
  }
}
