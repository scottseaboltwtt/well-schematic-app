import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WellSchematic3dComponent } from '../../components/well-schematic-3d/well-schematic-3d.component';
import { ParamsSidebarComponent } from '../../components/params-sidebar/params-sidebar.component';
import { WellboreImportService } from '../../services/wellbore-import.service';
import { ImportMergeService } from '../../services/import-merge.service';
import { WellSchematicParams, DEFAULT_PARAMS, ImportedWellboreData, SurveyStation, PerforationInterval } from '../../models/well-schematic.model';

@Component({
  selector: 'app-well-schematic-page',
  standalone: true,
  imports: [DecimalPipe, FormsModule, WellSchematic3dComponent, ParamsSidebarComponent],
  templateUrl: './well-schematic-page.component.html',
  styleUrl: './well-schematic-page.component.css',
})
export class WellSchematicPageComponent {
  params: WellSchematicParams = { ...DEFAULT_PARAMS };
  importedData: ImportedWellboreData | null = null;
  importError: string | null = null;
  activeTab: 'data' | 'schematic' = 'schematic';
  readonly pageSize = 10;
  surveyPage = 1;
  perfPage = 1;
  showOffsetWell = false;
  offsetWell: WellSchematicParams = (() => {
    const p = { ...DEFAULT_PARAMS };
    p.wellName = 'Offset Well A';
    p.totalDepth = 8200;
    p.kopDepth = 6400;
    p.surfaceCasingDepth = 3400;
    p.intermediateCasingDepth = 6400;
    p.productionCasingDepth = 8200;
    p.perforationDepths = [7300, 7600, 7900];
    p.packerDepths = [7200, 7800];
    p.bitDepth = 8200;
    p.eocDepth = 7100;
    p.lossesDepths = [4100];
    return p;
  })();

  constructor(
    private wellboreImport: WellboreImportService,
    private importMerge: ImportMergeService
  ) {}

  onParamsChange(p: WellSchematicParams): void {
    this.params = p;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.importError = null;
    try {
      const data = await this.wellboreImport.parseExcel(file);
      if (!data.surveyStations?.length) {
        this.importError = 'No directional survey data found.';
        return;
      }
      this.importedData = data;
      this.surveyPage = 1;
      this.perfPage = 1;
      // Merge: existing params as base, import overrides/influences where it has data
      this.params = this.importMerge.mergeWithImport(this.params, data);
    } catch (err) {
      this.importError = err instanceof Error ? err.message : 'Failed to parse Excel file.';
    }
    input.value = '';
  }

  clearImport(): void {
    this.importedData = null;
    this.importError = null;
    this.activeTab = 'schematic';
    this.params = { ...DEFAULT_PARAMS };
  }

  get paginatedSurveyStations() {
    if (!this.importedData?.surveyStations) return [];
    const start = (this.surveyPage - 1) * this.pageSize;
    return this.importedData.surveyStations.slice(start, start + this.pageSize);
  }

  get totalSurveyPages(): number {
    if (!this.importedData?.surveyStations?.length) return 0;
    return Math.ceil(this.importedData.surveyStations.length / this.pageSize);
  }

  get paginatedPerforationIntervals() {
    if (!this.importedData?.perforationIntervals) return [];
    const start = (this.perfPage - 1) * this.pageSize;
    return this.importedData.perforationIntervals.slice(start, start + this.pageSize);
  }

  get totalPerfPages(): number {
    if (!this.importedData?.perforationIntervals?.length) return 0;
    return Math.ceil(this.importedData.perforationIntervals.length / this.pageSize);
  }

  surveyRangeEnd(): number {
    if (!this.importedData?.surveyStations) return 0;
    return Math.min(this.surveyPage * this.pageSize, this.importedData.surveyStations.length);
  }

  perfRangeEnd(): number {
    if (!this.importedData?.perforationIntervals) return 0;
    return Math.min(this.perfPage * this.pageSize, this.importedData.perforationIntervals.length);
  }

  /** Update a survey station field; triggers schematic rebuild */
  updateSurveyStation(globalIndex: number, field: keyof SurveyStation, value: string | number): void {
    if (!this.importedData?.surveyStations || globalIndex < 0 || globalIndex >= this.importedData.surveyStations.length) return;
    const parsed = typeof value === 'string' ? (field === 'index' ? parseInt(value, 10) || 0 : parseFloat(value) || 0) : value;
    const stations = this.importedData.surveyStations.map((s, i) =>
      i === globalIndex ? { ...s, [field]: parsed } : s
    );
    this.importedData = { ...this.importedData, surveyStations: stations };
    this.params = this.importMerge.mergeWithImport(this.params, this.importedData);
  }

  /** Update a perforation interval field; triggers schematic rebuild */
  updatePerforationInterval(globalIndex: number, field: keyof PerforationInterval, value: string | number): void {
    if (!this.importedData?.perforationIntervals || globalIndex < 0 || globalIndex >= this.importedData.perforationIntervals.length) return;
    const parsed = typeof value === 'string'
      ? (field === 'alias' ? value : (field === 'numPerfs' || field === 'numClusters' ? parseInt(value, 10) || 0 : parseFloat(value) || 0))
      : value;
    const intervals = this.importedData.perforationIntervals.map((p, i) =>
      i === globalIndex ? { ...p, [field]: parsed } : p
    );
    this.importedData = { ...this.importedData, perforationIntervals: intervals };
    this.params = this.importMerge.mergeWithImport(this.params, this.importedData);
  }

  /** Global index for paginated survey row */
  surveyGlobalIndex(rowIndex: number): number {
    return (this.surveyPage - 1) * this.pageSize + rowIndex;
  }

  /** Global index for paginated perforation row */
  perfGlobalIndex(rowIndex: number): number {
    return (this.perfPage - 1) * this.pageSize + rowIndex;
  }
}
