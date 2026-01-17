/**
 * Google Scholar MCP - Utility Functions
 * Rate limiting, user agents, and helper functions
 */

import { RateLimitConfig, UserAgentConfig } from '../types/index.js';

// =============================================================================
// User Agents
// =============================================================================

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

let currentUserAgentIndex = 0;

/**
 * Get a random or rotating user agent
 */
export function getUserAgent(config?: UserAgentConfig): string {
  const agents = config?.userAgents || DEFAULT_USER_AGENTS;
  
  if (config?.rotate) {
    currentUserAgentIndex = (currentUserAgentIndex + 1) % agents.length;
    return agents[currentUserAgentIndex];
  }
  
  return agents[Math.floor(Math.random() * agents.length)];
}

// =============================================================================
// Rate Limiting
// =============================================================================

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  minDelay: 1000,    // 1 second minimum
  maxDelay: 5000,    // 5 seconds maximum
  maxRetries: 3,
  backoffMultiplier: 2,
};

let lastRequestTime = 0;

/**
 * Calculate delay with jitter to avoid detection
 */
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Wait for rate limit before making a request
 */
export async function waitForRateLimit(config?: Partial<RateLimitConfig>): Promise<void> {
  const cfg = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const delay = getRandomDelay(cfg.minDelay, cfg.maxDelay);
  
  if (timeSinceLastRequest < delay) {
    await sleep(delay - timeSinceLastRequest);
  }
  
  lastRequestTime = Date.now();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay calculation
 */
export function getBackoffDelay(attempt: number, config?: Partial<RateLimitConfig>): number {
  const cfg = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  const delay = cfg.minDelay * Math.pow(cfg.backoffMultiplier, attempt);
  return Math.min(delay, cfg.maxDelay * 10); // Cap at 10x max delay
}

// =============================================================================
// URL Helpers
// =============================================================================

const SCHOLAR_BASE_URL = 'https://scholar.google.com';

/**
 * Build Google Scholar search URL
 */
export function buildSearchUrl(params: {
  query?: string;
  author?: string;
  yearStart?: number;
  yearEnd?: number;
  start?: number;
  sortBy?: 'relevance' | 'date';
  includePatents?: boolean;
  includeCitations?: boolean;
  language?: string;
}): string {
  const url = new URL('/scholar', SCHOLAR_BASE_URL);
  
  // Build the query
  let q = params.query || '';
  if (params.author) {
    q = `author:"${params.author}" ${q}`.trim();
  }
  
  if (q) url.searchParams.set('q', q);
  
  // Year range
  if (params.yearStart) url.searchParams.set('as_ylo', params.yearStart.toString());
  if (params.yearEnd) url.searchParams.set('as_yhi', params.yearEnd.toString());
  
  // Pagination
  if (params.start) url.searchParams.set('start', params.start.toString());
  
  // Sort by date
  if (params.sortBy === 'date') url.searchParams.set('scisbd', '1');
  
  // Language
  url.searchParams.set('hl', params.language || 'en');
  
  // Patents and citations filters
  if (params.includePatents === false) url.searchParams.set('as_sdt', '0,5');
  
  return url.toString();
}

/**
 * Build author search URL
 */
export function buildAuthorSearchUrl(params: {
  query: string;
  organization?: string;
}): string {
  const url = new URL('/citations', SCHOLAR_BASE_URL);
  url.searchParams.set('view_op', 'search_authors');
  
  let mauthors = params.query;
  if (params.organization) {
    // Add organization filter
    mauthors = `${params.query} label:${params.organization}`;
  }
  
  url.searchParams.set('mauthors', mauthors);
  url.searchParams.set('hl', 'en');
  
  return url.toString();
}

/**
 * Build author profile URL
 */
export function buildAuthorProfileUrl(scholarId: string): string {
  const url = new URL('/citations', SCHOLAR_BASE_URL);
  url.searchParams.set('user', scholarId);
  url.searchParams.set('hl', 'en');
  return url.toString();
}

/**
 * Build citation search URL
 */
export function buildCitationUrl(params: {
  clusterId: string;
  start?: number;
  sortBy?: 'relevance' | 'date';
}): string {
  const url = new URL('/scholar', SCHOLAR_BASE_URL);
  url.searchParams.set('cites', params.clusterId);
  url.searchParams.set('hl', 'en');
  
  if (params.start) url.searchParams.set('start', params.start.toString());
  if (params.sortBy === 'date') url.searchParams.set('scisbd', '1');
  
  return url.toString();
}

// =============================================================================
// Text Parsing Helpers
// =============================================================================

/**
 * Clean and normalize text
 */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract year from text
 */
export function extractYear(text: string): number | undefined {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

/**
 * Extract citation count from text like "Cited by 123"
 */
export function extractCitationCount(text: string): number | undefined {
  const match = text.match(/Cited by (\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Extract cluster ID from URL
 */
export function extractClusterId(url: string): string | undefined {
  const match = url.match(/cluster=(\d+)|cites=(\d+)/);
  return match ? (match[1] || match[2]) : undefined;
}

/**
 * Parse author string "A Smith, B Jones, C Lee" into array
 */
export function parseAuthors(authorStr: string): string[] {
  if (!authorStr) return [];
  return authorStr.split(',').map(a => cleanText(a)).filter(Boolean);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Check if response indicates rate limiting or CAPTCHA
 */
export function isRateLimited(html: string): boolean {
  const rateLimitIndicators = [
    'unusual traffic',
    'automated requests',
    'please show you',
    'robot',
    'captcha',
    'recaptcha',
    'sorry, we can\'t',
    'systems have detected',
  ];
  
  const lowerHtml = html.toLowerCase();
  return rateLimitIndicators.some(indicator => lowerHtml.includes(indicator));
}

/**
 * Check if response indicates blocked access
 */
export function isBlocked(html: string): boolean {
  const blockIndicators = [
    'access denied',
    'forbidden',
    '403',
    'blocked',
  ];
  
  const lowerHtml = html.toLowerCase();
  return blockIndicators.some(indicator => lowerHtml.includes(indicator));
}
