export interface FormationLayer {
  depthTop: number;
  depthBottom: number;
  color: string;
  name?: string;
}

export interface MudWeightPoint {
  depth: number;
  ppg: number;
}

export interface WellSchematicParams {
  kopDepth: number;
  buildRate: number;
  maxInclination: number;
  totalDepth: number;
  surfaceCasingDepth: number;
  intermediateCasingDepth: number;
  productionCasingDepth: number;
  perforationDepths: number[];
  perforationZoneLength: number;
  packerDepths: number[];
  wellName: string;
  showPerforations: boolean;
  showPackers: boolean;
  showCutaway: boolean;
  cutawayAngle: number;
  showDepthMarkers: boolean;
  showCasingSpecs: boolean;
  showMudWeight: boolean;
  mudWeightMin: number;
  mudWeightMax: number;
  surfaceCasingSpec: string;
  intermediateCasingSpec: string;
  productionCasingSpec: string;
  // Filters
  showHoleSection: boolean;
  showCasing: boolean;
  showBHA: boolean;
  showMud: boolean;
  showFormation: boolean;
  showDirectional: boolean;
  showParameters: boolean;
  showCement: boolean;
  showHazard: boolean;
  // Event markers
  bitDepth: number;
  eocDepth: number;
  fishingDepths: number[];
  lossesDepths: number[];
  stuckPipeDepths: number[];
  wellControlDepths: number[];
  // Formation layers & mud data
  formationLayers: FormationLayer[];
  mudWeightData: MudWeightPoint[];
}

export interface WellSchematicState {
  mainWell: WellSchematicParams;
  offsetWells: WellSchematicParams[];
}

export interface TrajectoryPoint {
  measuredDepth: number;
  trueVerticalDepth: number;
  inclination: number;
  azimuth: number;
  x: number;
  y: number;
  z: number;
}

function defaultFormationLayers(totalDepth: number): FormationLayer[] {
  // Typical Permian/Delaware stratigraphy: overburden → target zone (distinct colors)
  return [
    { depthTop: 0, depthBottom: 2500, color: '#b8956e', name: 'Overburden Shale' },
    { depthTop: 2500, depthBottom: 5000, color: '#d4a574', name: 'Sandstone' },
    { depthTop: 5000, depthBottom: 7000, color: '#a8a090', name: 'Limestone' },
    { depthTop: 7000, depthBottom: 10000, color: '#8a7c6e', name: 'Dolomite' },
    { depthTop: 10000, depthBottom: totalDepth, color: '#6b5b4f', name: 'Reservoir' },
  ];
}

function defaultMudWeightData(totalDepth: number): MudWeightPoint[] {
  const pts: MudWeightPoint[] = [];
  for (let d = 0; d <= totalDepth; d += 500) {
    const base = 8.5 + (d / totalDepth) * 3.5;
    const wiggle = 0.15 * Math.sin(d / 800) + 0.1 * Math.sin(d / 400);
    pts.push({ depth: d, ppg: Math.min(12.5, Math.max(8.5, base + wiggle)) });
  }
  return pts;
}

export const DEFAULT_PARAMS: WellSchematicParams = {
  // Trajectory (typical Permian horizontal: KOP ~6–7k ft, 8°/100ft build, ~7k ft lateral)
  kopDepth: 6500,
  buildRate: 8,
  maxInclination: 90,
  totalDepth: 14500,
  // Casing depths (ft): surface to freshwater, intermediate through build, prod to TD
  surfaceCasingDepth: 2500,
  intermediateCasingDepth: 7200,
  productionCasingDepth: 14500,
  perforationDepths: [9500, 11000, 12500],
  packerDepths: [9200, 12000],
  wellName: 'Texas 123',
  showPerforations: true,
  showPackers: true,
  showCutaway: true,
  cutawayAngle: 0,
  showDepthMarkers: true,
  showCasingSpecs: true,
  showMudWeight: true,
  mudWeightMin: 8.5,
  mudWeightMax: 12.5,
  perforationZoneLength: 40,
  // API 5CT casing specs (OD, weight lb/ft, grade)
  surfaceCasingSpec: '13 3/8" 54.5 lb/ft J-55',
  intermediateCasingSpec: '9 5/8" 40.0 lb/ft L-80',
  productionCasingSpec: '5 1/2" 20.0 lb/ft P-110',
  showHoleSection: true,
  showCasing: true,
  showBHA: true,
  showMud: true,
  showFormation: true,
  showDirectional: true,
  showParameters: true,
  showCement: true,
  showHazard: true,
  bitDepth: 14500,
  eocDepth: 7625,
  fishingDepths: [],
  lossesDepths: [4200],
  stuckPipeDepths: [],
  wellControlDepths: [],
  formationLayers: defaultFormationLayers(14500),
  mudWeightData: defaultMudWeightData(14500),
};
