# Well Schematic 3D

A J-hook fracking well schematic viewer built with Angular 18 and Three.js. Features an interactive 3D wellbore with dynamic parameters controlled via a sidebar.

## Features

- **3D J-hook wellbore** – Vertical → build curve → horizontal trajectory
- **Casing strings** – Surface, intermediate, and production casing
- **Markers** – Perforations (red spheres) and packers (orange torus rings)
- **Orbit controls** – Rotate, zoom, and pan the 3D view
- **Dynamic parameters** – Adjust KOP, build rate, depths, and more in real time
- **Express backend** – REST API for well data (optional)

## Quick Start

### Frontend only

```bash
npm install
npm start
```

Open http://localhost:4200

### Frontend + Backend

```bash
npm install
npm run start:all
```

- Angular: http://localhost:4200
- API: http://localhost:3001

## Project Structure

```
well-schematic-app/
├── src/app/
│   ├── components/
│   │   ├── well-schematic-3d/    # Three.js 3D viewer
│   │   └── params-sidebar/       # Parameter controls
│   ├── models/                   # WellSchematicParams, etc.
│   ├── services/                 # Trajectory calculation
│   └── pages/well-schematic-page/
├── server/                       # Express API
└── package.json
```

## API Endpoints

- `GET /api/wells` – List wells
- `GET /api/wells/:id` – Get well by ID
- `PUT /api/wells/:id` – Update well
- `POST /api/wells` – Create well

## Parameters

| Parameter | Description |
|-----------|-------------|
| KOP Depth | Kick-off point (ft) |
| Build Rate | °/100ft in curve |
| Max Inclination | Target angle (90° = horizontal) |
| Total Depth | Measured depth (ft) |
| Casing Depths | Surface, intermediate, production |
| Perforations | Depths for perforation markers |
| Packers | Depths for packer markers |
