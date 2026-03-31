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

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:20px;font-weight:800;color:#bbfd00;letter-spacing:-0.5px;">GEO</span><span style="font-size:20px;font-weight:800;color:#7c7c96;">_</span><span style="font-size:20px;font-weight:800;color:#bbfd00;">ANALYZER</span>
  </div>

  <div style="background:#111119;border-radius:16px;padding:32px;text-align:center;">
    <div style="font-size:64px;font-weight:800;color:#bbfd00;line-height:1;">${payload.score}</div>
    <div style="color:#7c7c96;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin-top:4px;">GEO Score</div>

    <div style="margin:24px 0;padding:16px;background:#1a1a24;border-radius:12px;text-align:left;">
      <div style="font-weight:700;color:#e4e4ed;font-size:15px;margin-bottom:4px;">${escapeHtml(payload.brandName)}</div>
      <div style="color:#7c7c96;font-size:13px;line-height:1.6;">${escapeHtml(payload.summary)}</div>
    </div>

    <a href="${escapeHtml(fullReportUrl)}" style="display:inline-block;padding:14px 32px;background:#bbfd00;color:#0a0a12;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;margin-top:8px;">
      View Full Report
    </a>
  </div>

  <div style="text-align:center;margin-top:24px;color:#7c7c9640;font-size:11px;">
    GEO Analyzer &middot; Built for the Generative Era
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GEO Analyzer <reports@accelerate-bots.com>',
        to: [payload.to],
        subject: `Your GEO Report: ${payload.brandName} scored ${payload.score}/100`,
        html,
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
