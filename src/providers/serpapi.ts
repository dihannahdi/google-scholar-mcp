/**
 * Google Scholar MCP - SerpAPI Provider
 * Reliable fallback using SerpAPI's Google Scholar API
 * https://serpapi.com/google-scholar-api
 */

import axios from 'axios';
import {
  Publication,
  AuthorSnippet,
  PublicationSearchOptions,
  PublicationSearchResult,
  AuthorSearchOptions,
  AuthorSearchResult,
  CitationSearchOptions,
  CitationSearchResult,
  ScholarError,
  ScholarErrorCode,
} from '../types/index.js';
import { config } from '../config/index.js';

const SERPAPI_BASE_URL = 'https://serpapi.com/search.json';

// =============================================================================
// SerpAPI Response Types
// =============================================================================

interface SerpApiOrganicResult {
  position: number;
  title: string;
  result_id: string;
  type?: string;
  link?: string;
  snippet?: string;
  publication_info?: {
    summary?: string;
    authors?: Array<{
      name: string;
      link?: string;
      author_id?: string;
    }>;
  };
  resources?: Array<{
    title: string;
    file_format?: string;
    link: string;
  }>;
  inline_links?: {
    cited_by?: {
      total: number;
      cites_id: string;
      link: string;
    };
    versions?: {
      total: number;
      cluster_id: string;
      link: string;
    };
    related_pages_link?: string;
  };
}

interface SerpApiAuthorResult {
  author_id: string;
  name: string;
  affiliations?: string;
  email?: string;
  cited_by?: number;
  interests?: Array<{ title: string; link: string }>;
  thumbnail?: string;
}

