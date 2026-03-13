import { Injectable } from '@angular/core';
import { TrajectoryPoint, SurveyStation } from '../models/well-schematic.model';

@Injectable({ providedIn: 'root' })
export class TrajectoryService {
  /**
   * Calculate J-hook trajectory using minimum curvature method.
   * Returns points in 3D space: Y = depth (negative down), X = east, Z = north.
   * For display we use: depth as -Y (down), horizontal offset as X.
   */
  calculateTrajectory(
    kopDepth: number,
    buildRate: number,
    maxInclination: number,
    totalDepth: number
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    const step = 50;
    const azim = 180; // horizontal section extends left (flipped)
    const radius = (180 / Math.PI) * (100 / buildRate); // radius of curvature in feet
    const maxInclRad = maxInclination * (Math.PI / 180);
    const buildArcLength = radius * maxInclRad;
    const buildEndMd = kopDepth + buildArcLength;

    let md = 0;
    while (md <= totalDepth) {
      let tvd: number;
      let incl: number;
      let disp: number;

      if (md <= kopDepth) {
        incl = 0;
        tvd = md;
        disp = 0;
      } else if (md <= buildEndMd) {
        const arcLen = md - kopDepth;
        const theta = arcLen / radius;
        incl = theta * (180 / Math.PI);
        tvd = kopDepth + radius * Math.sin(theta);
        disp = radius * (1 - Math.cos(theta));
      } else {
        const tangentLen = md - buildEndMd;
        const buildTvd = radius * Math.sin(maxInclRad);
        const buildDisp = radius * (1 - Math.cos(maxInclRad));
        tvd = kopDepth + buildTvd + tangentLen * Math.cos(maxInclRad);
        disp = buildDisp + tangentLen * Math.sin(maxInclRad);
        incl = maxInclination;
      }

      const x = disp * Math.sin(azim * (Math.PI / 180));
      const z = disp * Math.cos(azim * (Math.PI / 180));

      points.push({
        measuredDepth: md,
        trueVerticalDepth: tvd,
        inclination: incl,
        azimuth: azim,
        x,
        y: -tvd,
        z,
      });

      md += step;
    }

    // Ensure final point at totalDepth (step may not land exactly)
    const last = points[points.length - 1];
    if (last && last.measuredDepth < totalDepth) {
      const md = totalDepth;
      let tvd: number;
      let incl: number;
      let disp: number;
      if (md <= kopDepth) {
        incl = 0;
        tvd = md;
        disp = 0;
      } else if (md <= buildEndMd) {
        const arcLen = md - kopDepth;
        const theta = arcLen / radius;
        incl = theta * (180 / Math.PI);
        tvd = kopDepth + radius * Math.sin(theta);
        disp = radius * (1 - Math.cos(theta));
      } else {
        const tangentLen = md - buildEndMd;
        const buildTvd = radius * Math.sin(maxInclRad);
        const buildDisp = radius * (1 - Math.cos(maxInclRad));
        tvd = kopDepth + buildTvd + tangentLen * Math.cos(maxInclRad);
        disp = buildDisp + tangentLen * Math.sin(maxInclRad);
        incl = maxInclination;
      }
      const x = disp * Math.sin(azim * (Math.PI / 180));
      const z = disp * Math.cos(azim * (Math.PI / 180));
      points.push({
        measuredDepth: md,
        trueVerticalDepth: tvd,
        inclination: incl,
        azimuth: azim,
        x,
        y: -tvd,
        z,
      });
    }

    return points;
  }

  /** Convert trajectory points to Three.js Vector3 path (x, y, z) */
  toPath3D(points: TrajectoryPoint[], scale = 1): { x: number; y: number; z: number }[] {
    return points.map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
      z: p.z * scale,
    }));
  }

  /**
   * Build trajectory from survey stations. Uses N-S (ft) and E-W (ft) for x/z.
   * Y = -TVD (depth down). Conventions: x = E-W (east), z = N-S (north).
   */
  trajectoryFromSurvey(stations: SurveyStation[]): TrajectoryPoint[] {
    if (!stations?.length) return [];
    return stations.map((s) => ({
      measuredDepth: s.md,
      trueVerticalDepth: s.tvd,
      inclination: s.inclination,
      azimuth: s.azimuth,
      x: s.eWest,
      y: -s.tvd,
      z: s.nSouth,
    }));
  }

  /** Get lateral (horizontal) length in feet for a J-hook trajectory */
  getLateralLength(kopDepth: number, buildRate: number, maxInclination: number, totalDepth: number): number {
    const radius = (180 / Math.PI) * (100 / buildRate);
    const maxInclRad = maxInclination * (Math.PI / 180);
    const buildArcLength = radius * maxInclRad;
    const buildEndMd = kopDepth + buildArcLength;
    return Math.max(0, totalDepth - buildEndMd);
  }
}
