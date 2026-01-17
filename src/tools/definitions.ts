/**
 * Google Scholar MCP - Tool Definitions
 * Comprehensive tools for searching and retrieving academic information
 */

import { z } from 'zod';

// =============================================================================
// Tool Schemas
// =============================================================================

/**
 * Schema for search_publications tool
 */
export const searchPublicationsSchema = {
  query: z.string().describe('Search query for finding publications (e.g., "machine learning", "climate change")'),
  author: z.string().optional().describe('Filter results by author name'),
  yearStart: z.number().min(1900).max(new Date().getFullYear()).optional()
    .describe('Filter publications from this year onwards'),
  yearEnd: z.number().min(1900).max(new Date().getFullYear()).optional()
    .describe('Filter publications up to this year'),
  numResults: z.number().min(1).max(20).default(10)
    .describe('Number of results to return (default: 10, max: 20)'),
  sortBy: z.enum(['relevance', 'date']).default('relevance')
    .describe('Sort results by relevance or publication date'),
};

/**
 * Schema for search_author tool
 */
export const searchAuthorSchema = {
  query: z.string().describe('Author name or keywords to search for'),
  organization: z.string().optional()
    .describe('Filter by organization/affiliation (e.g., "Stanford University")'),
  numResults: z.number().min(1).max(20).default(10)
    .describe('Number of results to return (default: 10, max: 20)'),
};

/**
 * Schema for get_author_profile tool
 */
export const getAuthorProfileSchema = {
  scholarId: z.string().describe('Google Scholar author ID (e.g., "JicYPdAAAAAJ")'),
};

/**
 * Schema for get_citations tool
 */
export const getCitationsSchema = {
  clusterId: z.string().describe('Google Scholar cluster ID of the publication'),
  numResults: z.number().min(1).max(20).default(10)
    .describe('Number of citing papers to return (default: 10, max: 20)'),
  sortBy: z.enum(['relevance', 'date']).default('relevance')
    .describe('Sort citations by relevance or date'),
};

/**
 * Schema for get_publication_bibtex tool
 */
export const getPublicationBibtexSchema = {
  title: z.string().describe('Publication title'),
  authors: z.array(z.string()).describe('List of author names'),
  year: z.number().optional().describe('Publication year'),
  venue: z.string().optional().describe('Journal or conference name'),
  url: z.string().optional().describe('Publication URL'),
};

// =============================================================================
// Tool Definitions (MCP format)
// =============================================================================

export const toolDefinitions = [
  {
    name: 'search_publications',
    description: `Search Google Scholar for academic publications, papers, and research articles.
    
Use this tool to:
- Find papers on a specific topic
- Search for publications by a particular author
- Find recent research in a field
- Get publications within a date range

Returns: List of publications with titles, authors, abstracts, citation counts, and links.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query for finding publications',
        },
        author: {
          type: 'string',
          description: 'Filter results by author name (optional)',
        },
        yearStart: {
          type: 'number',
          description: 'Filter publications from this year onwards (optional)',
          minimum: 1900,
          maximum: new Date().getFullYear(),
        },
        yearEnd: {
          type: 'number',
          description: 'Filter publications up to this year (optional)',
          minimum: 1900,
          maximum: new Date().getFullYear(),
        },
        numResults: {
          type: 'number',
          description: 'Number of results to return (default: 10, max: 20)',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date'],
          description: 'Sort by relevance or publication date',
          default: 'relevance',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_author',
    description: `Search for academic researchers and their Google Scholar profiles.
    
Use this tool to:
- Find researchers in a specific field
- Search for authors by name
- Find experts at a particular institution

Returns: List of author profiles with names, affiliations, research interests, and citation metrics.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Author name or research topic keywords',
        },
        organization: {
          type: 'string',
          description: 'Filter by institution/organization (optional)',
        },
        numResults: {
          type: 'number',
          description: 'Number of results to return (default: 10, max: 20)',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_author_profile',
    description: `Get detailed information about a specific Google Scholar author profile.
    
Use this tool to:
- Get an author's complete publication list
- View citation metrics (h-index, i10-index, total citations)
- Find an author's research interests and coauthors
- See citation history over time

Returns: Detailed author profile with publications, metrics, coauthors, and more.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        scholarId: {
          type: 'string',
          description: 'Google Scholar author ID (found in profile URL, e.g., "JicYPdAAAAAJ")',
        },
      },
      required: ['scholarId'],
    },
  },
  {
    name: 'get_citations',
    description: `Get papers that cite a specific publication.
    
Use this tool to:
- Find papers that cite a specific work
- Track how a publication has influenced subsequent research
- Discover related research building on previous findings

Requires the cluster ID from a publication's "Cited by" link.

Returns: List of citing publications with their details.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        clusterId: {
          type: 'string',
          description: 'Google Scholar cluster ID (from citation URL)',
        },
        numResults: {
          type: 'number',
          description: 'Number of citing papers to return (default: 10, max: 20)',
          minimum: 1,
          maximum: 20,
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date'],
          description: 'Sort by relevance or date',
          default: 'relevance',
        },
      },
      required: ['clusterId'],
    },
  },
  {
    name: 'generate_bibtex',
    description: `Generate a BibTeX citation entry for a publication.
    
Use this tool to:
- Create properly formatted BibTeX entries
- Get citation entries for academic papers
- Export citations for use in LaTeX documents

Returns: Formatted BibTeX entry string.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Publication title',
        },
        authors: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of author names',
        },
        year: {
          type: 'number',
          description: 'Publication year',
        },
        venue: {
          type: 'string',
          description: 'Journal or conference name',
        },
        url: {
          type: 'string',
          description: 'Publication URL',
        },
      },
      required: ['title', 'authors'],
    },
  },
];

// =============================================================================
// Tool Names
// =============================================================================

export const TOOL_NAMES = {
  SEARCH_PUBLICATIONS: 'search_publications',
  SEARCH_AUTHOR: 'search_author',
  GET_AUTHOR_PROFILE: 'get_author_profile',
  GET_CITATIONS: 'get_citations',
  GENERATE_BIBTEX: 'generate_bibtex',
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
