/**
 * Google Scholar MCP - Web Scraper
 * Robust scraping functions for Google Scholar
 * Falls back to SerpAPI when blocked
 */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import {
  Publication,
  Author,
  AuthorSnippet,
  PublicationSearchOptions,
  PublicationSearchResult,
  AuthorSearchOptions,
  AuthorSearchResult,
  CitationSearchOptions,
  CitationSearchResult,
  ScholarError,
  ScholarErrorCode,
  CoAuthor,
  CitationsByYear,
} from '../types/index.js';
import {
  getUserAgent,
  waitForRateLimit,
  getBackoffDelay,
  sleep,
  buildSearchUrl,
  buildAuthorSearchUrl,
  buildAuthorProfileUrl,
  buildCitationUrl,
  buildRelatedUrl,
  buildVersionsUrl,
  buildAdvancedSearchUrl,
  cleanText,
  extractYear,
  extractCitationCount,
  extractClusterId,
  parseAuthors,
  isRateLimited,
  isBlocked,
} from '../utils/helpers.js';
import * as serpapi from '../providers/serpapi.js';

const SCHOLAR_BASE_URL = 'https://scholar.google.com';
const MAX_RETRIES = 3;

// Track if we should use SerpAPI fallback
let useSerpApiFallback = false;

// =============================================================================
// HTTP Client
// =============================================================================

/**
 * Make an HTTP request with rate limiting and retry logic
 */
