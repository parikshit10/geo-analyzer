import type { BrandInfo } from './scraper.js';
import type { GeoAnalysis } from './geo-analyzer.js';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert hex to HSL, return CSS hsl() string and raw values */
function hexToHsl(hex: string): { h: number; s: number; l: number; css: string } {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const H = Math.round(h * 360), S = Math.round(s * 100), L = Math.round(l * 100);
  return { h: H, s: S, l: L, css: `hsl(${H}, ${S}%, ${L}%)` };
}

/** Generate a palette from the brand color that works on dark backgrounds */
function brandPalette(hex: string) {
  const { h, s } = hexToHsl(hex);
  return {
    brand: `hsl(${h}, ${Math.min(s, 85)}%, 60%)`,        // Vibrant mid
    brandBright: `hsl(${h}, ${Math.min(s, 90)}%, 72%)`,   // Light accent for text
    brandDim: `hsl(${h}, ${Math.min(s, 70)}%, 45%)`,      // Muted
    brandGlow: `hsla(${h}, ${Math.min(s, 80)}%, 55%, 0.15)`, // Ambient glow
    brandSubtle: `hsla(${h}, ${Math.min(s, 70)}%, 55%, 0.08)`, // Very subtle bg
  };
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '<span class="material-symbols-outlined" style="color:var(--error)">error</span>';
    case 'warning': return '<span class="material-symbols-outlined" style="color:var(--warning)">warning</span>';
    default: return '<span class="material-symbols-outlined" style="color:var(--info)">info</span>';
  }
}

function crawlerPill(name: string, status: string): string {
  const color = status === 'allowed' ? 'var(--success)' : status === 'blocked' ? 'var(--error)' : 'var(--muted)';
  const label = status === 'not_specified' ? 'Not specified' : status.charAt(0).toUpperCase() + status.slice(1);
  return `<span class="crawler-pill" style="--pill-color:${color}">
    <span class="pill-dot" style="background:${color}"></span>
    <strong>${escapeHtml(name)}</strong>
    <span class="pill-label">${label}</span>
  </span>`;
}

function dimensionBar(label: string, score: number, icon: string, color: string): string {
  return `<div class="dim-row">
    <div class="dim-header">
      <div class="dim-label">
        <span class="material-symbols-outlined" style="color:${color}">${icon}</span>
        <span>${escapeHtml(label)}</span>
      </div>
      <span class="dim-score" style="color:${color}">${score}</span>
    </div>
    <div class="dim-track"><div class="dim-fill" style="width:${score}%;background:${color}"></div></div>
  </div>`;
}

function platformCard(name: string, score: number, icon: string): string {
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  return `<div class="platform-card">
    <span class="material-symbols-outlined platform-icon">${icon}</span>
    <div class="platform-name">${escapeHtml(name)}</div>
    <div class="platform-score">${score}</div>
    <div class="platform-grade">${grade}</div>
  </div>`;
}

