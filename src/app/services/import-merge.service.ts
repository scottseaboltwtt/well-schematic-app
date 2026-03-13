import { Injectable } from '@angular/core';
import {
  WellSchematicParams,
  ImportedWellboreData,
  defaultFormationLayers,
  defaultMudWeightData,
} from '../models/well-schematic.model';

/**
 * Merge strategy: existing params as base, imported data overrides or influences.
 * - REPLACE: when import has direct data (totalDepth, KOP, perforations, etc.)
 * - INFLUENCE: when import changes context (e.g. scale casing depths with new totalDepth)
 */
@Injectable({ providedIn: 'root' })
export class ImportMergeService {
  /**
   * Merge base params with import-derived values.
   * Import replaces where it has data; influences (scales) where base values depend on replaced fields.
   */
  mergeWithImport(base: WellSchematicParams, data: ImportedWellboreData): WellSchematicParams {
    const derived = this.deriveFromImport(data);
    const influence = this.computeInfluence(base, derived);

    return {
      ...base,
      ...influence,
    };
  }

  /** Values we can derive directly from import (replace base) */
  private deriveFromImport(data: ImportedWellboreData): Partial<WellSchematicParams> {
    const stations = data.surveyStations;
    const perfs = data.perforationIntervals ?? [];

    if (!stations?.length) return {};

    const totalDepth = Math.max(...stations.map((s) => s.md), 0);
    const kopStation = stations.find((s) => s.inclination > 1);
    const kopDepth = kopStation?.md ?? Math.min(2500, totalDepth * 0.2);
    const maxInclination = Math.max(...stations.map((s) => s.inclination), 90);
    const buildEndStation = stations.find((s) => s.inclination >= maxInclination * 0.85);

    let buildRate = 8;
    if (stations.length >= 2 && kopStation && buildEndStation) {
      const buildStations = stations.filter(
        (s) => s.md >= kopStation.md && s.md <= buildEndStation.md && s.inclination > kopStation.inclination
      );
      if (buildStations.length >= 2) {
        const first = buildStations[0];
        const last = buildStations[buildStations.length - 1];
        const buildLength = last.md - first.md;
        const inclGain = last.inclination - first.inclination;
        if (buildLength > 0 && inclGain > 0) {
          buildRate = (inclGain / buildLength) * 100;
          buildRate = Math.max(3, Math.min(15, buildRate));
        }
      }
    }

    const firstPerfTop = perfs.length ? Math.min(...perfs.map((p) => p.topMd)) : totalDepth;
    const intCandidate = kopDepth > 0 ? Math.min(kopDepth + 1200, Math.floor(totalDepth * 0.65)) : Math.floor(totalDepth * 0.5);
    const intermediateCasingDepth = Math.max(
      kopDepth + 200,
      Math.min(intCandidate, firstPerfTop - 100)
    );

    const packerDepths: number[] = [];
    if (perfs.length >= 2) {
      const sorted = [...perfs].sort((a, b) => a.topMd - b.topMd);
      packerDepths.push(Math.max(0, sorted[0].topMd - 150));
      if (sorted[sorted.length - 1].botMd - sorted[0].topMd > 500) {
        packerDepths.push(Math.min(totalDepth, sorted[sorted.length - 1].botMd + 150));
      }
    }

    const surfaceCasingDepth = Math.min(3000, Math.floor(totalDepth * 0.2));

    return {
      wellName: 'Imported Well',
      totalDepth,
      kopDepth,
      maxInclination,
      buildRate,
      surfaceCasingDepth,
      intermediateCasingDepth,
      productionCasingDepth: totalDepth,
      bitDepth: totalDepth,
      eocDepth: Math.min(kopDepth + 600, intermediateCasingDepth - 50),
      perforationDepths: perfs.map((p) => Math.round((p.topMd + p.botMd) / 2)),
      packerDepths,
      showPackers: packerDepths.length > 0,
      formationLayers: defaultFormationLayers(totalDepth),
      mudWeightData: defaultMudWeightData(totalDepth),
    };
  }

  /** Influence: scale base values when derived changes context (e.g. totalDepth) */
  private computeInfluence(base: WellSchematicParams, derived: Partial<WellSchematicParams>): Partial<WellSchematicParams> {
    const result = { ...derived };
    const newTd = derived.totalDepth ?? base.totalDepth;
    const oldTd = base.totalDepth;

    // When totalDepth changes, influence surface casing if not in derived (scale proportionally)
    if (derived.surfaceCasingDepth === undefined && oldTd > 0 && newTd !== oldTd) {
      result.surfaceCasingDepth = Math.min(
        3000,
        Math.round(base.surfaceCasingDepth * (newTd / oldTd))
      );
    }
    return result;
  }
}
