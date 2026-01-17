# Google Scholar MCP Server

[![MCP](https://img.shields.io/badge/MCP-1.0-blue.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive Model Context Protocol (MCP) server for Google Scholar. This server enables AI assistants like Claude to search for academic publications, find researchers, analyze citations, and more.

## 🌟 Features

### Tools

| Tool | Description |
|------|-------------|
| `search_publications` | Search for academic papers by topic, author, or date range |
| `search_author` | Find researchers by name, field, or institution |
| `get_author_profile` | Get detailed author info including h-index, publications, and coauthors |
| `get_citations` | Find papers that cite a specific publication |
| `generate_bibtex` | Generate BibTeX entries for citations |

### Prompts

| Prompt | Description |
|--------|-------------|
| `literature_review` | Structured approach to conducting literature reviews |
| `find_expert` | Find leading researchers in a specific field |
| `citation_analysis` | Analyze the citation impact of a publication |

### Key Advantages

- **Comprehensive Coverage**: Search publications, authors, citations all in one server
- **Rich Metadata**: Get abstracts, citation counts, h-index, coauthors, and more
- **Rate Limiting**: Built-in protection against Google Scholar blocking
- **Error Handling**: Graceful handling of rate limits and CAPTCHAs
- **BibTeX Support**: Generate proper academic citations
- **Prompts Included**: Pre-built workflows for common research tasks

## 📦 Installation

### Via npm (when published)

```bash
npm install -g @anthropic/google-scholar-mcp
```

### From Source

```bash
git clone https://github.com/yourusername/google-scholar-mcp.git
cd google-scholar-mcp
npm install
npm run build
```

## 🚀 Quick Start

### Running the Server

```bash
# If installed globally
google-scholar-mcp

# From source
npm start

# Development mode
npm run dev
```

### Configuration for Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-scholar": {
      "command": "node",
      "args": ["/path/to/google-scholar-mcp/dist/index.js"]
    }
  }
}
```

Or if using npx:

```json
{
  "mcpServers": {
    "google-scholar": {
      "command": "npx",
      "args": ["-y", "@anthropic/google-scholar-mcp"]
    }
  }
}
```

## 📖 Usage Examples

### Search for Publications

```
Search for recent machine learning papers about transformers

Tool: search_publications
Arguments:
  query: "transformer neural network"
  yearStart: 2020
  numResults: 10
  sortBy: "relevance"
```

### Find an Author

```
Find researchers working on quantum computing at MIT

Tool: search_author
Arguments:
  query: "quantum computing"
  organization: "MIT"
  numResults: 5
```

### Get Author Profile

```
Get detailed profile for Geoffrey Hinton

Tool: get_author_profile
Arguments:
  scholarId: "JicYPdAAAAAJ"
```

### Get Citations

```
Find papers citing "Attention Is All You Need"

Tool: get_citations
Arguments:
  clusterId: "4054916225996727837"
  numResults: 10
  sortBy: "date"
```

### Generate BibTeX

```
Create BibTeX for a paper

Tool: generate_bibtex
Arguments:
  title: "Attention Is All You Need"
  authors: ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"]
  year: 2017
  venue: "Advances in Neural Information Processing Systems"
```

## 🔧 API Reference

### search_publications

Search Google Scholar for academic publications.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Search query |
| author | string | No | - | Filter by author name |
| yearStart | number | No | - | Start year for filter |
| yearEnd | number | No | - | End year for filter |
| numResults | number | No | 10 | Number of results (1-20) |
| sortBy | string | No | "relevance" | "relevance" or "date" |

**Returns:**
- List of publications with title, authors, abstract, venue, year, citation count, URLs

### search_author

Search for academic researchers.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | Author name or keywords |
| organization | string | No | - | Filter by institution |
| numResults | number | No | 10 | Number of results (1-20) |

**Returns:**
- List of author profiles with name, affiliation, interests, citation count

### get_author_profile

Get detailed author information.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| scholarId | string | Yes | Google Scholar author ID |

**Returns:**
- Complete profile with publications, h-index, i10-index, coauthors, citation history

### get_citations

Get papers that cite a specific publication.

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| clusterId | string | Yes | - | Google Scholar cluster ID |
| numResults | number | No | 10 | Number of results (1-20) |
| sortBy | string | No | "relevance" | "relevance" or "date" |

**Returns:**
- List of citing publications with details

### generate_bibtex

Generate a BibTeX citation entry.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Publication title |
| authors | string[] | Yes | List of author names |
| year | number | No | Publication year |
| venue | string | No | Journal/conference name |
| url | string | No | Publication URL |

**Returns:**
- Formatted BibTeX entry

## 🛠️ Development

### Project Structure

```
google-scholar-mcp/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── types/
│   │   └── index.ts      # TypeScript type definitions
│   ├── tools/
│   │   ├── definitions.ts # Tool schemas
│   │   ├── handlers.ts    # Tool implementation
│   │   └── index.ts
│   ├── scraper/
│   │   ├── scholar.ts    # Google Scholar scraper
│   │   └── index.ts
│   └── utils/
│       ├── helpers.ts    # Utility functions
│       └── index.ts
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

### Testing

```bash
# Run MCP Inspector for debugging
npx @modelcontextprotocol/inspector node dist/index.js
```

## ⚠️ Limitations

1. **Rate Limiting**: Google Scholar may rate-limit or block requests. The server includes delays and retries, but heavy usage may trigger blocks.

2. **CAPTCHA**: Excessive requests may trigger CAPTCHA challenges. If this happens, wait a few minutes before retrying.

3. **No Official API**: This server scrapes Google Scholar's web interface, which may break if Google changes their HTML structure.

4. **Results Limited**: Maximum 20 results per request to stay within reasonable limits.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the MCP SDK
- [Scholarly](https://github.com/scholarly-python-package/scholarly) for inspiration
- The academic community for making research accessible

## 📬 Support

For issues and questions:
- Open an issue on GitHub
- Check the [MCP documentation](https://modelcontextprotocol.io/)

---

Made with ❤️ for the research community
