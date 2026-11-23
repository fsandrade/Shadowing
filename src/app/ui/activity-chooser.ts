import {
  afterEveryRender, ChangeDetectionStrategy, Component, computed, ElementRef,
  inject, signal, ViewChild,
} from '@angular/core';
import { type Kind, KINDS } from '../core/activity';
import { formatStudied } from '../core/timing';
import { HistoryService, type PracticeTotals } from '../data/history-service';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { CustomTopicStore } from '../state/custom-topic-store';
import { FlowStore } from '../state/flow-store';
import { PracticeStore } from '../state/practice-store';
import { CustomTopic } from './custom-topic';
import { TopicList } from './topic-list';

export type SourceTab = 'catalog' | 'custom';

interface DurationOption {
  readonly min: number;
  readonly label: string;
  readonly title: string;
}

const DURATIONS: readonly DurationOption[] = [
  { min: 5, label: '5 min', title: 'Practise for 5 minutes' },
  { min: 10, label: '10 min', title: 'Practise for 10 minutes' },
  { min: 15, label: '15 min', title: 'Practise for 15 minutes' },
  { min: 0, label: 'Unlimited', title: 'Practise until you finish the activity' },
];

@Component({
  selector: 'main[appActivityChooser]',
  imports: [TopicList, CustomTopic],
  host: { class: 'chooser' },
  templateUrl: './activity-chooser.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChooser {
  private readonly flow = inject(FlowStore);
  private readonly sttSupported = inject(SpeechRecognizer).supported();

  protected readonly KINDS = KINDS;
  protected readonly DURATIONS = DURATIONS;

  private readonly history = inject(HistoryService);

  protected readonly totals = signal<PracticeTotals | null>(null);

  protected readonly studied = formatStudied;

  protected readonly kind = signal<Kind | null>(null);
  protected readonly source = signal<SourceTab>('catalog');
  protected readonly topicId = signal<string | null>(null);
  protected readonly minutes = signal(10);

  private readonly custom = inject(CustomTopicStore);
  private readonly practice = inject(PracticeStore);

  protected readonly chooserVisible = computed(() => this.kind() !== null);

  protected readonly mastered = computed(() => {
    if (this.source() !== 'catalog' || !this.topicPicked()) { return false; }
    return this.practice.remainingFor(this.topicId()) === 0;
  });

  protected readonly sourceReady = computed(() => {
    switch (this.source()) {
      case 'custom': return this.custom.hasText();
      default: return this.topicPicked() && !this.mastered();
    }
  });

  protected readonly ready = computed(() => this.kind() !== null && this.sourceReady());

  @ViewChild(TopicList, { read: ElementRef }) private readonly topics?: ElementRef<HTMLElement>;

  private focusTopics = false;
  private readonly topicPicked = signal(false);

  constructor() {
    this.totals.set(this.history.totals());
    afterEveryRender(() => {
      if (!this.focusTopics) { return; }
      this.focusTopics = false;
      if (this.onPhone()) { this.topics?.nativeElement.focus(); }
    });
  }

  protected unavailable(kind: Kind): boolean {
    return kind.needsMicrophone && !this.sttSupported;
  }

  protected choose(kind: Kind): void {
    if (this.unavailable(kind)) { return; }
    this.kind.set(kind);
    this.source.set('catalog');
    this.focusTopics = true;
  }

  protected pickSource(tab: SourceTab): void {
    this.source.set(tab);
  }

  protected pickTopic(id: string | null): void {
    this.topicId.set(id);
    this.topicPicked.set(true);
  }

  protected pickDuration(min: number): void {
    this.minutes.set(min);
  }

  private onPhone(): boolean {
    return window.matchMedia('(max-width: 640px)').matches;
  }

  protected async begin(): Promise<void> {
    const kind = this.kind();
    if (!kind) { return; }
    await this.flow.start(
      kind.id,
      this.source(),
      this.source() === 'catalog' ? this.topicId() : null,
      this.minutes(),
    );
  }
}
