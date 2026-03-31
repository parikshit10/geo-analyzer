import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeFile } from 'fs/promises';
import path from 'path';
import { scrapePage, fetchCrawlerData } from '../services/scraper.js';
import { analyzeWithOpenRouter } from '../services/geo-analyzer.js';
import { generateReport } from '../services/report-generator.js';
import { sendReportEmail } from '../services/emailer.js';

const router = Router();

const AnalyzeInput = z.object({
  url: z.string().url('Please enter a valid URL'),
  email: z.string().email('Please enter a valid email'),
});

router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  const parsed = AnalyzeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  let { url, email } = parsed.data;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'OpenRouter API key not configured' });
    return;
  }

  // Respond immediately — analysis runs in background
  res.json({ queued: true, message: 'Your GEO report is being generated. Check your email shortly!' });

  // Fire and forget
  processAnalysis(url, email, apiKey).catch(err => {
    console.error(`[ANALYSIS-FAILED] ${url} for ${email}:`, err);
  });
});

async function processAnalysis(url: string, email: string, apiKey: string) {
  console.log(`[ANALYSIS-START] ${url} for ${email}`);

  const [page, crawlerData] = await Promise.all([
    scrapePage(url),
    fetchCrawlerData(url),
  ]);

  const analysis = await analyzeWithOpenRouter(page, crawlerData, apiKey, process.env.MODEL);

  const reportHtml = generateReport(page.brand, analysis, url);

  const reportId = nanoid(12);
  const reportFilename = `${reportId}.html`;
  const reportsDir = path.resolve('public/reports');
  await writeFile(path.join(reportsDir, reportFilename), reportHtml, 'utf-8');

  const reportUrl = `/reports/${reportFilename}`;
  console.log(`[ANALYSIS-DONE] ${url} → ${reportUrl} (score: ${analysis.overallScore})`);

  await sendReportEmail({
    to: email,
    brandName: page.brand.name,
    score: analysis.overallScore,
    reportUrl,
    summary: analysis.summary,
  });
}

export default router;
