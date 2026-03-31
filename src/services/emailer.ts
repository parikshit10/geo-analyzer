const RESEND_API = 'https://api.resend.com/emails';

interface EmailPayload {
  to: string;
  brandName: string;
  score: number;
  reportUrl: string;
  summary: string;
}

export async function sendReportEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[EMAIL-SKIP] No RESEND_API_KEY. Would email ${payload.to}: ${payload.reportUrl}`);
    return;
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
  const fullReportUrl = `${baseUrl}${payload.reportUrl}`;

  const text = `Your GEO Report is Ready

${payload.brandName} scored ${payload.score}/100

${payload.summary}

View your full report here:
${fullReportUrl}

Your report includes:
- GEO Readiness Score across 5 dimensions
- AI Crawler Access Status (GPTBot, ClaudeBot, PerplexityBot, etc.)
- Passage Citability Analysis
- Platform Scores (Google AI Overviews, ChatGPT, Perplexity, Bing Copilot)
- Prioritized Recommendations

---
GEO Analyzer | Built for the Generative Era
https://geo.accelerate-bots.com`;

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GEO Analyzer <reports@leadroket.com>',
        to: [payload.to],
        subject: `Your GEO Report: ${payload.brandName} scored ${payload.score}/100`,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[EMAIL-ERROR] Resend API ${res.status}: ${err}`);
    } else {
      console.log(`[EMAIL-SENT] Report sent to ${payload.to}`);
    }
  } catch (err) {
    console.error('[EMAIL-ERROR]', err);
  }
}
