import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const defaultWell = {
  id: '1',
  name: 'Texas 123',
  kopDepth: 6500,
  buildRate: 8,
  maxInclination: 90,
  totalDepth: 8500,
  surfaceCasingDepth: 3500,
  intermediateCasingDepth: 6500,
  productionCasingDepth: 8500,
  perforationDepths: [7500, 7800, 8100],
  packerDepths: [7400, 8000],
};

const wells = new Map([['1', { ...defaultWell }]]);

app.get('/api/wells', (req, res) => {
  res.json(Array.from(wells.values()));
});

app.get('/api/wells/:id', (req, res) => {
  const well = wells.get(req.params.id);
  if (!well) return res.status(404).json({ error: 'Well not found' });
  res.json(well);
});

app.put('/api/wells/:id', (req, res) => {
  const id = req.params.id;
  const body = req.body;
  const existing = wells.get(id) || { id };
  const updated = { ...existing, ...body };
  wells.set(id, updated);
  res.json(updated);
});

app.post('/api/wells', (req, res) => {
  const id = String(wells.size + 1);
  const well = { id, ...req.body };
  wells.set(id, well);
  res.status(201).json(well);
});

app.listen(PORT, () => {
  console.log(`Well Schematic API running at http://localhost:${PORT}`);
});
