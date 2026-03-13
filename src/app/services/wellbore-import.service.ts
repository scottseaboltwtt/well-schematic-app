import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  ImportedWellboreData,
  SurveyStation,
  PerforationInterval,
} from '../models/well-schematic.model';

function toNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

@Injectable({ providedIn: 'root' })
export class WellboreImportService {
  /**
   * Parse Excel file. Expects sheets: "Directional survey" and "Perforation Intervals".
   * Column order matches screenshots: Directional = MD, TVD, Azimuth, N-S, E-W, Inclination;
   * Perforation = Alias, Top MD, Bot MD, Top TVD, Bot TVD, Diameter, No. of Perfs, Perf Phasing, No. of Clusters.
   */
  async parseExcel(file: File): Promise<ImportedWellboreData> {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    const surveyStations = this.parseDirectionalSurvey(wb);
    const perforationIntervals = this.parsePerforationIntervals(wb);

    return { surveyStations, perforationIntervals };
  }

  private parseDirectionalSurvey(wb: XLSX.WorkBook): SurveyStation[] {
    const sheet = wb.Sheets['Directional survey'] ?? wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const stations: SurveyStation[] = [];
    // Skip header row if first row looks like headers (non-numeric)
    let startRow = 0;
    const first = rows[0];
    if (first && Array.isArray(first) && first.length > 0) {
      const firstVal = first[0];
      if (typeof firstVal === 'string' && (firstVal === '#' || firstVal.toLowerCase().includes('md'))) {
        startRow = 1;
      }
      // Also skip if first row is all zeros (placeholder)
      if (Array.isArray(first) && first.every((c) => c === 0 || c === '0' || c === '')) {
        startRow = 1;
      }
    }

    // Detect column order from header if present (MD, TVD, Azimuth, N-S, E-W, Inclination is common)
    let colMd = 0, colTvd = 1, colAz = 2, colNs = 3, colEw = 4, colIncl = 5;
    if (startRow > 0 && rows[0] && Array.isArray(rows[0])) {
      const h = rows[0].map((c) => String(c).toLowerCase());
      const idx = (s: string) => h.findIndex((c) => c.includes(s));
      const iMd = idx('md');
      const iTvd = idx('tvd');
      const iNs = idx('n-s') >= 0 ? idx('n-s') : idx('n/s');
      const iEw = idx('e-w') >= 0 ? idx('e-w') : idx('e/w');
      if (iMd >= 0) colMd = iMd;
      if (iTvd >= 0) colTvd = iTvd;
      if (iNs >= 0) colNs = iNs;
      if (iEw >= 0) colEw = iEw;
      const iAz = idx('azimuth');
      const iIncl = idx('incl');
      if (iAz >= 0) colAz = iAz;
      if (iIncl >= 0) colIncl = iIncl;
    }

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const md = toNum(row[colMd]);
      const tvd = toNum(row[colTvd]);
      const azimuth = toNum(row[colAz]);
      const nSouth = toNum(row[colNs]);
      const eWest = toNum(row[colEw]);
      const inclination = toNum(row[colIncl]);

      // Skip empty rows
      if (md === 0 && tvd === 0 && inclination === 0 && i > startRow) continue;
      // Skip trailing empty row
      if (md === 0 && tvd === 0 && row.every((c) => c === 0 || c === '' || c === '-')) continue;

      stations.push({
        index: stations.length + 1,
        md,
        tvd,
        azimuth,
        nSouth,
        eWest,
        inclination,
      });
    }

    return stations;
  }

  private parsePerforationIntervals(wb: XLSX.WorkBook): PerforationInterval[] {
    const sheet = wb.Sheets['Perforation Intervals'] ?? wb.Sheets[wb.SheetNames[1]];
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const intervals: PerforationInterval[] = [];
    let startRow = 0;
    const first = rows[0];
    if (first && Array.isArray(first)) {
      const v = first[1] ?? first[0];
      if (typeof v === 'string' && (v.toLowerCase().includes('alias') || v.toLowerCase().includes('top'))) {
        startRow = 1;
      }
    }

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      // Excel: Col0=?, Col1=index, Col2=Top MD, Col3=Bot MD, Col4=Top TVD, Col5=Bot TVD, Col6=Diameter, Col7=No. Perfs, Col8=Phasing, Col9=Clusters
      const topMd = toNum(row[2]);
      const botMd = toNum(row[3]);
      const topTvd = toNum(row[4]);
      const botTvd = toNum(row[5]);
      const diameter = toNum(row[6]);
      const numPerfs = toNum(row[7]);
      const perfPhasing = toNum(row[8]);
      const numClusters = toNum(row[9]);

      if (topMd === 0 && botMd === 0) continue;
      if (topMd === 0 && botMd === 0 && diameter === 0 && numPerfs === 0) continue;

      const alias = row[1] ?? row[0];
      intervals.push({
        alias: typeof alias === 'string' ? alias : String(alias || intervals.length + 1),
        topMd,
        botMd,
        topTvd,
        botTvd,
        diameter,
        numPerfs,
        perfPhasing,
        numClusters,
      });
    }

    return intervals;
  }
}
