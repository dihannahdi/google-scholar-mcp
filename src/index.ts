#!/usr/bin/env node
/**
 * Google Scholar MCP Server
 * A comprehensive Model Context Protocol server for Google Scholar
 * 
 * Features:
 * - Search publications by query, author, year range
 * - Search for academic authors
 * - Get detailed author profiles with metrics
 * - Get citations for publications
 * - Generate BibTeX entries
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { TOOL_NAMES } from './tools/definitions.js';
import { handleToolCall } from './tools/handlers.js';

// =============================================================================
// Server Configuration
// =============================================================================

const SERVER_NAME = 'google-scholar-mcp';
const SERVER_VERSION = '1.0.0';

// =============================================================================
// Create MCP Server
// =============================================================================

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// =============================================================================
// Register Tools
// =============================================================================

// Tool: search_publications
server.tool(
  TOOL_NAMES.SEARCH_PUBLICATIONS,
  'Search Google Scholar for academic publications, papers, and research articles. Use this to find papers on topics, by authors, or within date ranges.',
  {
    query: z.string().describe('Search query for finding publications'),
    author: z.string().optional().describe('Filter results by author name'),
    yearStart: z.number().optional().describe('Filter publications from this year onwards'),
    yearEnd: z.number().optional().describe('Filter publications up to this year'),
    numResults: z.number().min(1).max(20).default(10).describe('Number of results (default: 10, max: 20)'),
    sortBy: z.enum(['relevance', 'date']).default('relevance').describe('Sort by relevance or date'),
  },
  async (args) => {
    const result = await handleToolCall(TOOL_NAMES.SEARCH_PUBLICATIONS, args);
    return {
      content: result.content.map(c => ({
        type: c.type as 'text',
        text: c.text,
      })),
      isError: result.isError,
    };
  }
);

// Tool: search_author
server.tool(
  TOOL_NAMES.SEARCH_AUTHOR,
  'Search for academic researchers and their Google Scholar profiles. Find researchers by name, field, or institution.',
  {
    query: z.string().describe('Author name or research topic keywords'),
    organization: z.string().optional().describe('Filter by institution/organization'),
    numResults: z.number().min(1).max(20).default(10).describe('Number of results (default: 10, max: 20)'),
  },
  async (args) => {
    const result = await handleToolCall(TOOL_NAMES.SEARCH_AUTHOR, args);
    return {
      content: result.content.map(c => ({
        type: c.type as 'text',
        text: c.text,
      })),
      isError: result.isError,
    };
  }
);

// Tool: get_author_profile
server.tool(
  TOOL_NAMES.GET_AUTHOR_PROFILE,
  'Get detailed information about a specific Google Scholar author profile, including publications, citation metrics (h-index, i10-index), and coauthors.',
  {
    scholarId: z.string().describe('Google Scholar author ID (e.g., "JicYPdAAAAAJ")'),
  },
  async (args) => {
    const result = await handleToolCall(TOOL_NAMES.GET_AUTHOR_PROFILE, args);
    return {
      content: result.content.map(c => ({
        type: c.type as 'text',
        text: c.text,
      })),
      isError: result.isError,
    };
  }
);

// Tool: get_citations
server.tool(
  TOOL_NAMES.GET_CITATIONS,
  'Get papers that cite a specific publication. Requires the cluster ID from the publication\'s "Cited by" link.',
  {
    clusterId: z.string().describe('Google Scholar cluster ID'),
    numResults: z.number().min(1).max(20).default(10).describe('Number of citing papers (default: 10, max: 20)'),
    sortBy: z.enum(['relevance', 'date']).default('relevance').describe('Sort by relevance or date'),
  },
  async (args) => {
    const result = await handleToolCall(TOOL_NAMES.GET_CITATIONS, args);
    return {
      content: result.content.map(c => ({
        type: c.type as 'text',
        text: c.text,
      })),
      isError: result.isError,
    };
  }
);

// Tool: generate_bibtex
server.tool(
  TOOL_NAMES.GENERATE_BIBTEX,
  'Generate a BibTeX citation entry for a publication. Useful for creating properly formatted citations for LaTeX documents.',
  {
    title: z.string().describe('Publication title'),
    authors: z.array(z.string()).describe('List of author names'),
    year: z.number().optional().describe('Publication year'),
    venue: z.string().optional().describe('Journal or conference name'),
    url: z.string().optional().describe('Publication URL'),
  },
  async (args) => {
    const result = await handleToolCall(TOOL_NAMES.GENERATE_BIBTEX, args);
    return {
      content: result.content.map(c => ({
        type: c.type as 'text',
        text: c.text,
      })),
      isError: result.isError,
    };
  }
);

// =============================================================================
// Register Prompts
// =============================================================================

server.prompt(
  'literature_review',
  'Generate a literature review search strategy',
  {
    topic: z.string().describe('Research topic for literature review'),
    depth: z.enum(['quick', 'comprehensive']).default('comprehensive').describe('Review depth'),
  },
  async ({ topic, depth }) => {
    const numResults = depth === 'quick' ? 5 : 15;
    
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please help me conduct a ${depth} literature review on the topic: "${topic}"

Suggested approach:
1. First, use search_publications to find recent papers on this topic (last 5 years)
2. Identify key authors from the top-cited papers
3. Use get_author_profile to explore their other relevant work
4. Use get_citations on seminal papers to find follow-up research
5. Summarize the main themes and research gaps

Start by searching for ${numResults} publications on this topic.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  'find_expert',
  'Find an expert researcher in a field',
  {
    field: z.string().describe('Research field or topic'),
    institution: z.string().optional().describe('Preferred institution'),
  },
  async ({ field, institution }) => {
    let searchHint = `the field of "${field}"`;
    if (institution) {
      searchHint += ` at ${institution}`;
    }
    
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please help me find expert researchers in ${searchHint}.

Steps:
1. Use search_author to find researchers in this field
2. For the top candidates, use get_author_profile to see their full citation metrics and publications
3. Recommend the best experts based on:
   - h-index and total citations
   - Relevance of their research interests
   - Recent publication activity
   - Collaboration network (coauthors)

Please identify 3-5 leading experts with a summary of their expertise.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  'citation_analysis',
  'Analyze the impact and citations of a publication',
  {
    clusterId: z.string().describe('Google Scholar cluster ID of the publication'),
  },
  async ({ clusterId }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please analyze the citation impact of publication with cluster ID: ${clusterId}

Analysis steps:
1. Use get_citations to retrieve papers that cite this work
2. Categorize the citing papers by:
   - Research area/topic
   - Publication year (to show citation trend over time)
   - Whether they build upon, validate, or critique the original work
3. Identify the most influential citing papers (highest citations)
4. Summarize how this publication has influenced subsequent research

Please provide a comprehensive citation analysis.`,
          },
        },
      ],
    };
  }
);

// =============================================================================
// Register Resources
// =============================================================================

server.resource(
  'about',
  'scholar://about',
  {
    title: 'About Google Scholar MCP',
    description: 'Information about this MCP server and its capabilities',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [{
      uri: 'scholar://about',
      mimeType: 'text/markdown',
      text: `# Google Scholar MCP Server

**Version:** ${SERVER_VERSION}

## Overview

This MCP server provides comprehensive access to Google Scholar, enabling AI assistants to search for academic publications, find researchers, analyze citations, and more.

## Available Tools

### search_publications
Search for academic papers by topic, author, or date range. Returns titles, authors, abstracts, citation counts, and links.

### search_author
Find researchers by name, field, or institution. Returns profile information including affiliations and research interests.

### get_author_profile
Get detailed author information including:
- Complete publication list
- Citation metrics (h-index, i10-index)
- Coauthors
- Citation history

### get_citations
Find papers that cite a specific publication. Useful for tracking research impact and finding related work.

### generate_bibtex
Generate BibTeX entries for proper academic citations.

## Available Prompts

- **literature_review**: Structured approach to conducting literature reviews
- **find_expert**: Find leading researchers in a specific field
- **citation_analysis**: Analyze the impact of a publication

## Usage Notes

- Rate limiting is built-in to avoid overloading Google Scholar
- Search queries support standard Google Scholar syntax
- Author IDs can be found in Google Scholar profile URLs
- Cluster IDs are available in publication citation links

## Tips

1. Use specific search terms for better results
2. Combine author name with topic for targeted searches
3. Use date filters to find recent or classic papers
4. Check coauthors to discover research networks
`,
    }],
  })
);

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Shutting down Google Scholar MCP server...');
    await server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.error('Shutting down Google Scholar MCP server...');
    await server.close();
    process.exit(0);
  });
  
  // Connect and start server
  await server.connect(transport);
  console.error(`Google Scholar MCP server v${SERVER_VERSION} running on stdio`);
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
