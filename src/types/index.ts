/**
 * Google Scholar MCP - Type Definitions
 * Comprehensive types for publications, authors, citations, and search results
 */

// =============================================================================
// Publication Types
// =============================================================================

/**
 * Represents a publication/paper from Google Scholar
 */
export interface Publication {
  /** Unique identifier (if available) */
  id?: string;
  /** Publication title */
  title: string;
  /** List of authors */
  authors: string[];
  /** Publication year */
  year?: number;
  /** Venue (journal, conference, etc.) */
  venue?: string;
  /** Publisher name */
  publisher?: string;
  /** Abstract or snippet */
  abstract?: string;
  /** Number of citations */
  citationCount?: number;
  /** Link to the publication page */
  url?: string;
  /** Link to PDF if available */
  pdfUrl?: string;
  /** Google Scholar cluster ID */
  clusterId?: string;
  /** Link to citing papers */
  citedByUrl?: string;
  /** Link to related articles */
  relatedUrl?: string;
  /** All versions link */
  versionsUrl?: string;
  /** Google Scholar cites ID (for citation queries) */
  citesId?: string;
  /** Number of versions */
  versionsCount?: number;
  /** eprint URL (e.g., arXiv) */
  eprintUrl?: string;
  /** Source of the result */
  source?: 'PUBLICATION_SEARCH' | 'AUTHOR_PROFILE' | 'CITATION' | 'RELATED' | 'VERSION' | 'ADVANCED_SEARCH' | 'SERPAPI';
}

/**
 * BibTeX entry for a publication
 */
export interface BibTeXEntry {
  entryType: string;
  citationKey: string;
  title: string;
  author: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  url?: string;
}

// =============================================================================
// Author Types
// =============================================================================

/**
 * Represents an author profile from Google Scholar
 */
export interface Author {
  /** Google Scholar author ID */
  scholarId: string;
  /** Author's full name */
  name: string;
  /** Current affiliation */
  affiliation?: string;
  /** Verified email domain */
  emailDomain?: string;
  /** Research interests/topics */
  interests?: string[];
  /** Total citation count */
  citationCount?: number;
  /** h-index */
  hIndex?: number;
  /** h-index since a specific year (e.g., last 5 years) */
  hIndex5y?: number;
  /** i10-index */
  i10Index?: number;
  /** i10-index since a specific year */
  i10Index5y?: number;
  /** Profile URL */
  url?: string;
  /** Profile picture URL */
  imageUrl?: string;
  /** Homepage URL */
  homepage?: string;
  /** List of publications */
  publications?: Publication[];
  /** List of coauthors */
  coauthors?: CoAuthor[];
  /** Citation history by year */
  citationsByYear?: CitationsByYear[];
}

/**
 * Brief author info for search results
 */
export interface AuthorSnippet {
  /** Google Scholar author ID */
  scholarId: string;
  /** Author's name */
  name: string;
  /** Affiliation */
  affiliation?: string;
  /** Email domain */
  emailDomain?: string;
  /** Research interests */
  interests?: string[];
  /** Total citations */
  citationCount?: number;
  /** Profile URL */
  url?: string;
  /** Profile image URL */
  imageUrl?: string;
}

/**
 * Coauthor information
 */
export interface CoAuthor {
  scholarId: string;
  name: string;
  affiliation?: string;
}

/**
 * Citations by year data
 */
export interface CitationsByYear {
  year: number;
  citations: number;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Options for searching publications
 */
export interface PublicationSearchOptions {
  /** Search query string */
  query: string;
  /** Filter by author name */
  author?: string;
  /** Start year for date range filter */
  yearStart?: number;
  /** End year for date range filter */
  yearEnd?: number;
  /** Number of results to return (default: 10, max: 20) */
  numResults?: number;
  /** Starting offset for pagination */
  startIndex?: number;
  /** Sort by: 'relevance' or 'date' */
  sortBy?: 'relevance' | 'date';
  /** Include patents in results */
  includePatents?: boolean;
  /** Include citations in results */
  includeCitations?: boolean;
  /** Language filter (ISO 639-1 code) */
  language?: string;
}

/**
 * Options for searching authors
 */
export interface AuthorSearchOptions {
  /** Author name or keywords */
  query: string;
  /** Filter by organization/affiliation */
  organization?: string;
  /** Number of results to return */
  numResults?: number;
}

/**
 * Options for getting citations
 */
export interface CitationSearchOptions {
  /** Google Scholar cluster ID of the publication */
  clusterId: string;
  /** Number of results to return */
  numResults?: number;
  /** Starting offset for pagination */
  startIndex?: number;
  /** Sort by: 'relevance' or 'date' */
  sortBy?: 'relevance' | 'date';
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Publication search response
 */
export interface PublicationSearchResult {
  /** Search query used */
  query: string;
  /** Total results found (estimated) */
  totalResults?: number;
  /** Search filters applied */
  filters?: {
    author?: string;
    source?: string;
    yearRange?: string;
    language?: string;
    includePatents?: boolean;
    reviewArticlesOnly?: boolean;
    sortBy?: string;
  };
  /** List of publications */
  publications: Publication[];
  /** Whether there are more results */
  hasMore?: boolean;
  /** Next page start index */
  nextStartIndex?: number;
}

/**
 * Author search response
 */
export interface AuthorSearchResult {
  /** Search query used */
  query: string;
  /** Total results found */
  totalResults?: number;
  /** List of authors */
  authors: AuthorSnippet[];
  /** Whether there are more results */
  hasMore?: boolean;
}

/**
 * Citation search response
 */
export interface CitationSearchResult {
  /** Publication that was cited */
  originalPublication?: {
    title: string;
    clusterId: string;
  };
  /** Total citation count */
  totalCitations?: number;
  /** List of citing publications */
  citations: Publication[];
  /** Whether there are more results */
  hasMore?: boolean;
  /** Next page start index */
  nextStartIndex?: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom error for Google Scholar operations
 */
export class ScholarError extends Error {
  constructor(
    message: string,
    public code: ScholarErrorCode,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ScholarError';
  }
}

/**
 * Error codes for Scholar operations
 */
export enum ScholarErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  CAPTCHA_REQUIRED = 'CAPTCHA_REQUIRED',
  NOT_FOUND = 'NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  BLOCKED = 'BLOCKED',
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  /** Minimum delay between requests in ms */
  minDelay: number;
  /** Maximum delay between requests in ms */
  maxDelay: number;
  /** Maximum retries on failure */
  maxRetries: number;
  /** Delay multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * User agent configuration
 */
export interface UserAgentConfig {
  /** List of user agents to rotate through */
  userAgents: string[];
  /** Whether to rotate user agents */
  rotate: boolean;
}
