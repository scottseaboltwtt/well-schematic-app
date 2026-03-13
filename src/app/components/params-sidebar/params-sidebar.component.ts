import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WellSchematicParams, DEFAULT_PARAMS } from '../../models/well-schematic.model';

@Component({
  selector: 'app-params-sidebar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './params-sidebar.component.html',
  styleUrl: './params-sidebar.component.css',
})
export class ParamsSidebarComponent {
  @Input() params: WellSchematicParams = { ...DEFAULT_PARAMS };
  @Output() paramsChange = new EventEmitter<WellSchematicParams>();
  @Input() showOffsetWell = false;
  @Output() showOffsetWellChange = new EventEmitter<boolean>();
  @Input() hideOffsetWell = false;

  update<K extends keyof WellSchematicParams>(key: K, value: WellSchematicParams[K]): void {
    const next = { ...this.params, [key]: value };
    this.params = next;
    this.paramsChange.emit(next);
  }

  updateNumber(key: keyof WellSchematicParams, val: string): void {
    const num = parseFloat(val);
    if (!isNaN(num)) this.update(key as keyof WellSchematicParams, num as any);
  }

  addPerforation(): void {
    const depths = [...this.params.perforationDepths];
    depths.push((depths[depths.length - 1] ?? 7500) + 300);
    this.update('perforationDepths', depths);
  }

  removePerforation(i: number): void {
    const depths = this.params.perforationDepths.filter((_, idx) => idx !== i);
    this.update('perforationDepths', depths);
  }

  addPacker(): void {
    const depths = [...this.params.packerDepths];
    depths.push((depths[depths.length - 1] ?? 7400) + 300);
    this.update('packerDepths', depths);
  }

  removePacker(i: number): void {
    const depths = this.params.packerDepths.filter((_, idx) => idx !== i);
    this.update('packerDepths', depths);
  }

  updatePerfDepth(i: number, val: string): void {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const depths = [...this.params.perforationDepths];
    depths[i] = num;
    this.update('perforationDepths', depths);
  }

  updatePackerDepth(i: number, val: string): void {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const depths = [...this.params.packerDepths];
    depths[i] = num;
    this.update('packerDepths', depths);
  }

  addLosses(): void {
    const depths = [...(this.params.lossesDepths || [])];
    depths.push((depths[depths.length - 1] ?? 4000) + 200);
    this.update('lossesDepths', depths);
  }

  removeLosses(i: number): void {
    const depths = (this.params.lossesDepths || []).filter((_, idx) => idx !== i);
    this.update('lossesDepths', depths);
  }

  updateLossesDepth(i: number, val: string): void {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const depths = [...(this.params.lossesDepths || [])];
    depths[i] = num;
    this.update('lossesDepths', depths);
  }

  reset(): void {
    this.params = { ...DEFAULT_PARAMS };
    this.paramsChange.emit(this.params);
  }
}
