import * as cheerio from 'cheerio';

export interface BrandInfo {
  name: string;
  domain: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  bgColor: string;
  favicon: string;
  ogImage: string;
  description: string;
}

export interface ScrapedPage {
  url: string;
  html: string;
  textContent: string;
  headings: { level: number; text: string }[];
  metaTitle: string;
  metaDescription: string;
  schemaTypes: string[];
  hasImages: boolean;
  hasVideo: boolean;
  hasTables: boolean;
  hasLists: boolean;
  hasFAQ: boolean;
  wordCount: number;
  brand: BrandInfo;
}

export interface CrawlerData {
  robotsTxt: string | null;
  llmsTxt: string | null;
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractColors($: cheerio.CheerioAPI): { primary: string; secondary: string; bg: string; text: string } {
  // Try theme-color meta tag first
  const themeColor = $('meta[name="theme-color"]').attr('content')
    || $('meta[name="msapplication-TileColor"]').attr('content');

  // Try to find colors from inline styles on key elements
  let primary = themeColor || '';
  let bg = '';
  let text = '';

  // Check body and header styles
  const bodyStyle = $('body').attr('style') || '';
  const headerStyle = $('header').attr('style') || $('nav').attr('style') || '';

  const bgMatch = bodyStyle.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/);
  if (bgMatch) bg = bgMatch[1];

  const colorMatch = bodyStyle.match(/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/);
  if (colorMatch) text = colorMatch[1];

  // Look for CSS variables in style tags
  const styleContent = $('style').text();
  const cssVarMatch = styleContent.match(/--(?:primary|brand|main|accent)(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/);
  if (cssVarMatch && !primary) primary = cssVarMatch[1];

  // Check for common color patterns in link tags / header elements
  if (!primary) {
    const headerBg = headerStyle.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/);
    if (headerBg) primary = headerBg[1];
  }

  // Look at button/link colors as fallback
  if (!primary) {
    const btnStyle = $('a.btn, button.btn, .cta, [class*="primary"]').first().attr('style') || '';
    const btnMatch = btnStyle.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/);
    if (btnMatch) primary = btnMatch[1];
  }

  return {
    primary: primary || '#3b82f6',
    secondary: '#6366f1',
    bg: bg || '#0c0c14',
    text: text || '#e4e4ed',
  };
}

function extractBrand($: cheerio.CheerioAPI, url: string): BrandInfo {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace('www.', '');

  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  const title = $('title').text().split(/[|\-–—]/).map(s => s.trim())[0] || '';
  const name = ogSiteName || title || domain;

  const favicon = $('link[rel="icon"]').attr('href')
    || $('link[rel="shortcut icon"]').attr('href')
    || $('link[rel="apple-touch-icon"]').attr('href')
    || '/favicon.ico';

  const faviconUrl = favicon.startsWith('http') ? favicon : new URL(favicon, url).href;

  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const description = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content') || '';

  const colors = extractColors($);

  return {
    name,
    domain,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    textColor: colors.text,
    bgColor: colors.bg,
    favicon: faviconUrl,
    ogImage: ogImage.startsWith('http') ? ogImage : ogImage ? new URL(ogImage, url).href : '',
    description,
  };
}

export async function scrapePage(url: string): Promise<ScrapedPage> {
  const html = await fetchUrl(url);
  if (!html) throw new Error(`Could not fetch ${url}`);

  const $ = cheerio.load(html);

  // Remove scripts, styles, noscript for text extraction
  const $text = cheerio.load(html);
  $text('script, style, noscript, svg, path').remove();

  const textContent = $text('body').text().replace(/\s+/g, ' ').trim();

  // Extract headings
  const headings: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = $(el).prop('tagName');
    if (tag) {
      headings.push({
        level: parseInt(tag.replace('H', '').replace('h', '')),
        text: $(el).text().trim(),
      });
    }
  });

  // Schema.org types
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type']) schemaTypes.push(data['@type']);
      if (Array.isArray(data['@graph'])) {
        data['@graph'].forEach((item: Record<string, string>) => {
          if (item['@type']) schemaTypes.push(item['@type']);
        });
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  const metaTitle = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';

  return {
    url,
    html,
    textContent: textContent.slice(0, 15000), // Limit for API
    headings,
    metaTitle,
    metaDescription,
    schemaTypes,
    hasImages: $('img').length > 0,
    hasVideo: $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0,
    hasTables: $('table').length > 0,
    hasLists: $('ul, ol').length > 0,
    hasFAQ: $('[class*="faq"], [id*="faq"], [itemtype*="FAQPage"]').length > 0 || headings.some(h => /\?/.test(h.text)),
    wordCount: textContent.split(/\s+/).length,
    brand: extractBrand($, url),
  };
}

export async function fetchCrawlerData(url: string): Promise<CrawlerData> {
  const origin = new URL(url).origin;

  const [robotsTxt, llmsTxt] = await Promise.all([
    fetchUrl(`${origin}/robots.txt`),
    fetchUrl(`${origin}/llms.txt`),
  ]);

  return { robotsTxt, llmsTxt };
}
