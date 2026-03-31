import { OpenRouter } from '@openrouter/sdk';
import { GEO_SYSTEM_PROMPT } from '../prompts/geo-instructions.js';
import type { ScrapedPage, CrawlerData } from './scraper.js';

export interface GeoAnalysis {
  overallScore: number;
  dimensions: {
    citability: { score: number; findings: string[]; suggestions: string[] };
    structuralReadability: { score: number; findings: string[]; suggestions: string[] };
    multiModal: { score: number; findings: string[]; suggestions: string[] };
    authoritySignals: { score: number; findings: string[]; suggestions: string[] };
    technicalAccessibility: { score: number; findings: string[]; suggestions: string[] };
  };
  crawlerStatus: Record<string, 'allowed' | 'blocked' | 'not_specified'>;
  llmsTxt: { present: boolean; valid: boolean; notes: string };
  platformScores: {
    googleAIO: number;
    chatGPT: number;
    perplexity: number;
    bingCopilot: number;
  };
  topIssues: { severity: 'critical' | 'warning' | 'info'; title: string; description: string }[];
  quickWins: string[];
  passageAnalysis: {
    totalBlocks: number;
    citableBlocks: number;
    avgWordCount: number;
    bestPassage: string;
  };
  ssrStatus: string;
  schemaTypes: string[];
  summary: string;
}

export async function analyzeWithOpenRouter(
  page: ScrapedPage,
  crawlerData: CrawlerData,
  apiKey: string,
  model?: string
): Promise<GeoAnalysis> {
  const client = new OpenRouter({ apiKey });

  const userPrompt = buildUserPrompt(page, crawlerData);

  const completion = await client.chat.send({
    model: model || 'anthropic/claude-sonnet-4',
    messages: [
      { role: 'system', content: GEO_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    maxTokens: 4096,
    stream: false,
  });

  const rawContent = completion.choices?.[0]?.message?.content;
  const text = typeof rawContent === 'string'
    ? rawContent
    : Array.isArray(rawContent)
      ? rawContent.filter((c): c is { type: 'text'; text: string } => c.type === 'text').map(c => c.text).join('')
      : '';
  if (!text) {
    throw new Error('Empty response from OpenRouter');
  }

  // Parse JSON from response — handle potential markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  try {
    return JSON.parse(cleaned) as GeoAnalysis;
  } catch {
    // If parsing fails, try to extract JSON from the response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as GeoAnalysis;
    }
    throw new Error('Failed to parse GEO analysis response as JSON');
  }
}

function buildUserPrompt(page: ScrapedPage, crawlerData: CrawlerData): string {
  const headingTree = page.headings.map(h => `${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`).join('\n');

  return `Analyze this page for GEO readiness.

## Target URL
${page.url}

## Meta Information
- Title: ${page.metaTitle}
- Description: ${page.metaDescription}
- Word count: ${page.wordCount}
- Has images: ${page.hasImages}
- Has video: ${page.hasVideo}
- Has tables: ${page.hasTables}
- Has lists: ${page.hasLists}
- Has FAQ section: ${page.hasFAQ}
- Schema.org types found: ${page.schemaTypes.length > 0 ? page.schemaTypes.join(', ') : 'None'}

## Heading Structure
${headingTree || 'No headings found'}

## Page Content (truncated to 15k chars)
${page.textContent}

## robots.txt
${crawlerData.robotsTxt || 'NOT FOUND (no robots.txt at domain root)'}

## llms.txt
${crawlerData.llmsTxt || 'NOT FOUND (no llms.txt at domain root)'}

Return your analysis as the specified JSON object.`;
}
