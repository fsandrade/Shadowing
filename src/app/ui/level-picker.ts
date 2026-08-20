import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { countAt } from '../core/catalog';
import { CATALOG } from '../state/catalog-token';
import { PracticeStore } from '../state/practice-store';

const BLURBS: Readonly<Record<string, string>> = {
  A1: 'You can follow very short, simple sentences',
  A2: 'You can handle everyday phrases and routine exchanges',
  B1: 'You can cope with familiar subjects and give opinions',
  B2: 'You can follow longer, more complex sentences',
  C1: 'You can handle demanding language and implied meaning',
  C2: 'You can follow virtually anything with ease',
};
@Component({
  selector: 'div[appLevelPicker]',
  host: { class: 'level-picker' },
  templateUrl: './level-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelPicker {
  private readonly catalog = inject(CATALOG);
  protected readonly practice = inject(PracticeStore);

  protected readonly choices = computed(() => this.catalog.levels.map((level) => ({
    ...level,
    blurb: BLURBS[level.id] ?? '',
    available: countAt(this.catalog, level.id) > 0,
  })));

  protected readonly current = computed(() => this.practice.level());

  protected pick(id: string, available: boolean): void {
    if (!available) { return; }
    this.practice.selectLevel(id);
  }
}
