import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { mkdir } from 'fs/promises';
import analyzeRouter from './routes/analyze.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Serve generated reports
const reportsDir = path.resolve('public/reports');
await mkdir(reportsDir, { recursive: true });
app.use('/reports', express.static(reportsDir));

// Serve landing page
app.use(express.static(path.resolve('public')));
app.get('/', (_req, res) => {
  res.sendFile(path.resolve('geo-landing.html'));
});
app.get('/thank-you', (_req, res) => {
  res.sendFile(path.resolve('thank-you.html'));
});

// API routes
app.use('/api', analyzeRouter);

app.listen(PORT, () => {
  console.log(`GEO Analyzer running at http://localhost:${PORT}`);
});
