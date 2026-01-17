/**
 * Google Scholar MCP - Configuration System
 * Environment-based configuration with sensible defaults
 */

import { homedir } from 'os';
import { join } from 'path';

// =============================================================================
// Configuration Interface
// =============================================================================

export interface ScholarConfig {
  // Storage
  storagePath: string;
  
  // Rate Limiting
  rateLimitMs: number;
  maxRetries: number;
  backoffMultiplier: number;
  
  // Proxy
  proxyUrl?: string;
  
  // Language
  defaultLanguage: string;
  
  // Cache
  cacheEnabled: boolean;
  cacheTtlMs: number;
  
  // Request
  requestTimeout: number;
  maxRedirects: number;
  
  // SerpAPI (optional fallback)
  serpApiKey?: string;
  useSerpApiFallback: boolean;
  
  // User Agent Rotation
  rotateUserAgent: boolean;
  
  // Request Jitter (randomize delays to appear more human)
  enableJitter: boolean;
  jitterMaxMs: number;
}

// =============================================================================
// Environment Variable Parsing
// =============================================================================

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_STORAGE_PATH = join(homedir(), '.google-scholar-mcp', 'papers');

export const config: ScholarConfig = {
  // Storage Configuration
  storagePath: getEnvString('SCHOLAR_STORAGE_PATH', DEFAULT_STORAGE_PATH),
  
  // Rate Limiting Configuration
  rateLimitMs: getEnvNumber('SCHOLAR_RATE_LIMIT_MS', 3000), // Increased to 3 seconds
  maxRetries: getEnvNumber('SCHOLAR_MAX_RETRIES', 3),
  backoffMultiplier: getEnvNumber('SCHOLAR_BACKOFF_MULTIPLIER', 2),
  
  // Proxy Configuration
  proxyUrl: process.env.SCHOLAR_PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY,
  
  // Language Configuration
  defaultLanguage: getEnvString('SCHOLAR_LANGUAGE', 'en'),
  
  // Cache Configuration
  cacheEnabled: getEnvBoolean('SCHOLAR_CACHE_ENABLED', true),
  cacheTtlMs: getEnvNumber('SCHOLAR_CACHE_TTL_MS', 3600000), // 1 hour
  
  // Request Configuration
  requestTimeout: getEnvNumber('SCHOLAR_REQUEST_TIMEOUT', 30000),
  maxRedirects: getEnvNumber('SCHOLAR_MAX_REDIRECTS', 5),
  
  // SerpAPI Fallback (optional - for production use)
  serpApiKey: process.env.SERPAPI_KEY || process.env.SERP_API_KEY,
  useSerpApiFallback: getEnvBoolean('SCHOLAR_USE_SERPAPI_FALLBACK', false),
  
  // User Agent Rotation
  rotateUserAgent: getEnvBoolean('SCHOLAR_ROTATE_USER_AGENT', true),
  
  // Request Jitter (randomize delays to appear more human)
  enableJitter: getEnvBoolean('SCHOLAR_ENABLE_JITTER', true),
  jitterMaxMs: getEnvNumber('SCHOLAR_JITTER_MAX_MS', 2000),
};

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Update configuration at runtime
 */
export function updateConfig(updates: Partial<ScholarConfig>): void {
  Object.assign(config, updates);
}

/**
 * Get current configuration
 */
export function getConfig(): Readonly<ScholarConfig> {
  return { ...config };
}

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.rateLimitMs < 1000) {
    errors.push('Rate limit should be at least 1000ms to avoid blocking');
  }
  
  if (config.maxRetries < 1) {
    errors.push('Max retries should be at least 1');
  }
  
  if (config.requestTimeout < 5000) {
    errors.push('Request timeout should be at least 5000ms');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export default config;
