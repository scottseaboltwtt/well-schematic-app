import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TrajectoryService } from '../../services/trajectory.service';
import { WellSchematicParams, DEFAULT_PARAMS, TrajectoryPoint, FormationLayer } from '../../models/well-schematic.model';

@Component({
  selector: 'app-well-schematic-3d',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './well-schematic-3d.component.html',
  styleUrl: './well-schematic-3d.component.css',
})
export class WellSchematic3dComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('depthScale') depthScaleRef?: ElementRef<HTMLElement>;
  @ViewChild('labelsPanel') labelsPanelRef?: ElementRef<HTMLElement>;

  @Input() params: WellSchematicParams = { ...DEFAULT_PARAMS };

  get depthMarkers(): number[] {
    const p = this.params;
    const set = new Set<number>([0]);
    for (let d = 1000; d <= p.totalDepth; d += 1000) set.add(d);
    set.add(p.kopDepth);
    set.add(p.surfaceCasingDepth);
    set.add(p.intermediateCasingDepth);
    return [...set].sort((a, b) => a - b);
  }

  /** Lateral (horizontal) section length in feet */
  get lateralLength(): number {
    const p = this.params;
    return this.trajectoryService.getLateralLength(
      p.kopDepth,
      p.buildRate,
      p.maxInclination,
      p.totalDepth
    );
  }

  /** Key depth labels for right-side panel */
  get keyDepthLabels(): { depth: number; label: string; spec?: string }[] {
    const p = this.params;
    const items: { depth: number; label: string; spec?: string }[] = [
      { depth: 0, label: p.wellName },
      { depth: p.kopDepth, label: `KOP ${p.kopDepth.toLocaleString()}'` },
      { depth: p.surfaceCasingDepth, label: `${p.surfaceCasingDepth.toLocaleString()}'`, spec: p.surfaceCasingSpec },
      { depth: p.intermediateCasingDepth, label: `${p.intermediateCasingDepth.toLocaleString()}'`, spec: p.intermediateCasingSpec },
      { depth: p.productionCasingDepth, label: `TD ${p.productionCasingDepth.toLocaleString()}'`, spec: p.productionCasingSpec },
    ];
    const eoc = p.eocDepth ?? 7200;
    if (eoc > 0 && eoc < p.totalDepth) {
      items.push({ depth: eoc, label: `EOC ${eoc.toLocaleString()}'` });
    }
    return items.sort((a, b) => a.depth - b.depth);
  }

  /** Combined parameter labels with side (left/right) for arrow layout. Packers excluded - rendered separately. */
  get parameterLabels(): { depth: number; label: string; spec?: string; side: 'left' | 'right'; isEvent: boolean; isPacker?: boolean }[] {
    const key = this.keyDepthLabels.map((item, i) => ({
      ...item,
      side: (i % 2 === 0 ? 'left' : 'right') as 'left' | 'right',
      isEvent: false,
    }));
    const events = this.eventMarkers.map((item, i) => ({
      ...item,
      label: `${item.label} ${item.depth.toLocaleString()}'`,
      spec: undefined,
      side: (i % 2 === 0 ? 'right' : 'left') as 'left' | 'right',
      isEvent: true,
    }));
    const packers = this.packerMarkers.map((item, i) => ({
      ...item,
      spec: undefined,
      side: (i % 2 === 0 ? 'right' : 'left') as 'left' | 'right',
      isEvent: true,
      isPacker: true,
    }));
    return [...key, ...events, ...packers].sort((a, b) => a.depth - b.depth);
  }

  /** Event markers for right-side panel */
  get eventMarkers(): { depth: number; label: string }[] {
    const p = this.params;
    const items: { depth: number; label: string }[] = [
      { depth: p.bitDepth, label: 'Bit' },
      ...(p.fishingDepths || []).map((d) => ({ depth: d, label: 'Fishing' })),
      ...(p.lossesDepths || []).map((d) => ({ depth: d, label: 'Losses' })),
      ...(p.stuckPipeDepths || []).map((d) => ({ depth: d, label: 'Stuck' })),
      ...(p.wellControlDepths || []).map((d) => ({ depth: d, label: 'Well Ctrl' })),
    ];
    return items.filter((e) => e.depth > 0 && e.depth <= p.totalDepth);
  }

  /** Packer markers (yellow indicators in horizontal section) */
  get packerMarkers(): { depth: number; label: string }[] {
    const p = this.params;
    if (!p.showPackers) return [];
    return (p.packerDepths || [])
      .filter((d) => d > 0 && d <= p.totalDepth)
      .map((d) => ({ depth: d, label: `Packer ${d.toLocaleString()}'` }));
  }

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationId = 0;
  private wellboreMesh: THREE.Group | null = null;
  private pathPoints: THREE.Vector3[] = [];
  private trajectoryPoints: TrajectoryPoint[] = [];
  private keyHandler = (e: KeyboardEvent) => this.onKeyDown(e);

  constructor(private trajectoryService: TrajectoryService) {}

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.wellboreMesh && this.canvasRef) {
      this.buildWell();
    }
    const pChange = changes['params'];
    if (pChange?.currentValue?.showCutaway && pChange?.previousValue?.showCutaway === false && this.camera && this.controls) {
      this.setCutawayView();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initThree();
      this.buildWell();
      this.animate();
    }, 0);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('keydown', this.keyHandler);
    this.renderer?.dispose();
    this.controls?.dispose();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.controls || !this.camera) return;
    const pan = 400;
    const target = this.controls.target;
    switch (e.key) {
      case 'ArrowUp': target.y += pan; break;
      case 'ArrowDown': target.y -= pan; break;
      case 'ArrowLeft': target.x -= pan; break;
      case 'ArrowRight': target.x += pan; break;
      case 'w': case 'W': target.y += pan; break;
      case 's': case 'S': target.y -= pan; break;
      case 'a': case 'A': target.x -= pan; break;
      case 'd': case 'D': target.x += pan; break;
    }
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    const width = Math.max(parent?.clientWidth ?? 800, 400);
    const height = Math.max(parent?.clientHeight ?? 600, 400);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e293b);

    // Tighter far plane improves depth precision when zooming (avoids z-fighting)
    const sceneExtent = Math.max(this.params.totalDepth * 1.5, 25000);
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, sceneExtent);
    const midY = -this.params.totalDepth / 2;
    const midZ = -4000;
    if (this.params.showCutaway) {
      this.camera.position.set(2500, midY, midZ);
      this.camera.lookAt(0, midY, midZ);
    } else {
      this.camera.position.set(2500, -4000, 3500);
      this.camera.lookAt(0, midY, 0);
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      logarithmicDepthBuffer: true, // Better depth precision when zooming (reduces z-fighting)
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enableRotate = false;
    this.controls.panSpeed = 1.2;
    this.controls.zoomSpeed = 1.5;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 50000;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.enableRotate = true;
    this.controls.target.set(0, midY, this.params.showCutaway ? midZ : 0);

    window.addEventListener('keydown', this.keyHandler);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(8000, 2000, 8000);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4);
    fillLight.position.set(-5000, -3000, -5000);
    this.scene.add(fillLight);

    const wellLight = new THREE.PointLight(0xffffff, 0.8, 15000);
    wellLight.position.set(0, -this.params.totalDepth / 2, -4000);
    this.scene.add(wellLight);

    const gridHelper = new THREE.GridHelper(20000, 40, 0x334155, 0x1e293b);
    gridHelper.position.y = -this.params.totalDepth;
    this.scene.add(gridHelper);

    window.addEventListener('resize', () => this.onResize());
  }

  private buildWell(): void {
    if (this.wellboreMesh) {
      this.scene.remove(this.wellboreMesh);
      this.wellboreMesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        if (o instanceof THREE.Sprite && o.material.map) {
          o.material.map.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }

    const p = this.params;
    const scale = 1;
    const points = this.trajectoryService.calculateTrajectory(
      p.kopDepth,
      p.buildRate,
      p.maxInclination,
      p.totalDepth
    );
    const path = points.map((pt) => new THREE.Vector3(pt.x * scale, pt.y * scale, pt.z * scale));
    this.pathPoints = path;
    this.trajectoryPoints = points;
    const curve = new THREE.CatmullRomCurve3(path, false);

    this.wellboreMesh = new THREE.Group();

    const clipPlanes = this.getClipPlanes();

    // Radial scale: exaggerate for clear visibility of layers in cutaway (4x)
    const radiusScale = 4;
    const formationRadius = 150 * radiusScale;
    // Higher segment counts preserve detail when zoomed in
    const segments = Math.max(128, Math.floor(p.totalDepth / 15));
    const radiusSegments = 32;
    const showHole = p.showHoleSection !== false;
    const showCasing = p.showCasing !== false;
    const showBHA = p.showBHA !== false;
    const showForm = p.showFormation !== false;
    const showCem = p.showCement !== false;
    const showDir = p.showDirectional !== false;
    const showParams = p.showParameters !== false;
    const showHaz = p.showHazard !== false;
    const showMud = p.showMud !== false;

    // Formation / open hole (outermost - rock, drilled hole wall)
    if (showHole) {
    const wellboreGeom = new THREE.TubeGeometry(curve, segments, formationRadius, radiusSegments, false);
    const wellboreMat = new THREE.MeshStandardMaterial({
      color: 0x9c7b5c,
      metalness: 0.02,
      roughness: 0.98,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const wellbore = new THREE.Mesh(wellboreGeom, wellboreMat);
    wellbore.castShadow = true;
    wellbore.receiveShadow = true;
    this.wellboreMesh.add(wellbore);
    }

    // Formation layers (colored bands) - slightly inside formation
    if (showForm && p.formationLayers?.length) {
      this.addFormationColumn(path, points, p.formationLayers, 145 * radiusScale, clipPlanes);
    }

    // Surface casing (17.5" - lightest, outermost steel)
    const surfaceEnd = Math.max(1, points.findIndex((pt) => pt.measuredDepth >= p.surfaceCasingDepth));
    const intEnd = Math.max(1, points.findIndex((pt) => pt.measuredDepth >= p.intermediateCasingDepth));

    // Cement sheaths (annulus - draw before casings so they appear behind)
    if (showCem) {
    this.addCementSheaths(path, surfaceEnd, intEnd, segments, radiusSegments, radiusScale, clipPlanes);
    }
    if (showCasing) {
    const surfaceCurve = new THREE.CatmullRomCurve3(path.slice(0, surfaceEnd + 1), false);
    const surfaceGeom = new THREE.TubeGeometry(
      surfaceCurve,
      Math.max(32, surfaceEnd),
      130 * radiusScale,
      radiusSegments,
      false
    );
    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc,
      metalness: 0.5,
      roughness: 0.4,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const surfaceCasing = new THREE.Mesh(surfaceGeom, surfaceMat);
    this.wellboreMesh.add(surfaceCasing);
    this.addCasingShoe(path, surfaceEnd, 130 * radiusScale, 0xe8e4dc, clipPlanes);

    // Intermediate casing (12.25" - medium steel)
    const intCurve = new THREE.CatmullRomCurve3(path.slice(0, intEnd + 1), false);
    const intGeom = new THREE.TubeGeometry(
      intCurve,
      Math.max(40, intEnd),
      105 * radiusScale,
      radiusSegments,
      false
    );
    const intMat = new THREE.MeshStandardMaterial({
      color: 0xa8a8a8,
      metalness: 0.5,
      roughness: 0.4,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const intCasing = new THREE.Mesh(intGeom, intMat);
    this.wellboreMesh.add(intCasing);
    this.addCasingShoe(path, intEnd, 105 * radiusScale, 0xa8a8a8, clipPlanes);

    // Production casing (6.75" - innermost, darkest steel)
    const prodGeom = new THREE.TubeGeometry(curve, segments, 70 * radiusScale, radiusSegments, false);
    const prodMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      metalness: 0.5,
      roughness: 0.4,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const prodCasing = new THREE.Mesh(prodGeom, prodMat);
    this.wellboreMesh.add(prodCasing);
    this.addCasingShoe(path, path.length - 1, 70 * radiusScale, 0x4a4a4a, clipPlanes);
    }

    // Tubing string / completion string (inside production casing) - BHA
    if (showBHA) {
    const tubingGeom = new THREE.TubeGeometry(curve, segments, 28 * radiusScale, 20, false);
    const tubingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.5,
      roughness: 0.4,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const tubing = new THREE.Mesh(tubingGeom, tubingMat);
    this.wellboreMesh.add(tubing);
    }

    // Borehole cavity / mud (fluid in well - visible in cutaway)
    if (showMud && clipPlanes.length > 0) {
      const boreGeom = new THREE.TubeGeometry(curve, segments, 32 * radiusScale, 24, false);
      const boreMat = new THREE.MeshStandardMaterial({
        color: 0x4a5d3a,
        metalness: 0.05,
        roughness: 0.95,
        side: THREE.DoubleSide,
        clippingPlanes: clipPlanes,
      });
      const borehole = new THREE.Mesh(boreGeom, boreMat);
      this.wellboreMesh.add(borehole);
    }

    // Packers (at production casing level)
    if (p.showPackers && showCasing) {
      for (const depth of p.packerDepths) {
        const idx = points.findIndex((pt) => pt.measuredDepth >= depth);
        if (idx >= 0 && idx < path.length) {
          this.addPacker(path[idx].clone(), 70 * radiusScale, path, idx, clipPlanes);
        }
      }
    }

    // Perforation zones: tunnels through casing → cement → formation (shaped-charge jets)
    if (p.showPerforations) {
      for (const depth of p.perforationDepths) {
        const idx = points.findIndex((pt) => pt.measuredDepth >= depth);
        if (idx >= 0 && idx < path.length) {
          this.addPerforationTunnels(path, idx, points, radiusScale, clipPlanes);
        }
      }
    }

    this.scene.add(this.wellboreMesh);
  }

  private getClipPlanes(): THREE.Plane[] {
    if (!this.params.showCutaway) return [];
    const angleDeg = this.params.cutawayAngle ?? 0;
    const angleRad = angleDeg * (Math.PI / 180);
    const nx = Math.cos(angleRad);
    const nz = Math.sin(angleRad);
    // Keep half facing away from camera so we see the cut face (interior layers)
    // Camera at +x: keep x<=0 half to see cut cross-section
    const n = new THREE.Vector3(-nx, 0, -nz);
    return [new THREE.Plane(n, 0)];
  }

  /** Set camera for cutaway view: hook (horizontal) to the right, layers visible */
  setCutawayView(): void {
    if (!this.camera || !this.controls) return;
    const midY = -this.params.totalDepth / 2;
    const midZ = -4000;
    this.camera.position.set(2500, midY, midZ);
    this.controls.target.set(0, midY, midZ);
  }

  private getTangent(path: THREE.Vector3[], idx: number): THREE.Vector3 {
    if (idx <= 0) return new THREE.Vector3(0, -1, 0);
    if (idx >= path.length - 1) return new THREE.Vector3().subVectors(path[idx], path[idx - 1]).normalize();
    return new THREE.Vector3().subVectors(path[idx + 1], path[idx - 1]).normalize();
  }

  private addCasingShoe(path: THREE.Vector3[], idx: number, radius: number, color: number, clipPlanes: THREE.Plane[]): void {
    if (idx >= path.length) return;
    const pos = path[idx].clone();
    const tangent = this.getTangent(path, idx);
    const shoe = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 1.2, radius * 0.6, 16),
      new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, clippingPlanes: clipPlanes })
    );
    shoe.position.copy(pos);
    shoe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.clone().negate());
    this.wellboreMesh!.add(shoe);
  }

  private addCasingSizeRing(path: THREE.Vector3[], idx: number, radius: number, sizeLabel: string, clipPlanes: THREE.Plane[]): void {
    if (idx >= path.length) return;
    const pos = path[idx].clone();
    const tangent = this.getTangent(path, idx);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0x78350f,
      clippingPlanes: clipPlanes,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.15, 8, 8, 24),
      ringMat
    );
    ring.position.copy(pos);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    this.wellboreMesh!.add(ring);
  }

  private addDepthRings(path: THREE.Vector3[], points: TrajectoryPoint[], interval: number, radius: number, clipPlanes: THREE.Plane[]): void {
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x422006,
      clippingPlanes: clipPlanes,
    });
    for (let depth = interval; depth < this.params.totalDepth; depth += interval) {
      const idx = points.findIndex((pt) => pt.measuredDepth >= depth);
      if (idx < 0 || idx >= path.length) continue;
      const pos = path[idx].clone();
      const tangent = this.getTangent(path, idx);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 16, 8, 24),
        ringMat.clone()
      );
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      this.wellboreMesh!.add(ring);
    }
  }

  private addCasingCollars(path: THREE.Vector3[], interval: number, radius: number, clipPlanes: THREE.Plane[]): void {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0x0f172a,
      clippingPlanes: clipPlanes,
    });
    const step = Math.max(1, Math.floor(interval / 50));
    for (let i = step; i < path.length - 1; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.05, radius * 0.12, 8, 24),
        mat.clone()
      );
      collar.position.copy(pos);
      collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      this.wellboreMesh!.add(collar);
    }
  }

  private addKopMarker(pos: THREE.Vector3, size: number, clipPlanes: THREE.Plane[]): void {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.5, size * 0.5, size * 2, 6),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        metalness: 0.4,
        roughness: 0.5,
        emissive: 0x0e7490,
        clippingPlanes: clipPlanes,
      })
    );
    marker.position.copy(pos);
    marker.rotation.x = Math.PI / 2;
    this.wellboreMesh!.add(marker);
  }

  private addFormationColumn(path: THREE.Vector3[], points: TrajectoryPoint[], layers: FormationLayer[], formationInnerR: number, clipPlanes: THREE.Plane[]): void {
    for (const layer of layers) {
      const startIdx = points.findIndex((pt) => pt.measuredDepth >= layer.depthTop);
      const endIdx = points.findIndex((pt) => pt.measuredDepth >= layer.depthBottom);
      if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) continue;
      const segPath = path.slice(startIdx, endIdx + 1);
      if (segPath.length < 2) continue;
      const segCurve = new THREE.CatmullRomCurve3(segPath, false);
      const hex = parseInt(layer.color.slice(1), 16);
      const mat = new THREE.MeshStandardMaterial({
        color: hex,
        metalness: 0.05,
        roughness: 0.95,
        side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
        clippingPlanes: clipPlanes,
      });
      const geom = new THREE.TubeGeometry(segCurve, Math.max(segPath.length, 32), formationInnerR, 20, false);
      const mesh = new THREE.Mesh(geom, mat);
      this.wellboreMesh!.add(mesh);
    }
  }

  private addLayerStrip(path: THREE.Vector3[], points: TrajectoryPoint[], surfaceEnd: number, intEnd: number, offset: number, clipPlanes: THREE.Plane[]): void {
    // offset can be negative (cutaway: toward camera / visible side)
    const p = this.params;
    const stripWidth = 80;
    const stripHeight = 100;
    const stripDepth = 40;
    const step = Math.max(2, Math.floor(path.length / 100));
    const up = new THREE.Vector3(0, 1, 0);

    const getFormationColor = (depth: number): number => {
      const layer = p.formationLayers?.find((l) => depth >= l.depthTop && depth < l.depthBottom);
      return layer ? parseInt(layer.color.slice(1), 16) : 0x4a5d4a;
    };

    for (let i = 0; i < path.length - 1; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize();
      pos.add(right.clone().multiplyScalar(offset));

      const depth = points[i]?.measuredDepth ?? 0;
      const isCementZone = depth < p.productionCasingDepth;
      const color = isCementZone ? 0xa8b8c8 : getFormationColor(depth);

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(stripWidth, stripHeight, stripDepth),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.05,
          roughness: 0.95,
          clippingPlanes: clipPlanes,
        })
      );
      box.position.copy(pos);
      box.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      this.wellboreMesh!.add(box);
    }
  }

  private addMudWeightStrip(path: THREE.Vector3[], points: TrajectoryPoint[], offset: number, clipPlanes: THREE.Plane[]): void {
    const p = this.params;
    const data = p.mudWeightData || [];
    if (data.length < 2) return;
    const minPpg = p.mudWeightMin ?? 8.5;
    const maxPpg = p.mudWeightMax ?? 12.5;
    const stripWidth = 70;
    const stripHeight = 90;
    const stripDepth = 35;
    const step = Math.max(2, Math.floor(path.length / 120));
    const up = new THREE.Vector3(0, 1, 0);

    const getMudWeightAtDepth = (depth: number): number => {
      if (depth <= data[0].depth) return data[0].ppg;
      if (depth >= data[data.length - 1].depth) return data[data.length - 1].ppg;
      for (let i = 0; i < data.length - 1; i++) {
        if (data[i].depth <= depth && data[i + 1].depth >= depth) {
          const t = (depth - data[i].depth) / (data[i + 1].depth - data[i].depth);
          return data[i].ppg + t * (data[i + 1].ppg - data[i].ppg);
        }
      }
      return data[0].ppg;
    };

    const ppgToColor = (ppg: number): number => {
      const t = (ppg - minPpg) / (maxPpg - minPpg);
      const r = Math.min(255, Math.floor(255 * t));
      const g = Math.min(255, Math.floor(200 * (1 - t)));
      const b = 80;
      return (r << 16) | (g << 8) | b;
    };

    for (let i = 0; i < path.length - 1; i += step) {
      const depth = points[i]?.measuredDepth ?? 0;
      const ppg = getMudWeightAtDepth(depth);
      const color = ppgToColor(ppg);

      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize();
      pos.add(right.clone().multiplyScalar(offset));

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(stripWidth, stripHeight, stripDepth),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.1,
          roughness: 0.9,
          clippingPlanes: clipPlanes,
        })
      );
      box.position.copy(pos);
      box.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      this.wellboreMesh!.add(box);
    }
  }

  private addEocMarker(pos: THREE.Vector3, size: number, clipPlanes: THREE.Plane[]): void {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.4, size * 0.6, size * 1.2, 6),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        metalness: 0.4,
        roughness: 0.5,
        emissive: 0x0e7490,
        clippingPlanes: clipPlanes,
      })
    );
    marker.position.copy(pos);
    marker.rotation.x = Math.PI / 2;
    this.wellboreMesh!.add(marker);
  }

  private addEventMarker(path: THREE.Vector3[], points: TrajectoryPoint[], depth: number, color: number, _label: string, offset: number, clipPlanes: THREE.Plane[]): void {
    const idx = points.findIndex((pt) => pt.measuredDepth >= depth);
    if (idx < 0 || idx >= path.length) return;
    const pos = path[idx].clone();
    const tangent = this.getTangent(path, idx);
    const up = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(tangent, up);
    if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
    right.normalize();
    pos.add(right.clone().multiplyScalar(offset));

    const mark = new THREE.Mesh(
      new THREE.SphereGeometry(50, 8, 6),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.6, clippingPlanes: clipPlanes })
    );
    mark.position.copy(pos);
    this.wellboreMesh!.add(mark);
  }

  private addCementSheaths(path: THREE.Vector3[], surfaceEnd: number, intEnd: number, segments: number, radiusSegments: number, radiusScale: number, clipPlanes: THREE.Plane[]): void {
    const cementMat = new THREE.MeshStandardMaterial({
      color: 0xc9b896,
      metalness: 0.05,
      roughness: 0.95,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const surfaceCurve = new THREE.CatmullRomCurve3(path.slice(0, surfaceEnd + 1), false);
    const cement1 = new THREE.Mesh(
      new THREE.TubeGeometry(surfaceCurve, Math.max(32, surfaceEnd), 140 * radiusScale, radiusSegments, false),
      cementMat.clone()
    );
    this.wellboreMesh!.add(cement1);
    const intCurve = new THREE.CatmullRomCurve3(path.slice(0, intEnd + 1), false);
    const cement2 = new THREE.Mesh(
      new THREE.TubeGeometry(intCurve, Math.max(40, intEnd), 117 * radiusScale, radiusSegments, false),
      cementMat.clone()
    );
    this.wellboreMesh!.add(cement2);
    const prodCurve = new THREE.CatmullRomCurve3(path, false);
    const cement3 = new THREE.Mesh(
      new THREE.TubeGeometry(prodCurve, segments, 88 * radiusScale, radiusSegments, false),
      cementMat.clone()
    );
    this.wellboreMesh!.add(cement3);
  }

  /** Perforation tunnels: shaped charges create jets through casing, cement, into formation */
  private addPerforationTunnels(path: THREE.Vector3[], idx: number, points: TrajectoryPoint[], radiusScale: number, clipPlanes: THREE.Plane[]): void {
    const zoneLen = this.params.perforationZoneLength || 40;
    const startIdx = Math.max(0, idx - Math.floor(zoneLen / 20));
    const endIdx = Math.min(path.length - 1, idx + Math.floor(zoneLen / 20));
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.1,
      roughness: 0.9,
      side: clipPlanes.length ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: clipPlanes,
    });
    const casingR = 70 * radiusScale;
    const formationR = 145 * radiusScale;
    const tunnelLen = formationR - casingR;
    const tunnelRadius = 8 * radiusScale;
    const up = new THREE.Vector3(0, 1, 0);
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 6));
    for (let i = startIdx; i <= endIdx; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize();
      const out = new THREE.Vector3().crossVectors(tangent, right).normalize();
      for (let ph = 0; ph < 6; ph++) {
        const angle = (ph / 6) * Math.PI * 2;
        const dir = right.clone().multiplyScalar(Math.cos(angle)).add(out.clone().multiplyScalar(Math.sin(angle)));
        const tunnelCenter = pos.clone().add(dir.clone().multiplyScalar((casingR + formationR) / 2));
        const tunnel = new THREE.Mesh(
          new THREE.CylinderGeometry(tunnelRadius, tunnelRadius * 1.2, tunnelLen, 8),
          tunnelMat.clone()
        );
        tunnel.position.copy(tunnelCenter);
        tunnel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.wellboreMesh!.add(tunnel);
      }
    }
  }

  private addPerforationCluster(path: THREE.Vector3[], idx: number, _points: { inclination: number }[], count: number, radiusScale: number, flip: number, clipPlanes: THREE.Plane[]): void {
    const zoneLen = this.params.perforationZoneLength || 50;
    const startIdx = Math.max(0, idx - Math.floor(zoneLen / 20));
    const endIdx = Math.min(path.length - 1, idx + Math.floor(zoneLen / 20));
    const perfsMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.2,
      roughness: 0.6,
      clippingPlanes: clipPlanes,
    });
    const crossLen = 12 * radiusScale;
    const crossThick = 2 * radiusScale;
    const outDist = 72 * radiusScale * flip; // at casing wall, flip for cutaway visible side
    const up = new THREE.Vector3(0, 1, 0);
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 10));
    for (let i = startIdx; i <= endIdx; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize();
      const out = right.clone().multiplyScalar(outDist);
      const crossPos = pos.clone().add(out);
      const h = new THREE.Mesh(new THREE.BoxGeometry(crossLen, crossThick, crossThick), perfsMat.clone());
      h.position.copy(crossPos);
      h.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right);
      this.wellboreMesh!.add(h);
      const v = new THREE.Mesh(new THREE.BoxGeometry(crossThick, crossLen, crossThick), perfsMat.clone());
      v.position.copy(crossPos);
      const upLocal = new THREE.Vector3().crossVectors(right, tangent).normalize();
      v.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upLocal);
      this.wellboreMesh!.add(v);
    }
  }

  private addHydraulicFractures(path: THREE.Vector3[], idx: number, points: TrajectoryPoint[], radiusScale: number, flip: number, clipPlanes: THREE.Plane[]): void {
    const zoneLen = this.params.perforationZoneLength || 50;
    const startIdx = Math.max(0, idx - Math.floor(zoneLen / 25));
    const endIdx = Math.min(path.length - 1, idx + Math.floor(zoneLen / 25));
    const fracMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.1,
      roughness: 0.8,
      emissive: 0x7f1d1d,
      clippingPlanes: clipPlanes,
    });
    const up = new THREE.Vector3(0, 1, 0);
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 4));
    for (let i = startIdx; i <= endIdx; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize().multiplyScalar(flip);
      const branchCount = 3;
      for (let b = 0; b < branchCount; b++) {
        const angle = (b - 1) * 0.4;
        const dir = right.clone().applyAxisAngle(tangent, angle).normalize();
        const fracLen = (180 + (b * 17 + i) % 80) * radiusScale;
        const baseDist = 90 * radiusScale + fracLen;
        const endPos = pos.clone().add(dir.clone().multiplyScalar(baseDist));
        const geom = new THREE.CylinderGeometry(8 * radiusScale, 12 * radiusScale, fracLen, 6);
        const frac = new THREE.Mesh(geom, fracMat.clone());
        frac.position.copy(pos.clone().add(endPos).multiplyScalar(0.5));
        frac.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.wellboreMesh!.add(frac);
      }
    }
  }

  private addProppant(path: THREE.Vector3[], idx: number, points: TrajectoryPoint[], radiusScale: number, flip: number, clipPlanes: THREE.Plane[]): void {
    const zoneLen = this.params.perforationZoneLength || 50;
    const startIdx = Math.max(0, idx - Math.floor(zoneLen / 25));
    const endIdx = Math.min(path.length - 1, idx + Math.floor(zoneLen / 25));
    const propMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.5,
      roughness: 0.6,
      emissive: 0x78350f,
      clippingPlanes: clipPlanes,
    });
    const up = new THREE.Vector3(0, 1, 0);
    const step = Math.max(1, Math.floor((endIdx - startIdx) / 3));
    for (let i = startIdx; i <= endIdx; i += step) {
      const pos = path[i].clone();
      const tangent = this.getTangent(path, i);
      let right = new THREE.Vector3().crossVectors(tangent, up);
      if (right.lengthSq() < 0.01) right = new THREE.Vector3(1, 0, 0);
      right.normalize().multiplyScalar(flip);
      for (let p = 0; p < 8; p++) {
        const dist = (100 + p * 25 + (p % 2) * 15) * radiusScale;
        const angle = (p % 3 - 1) * 0.35;
        const dir = right.clone().applyAxisAngle(tangent, angle).normalize();
        const propPos = pos.clone().add(dir.clone().multiplyScalar(dist));
        const prop = new THREE.Mesh(new THREE.SphereGeometry(12 * radiusScale, 6, 6), propMat.clone());
        prop.position.copy(propPos);
        this.wellboreMesh!.add(prop);
      }
    }
  }

  private addPacker(pos: THREE.Vector3, outerR: number, path: THREE.Vector3[], idx: number, clipPlanes: THREE.Plane[]): void {
    const packerMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.5,
      roughness: 0.35,
      emissive: 0x78350f,
      clippingPlanes: clipPlanes,
    });
    const packer = new THREE.Mesh(
      new THREE.CylinderGeometry(outerR * 1.08, outerR * 1.2, 120, 16),
      packerMat
    );
    packer.position.copy(pos);
    const tangent = this.getTangent(path, idx);
    packer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    this.wellboreMesh!.add(packer);
  }

  private onResize(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas?.parentElement) return;
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateOverlayPositions();
  };

  /** Get path position at depth - matches addPacker logic exactly (first path point >= depth) */
  private getPointAtPathForDepth(depth: number): THREE.Vector3 | null {
    const pts = this.trajectoryPoints;
    const path = this.pathPoints;
    if (!pts.length || !path.length) return null;
    const idx = pts.findIndex((pt) => pt.measuredDepth >= depth);
    if (idx < 0) return path[path.length - 1].clone();
    return path[Math.min(idx, path.length - 1)].clone();
  }

  private getPointAtDepth(depth: number): THREE.Vector3 | null {
    const pts = this.trajectoryPoints;
    const path = this.pathPoints;
    if (!pts.length || !path.length) return null;
    if (depth <= pts[0].measuredDepth) return path[0].clone();
    if (depth >= pts[pts.length - 1].measuredDepth) return path[path.length - 1].clone();
    let i = 0;
    for (; i < pts.length - 1; i++) {
      if (pts[i].measuredDepth <= depth && pts[i + 1].measuredDepth >= depth) break;
    }
    const t = (depth - pts[i].measuredDepth) / (pts[i + 1].measuredDepth - pts[i].measuredDepth);
    return new THREE.Vector3().lerpVectors(path[i], path[i + 1], t);
  }

  private projectToScreen(worldPos: THREE.Vector3): { x: number; y: number; visible: boolean } | null {
    if (!this.camera || !this.renderer) return null;
    this.camera.updateMatrixWorld(true);
    const v = worldPos.clone().project(this.camera);
    const el = this.renderer.domElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const x = ((v.x + 1) / 2) * w;
    const y = ((1 - v.y) / 2) * h;
    const visible = v.z >= -1 && v.z <= 1 && x >= -50 && x <= w + 50 && y >= -20 && y <= h + 20;
    return { x, y, visible };
  }

  private updateOverlayPositions(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas?.parentElement) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const REF_DISTANCE = 5000;
    const distance = this.controls?.getDistance?.() ?? REF_DISTANCE;
    const zoomScale = Math.max(1, Math.min(2.5, REF_DISTANCE / distance));

    if (this.params.showDepthMarkers && this.depthScaleRef?.nativeElement) {
      const labels = this.depthScaleRef.nativeElement.querySelectorAll<HTMLElement>('.depth-label');
      labels.forEach((el) => {
        const depth = parseInt(el.getAttribute('data-depth') ?? '0', 10);
        const pt = this.getPointAtDepth(depth);
        if (!pt) return;
        const proj = this.projectToScreen(pt);
        if (!proj) return;
        el.style.top = proj.y + 'px';
        el.style.transform = `translateY(-50%) scale(${zoomScale})`;
        el.style.transformOrigin = 'right center';
        el.style.visibility = proj.visible ? 'visible' : 'hidden';
      });
    }

    if (this.params.showParameters && this.labelsPanelRef?.nativeElement) {
      const items = this.labelsPanelRef.nativeElement.querySelectorAll<HTMLElement>('.label-item');
      const scale = zoomScale;
      const arrowOffset = 80 * scale;
      const MIN_LABEL_GAP = 28 * scale;

      const leftItems: { el: HTMLElement; y: number }[] = [];
      const rightItems: { el: HTMLElement; y: number }[] = [];

      items.forEach((el) => {
        const depth = parseInt(el.getAttribute('data-depth') ?? '0', 10);
        const side = el.getAttribute('data-side') as 'left' | 'right';
        const isPacker = el.getAttribute('data-is-packer') === 'true';

        const pt = isPacker ? this.getPointAtPathForDepth(depth) : this.getPointAtDepth(depth);
        if (!pt) return;
        const proj = this.projectToScreen(pt);
        if (!proj) return;
        el.style.visibility = proj.visible ? 'visible' : 'hidden';

        if (isPacker) {
          el.style.left = side === 'left' ? (proj.x - arrowOffset) + 'px' : proj.x + 'px';
          el.style.right = '';
          el.style.top = proj.y + 'px';
          el.style.transform = `translateY(-50%) scale(${scale})`;
          el.style.transformOrigin = side === 'left' ? 'right center' : 'left center';
          return;
        }

        if (side === 'left') {
          el.style.left = (proj.x - arrowOffset) + 'px';
          el.style.right = '';
          leftItems.push({ el, y: proj.y });
        } else {
          el.style.left = proj.x + 'px';
          el.style.right = '';
          rightItems.push({ el, y: proj.y });
        }
      });

      const enforceMinGap = (arr: { el: HTMLElement; y: number }[]) => {
        arr.sort((a, b) => a.y - b.y);
        for (let i = 1; i < arr.length; i++) {
          const prevY = arr[i - 1].y;
          const currY = arr[i].y;
          if (currY - prevY < MIN_LABEL_GAP) {
            arr[i].y = prevY + MIN_LABEL_GAP;
          }
        }
      };
      enforceMinGap(leftItems);
      enforceMinGap(rightItems);

      leftItems.forEach(({ el, y }) => {
        el.style.top = y + 'px';
        el.style.transform = `translateY(-50%) scale(${scale})`;
        el.style.transformOrigin = 'right center';
      });
      rightItems.forEach(({ el, y }) => {
        el.style.top = y + 'px';
        el.style.transform = `translateY(-50%) scale(${scale})`;
        el.style.transformOrigin = 'left center';
      });
    }

  }

  updateFromParams(params: WellSchematicParams): void {
    this.params = params;
    this.buildWell();
  }

  resetView(): void {
    if (!this.camera || !this.controls) return;
    const midY = -this.params.totalDepth / 2;
    const midZ = -4000;
    if (this.params.showCutaway) {
      this.setCutawayView();
    } else {
      this.camera.position.set(2500, -4000, 3500);
      this.controls.target.set(0, midY, 0);
    }
  }
}
