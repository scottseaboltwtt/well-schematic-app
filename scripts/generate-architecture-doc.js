const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50 });
const outPath = path.join(__dirname, '..', 'Well-Schematic-App-Architecture.pdf');
doc.pipe(fs.createWriteStream(outPath));

// Title
doc.fontSize(24).font('Helvetica-Bold').text('Well Schematic 3D — Architecture & 3D Stack', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica').text('Technical documentation', { align: 'center' });
doc.moveDown(2);

// Section 1
doc.fontSize(14).font('Helvetica-Bold').text('App Architecture Overview', { underline: true });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica');
doc.text('Well Schematic 3D is an Angular 18 application that visualizes J-hook fracking well trajectories in 3D. It uses a frontend-only setup with an optional Express backend.');
doc.moveDown(1.5);

// Section 2
doc.fontSize(14).font('Helvetica-Bold').text('Main Components', { underline: true });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica');
const components = [
  ['WellSchematicPageComponent', 'Main page; holds params and wires the 3D viewer and sidebar'],
  ['WellSchematic3dComponent', 'Three.js 3D viewer; builds and renders the wellbore'],
  ['ParamsSidebarComponent', 'Sidebar for editing well parameters (depths, casing, perforations, etc.)'],
  ['TrajectoryService', 'Computes the J-hook trajectory from parameters'],
  ['WellSchematicParams', 'Model for all well parameters'],
];
components.forEach(([name, desc]) => {
  doc.font('Helvetica-Bold').text(name + ': ', { continued: true }).font('Helvetica').text(desc);
});
doc.moveDown(1.5);

// Section 3
doc.fontSize(14).font('Helvetica-Bold').text('3D Stack & Libraries', { underline: true });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica');
doc.text('The 3D rendering is powered entirely by Three.js and its examples:');
doc.moveDown(0.5);
doc.text('• THREE — Core library');
doc.text('• OrbitControls — three/examples/jsm/controls/OrbitControls.js for pan, zoom, rotate');
doc.moveDown(0.5);
doc.font('Helvetica-Bold').text('Three.js Usage in the App:');
doc.moveDown(0.3);
doc.text('1. Scene setup: THREE.Scene, THREE.PerspectiveCamera (with logarithmicDepthBuffer), THREE.WebGLRenderer (antialias, shadows, clipping)');
doc.text('2. Geometry: TubeGeometry (wellbore path), CatmullRomCurve3 (smooth path), CylinderGeometry, SphereGeometry, TorusGeometry, ConeGeometry, BoxGeometry');
doc.text('3. Materials: MeshStandardMaterial with clippingPlanes for cutaway views');
doc.text('4. Lighting: AmbientLight, DirectionalLight (with shadows), PointLight');
doc.text('5. Cutaway: THREE.Plane for clipping, renderer.localClippingEnabled = true');
doc.moveDown(1.5);

// Section 4
doc.fontSize(14).font('Helvetica-Bold').text('Trajectory Math', { underline: true });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica');
doc.text('TrajectoryService uses the minimum curvature method to compute the J-hook path: vertical segment → build curve (arc) → horizontal tangent. Output is TrajectoryPoint[] with measuredDepth, trueVerticalDepth, inclination, azimuth, x, y, z.');
doc.moveDown(1.5);

// Section 5
doc.fontSize(14).font('Helvetica-Bold').text('Data Flow', { underline: true });
doc.moveDown(0.5);
doc.fontSize(9).font('Courier');
doc.text('ParamsSidebarComponent (user edits)\n    → paramsChange.emit()\n        → WellSchematicPageComponent.onParamsChange()\n            → params = newParams\n                → WellSchematic3dComponent [params] input\n                    → ngOnChanges → buildWell()');
doc.moveDown(1.5);

// Section 6
doc.fontSize(14).font('Helvetica-Bold').text('Dependencies Summary', { underline: true });
doc.moveDown(0.5);
doc.fontSize(10).font('Helvetica');
const deps = [
  ['Angular', '18.2.x', 'Framework, routing, forms'],
  ['Three.js', '0.183.2', '3D rendering'],
  ['@types/three', '0.183.1', 'TypeScript types'],
  ['RxJS', '7.8.x', 'Reactive utilities'],
  ['zone.js', '0.14.10', 'Angular change detection'],
];
deps.forEach(([lib, ver, role]) => {
  doc.font('Helvetica-Bold').text(lib + ' ', { continued: true })
    .font('Helvetica').text('(' + ver + '): ' + role);
});
doc.moveDown(1);
doc.font('Helvetica').text('There are no other 3D libraries — the 3D behavior comes entirely from Three.js and its built-in examples.');

doc.end();

console.log('PDF generated: ' + outPath);