interface SerpApiResponse {
  search_metadata: {
    status: string;
    id: string;
  };
  search_information?: {
    total_results?: number;
    query_displayed?: string;
  };
  organic_results?: SerpApiOrganicResult[];
  profiles?: SerpApiAuthorResult[];
  related_searches?: Array<{ query: string; link: string }>;
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(): string {
  const apiKey = config.serpApiKey;
  if (!apiKey) {
    throw new ScholarError(
      'SerpAPI key not configured. Set SERPAPI_KEY environment variable.',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  return apiKey;
}

function mapSerpApiResultToPublication(result: SerpApiOrganicResult): Publication {
  const authors = result.publication_info?.authors?.map(a => a.name) || [];
  const year = extractYearFromSummary(result.publication_info?.summary);
  
  return {
    title: result.title,
    authors,
    abstract: result.snippet || '',
    year,
    venue: extractVenueFromSummary(result.publication_info?.summary),
    citationCount: result.inline_links?.cited_by?.total || 0,
    url: result.link || '',
    pdfUrl: result.resources?.[0]?.link,
    clusterId: result.inline_links?.versions?.cluster_id || result.result_id,
    citesId: result.inline_links?.cited_by?.cites_id,
    source: 'SERPAPI',
  };
}

function extractYearFromSummary(summary?: string): number | undefined {
  if (!summary) return undefined;
  const match = summary.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : undefined;
}

function extractVenueFromSummary(summary?: string): string {
  if (!summary) return '';
  // Format: "Author1, Author2 - Venue, Year - source"
  const parts = summary.split(' - ');
  if (parts.length >= 2) {
    return parts[1].replace(/,\s*\d{4}.*$/, '').trim();
  }
  return '';
}

// =============================================================================
// SerpAPI Search Functions
// =============================================================================

/**
 * Search publications using SerpAPI
 */
export async function searchPublicationsSerpApi(
  options: PublicationSearchOptions
): Promise<PublicationSearchResult> {
  const apiKey = getApiKey();
  
  const params: Record<string, string | number> = {
    engine: 'google_scholar',
    q: options.query,
    api_key: apiKey,
    hl: 'en',
    num: Math.min(options.numResults || 10, 20),
  };
  
  // Add author filter
  if (options.author) {
    params.q = `author:"${options.author}" ${options.query}`;
  }
  
  // Add year filters
  if (options.yearStart) {
    params.as_ylo = options.yearStart;
  }
  if (options.yearEnd) {
    params.as_yhi = options.yearEnd;
  }
  
  // Add pagination
  if (options.startIndex) {
    params.start = options.startIndex;
  }
  
  // Sort by date if requested
  if (options.sortBy === 'date') {
    params.scisbd = 1; // Sort by date
  }
  
  try {
    const response = await axios.get<SerpApiResponse>(SERPAPI_BASE_URL, {
      params,
      timeout: 30000,
    });
    
    if (response.data.error) {
      throw new ScholarError(
        `SerpAPI error: ${response.data.error}`,
        ScholarErrorCode.NETWORK_ERROR
      );
    }
    
    const publications = (response.data.organic_results || [])
      .map(mapSerpApiResultToPublication);
    
    return {
      query: options.query,
      publications,
      totalResults: response.data.search_information?.total_results,
      hasMore: publications.length >= (options.numResults || 10),
      nextStartIndex: publications.length >= (options.numResults || 10) 
        ? (options.startIndex || 0) + publications.length
        : undefined,
    };
  } catch (error) {
    if (error instanceof ScholarError) throw error;
    
    const axiosError = error as { message: string };
    throw new ScholarError(
      `SerpAPI request failed: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Search authors using SerpAPI
 */
export async function searchAuthorsSerpApi(
  options: AuthorSearchOptions
): Promise<AuthorSearchResult> {
  const apiKey = getApiKey();
  
  let query = options.query;
  if (options.organization) {
    query = `${query} ${options.organization}`;
  }
  
  const params: Record<string, string | number> = {
    engine: 'google_scholar_profiles',
    mauthors: query,
    api_key: apiKey,
    hl: 'en',
  };
  
  try {
    const response = await axios.get<SerpApiResponse>(SERPAPI_BASE_URL, {
      params,
      timeout: 30000,
    });
    
    if (response.data.error) {
      throw new ScholarError(
        `SerpAPI error: ${response.data.error}`,
        ScholarErrorCode.NETWORK_ERROR
      );
    }
    
    const authors: AuthorSnippet[] = (response.data.profiles || []).map(profile => ({
      name: profile.name,
      scholarId: profile.author_id,
      affiliation: profile.affiliations || '',
      interests: profile.interests?.map(i => i.title) || [],
      citationCount: profile.cited_by || 0,
      thumbnailUrl: profile.thumbnail,
    }));
    
    return {
      query: options.query,
      authors: authors.slice(0, options.numResults || 10),
      totalResults: authors.length,
    };
  } catch (error) {
    if (error instanceof ScholarError) throw error;
    
    const axiosError = error as { message: string };
    throw new ScholarError(
      `SerpAPI request failed: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Get citations using SerpAPI
 */
export async function getCitationsSerpApi(
  options: CitationSearchOptions
): Promise<CitationSearchResult> {
  const apiKey = getApiKey();
  
  const params: Record<string, string | number> = {
    engine: 'google_scholar',
    cites: options.clusterId,
    api_key: apiKey,
    hl: 'en',
    num: Math.min(options.numResults || 10, 20),
  };
  
  if (options.startIndex) {
    params.start = options.startIndex;
  }
  
  if (options.sortBy === 'date') {
    params.scisbd = 1;
  }
  
  try {
    const response = await axios.get<SerpApiResponse>(SERPAPI_BASE_URL, {
      params,
      timeout: 30000,
    });
    
    if (response.data.error) {
      throw new ScholarError(
        `SerpAPI error: ${response.data.error}`,
        ScholarErrorCode.NETWORK_ERROR
      );
    }
    
    const citations = (response.data.organic_results || [])
      .map(mapSerpApiResultToPublication);
    
    return {
      citations,
      totalCitations: response.data.search_information?.total_results,
      hasMore: citations.length >= (options.numResults || 10),
      nextStartIndex: citations.length >= (options.numResults || 10)
        ? (options.startIndex || 0) + citations.length
        : undefined,
    };
  } catch (error) {
    if (error instanceof ScholarError) throw error;
    
    const axiosError = error as { message: string };
    throw new ScholarError(
      `SerpAPI request failed: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Get related articles using SerpAPI
 */
export async function getRelatedArticlesSerpApi(
  clusterId: string,
  numResults = 10
): Promise<Publication[]> {
  const apiKey = getApiKey();
  
  const params: Record<string, string | number> = {
    engine: 'google_scholar',
    q: `related:${clusterId}:scholar.google.com/`,
    api_key: apiKey,
    hl: 'en',
    num: Math.min(numResults, 20),
  };
  
  try {
    const response = await axios.get<SerpApiResponse>(SERPAPI_BASE_URL, {
      params,
      timeout: 30000,
    });
    
    if (response.data.error) {
      throw new ScholarError(
        `SerpAPI error: ${response.data.error}`,
        ScholarErrorCode.NETWORK_ERROR
      );
    }
    
    return (response.data.organic_results || [])
      .map(mapSerpApiResultToPublication);
  } catch (error) {
    if (error instanceof ScholarError) throw error;
    
    const axiosError = error as { message: string };
    throw new ScholarError(
      `SerpAPI request failed: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Get all versions of a paper using SerpAPI
 */
export async function getAllVersionsSerpApi(
  clusterId: string,
  numResults = 10
): Promise<Publication[]> {
  const apiKey = getApiKey();
  
  const params: Record<string, string | number> = {
    engine: 'google_scholar',
    cluster: clusterId,
    api_key: apiKey,
    hl: 'en',
    num: Math.min(numResults, 20),
  };
  
  try {
    const response = await axios.get<SerpApiResponse>(SERPAPI_BASE_URL, {
      params,
      timeout: 30000,
    });
    
    if (response.data.error) {
      throw new ScholarError(
        `SerpAPI error: ${response.data.error}`,
        ScholarErrorCode.NETWORK_ERROR
      );
    }
    
    return (response.data.organic_results || [])
      .map(result => ({
        ...mapSerpApiResultToPublication(result),
        source: 'VERSION' as const,
      }));
  } catch (error) {
    if (error instanceof ScholarError) throw error;
    
    const axiosError = error as { message: string };
    throw new ScholarError(
      `SerpAPI request failed: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR
    );
  }
}

/**
 * Check if SerpAPI is available
 */
export function isSerpApiAvailable(): boolean {
  return !!config.serpApiKey && config.useSerpApiFallback;
}

export default {
  searchPublications: searchPublicationsSerpApi,
  searchAuthors: searchAuthorsSerpApi,
  getCitations: getCitationsSerpApi,
  getRelatedArticles: getRelatedArticlesSerpApi,
  getAllVersions: getAllVersionsSerpApi,
  isAvailable: isSerpApiAvailable,
};
