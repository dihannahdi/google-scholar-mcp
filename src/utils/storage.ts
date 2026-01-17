/**
 * Google Scholar MCP - Local Paper Storage
 * Download and manage papers locally for offline access
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { config } from '../config/index.js';
import { Publication } from '../types/index.js';
import { getUserAgent } from './helpers.js';

// =============================================================================
// Types
// =============================================================================

export interface StoredPaper {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  abstract?: string;
  citationCount?: number;
  clusterId?: string;
  pdfPath?: string;
  metadataPath: string;
  downloadedAt: string;
  source: string;
}

export interface PaperMetadata extends Publication {
  downloadedAt: string;
  pdfFilename?: string;
}

// =============================================================================
// Storage Management
// =============================================================================

/**
 * Ensure storage directory exists
 */
function ensureStorageDir(): string {
  const storagePath = config.storagePath;
  if (!existsSync(storagePath)) {
    mkdirSync(storagePath, { recursive: true });
  }
  return storagePath;
}

/**
 * Generate a safe filename from paper title
 */
function generatePaperId(title: string, authors: string[]): string {
  const authorPart = authors[0]?.split(' ').pop()?.toLowerCase() || 'unknown';
  const titlePart = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(' ')
    .slice(0, 5)
    .join('_');
  const hash = Buffer.from(title).toString('base64').slice(0, 8);
  return `${authorPart}_${titlePart}_${hash}`;
}

// =============================================================================
// Paper Operations
// =============================================================================

/**
 * Download and store a paper's PDF
 */
export async function downloadPaper(
  publication: Publication
): Promise<StoredPaper> {
  const storagePath = ensureStorageDir();
  const paperId = generatePaperId(publication.title, publication.authors);
  
  // Create paper directory
  const paperDir = join(storagePath, paperId);
  if (!existsSync(paperDir)) {
    mkdirSync(paperDir, { recursive: true });
  }
  
  // Prepare metadata
  const metadata: PaperMetadata = {
    ...publication,
    downloadedAt: new Date().toISOString(),
  };
  
  // Try to download PDF if available
  let pdfPath: string | undefined;
  const pdfUrl = publication.pdfUrl || publication.eprintUrl;
  
  if (pdfUrl) {
    try {
      const response = await axios.get(pdfUrl, {
        headers: {
          'User-Agent': getUserAgent({ rotate: true, userAgents: [] }),
        },
        responseType: 'arraybuffer',
        timeout: 60000,
        maxRedirects: 5,
      });
      
      const pdfFilename = `${paperId}.pdf`;
      pdfPath = join(paperDir, pdfFilename);
      writeFileSync(pdfPath, response.data);
      metadata.pdfFilename = pdfFilename;
    } catch (error) {
      console.error(`Failed to download PDF for "${publication.title}":`, error);
    }
  }
  
  // Save metadata
  const metadataPath = join(paperDir, 'metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  return {
    id: paperId,
    title: publication.title,
    authors: publication.authors,
    year: publication.year,
    venue: publication.venue,
    abstract: publication.abstract,
    citationCount: publication.citationCount,
    clusterId: publication.clusterId,
    pdfPath,
    metadataPath,
    downloadedAt: metadata.downloadedAt,
    source: publication.source || 'UNKNOWN',
  };
}

/**
 * List all stored papers
 */
export function listStoredPapers(): StoredPaper[] {
  const storagePath = config.storagePath;
  
  if (!existsSync(storagePath)) {
    return [];
  }
  
  const papers: StoredPaper[] = [];
  const entries = readdirSync(storagePath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const metadataPath = join(storagePath, entry.name, 'metadata.json');
    if (!existsSync(metadataPath)) continue;
    
    try {
      const metadata: PaperMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      const pdfPath = metadata.pdfFilename 
        ? join(storagePath, entry.name, metadata.pdfFilename)
        : undefined;
      
      papers.push({
        id: entry.name,
        title: metadata.title,
        authors: metadata.authors,
        year: metadata.year,
        venue: metadata.venue,
        abstract: metadata.abstract,
        citationCount: metadata.citationCount,
        clusterId: metadata.clusterId,
        pdfPath: pdfPath && existsSync(pdfPath) ? pdfPath : undefined,
        metadataPath,
        downloadedAt: metadata.downloadedAt,
        source: metadata.source || 'UNKNOWN',
      });
    } catch (error) {
      console.error(`Failed to read metadata for ${entry.name}:`, error);
    }
  }
  
  return papers;
}

/**
 * Get a specific stored paper by ID
 */
export function getStoredPaper(paperId: string): StoredPaper | null {
  const storagePath = config.storagePath;
  const metadataPath = join(storagePath, paperId, 'metadata.json');
  
  if (!existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const metadata: PaperMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const pdfPath = metadata.pdfFilename 
      ? join(storagePath, paperId, metadata.pdfFilename)
      : undefined;
    
    return {
      id: paperId,
      title: metadata.title,
      authors: metadata.authors,
      year: metadata.year,
      venue: metadata.venue,
      abstract: metadata.abstract,
      citationCount: metadata.citationCount,
      clusterId: metadata.clusterId,
      pdfPath: pdfPath && existsSync(pdfPath) ? pdfPath : undefined,
      metadataPath,
      downloadedAt: metadata.downloadedAt,
      source: metadata.source || 'UNKNOWN',
    };
  } catch (error) {
    console.error(`Failed to read paper ${paperId}:`, error);
    return null;
  }
}

/**
 * Read paper content (returns PDF path or metadata)
 */
export function readPaperContent(paperId: string): { 
  metadata: PaperMetadata; 
  pdfPath?: string;
  hasPdf: boolean;
} | null {
  const storagePath = config.storagePath;
  const metadataPath = join(storagePath, paperId, 'metadata.json');
  
  if (!existsSync(metadataPath)) {
    return null;
  }
  
  try {
    const metadata: PaperMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const pdfPath = metadata.pdfFilename 
      ? join(storagePath, paperId, metadata.pdfFilename)
      : undefined;
    
    return {
      metadata,
      pdfPath,
      hasPdf: pdfPath ? existsSync(pdfPath) : false,
    };
  } catch (error) {
    console.error(`Failed to read paper ${paperId}:`, error);
    return null;
  }
}

/**
 * Delete a stored paper
 */
export function deletePaper(paperId: string): boolean {
  const storagePath = config.storagePath;
  const paperDir = join(storagePath, paperId);
  
  if (!existsSync(paperDir)) {
    return false;
  }
  
  try {
    // Delete all files in the directory
    const files = readdirSync(paperDir);
    for (const file of files) {
      unlinkSync(join(paperDir, file));
    }
    // Remove directory (requires it to be empty)
    require('fs').rmdirSync(paperDir);
    return true;
  } catch (error) {
    console.error(`Failed to delete paper ${paperId}:`, error);
    return false;
  }
}

export default {
  downloadPaper,
  listStoredPapers,
  getStoredPaper,
  readPaperContent,
  deletePaper,
};
