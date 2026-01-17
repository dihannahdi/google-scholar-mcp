/**
 * Google Scholar MCP - Tool Handlers
 * Implementation of tool execution logic
 */

import {
  searchPublications,
  searchAuthors,
  getAuthorProfile,
  getCitations,
  generateBibTeX,
} from '../scraper/scholar.js';
import { TOOL_NAMES } from './definitions.js';
import {
  Publication,
  ScholarError,
  ScholarErrorCode,
} from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface SearchPublicationsArgs {
  query: string;
  author?: string;
  yearStart?: number;
  yearEnd?: number;
  numResults?: number;
  sortBy?: 'relevance' | 'date';
}

interface SearchAuthorArgs {
  query: string;
  organization?: string;
  numResults?: number;
}

interface GetAuthorProfileArgs {
  scholarId: string;
}

interface GetCitationsArgs {
  clusterId: string;
  numResults?: number;
  sortBy?: 'relevance' | 'date';
}

interface GenerateBibtexArgs {
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  url?: string;
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle tool execution based on tool name
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case TOOL_NAMES.SEARCH_PUBLICATIONS:
        return await handleSearchPublications(args as unknown as SearchPublicationsArgs);
      
      case TOOL_NAMES.SEARCH_AUTHOR:
        return await handleSearchAuthor(args as unknown as SearchAuthorArgs);
      
      case TOOL_NAMES.GET_AUTHOR_PROFILE:
        return await handleGetAuthorProfile(args as unknown as GetAuthorProfileArgs);
      
      case TOOL_NAMES.GET_CITATIONS:
        return await handleGetCitations(args as unknown as GetCitationsArgs);
      
      case TOOL_NAMES.GENERATE_BIBTEX:
        return handleGenerateBibtex(args as unknown as GenerateBibtexArgs);
      
      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${toolName}`,
          }],
          isError: true,
        };
    }
  } catch (error) {
    return handleError(error);
  }
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Handle search_publications tool
 */
async function handleSearchPublications(args: SearchPublicationsArgs): Promise<ToolResult> {
  const result = await searchPublications({
    query: args.query,
    author: args.author,
    yearStart: args.yearStart,
    yearEnd: args.yearEnd,
    numResults: args.numResults || 10,
    sortBy: args.sortBy || 'relevance',
  });
  
  // Format publications for readable output
  const formattedResults = formatPublicationResults(result.publications, result.query);
  
  return {
    content: [{
      type: 'text',
      text: formattedResults,
    }],
  };
}

/**
 * Handle search_author tool
 */
async function handleSearchAuthor(args: SearchAuthorArgs): Promise<ToolResult> {
  const result = await searchAuthors({
    query: args.query,
    organization: args.organization,
    numResults: args.numResults || 10,
  });
  
  // Format output
  let output = `# Author Search Results for "${args.query}"\n\n`;
  output += `Found ${result.authors.length} authors\n\n`;
  
  result.authors.forEach((author, index) => {
    output += `## ${index + 1}. ${author.name}\n\n`;
    
    if (author.affiliation) {
      output += `**Affiliation:** ${author.affiliation}\n`;
    }
    
    if (author.emailDomain) {
      output += `**Email Domain:** ${author.emailDomain}\n`;
    }
    
    if (author.interests && author.interests.length > 0) {
      output += `**Research Interests:** ${author.interests.join(', ')}\n`;
    }
    
    if (author.citationCount) {
      output += `**Total Citations:** ${author.citationCount.toLocaleString()}\n`;
    }
    
    if (author.scholarId) {
      output += `**Scholar ID:** ${author.scholarId}\n`;
    }
    
    if (author.url) {
      output += `**Profile URL:** ${author.url}\n`;
    }
    
    output += '\n---\n\n';
  });
  
  return {
    content: [{
      type: 'text',
      text: output,
    }],
  };
}

/**
 * Handle get_author_profile tool
 */
async function handleGetAuthorProfile(args: GetAuthorProfileArgs): Promise<ToolResult> {
  const author = await getAuthorProfile(args.scholarId);
  
  // Format detailed profile
  let output = `# Author Profile: ${author.name}\n\n`;
  
  output += `## Basic Information\n\n`;
  if (author.affiliation) output += `**Affiliation:** ${author.affiliation}\n`;
  if (author.emailDomain) output += `**Email Domain:** ${author.emailDomain}\n`;
  if (author.homepage) output += `**Homepage:** ${author.homepage}\n`;
  if (author.interests && author.interests.length > 0) {
    output += `**Research Interests:** ${author.interests.join(', ')}\n`;
  }
  output += `**Scholar ID:** ${author.scholarId}\n`;
  output += `**Profile URL:** ${author.url}\n\n`;
  
  output += `## Citation Metrics\n\n`;
  output += `| Metric | All Time | Last 5 Years |\n`;
  output += `|--------|----------|---------------|\n`;
  output += `| Citations | ${author.citationCount?.toLocaleString() || 'N/A'} | - |\n`;
  output += `| h-index | ${author.hIndex || 'N/A'} | ${author.hIndex5y || 'N/A'} |\n`;
  output += `| i10-index | ${author.i10Index || 'N/A'} | ${author.i10Index5y || 'N/A'} |\n`;
  output += '\n';
  
  if (author.publications && author.publications.length > 0) {
    output += `## Recent Publications (${author.publications.length})\n\n`;
    author.publications.slice(0, 10).forEach((pub, index) => {
      output += `${index + 1}. **${pub.title}**\n`;
      if (pub.authors.length > 0) output += `   Authors: ${pub.authors.join(', ')}\n`;
      if (pub.venue) output += `   Venue: ${pub.venue}`;
      if (pub.year) output += ` (${pub.year})`;
      output += '\n';
      if (pub.citationCount) output += `   Citations: ${pub.citationCount}\n`;
      output += '\n';
    });
  }
  
  if (author.coauthors && author.coauthors.length > 0) {
    output += `## Coauthors\n\n`;
    author.coauthors.slice(0, 10).forEach((coauthor) => {
      output += `- **${coauthor.name}**`;
      if (coauthor.affiliation) output += ` (${coauthor.affiliation})`;
      output += ` - ID: ${coauthor.scholarId}\n`;
    });
    output += '\n';
  }
  
  if (author.citationsByYear && author.citationsByYear.length > 0) {
    output += `## Citations by Year\n\n`;
    output += `| Year | Citations |\n`;
    output += `|------|----------|\n`;
    author.citationsByYear.slice(-10).forEach((yearData) => {
      output += `| ${yearData.year} | ${yearData.citations} |\n`;
    });
    output += '\n';
  }
  
  return {
    content: [{
      type: 'text',
      text: output,
    }],
  };
}