export function generateReport(brand: BrandInfo, analysis: GeoAnalysis, url: string): string {
  const d = analysis.dimensions;
  const palette = brandPalette(brand.primaryColor);

  const scoreRingOffset = 339.292 - (339.292 * analysis.overallScore / 100);

  const issueCards = analysis.topIssues.map(issue => `
    <div class="issue-card issue-${issue.severity}">
      ${severityIcon(issue.severity)}
      <div>
        <strong>${escapeHtml(issue.title)}</strong>
        <p>${escapeHtml(issue.description)}</p>
      </div>
    </div>`).join('');

  const crawlerPills = Object.entries(analysis.crawlerStatus)
    .map(([name, status]) => crawlerPill(name, status)).join('');

  const quickWinItems = analysis.quickWins.map(w => `<li>${escapeHtml(w)}</li>`).join('');

  const findingsHtml = (dim: { findings: string[]; suggestions: string[] }) => {
    const f = dim.findings.map(f => `<li class="finding">${escapeHtml(f)}</li>`).join('');
    const s = dim.suggestions.map(s => `<li class="suggestion">${escapeHtml(s)}</li>`).join('');
    return `<ul class="finding-list">${f}</ul><ul class="suggestion-list">${s}</ul>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>GEO Report — ${escapeHtml(brand.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<style>
:root {
  --brand: ${palette.brand};
  --brand-bright: ${palette.brandBright};
  --brand-dim: ${palette.brandDim};
  --brand-glow: ${palette.brandGlow};
  --brand-subtle: ${palette.brandSubtle};
  --bg: #0a0a12;
  --surface: #111119;
  --surface-high: #1a1a24;
  --surface-highest: #222230;
  --text: #e4e4ed;
  --text-muted: #7c7c96;
  --success: #4ade80;
  --error: #f87171;
  --warning: #fbbf24;
  --info: #60a5fa;
  --radius: 1.25rem;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Manrope', sans-serif;
  line-height: 1.6;
  overflow-x: hidden;
}
.editorial { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; }
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }

/* Ambient mesh */
.mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 500px 400px at 10% 20%, var(--brand-subtle) 0%, transparent 70%),
    radial-gradient(ellipse 400px 500px at 90% 80%, var(--brand-subtle) 0%, transparent 70%);
}

/* Layout */
.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; position: relative; z-index: 1; }

/* Header */
.report-header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
  padding: 2rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.brand-block { display: flex; align-items: center; gap: 1rem; }
.brand-block img { width: 36px; height: 36px; border-radius: 8px; object-fit: contain; background: var(--surface-high); }
.brand-name { font-size: 1.25rem; font-weight: 700; }
.brand-domain { color: var(--text-muted); font-size: 0.85rem; }
.report-badge {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--surface-high); padding: 0.5rem 1rem; border-radius: 9999px;
  font-size: 0.8rem; font-weight: 600; color: var(--brand);
}
.report-badge .material-symbols-outlined { font-size: 1rem; }

/* Score hero */
.score-hero {
  display: flex; flex-wrap: wrap; gap: 3rem; align-items: center; justify-content: center;
  padding: 4rem 0;
}
.score-ring-wrap { position: relative; width: 260px; height: 260px; flex-shrink: 0; }
.score-ring-wrap svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.score-ring-wrap .track { fill: none; stroke: var(--surface-high); stroke-width: 10; }
.score-ring-wrap .fill {
  fill: none; stroke: var(--brand); stroke-width: 10; stroke-linecap: round;
  stroke-dasharray: 339.292; stroke-dashoffset: ${scoreRingOffset};
  transition: stroke-dashoffset 2s cubic-bezier(0.4,0,0.2,1);
}
.score-center {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.score-number { font-size: 4.5rem; font-weight: 700; line-height: 1; }
.score-label { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.1em; }
.score-summary { max-width: 420px; }
.score-summary h2 { font-size: 2rem; margin-bottom: 1rem; }
.score-summary p { color: var(--text-muted); font-size: 1rem; line-height: 1.7; }

/* Dimension bars */
.dimensions { padding: 2rem 0 3rem; }
.dimensions h3 { font-size: 1.5rem; margin-bottom: 2rem; }
.dim-row { margin-bottom: 1.5rem; }
.dim-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
.dim-label { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.95rem; }
.dim-label .material-symbols-outlined { font-size: 1.25rem; }
.dim-score { font-weight: 700; font-size: 1.1rem; }
.dim-track { height: 8px; border-radius: 9999px; background: var(--surface-high); overflow: hidden; }
.dim-fill { height: 100%; border-radius: 9999px; transition: width 1.5s cubic-bezier(0.16,1,0.3,1); }

/* Cards & sections */
.section { padding: 2.5rem 0; }
.section-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; }
.section-title .material-symbols-outlined { color: var(--brand); }

.card { background: var(--surface); border-radius: var(--radius); padding: 1.5rem; margin-bottom: 1rem; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }

/* Issues */
.issue-card {
  display: flex; gap: 1rem; align-items: flex-start;
  background: var(--surface); border-radius: var(--radius); padding: 1.25rem;
}
.issue-card strong { display: block; margin-bottom: 0.25rem; font-size: 0.95rem; }
.issue-card p { color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; }
.issue-card .material-symbols-outlined { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }

/* Crawler pills */
.crawler-wrap { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.crawler-pill {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--surface-high); padding: 0.6rem 1rem; border-radius: var(--radius); font-size: 0.85rem;
}
.pill-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pill-label { color: var(--text-muted); font-size: 0.8rem; }

/* Platform cards */
.platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
.platform-card {
  background: var(--surface); border-radius: var(--radius); padding: 1.5rem; text-align: center;
}
.platform-icon { font-size: 2rem; color: var(--brand); display: block; margin-bottom: 0.75rem; }
.platform-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; }
.platform-score { font-size: 2.5rem; font-weight: 700; line-height: 1; }
.platform-grade {
  display: inline-block; margin-top: 0.5rem;
  padding: 0.15rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700;
  background: color-mix(in srgb, var(--brand) 15%, transparent); color: var(--brand);
}

/* Quick wins */
.quick-wins { list-style: none; }
.quick-wins li {
  position: relative; padding: 0.75rem 0 0.75rem 2rem; font-size: 0.95rem;
  color: var(--text-muted);
}
.quick-wins li::before {
  content: ''; position: absolute; left: 0; top: 1.05rem;
  width: 10px; height: 10px; border-radius: 50%; background: var(--brand);
}

/* Passage */
.passage-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-box { background: var(--surface-high); border-radius: var(--radius); padding: 1.25rem; text-align: center; }
.stat-number { font-size: 2rem; font-weight: 700; color: var(--brand); }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em; }
.best-passage {
  background: var(--surface-high); border-radius: var(--radius); padding: 1.25rem;
  border-left: 3px solid var(--brand); font-style: italic; color: var(--text-muted); font-size: 0.9rem; line-height: 1.7;
}

/* llms.txt status */
.llms-status {
  display: flex; align-items: center; gap: 1rem;
  background: var(--surface); border-radius: var(--radius); padding: 1.25rem;
}
.llms-badge {
  padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;
  flex-shrink: 0;
}
.llms-present { background: rgba(74,222,128,0.15); color: var(--success); }
.llms-missing { background: rgba(248,113,113,0.15); color: var(--error); }

/* Findings */
.finding-list, .suggestion-list { list-style: none; margin: 0.75rem 0; }
.finding-list li, .suggestion-list li { position: relative; padding: 0.4rem 0 0.4rem 1.5rem; font-size: 0.88rem; color: var(--text-muted); }
.finding-list li::before { content: '~'; position: absolute; left: 0; color: var(--text-muted); font-weight: 700; }
.suggestion-list li::before { content: '+'; position: absolute; left: 0; color: var(--success); font-weight: 700; }

/* Detail accordion */
details { margin-bottom: 0.5rem; }
details summary {
  cursor: pointer; padding: 1rem 1.25rem; background: var(--surface); border-radius: var(--radius);
  font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between;
  list-style: none;
}
details summary::-webkit-details-marker { display: none; }
details[open] summary { border-radius: var(--radius) var(--radius) 0 0; }
details .detail-body { padding: 1rem 1.25rem; background: var(--surface); border-radius: 0 0 var(--radius) var(--radius); }

/* Footer */
.report-footer {
  padding: 3rem 0 2rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;
  border-top: 1px solid rgba(255,255,255,0.05); margin-top: 2rem;
}
.report-footer a { color: var(--brand); text-decoration: none; }

/* Responsive */
@media (max-width: 768px) {
  .score-hero { flex-direction: column; text-align: center; padding: 2rem 0; }
  .score-ring-wrap { width: 200px; height: 200px; }
  .score-number { font-size: 3rem; }
  .passage-stats { grid-template-columns: 1fr; }
  .platform-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Animations */
@keyframes fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate { animation: fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both; }
.d1 { animation-delay: 0.1s; } .d2 { animation-delay: 0.2s; } .d3 { animation-delay: 0.3s; }
.d4 { animation-delay: 0.4s; } .d5 { animation-delay: 0.5s; }
</style>
</head>
<body>
<div class="mesh"></div>
<div class="container">

  <!-- Header -->
  <header class="report-header animate">
    <div class="brand-block">
      <img src="${escapeHtml(brand.favicon)}" alt="" onerror="this.style.display='none'"/>
      <div>
        <div class="brand-name editorial">${escapeHtml(brand.name)}</div>
        <div class="brand-domain">${escapeHtml(brand.domain)}</div>
      </div>
    </div>
    <div class="report-badge editorial">
      <span class="material-symbols-outlined">auto_awesome</span>
      GEO Analysis Report
    </div>
  </header>

  <!-- Score Hero -->
  <div class="score-hero animate d1">
    <div class="score-ring-wrap">
      <svg viewBox="0 0 120 120">
        <circle class="track" cx="60" cy="60" r="54"/>
        <circle class="fill" cx="60" cy="60" r="54"/>
      </svg>
      <div class="score-center">
        <div class="score-number editorial" style="color:var(--brand)">${analysis.overallScore}</div>
        <div class="score-label">GEO Score</div>
      </div>
    </div>
    <div class="score-summary">
      <h2 class="editorial">GEO Readiness Report</h2>
      <p>${escapeHtml(analysis.summary)}</p>
    </div>
  </div>

  <!-- Dimensions -->
  <div class="dimensions animate d2">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">speed</span>
      Score Breakdown
    </h3>
    ${dimensionBar('Citability', d.citability.score, 'format_quote', '#4ade80')}
    ${dimensionBar('Structural Readability', d.structuralReadability.score, 'view_headline', '#60a5fa')}
    ${dimensionBar('Multi-Modal Content', d.multiModal.score, 'perm_media', '#a78bfa')}
    ${dimensionBar('Authority & Brand Signals', d.authoritySignals.score, 'verified', '#fbbf24')}
    ${dimensionBar('Technical Accessibility', d.technicalAccessibility.score, 'terminal', '#f472b6')}
  </div>

  <!-- Platform Scores -->
  <div class="section animate d3">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">public</span>
      Platform Readiness
    </h3>
    <div class="platform-grid">
      ${platformCard('Google AI Overviews', analysis.platformScores.googleAIO, 'search')}
      ${platformCard('ChatGPT', analysis.platformScores.chatGPT, 'smart_toy')}
      ${platformCard('Perplexity', analysis.platformScores.perplexity, 'psychology')}
      ${platformCard('Bing Copilot', analysis.platformScores.bingCopilot, 'assistant')}
    </div>
  </div>

  <!-- Top Issues -->
  <div class="section animate d4">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">priority_high</span>
      Key Findings
    </h3>
    <div class="card-grid">
      ${issueCards}
    </div>
  </div>

  <!-- AI Crawler Status -->
  <div class="section animate d5">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">robot_2</span>
      AI Crawler Access
    </h3>
    <div class="crawler-wrap">
      ${crawlerPills}
    </div>
  </div>

  <!-- llms.txt -->
  <div class="section animate">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">description</span>
      llms.txt Status
    </h3>
    <div class="llms-status">
      <span class="llms-badge ${analysis.llmsTxt.present ? 'llms-present' : 'llms-missing'}">
        ${analysis.llmsTxt.present ? 'Present' : 'Missing'}
      </span>
      <span style="color:var(--text-muted);font-size:0.9rem">${escapeHtml(analysis.llmsTxt.notes)}</span>
    </div>
  </div>

  <!-- Passage Analysis -->
  <div class="section animate">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">format_quote</span>
      Passage Citability
    </h3>
    <div class="passage-stats">
      <div class="stat-box">
        <div class="stat-number editorial">${analysis.passageAnalysis.totalBlocks}</div>
        <div class="stat-label">Content Blocks</div>
      </div>
      <div class="stat-box">
        <div class="stat-number editorial">${analysis.passageAnalysis.citableBlocks}</div>
        <div class="stat-label">Citable Passages</div>
      </div>
      <div class="stat-box">
        <div class="stat-number editorial">${analysis.passageAnalysis.avgWordCount}</div>
        <div class="stat-label">Avg. Word Count</div>
      </div>
    </div>
    ${analysis.passageAnalysis.bestPassage ? `<div class="best-passage">"${escapeHtml(analysis.passageAnalysis.bestPassage)}"</div>` : ''}
  </div>

  <!-- Dimension Detail Accordions -->
  <div class="section animate">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">library_books</span>
      Detailed Analysis
    </h3>
    <details>
      <summary class="editorial">Citability — ${d.citability.score}/100</summary>
      <div class="detail-body">${findingsHtml(d.citability)}</div>
    </details>
    <details>
      <summary class="editorial">Structural Readability — ${d.structuralReadability.score}/100</summary>
      <div class="detail-body">${findingsHtml(d.structuralReadability)}</div>
    </details>
    <details>
      <summary class="editorial">Multi-Modal Content — ${d.multiModal.score}/100</summary>
      <div class="detail-body">${findingsHtml(d.multiModal)}</div>
    </details>
    <details>
      <summary class="editorial">Authority & Brand Signals — ${d.authoritySignals.score}/100</summary>
      <div class="detail-body">${findingsHtml(d.authoritySignals)}</div>
    </details>
    <details>
      <summary class="editorial">Technical Accessibility — ${d.technicalAccessibility.score}/100</summary>
      <div class="detail-body">${findingsHtml(d.technicalAccessibility)}</div>
    </details>
  </div>

  <!-- Quick Wins -->
  <div class="section animate">
    <h3 class="editorial section-title">
      <span class="material-symbols-outlined">bolt</span>
      Quick Wins
    </h3>
    <div class="card">
      <ul class="quick-wins">${quickWinItems}</ul>
    </div>
  </div>

  <!-- Footer -->
  <footer class="report-footer">
    <p>Generated by <a href="/">GEO Analyzer</a> · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <p style="margin-top:0.5rem;opacity:0.5">Analyzed: ${escapeHtml(url)}</p>
  </footer>

</div>
</body>
</html>`;
}
