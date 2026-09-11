import { computed, inject, Injectable, signal } from '@angular/core';
import { type PracticeKind, type PracticeSource } from '../core/activity';
import { pacingFor } from '../core/pacing';
import { ProgressService } from '../data/progress-service';
import { ValidationService } from '../validation/validation-service';
import { BannerStore } from './banner-store';
import { MESSAGES } from './messages';
import { PracticeStore } from './practice-store';
import { ProfileStore } from './profile-store';
import { SessionTimerStore } from './session-timer-store';
import { SettingsStore } from './settings-store';

export type Screen = 'onboarding' | 'chooser' | 'practice' | 'dictation' | 'summary';

export interface SessionResult {
  readonly kind: PracticeKind;
  readonly source: PracticeSource;
  readonly topicId: string | null;
  // Time actually spent practising, not the duration that was picked. Pressing
  // Finish early is a first-class exit, so the two are usually different.
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

// Which screen the learner is on, and the transitions between them. Nothing is
// persisted: reloading mid-practice lands on the chooser, and the open session
// is closed by the pagehide handler in AppStartup.
@Injectable({ providedIn: 'root' })
export class FlowStore {
  private readonly profile = inject(ProfileStore);
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
    if (!this.profile.chosen()) { return 'onboarding'; }
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

    // Restarting the same kind on the same topic changes no signal the
    // validator watches - selectTopic writes values it already holds, so
    // lines() never recomputes and the effect that drops stale results never
    // runs. Without this the "fresh" screen still shows the last session's
    // transcripts and stars, and a typing box left open swallows Enter.
    this.validation.reset();

    // Read the profile level once, here. Everything downstream uses the frozen
    // copy, so a level changed mid-session only lands on the next start.
    this.practice.activateLevel(this.profile.levelId());

    if (source === 'custom') {
      this.practice.useCustomText();
    } else if (source === 'youtube') {
      this.practice.useYoutube();
    } else {
      this.practice.selectTopic(topicId);
      // Every session starts on a fresh order, so there is no shuffle button
      // to press. It has to be explicit for the same reason validation.reset()
      // does: restarting the same topic leaves lines() cached, so nothing would
      // reshuffle on its own. After selectTopic, or it would shuffle the topic
      // the learner just left.
      this.practice.shuffleLines();
    }

    const pacing = pacingFor(this.profile.levelId());
    this.settings.setRate(pacing.rate);
    this.settings.setSlack(pacing.slack);
    this.settings.setDurationMin(minutes);

    if (kind === 'dictation') {
      // No mic, no STT: the dictation screen checks the typed answer itself.
      this.settings.setTypingMode(true);
      this.banner.clear('stt-denied');
    } else {
      // useSpeaking owns the microphone permission and the stt flag; going
      // around it would leave the validator half-configured.
      const enabled = await this.validation.useSpeaking();
      // A denied microphone makes Speaking resolve to 'nothing', which is
      // Shadowing with a different name - and the row still says
      // kind = 'speaking'. The banner outlives Play, because play() clears
      // only the banners a retry can disprove.
      if (!enabled) {
        this.banner.show(MESSAGES.micDenied, 'stt-denied');
      } else {
        this.banner.clear('stt-denied');
      }
    }

    this.timer.reset(minutes);

    // My text and YouTube never reach the database: that content lives only in
    // the browser, and sentence_attempts.sentence_id is not nullable.
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

    // A catalog session is named by its kind; the other sources carry their
    // own display name because the summary has no topic to point at.
    const names: Record<PracticeSource, string> = {
      catalog: '',
      custom: 'My text',
      youtube: 'YouTube',
    };
    const name = session.source === 'catalog'
      ? session.kind === 'speaking' ? 'Speaking' : 'Dictation'
      : names[session.source];
    this.finished.set({
      kind: this.running()!.kind,
      source: this.running()!.source,
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
