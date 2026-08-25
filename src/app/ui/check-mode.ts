import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SpeechRecognizer } from '../platform/speech-recognition';
import { type CheckMode as Mode, ValidationService } from '../validation/validation-service';

interface Option {
  readonly id: Mode;
  readonly label: string;
  readonly title: string;
}

const OPTIONS: readonly Option[] = [
  {
    id: 'nothing',
    label: 'Nothing',
    title: 'Just listen and repeat — nothing is scored',
  },
  {
    id: 'speaking',
    label: 'Speaking',
    title: 'Say the sentence out loud and have it scored',
  },
  {
    id: 'spelling',
    label: 'Spelling',
    title: 'Type the sentence and have your spelling scored',
  },
];

@Component({
  selector: 'div[appCheckMode]',
  host: { class: 'check-mode', role: 'group', 'aria-label': 'Check my' },
  templateUrl: './check-mode.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckModeControl {
  private readonly validation = inject(ValidationService);
  private readonly sttSupported = inject(SpeechRecognizer).supported();

  protected readonly OPTIONS = OPTIONS;

  protected readonly mode = computed(() => this.validation.mode());

  protected unavailable(id: Mode): boolean {
    return id === 'speaking' && !this.sttSupported;
  }

  protected pick(id: Mode): void {
    if (this.mode() === id) { return; }
    void this.validation.setMode(id);
  }
}