async function fetchPage(url: string, retryCount = 0): Promise<string> {
  await waitForRateLimit();
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getUserAgent({ rotate: true, userAgents: [] }),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
      timeout: 30000,
      maxRedirects: 5,
    });
    
    const html = response.data as string;
    
    // Check for rate limiting or CAPTCHA
    if (isRateLimited(html)) {
      throw new ScholarError(
        'Rate limited by Google Scholar. Please try again later.',
        ScholarErrorCode.RATE_LIMITED
      );
    }
    
    // Check for blocked access
    if (isBlocked(html)) {
      throw new ScholarError(
        'Access blocked by Google Scholar.',
        ScholarErrorCode.BLOCKED
      );
    }
    
    return html;
  } catch (error) {
    if (error instanceof ScholarError) {
      throw error;
    }
    
    const axiosError = error as AxiosError;
    
    // Retry logic for network errors
    if (retryCount < MAX_RETRIES) {
      const delay = getBackoffDelay(retryCount);
      console.error(`Request failed, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return fetchPage(url, retryCount + 1);
    }
    
    throw new ScholarError(
      `Network error: ${axiosError.message}`,
      ScholarErrorCode.NETWORK_ERROR,
      { originalError: axiosError.message }
    );
  }
}

// =============================================================================
// Publication Search
// =============================================================================

/**
 * Search for publications on Google Scholar
 * Falls back to SerpAPI when direct scraping is blocked
 */
export async function searchPublications(
  options: PublicationSearchOptions
): Promise<PublicationSearchResult> {
  // Check if we should use SerpAPI directly
  if (useSerpApiFallback && serpapi.isSerpApiAvailable()) {
    console.error('[Scholar] Using SerpAPI fallback for search');
    return serpapi.searchPublicationsSerpApi(options);
  }
  
  const { numResults = 10, startIndex = 0 } = options;
  
  // Validate input
  if (!options.query?.trim()) {
    throw new ScholarError(
      'Search query is required',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const publications: Publication[] = [];
  let currentStart = startIndex;
  const resultsPerPage = 10;
  
  try {
    while (publications.length < numResults) {
      const url = buildSearchUrl({
        query: options.query,
        author: options.author,
        yearStart: options.yearStart,
        yearEnd: options.yearEnd,
        start: currentStart,
        sortBy: options.sortBy,
        includePatents: options.includePatents,
      });
      
      const html = await fetchPage(url);
      const $ = cheerio.load(html);
      
      const results = parsePublicationResults($);
      
      if (results.length === 0) break;
      
      publications.push(...results);
      currentStart += resultsPerPage;
      
      // Add delay between pages
      if (publications.length < numResults) {
        await sleep(1000);
      }
    }
  } catch (error) {
    // If blocked and SerpAPI is available, fallback
    if (error instanceof ScholarError && 
        (error.code === ScholarErrorCode.BLOCKED || error.code === ScholarErrorCode.RATE_LIMITED) &&
        serpapi.isSerpApiAvailable()) {
      console.error('[Scholar] Blocked by Google Scholar, switching to SerpAPI fallback');
      useSerpApiFallback = true;
      return serpapi.searchPublicationsSerpApi(options);
    }
    throw error;
  }
  
  return {
    query: options.query,
    filters: {
      author: options.author,
      yearRange: options.yearStart || options.yearEnd
        ? `${options.yearStart || 'any'}-${options.yearEnd || 'any'}`
        : undefined,
      sortBy: options.sortBy,
    },
    publications: publications.slice(0, numResults),
    hasMore: publications.length >= numResults,
    nextStartIndex: currentStart,
  };
}

/**
 * Parse publication results from HTML
 */
function parsePublicationResults($: cheerio.CheerioAPI): Publication[] {
  const publications: Publication[] = [];
  
  $('.gs_r.gs_or.gs_scl').each((_, element) => {
    try {
      const $el = $(element);
      
      // Title and URL
      const titleEl = $el.find('.gs_rt a');
      const title = cleanText(titleEl.text()) || cleanText($el.find('.gs_rt').text());
      const url = titleEl.attr('href');
      
      if (!title) return; // Skip if no title
      
      // Authors, venue, year
      const metaText = cleanText($el.find('.gs_a').text());
      const metaParts = metaText.split(' - ');
      const authors = parseAuthors(metaParts[0] || '');
      const venueYear = metaParts[1] || '';
      const year = extractYear(venueYear);
      const venue = venueYear.replace(/\d{4}/, '').trim().replace(/^,|,$/g, '').trim();
      
      // Abstract/snippet
      const abstract = cleanText($el.find('.gs_rs').text());
      
      // Citation info
      const citedByText = cleanText($el.find('.gs_fl a').filter((_, a) => 
        $(a).text().includes('Cited by')
      ).text());
      const citationCount = extractCitationCount(citedByText);
      
      // Citation URL
      const citedByLink = $el.find('.gs_fl a').filter((_, a) => 
        $(a).text().includes('Cited by')
      ).attr('href');
      const citedByUrl = citedByLink ? `${SCHOLAR_BASE_URL}${citedByLink}` : undefined;
      const clusterId = citedByLink ? extractClusterId(citedByLink) : undefined;
      
      // Related articles URL
      const relatedLink = $el.find('.gs_fl a').filter((_, a) => 
        $(a).text().includes('Related')
      ).attr('href');
      const relatedUrl = relatedLink ? `${SCHOLAR_BASE_URL}${relatedLink}` : undefined;
      
      // All versions
      const versionsLink = $el.find('.gs_fl a').filter((_, a) => 
        $(a).text().includes('versions')
      );
      const versionsText = cleanText(versionsLink.text());
      const versionsCount = versionsText ? parseInt(versionsText.match(/\d+/)?.[0] || '0', 10) : undefined;
      const versionsUrl = versionsLink.attr('href') 
        ? `${SCHOLAR_BASE_URL}${versionsLink.attr('href')}`
        : undefined;
      
      // PDF URL
      const pdfLink = $el.find('.gs_or_ggsm a').attr('href');
      
      // eprint URL (e.g., arxiv link on the right side)
      const eprintUrl = $el.find('.gs_ggs a').attr('href');
      
      publications.push({
        title,
        authors,
        year,
        venue: venue || undefined,
        abstract: abstract || undefined,
        citationCount,
        url: url || undefined,
        pdfUrl: pdfLink || undefined,
        clusterId,
        citedByUrl,
        relatedUrl,
        versionsUrl,
        versionsCount,
        eprintUrl: eprintUrl || undefined,
        source: 'PUBLICATION_SEARCH',
      });
    } catch (err) {
      console.error('Error parsing publication:', err);
    }
  });
  
  return publications;
}

// =============================================================================
// Author Search
// =============================================================================

/**
 * Search for authors on Google Scholar
 */
export async function searchAuthors(
  options: AuthorSearchOptions
): Promise<AuthorSearchResult> {
  if (!options.query?.trim()) {
    throw new ScholarError(
      'Author search query is required',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const url = buildAuthorSearchUrl({
    query: options.query,
    organization: options.organization,
  });
  
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  const authors = parseAuthorSearchResults($);
  
  return {
    query: options.query,
    totalResults: authors.length,
    authors: authors.slice(0, options.numResults || 10),
    hasMore: authors.length >= 10,
  };
}

/**
 * Parse author search results from HTML
 */
function parseAuthorSearchResults($: cheerio.CheerioAPI): AuthorSnippet[] {
  const authors: AuthorSnippet[] = [];
  
  $('.gsc_1usr').each((_, element) => {
    try {
      const $el = $(element);
      
      // Name and profile link
      const nameEl = $el.find('.gs_ai_name a');
      const name = cleanText(nameEl.text());
      const profilePath = nameEl.attr('href');
      
      if (!name) return;
      
      // Extract scholar ID from URL
      const scholarIdMatch = profilePath?.match(/user=([^&]+)/);
      const scholarId = scholarIdMatch ? scholarIdMatch[1] : '';
      
      // Affiliation
      const affiliation = cleanText($el.find('.gs_ai_aff').text());
      
      // Email domain
      const emailDomain = cleanText($el.find('.gs_ai_eml').text());
      
      // Research interests
      const interestsText = cleanText($el.find('.gs_ai_int').text());
      const interests = interestsText ? interestsText.split(',').map(i => i.trim()) : [];
      
      // Citation count
      const citedByText = cleanText($el.find('.gs_ai_cby').text());
      const citationCount = citedByText ? parseInt(citedByText.replace(/\D/g, ''), 10) : undefined;
      
      // Profile image
      const imageUrl = $el.find('.gs_ai_pho img').attr('src');
      
      authors.push({
        scholarId,
        name,
        affiliation: affiliation || undefined,
        emailDomain: emailDomain || undefined,
        interests: interests.length > 0 ? interests : undefined,
        citationCount,
        url: profilePath ? `${SCHOLAR_BASE_URL}${profilePath}` : undefined,
        imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
      });
    } catch (err) {
      console.error('Error parsing author:', err);
    }
  });
  
  return authors;
}

// =============================================================================
// Author Profile
// =============================================================================

/**
 * Get detailed author profile
 */
export async function getAuthorProfile(scholarId: string): Promise<Author> {
  if (!scholarId?.trim()) {
    throw new ScholarError(
      'Scholar ID is required',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const url = buildAuthorProfileUrl(scholarId);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  // Check if profile exists
  if ($('#gsc_prf_in').length === 0) {
    throw new ScholarError(
      `Author profile not found: ${scholarId}`,
      ScholarErrorCode.NOT_FOUND
    );
  }
  
  // Basic info
  const name = cleanText($('#gsc_prf_in').text());
  const affiliation = cleanText($('.gsc_prf_il').first().text());
  const emailDomain = cleanText($('#gsc_prf_ivh').text());
  const homepage = $('#gsc_prf_ivh a').attr('href');
  
  // Interests
  const interests: string[] = [];
  $('#gsc_prf_int a').each((_, el) => {
    const interest = cleanText($(el).text());
    if (interest) interests.push(interest);
  });
  
  // Citation metrics
  const citationCells = $('#gsc_rsb_st td.gsc_rsb_std');
  const citationCount = parseInt(cleanText(citationCells.eq(0).text()).replace(/\D/g, '') || '0', 10);
  // Note: 5-year citation count also available at index 1
  const hIndex = parseInt(cleanText(citationCells.eq(2).text()).replace(/\D/g, '') || '0', 10);
  const hIndex5y = parseInt(cleanText(citationCells.eq(3).text()).replace(/\D/g, '') || '0', 10);
  const i10Index = parseInt(cleanText(citationCells.eq(4).text()).replace(/\D/g, '') || '0', 10);
  const i10Index5y = parseInt(cleanText(citationCells.eq(5).text()).replace(/\D/g, '') || '0', 10);
  
  // Publications
  const publications: Publication[] = [];
  $('#gsc_a_b .gsc_a_tr').each((_, element) => {
    try {
      const $el = $(element);
      const titleEl = $el.find('.gsc_a_at');
      const title = cleanText(titleEl.text());
      const pubUrl = titleEl.attr('href');
      
      const authorVenue = $el.find('.gs_gray');
      const authors = parseAuthors(cleanText(authorVenue.eq(0).text()));
      const venueYear = cleanText(authorVenue.eq(1).text());
      const year = extractYear(venueYear);
      const venue = venueYear.replace(/\d{4}/, '').replace(/,/g, '').trim();
      
      const citations = parseInt($el.find('.gsc_a_c a').text() || '0', 10);
      
      if (title) {
        publications.push({
          title,
          authors,
          year,
          venue: venue || undefined,
          citationCount: citations || undefined,
          url: pubUrl ? `${SCHOLAR_BASE_URL}${pubUrl}` : undefined,
          source: 'AUTHOR_PROFILE',
        });
      }
    } catch (err) {
      console.error('Error parsing publication:', err);
    }
  });
  
  // Coauthors
  const coauthors: CoAuthor[] = [];
  $('#gsc_rsb_co .gsc_rsb_a').each((_, element) => {
    try {
      const $el = $(element);
      const linkEl = $el.find('a');
      const coauthorName = cleanText(linkEl.text());
      const coauthorUrl = linkEl.attr('href');
      const coauthorIdMatch = coauthorUrl?.match(/user=([^&]+)/);
      const coauthorAffil = cleanText($el.find('.gsc_rsb_a_ext').text());
      
      if (coauthorName && coauthorIdMatch) {
        coauthors.push({
          scholarId: coauthorIdMatch[1],
          name: coauthorName,
          affiliation: coauthorAffil || undefined,
        });
      }
    } catch (err) {
      console.error('Error parsing coauthor:', err);
    }
  });
  
  // Citations by year (from the graph)
  const citationsByYear: CitationsByYear[] = [];
  $('.gsc_md_hist_b .gsc_g_t').each((i, element) => {
    const yearText = cleanText($(element).text());
    const year = parseInt(yearText, 10);
    const barEl = $('.gsc_md_hist_b .gsc_g_al').eq(i);
    const citations = parseInt(cleanText(barEl.text()) || '0', 10);
    
    if (!isNaN(year)) {
      citationsByYear.push({ year, citations });
    }
  });
  
  // Profile image
  const imageUrl = $('#gsc_prf_pup-img').attr('src');
  
  return {
    scholarId,
    name,
    affiliation: affiliation || undefined,
    emailDomain: emailDomain || undefined,
    interests: interests.length > 0 ? interests : undefined,
    citationCount: citationCount || undefined,
    hIndex: hIndex || undefined,
    hIndex5y: hIndex5y || undefined,
    i10Index: i10Index || undefined,
    i10Index5y: i10Index5y || undefined,
    url: url,
    imageUrl: imageUrl?.startsWith('http') ? imageUrl : undefined,
    homepage: homepage || undefined,
    publications,
    coauthors: coauthors.length > 0 ? coauthors : undefined,
    citationsByYear: citationsByYear.length > 0 ? citationsByYear : undefined,
  };
}

// =============================================================================
// Citations
// =============================================================================

/**
 * Get papers that cite a specific publication
 */
export async function getCitations(
  options: CitationSearchOptions
): Promise<CitationSearchResult> {
  if (!options.clusterId?.trim()) {
    throw new ScholarError(
      'Cluster ID is required for citation search',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const { numResults = 10, startIndex = 0 } = options;
  const citations: Publication[] = [];
  let currentStart = startIndex;
  const resultsPerPage = 10;
  
  while (citations.length < numResults) {
    const url = buildCitationUrl({
      clusterId: options.clusterId,
      start: currentStart,
      sortBy: options.sortBy,
    });
    
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    // Parse citing publications
    const results = parsePublicationResults($);
    results.forEach(pub => {
      pub.source = 'CITATION';
    });
    
    if (results.length === 0) break;
    
    citations.push(...results);
    currentStart += resultsPerPage;
    
    if (citations.length < numResults) {
      await sleep(1000);
    }
  }
  
  // Extract total citation count from page
  const totalCitationsMatch = cheerio.load(await fetchPage(buildCitationUrl({ clusterId: options.clusterId })))
    ('#gs_ab_md .gs_ab_mdw').text().match(/About ([\d,]+) results/);
  const totalCitations = totalCitationsMatch 
    ? parseInt(totalCitationsMatch[1].replace(/,/g, ''), 10) 
    : citations.length;
  
  return {
    originalPublication: {
      title: '', // Would need additional fetch to get this
      clusterId: options.clusterId,
    },
    totalCitations,
    citations: citations.slice(0, numResults),
    hasMore: citations.length >= numResults,
    nextStartIndex: currentStart,
  };
}

// =============================================================================
// Export BibTeX
// =============================================================================

/**
 * Get BibTeX for a publication (requires publication URL)
 * Note: This is a simplified version - full BibTeX may require additional API calls
 */
export function generateBibTeX(publication: Publication): string {
  const authors = publication.authors.join(' and ');
  const key = publication.authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
  const year = publication.year || 'n.d.';
  const citationKey = `${key}${year}`;
  
  let bibtex = `@article{${citationKey},\n`;
  bibtex += `  title = {${publication.title}},\n`;
  bibtex += `  author = {${authors}},\n`;
  
  if (publication.year) {
    bibtex += `  year = {${publication.year}},\n`;
  }
  
  if (publication.venue) {
    bibtex += `  journal = {${publication.venue}},\n`;
  }
  
  if (publication.url) {
    bibtex += `  url = {${publication.url}},\n`;
  }
  
  bibtex += `}`;
  
  return bibtex;
}

// =============================================================================
// Related Articles
// =============================================================================

/**
 * Get articles related to a specific publication
 */
export async function getRelatedArticles(
  clusterId: string,
  numResults = 10
): Promise<Publication[]> {
  if (!clusterId?.trim()) {
    throw new ScholarError(
      'Cluster ID is required for finding related articles',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const url = buildRelatedUrl(clusterId);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  const publications = parsePublicationResults($);
  publications.forEach(pub => {
    pub.source = 'RELATED';
  });
  
  return publications.slice(0, numResults);
}

// =============================================================================
// All Versions
// =============================================================================

/**
 * Get all versions/variants of a publication
 */
export async function getAllVersions(
  clusterId: string
): Promise<Publication[]> {
  if (!clusterId?.trim()) {
    throw new ScholarError(
      'Cluster ID is required for finding all versions',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const url = buildVersionsUrl(clusterId);
  const html = await fetchPage(url);
  const $ = cheerio.load(html);
  
  const publications = parsePublicationResults($);
  publications.forEach(pub => {
    pub.source = 'VERSION';
    pub.clusterId = clusterId;
  });
  
  return publications;
}

// =============================================================================
// Advanced Search
// =============================================================================

export interface AdvancedSearchOptions {
  query: string;
  author?: string;
  source?: string;
  yearStart?: number;
  yearEnd?: number;
  language?: string;
  includePatents?: boolean;
  reviewArticlesOnly?: boolean;
  numResults?: number;
  sortBy?: 'relevance' | 'date';
}

/**
 * Perform an advanced search with full Google Scholar parameters
 */
export async function advancedSearch(
  options: AdvancedSearchOptions
): Promise<PublicationSearchResult> {
  if (!options.query?.trim()) {
    throw new ScholarError(
      'Search query is required',
      ScholarErrorCode.INVALID_INPUT
    );
  }
  
  const { numResults = 10 } = options;
  const publications: Publication[] = [];
  let currentStart = 0;
  const resultsPerPage = 10;
  
  while (publications.length < numResults) {
    const url = buildAdvancedSearchUrl({
      query: options.query,
      author: options.author,
      source: options.source,
      yearStart: options.yearStart,
      yearEnd: options.yearEnd,
      language: options.language,
      includePatents: options.includePatents,
      reviewArticlesOnly: options.reviewArticlesOnly,
      start: currentStart,
      sortBy: options.sortBy,
    });
    
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    const results = parsePublicationResults($);
    results.forEach(pub => {
      pub.source = 'ADVANCED_SEARCH';
    });
    
    if (results.length === 0) break;
    
    publications.push(...results);
    currentStart += resultsPerPage;
    
    if (publications.length < numResults) {
      await sleep(1000);
    }
  }
  
  return {
    query: options.query,
    filters: {
      author: options.author,
      source: options.source,
      yearRange: options.yearStart || options.yearEnd
        ? `${options.yearStart || 'any'}-${options.yearEnd || 'any'}`
        : undefined,
      language: options.language,
      includePatents: options.includePatents,
      reviewArticlesOnly: options.reviewArticlesOnly,
      sortBy: options.sortBy,
    },
    publications: publications.slice(0, numResults),
    hasMore: publications.length >= numResults,
    nextStartIndex: currentStart,
  };
}