/**
 * Handle get_citations tool
 */
async function handleGetCitations(args: GetCitationsArgs): Promise<ToolResult> {
  const result = await getCitations({
    clusterId: args.clusterId,
    numResults: args.numResults || 10,
    sortBy: args.sortBy || 'relevance',
  });
  
  let output = `# Citations for Cluster ID: ${args.clusterId}\n\n`;
  output += `**Total Citations:** ${result.totalCitations?.toLocaleString() || 'Unknown'}\n`;
  output += `**Showing:** ${result.citations.length} papers\n\n`;
  
  output += formatPublicationResults(result.citations, 'Citations');
  
  if (result.hasMore) {
    output += `\n*More citations available. Use startIndex: ${result.nextStartIndex} to fetch next page.*\n`;
  }
  
  return {
    content: [{
      type: 'text',
      text: output,
    }],
  };
}

/**
 * Handle generate_bibtex tool
 */
function handleGenerateBibtex(args: GenerateBibtexArgs): ToolResult {
  const publication: Publication = {
    title: args.title,
    authors: args.authors,
    year: args.year,
    venue: args.venue,
    url: args.url,
  };
  
  const bibtex = generateBibTeX(publication);
  
  return {
    content: [{
      type: 'text',
      text: `# BibTeX Entry\n\n\`\`\`bibtex\n${bibtex}\n\`\`\``,
    }],
  };
}

// =============================================================================
// Formatting Helpers
// =============================================================================

/**
 * Format publication results into readable markdown
 */
function formatPublicationResults(publications: Publication[], query: string): string {
  let output = `# Publication Search Results\n\n`;
  output += `**Query:** ${query}\n`;
  output += `**Results found:** ${publications.length}\n\n`;
  
  publications.forEach((pub, index) => {
    output += `## ${index + 1}. ${pub.title}\n\n`;
    
    if (pub.authors.length > 0) {
      output += `**Authors:** ${pub.authors.join(', ')}\n`;
    }
    
    if (pub.venue) {
      output += `**Venue:** ${pub.venue}`;
      if (pub.year) output += ` (${pub.year})`;
      output += '\n';
    } else if (pub.year) {
      output += `**Year:** ${pub.year}\n`;
    }
    
    if (pub.abstract) {
      output += `**Abstract:** ${pub.abstract}\n`;
    }
    
    if (pub.citationCount !== undefined) {
      output += `**Citations:** ${pub.citationCount.toLocaleString()}\n`;
    }
    
    if (pub.url) {
      output += `**URL:** ${pub.url}\n`;
    }
    
    if (pub.pdfUrl) {
      output += `**PDF:** ${pub.pdfUrl}\n`;
    }
    
    if (pub.clusterId) {
      output += `**Cluster ID:** ${pub.clusterId} (use with get_citations)\n`;
    }
    
    output += '\n---\n\n';
  });
  
  return output;
}

/**
 * Handle errors and format error response
 */
function handleError(error: unknown): ToolResult {
  if (error instanceof ScholarError) {
    let message = `Error: ${error.message}`;
    
    switch (error.code) {
      case ScholarErrorCode.RATE_LIMITED:
        message += '\n\nGoogle Scholar has rate-limited requests. Please wait a few minutes before trying again.';
        break;
      case ScholarErrorCode.CAPTCHA_REQUIRED:
        message += '\n\nGoogle Scholar is requiring CAPTCHA verification. Try again later.';
        break;
      case ScholarErrorCode.BLOCKED:
        message += '\n\nAccess to Google Scholar has been blocked. Try again later or use a different network.';
        break;
      case ScholarErrorCode.NOT_FOUND:
        message += '\n\nThe requested resource was not found. Please check the ID and try again.';
        break;
      case ScholarErrorCode.INVALID_INPUT:
        message += '\n\nPlease check your input parameters and try again.';
        break;
    }
    
    return {
      content: [{
        type: 'text',
        text: message,
      }],
      isError: true,
    };
  }
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  return {
    content: [{
      type: 'text',
      text: `Error: ${errorMessage}`,
    }],
    isError: true,
  };
}
